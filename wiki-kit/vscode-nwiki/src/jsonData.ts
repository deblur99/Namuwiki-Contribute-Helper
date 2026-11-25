import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/** `import Name from "….json"` or legacy `import("….json")` */
const IMPORT_JSON_FROM_RE =
  /\bimport\s+([A-Za-z_][\w]*)\s+from\s+(?:"([^"]+\.json)"|'([^']+\.json)')/gi;
const IMPORT_JSON_CALL_RE =
  /\bimport\s*\(\s*(?:"([^"]+\.json)"|'([^']+\.json)')\s*\)/gi;

export type JsonNamespaceMap = Map<string, Record<string, string>>;

function tryLoadFlatJson(
  resolved: string
): Record<string, string> | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v !== "string") return undefined;
      flat[k] = v;
    }
    return flat;
  } catch {
    return undefined;
  }
}

/** Collect JSON import namespaces (binding name or stem → flat strings). */
export function loadJsonNamespaces(
  document: vscode.TextDocument
): JsonNamespaceMap {
  const text = document.getText();
  const baseDir = path.dirname(document.uri.fsPath);
  const out: JsonNamespaceMap = new Map();

  const add = (ns: string, rel: string) => {
    if (out.has(ns)) return;
    const resolved = path.isAbsolute(rel) ? rel : path.resolve(baseDir, rel);
    const flat = tryLoadFlatJson(resolved);
    if (flat) out.set(ns, flat);
  };

  let m: RegExpExecArray | null;
  IMPORT_JSON_FROM_RE.lastIndex = 0;
  while ((m = IMPORT_JSON_FROM_RE.exec(text))) {
    const ns = m[1];
    const rel = m[2] || m[3];
    if (ns && rel) add(ns, rel);
  }
  IMPORT_JSON_CALL_RE.lastIndex = 0;
  while ((m = IMPORT_JSON_CALL_RE.exec(text))) {
    const rel = m[1] || m[2];
    if (!rel) continue;
    const resolved = path.isAbsolute(rel) ? rel : path.resolve(baseDir, rel);
    add(path.basename(resolved, path.extname(resolved)), rel);
  }

  const ds =
    out.get("DesignSystem") ||
    out.get("design-system") ||
    out.get("designSystem");
  if (ds) {
    out.set("DesignSystem", ds);
    out.set("design-system", ds);
    out.set("designSystem", ds);
  }

  return out;
}

/** Failed JSON import ranges for diagnostics. */
export function jsonImportDiagnostics(
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const text = document.getText();
  const baseDir = path.dirname(document.uri.fsPath);
  const diags: vscode.Diagnostic[] = [];

  const check = (rel: string, index: number, length: number) => {
    const resolved = path.isAbsolute(rel) ? rel : path.resolve(baseDir, rel);
    // Missing path is reported by importPathDiagnostics.
    if (!fs.existsSync(resolved)) return;
    let message: string | undefined;
    try {
      const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        message = `import from "${rel}": JSON root must be an object`;
      } else {
        for (const [k, v] of Object.entries(
          raw as Record<string, unknown>
        )) {
          if (typeof v !== "string") {
            message = `import from "${rel}": value for "${k}" must be a string`;
            break;
          }
        }
      }
    } catch (e) {
      message = `cannot load import from "${rel}": ${
        e instanceof Error ? e.message : String(e)
      }`;
    }
    if (!message) return;
    const d = new vscode.Diagnostic(
      new vscode.Range(
        document.positionAt(index),
        document.positionAt(index + length)
      ),
      message,
      vscode.DiagnosticSeverity.Error
    );
    d.source = "nwiki";
    d.code = "json-import";
    diags.push(d);
  };

  let m: RegExpExecArray | null;
  IMPORT_JSON_FROM_RE.lastIndex = 0;
  while ((m = IMPORT_JSON_FROM_RE.exec(text))) {
    const rel = m[2] || m[3];
    if (rel) check(rel, m.index, m[0].length);
  }
  IMPORT_JSON_CALL_RE.lastIndex = 0;
  while ((m = IMPORT_JSON_CALL_RE.exec(text))) {
    const rel = m[1] || m[2];
    if (rel) check(rel, m.index, m[0].length);
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
