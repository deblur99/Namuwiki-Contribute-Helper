import { spawn } from "child_process";
import * as vscode from "vscode";
import { closestTag, isKnownTag } from "./catalog";
import { findWikiKitRoot } from "./paths";

export const collection = vscode.languages.createDiagnosticCollection("nwiki");

let timer: NodeJS.Timeout | undefined;

export function scheduleDiagnose(doc: vscode.TextDocument): void {
  if (doc.languageId !== "nwiki") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void diagnose(doc);
  }, 300);
}

export async function diagnose(doc: vscode.TextDocument): Promise<void> {
  const diagnostics: vscode.Diagnostic[] = [];
  const text = doc.getText();

  const imported = collectImportedTags(text);

  // Lightweight unknown-tag scan (built-ins + import(...))
  const tagRe = /<\/?([A-Za-z_][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text))) {
    const name = m[1];
    if (["script", "template"].includes(name)) continue;
    if (isKnownTag(name) || imported.has(name)) continue;
    const start = doc.positionAt(m.index + (m[0].startsWith("</") ? 2 : 1));
    const end = doc.positionAt(m.index + m[0].length);
    const hint = closestTag(name);
    const msg = hint
      ? `Unknown tag <${name}>. Did you mean <${hint}>?`
      : `Unknown tag <${name}>`;
    const d = new vscode.Diagnostic(
      new vscode.Range(start, end),
      msg,
      vscode.DiagnosticSeverity.Error
    );
    d.code = hint ? `unknown-tag:${hint}` : "unknown-tag";
    d.source = "nwiki";
    diagnostics.push(d);
  }

  // delimeter typo
  const typoRe = /\bdelimeter\b/g;
  while ((m = typoRe.exec(text))) {
    const start = doc.positionAt(m.index);
    const end = doc.positionAt(m.index + m[0].length);
    const d = new vscode.Diagnostic(
      new vscode.Range(start, end),
      "Unknown attribute 'delimeter'. Did you mean 'delimiter'?",
      vscode.DiagnosticSeverity.Error
    );
    d.code = "typo-delimiter";
    d.source = "nwiki";
    diagnostics.push(d);
  }

  // Parser-backed diagnostics
  const parserDiags = await runParserDiagnostics(doc);
  diagnostics.push(...parserDiags);

  collection.set(doc.uri, diagnostics);
}

async function runParserDiagnostics(
  doc: vscode.TextDocument
): Promise<vscode.Diagnostic[]> {
  const root = findWikiKitRoot(doc.uri.fsPath);
  if (!root) return [];

  const python = vscode.workspace
    .getConfiguration("nwiki")
    .get<string>("pythonPath", "python3");

  const code = `
import sys
sys.path.insert(0, ${JSON.stringify(root)})
from engine.nwiki.parser import parse_document
from engine.nwiki.errors import NwikiError
from engine.nwiki.validate import validate_document
from engine.nwiki.resolve import resolve_imports
text = sys.stdin.read()
try:
    doc = parse_document(text, path=${JSON.stringify(doc.uri.fsPath)})
    resolved = resolve_imports(doc)
    validate_document(resolved)
except NwikiError as e:
    idx = e.index if e.index is not None else 0
    print(f"{idx}\\t{e}")
    sys.exit(2)
except Exception as e:
    print(f"0\\t{e}")
    sys.exit(2)
`;

  return new Promise((resolve) => {
    const child = spawn(python, ["-c", code], {
      cwd: root,
      env: process.env,
    });
    let stderr = "";
    let stdout = "";
    let settled = false;
    const finish = (diags: vscode.Diagnostic[]) => {
      if (settled) return;
      settled = true;
      resolve(diags);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish([]);
    }, 15_000);
    child.stdin.write(doc.getText());
    child.stdin.end();
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", () => {
      clearTimeout(timer);
      finish([]);
    });
    child.on("close", (exit) => {
      clearTimeout(timer);
      if (exit === 0) {
        finish([]);
        return;
      }
      const line = (stdout || stderr).trim().split("\n")[0] || "parse error";
      const tab = line.indexOf("\t");
      let index = 0;
      let message = line;
      if (tab >= 0) {
        index = parseInt(line.slice(0, tab), 10) || 0;
        message = line.slice(tab + 1).replace(/\s*\(at \d+\)\s*$/, "");
      }
      const pos = doc.positionAt(
        Math.min(Math.max(index, 0), doc.getText().length)
      );
      const end = doc.positionAt(
        Math.min(pos.character + 1 + doc.offsetAt(pos), doc.getText().length)
      );
      // underline ~20 chars or to EOL
      const lineEnd = doc.lineAt(pos.line).range.end;
      const range = new vscode.Range(
        pos,
        end.isAfter(lineEnd) ? lineEnd : end.translate(0, 12)
      );
      const d = new vscode.Diagnostic(
        range,
        message,
        vscode.DiagnosticSeverity.Error
      );
      d.source = "nwiki";
      d.code = "parse-error";
      finish([d]);
    });
  });
}

/** Names from top-level import(Ident) / import("Ident") in this file. */
export function collectImportedTags(text: string): Set<string> {
  const names = new Set<string>();
  const re = /\bimport\s*\(\s*(?:([A-Za-z_][\w]*)|"([^"]+)"|'([^']+)')\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const name = m[1] || m[2] || m[3];
    if (name) names.add(name);
  }
  return names;
}

export function clearDiagnostics(uri: vscode.Uri): void {
  collection.delete(uri);
}
