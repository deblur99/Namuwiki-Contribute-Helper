import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const IMPORT_JSON_RE =
  /\bimport\s*\(\s*(?:"([^"]+\.json)"|'([^']+\.json)')\s*\)/gi;

export type JsonNamespaceMap = Map<string, Record<string, string>>;

/** Collect successfully loaded import("….json") namespaces (stem → flat strings). */
export function loadJsonNamespaces(
  document: vscode.TextDocument
): JsonNamespaceMap {
  const text = document.getText();
  const baseDir = path.dirname(document.uri.fsPath);
  const out: JsonNamespaceMap = new Map();

  let m: RegExpExecArray | null;
  IMPORT_JSON_RE.lastIndex = 0;
  while ((m = IMPORT_JSON_RE.exec(text))) {
    const rel = m[1] || m[2];
    if (!rel) continue;
    const resolved = path.isAbsolute(rel)
      ? rel
      : path.resolve(baseDir, rel);
    const stem = path.basename(resolved, path.extname(resolved));
    if (out.has(stem)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const flat: Record<string, string> = {};
      let ok = true;
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v !== "string") {
          ok = false;
          break;
        }
        flat[k] = v;
      }
      if (ok) out.set(stem, flat);
    } catch {
      // load failed → no completions for this ns
    }
  }
  return out;
}

/** Failed import("….json") ranges for diagnostics. */
export function jsonImportDiagnostics(
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const text = document.getText();
  const baseDir = path.dirname(document.uri.fsPath);
  const diags: vscode.Diagnostic[] = [];
  let m: RegExpExecArray | null;
  IMPORT_JSON_RE.lastIndex = 0;
  while ((m = IMPORT_JSON_RE.exec(text))) {
    const rel = m[1] || m[2];
    if (!rel) continue;
    const resolved = path.isAbsolute(rel)
      ? rel
      : path.resolve(baseDir, rel);
    let message: string | undefined;
    try {
      if (!fs.existsSync(resolved)) {
        message = `cannot load import("${rel}"): file not found`;
      } else {
        const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          message = `import("${rel}"): JSON root must be an object`;
        } else {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof v !== "string") {
              message = `import("${rel}"): value for "${k}" must be a string`;
              break;
            }
          }
        }
      }
    } catch (e) {
      message = `cannot load import("${rel}"): ${e instanceof Error ? e.message : String(e)}`;
    }
    if (!message) continue;
    const start = document.positionAt(m.index);
    const end = document.positionAt(m.index + m[0].length);
    const d = new vscode.Diagnostic(
      new vscode.Range(start, end),
      message,
      vscode.DiagnosticSeverity.Error
    );
    d.source = "nwiki";
    d.code = "json-import";
    diags.push(d);
  }
  return diags;
}

/** Completion items for `ns.` / `${ns.` when namespace loaded. */
export function jsonKeyCompletions(
  namespaces: JsonNamespaceMap,
  ns: string
): vscode.CompletionItem[] {
  const data = namespaces.get(ns);
  if (!data) return [];
  return Object.keys(data).map((key) => {
    const item = new vscode.CompletionItem(
      key,
      vscode.CompletionItemKind.Field
    );
    item.detail = data[key];
    item.insertText = key;
    item.documentation = new vscode.MarkdownString(
      `\`${ns}.${key}\` = \`${data[key]}\``
    );
    return item;
  });
}
