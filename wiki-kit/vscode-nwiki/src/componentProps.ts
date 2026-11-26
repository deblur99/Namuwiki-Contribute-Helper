import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  formatPropItem,
  parsePropsBody,
  PropInfo,
  sortPropsRequiredFirst,
} from "./propsSyntax";

export type { PropInfo };
export { formatPropItem, parsePropsBody, sortPropsRequiredFirst };

const IMPORT_NWIKI_FROM_RE =
  /\bimport\s+([A-Za-z_][\w]*)\s+from\s+(?:"([^"]+\.nwiki)"|'([^']+\.nwiki)')/gi;
const IMPORT_LEGACY_RE =
  /\bimport\s*\(\s*(?:([A-Za-z_][\w]*)|"([^"]+)"|'([^']+)')\s*\)/g;
const PROPS_BLOCK_RE = /\bprops\s*\{([^}]*)\}/s;

/** Tag name → props from imported component files. */
export function loadImportedComponentProps(
  document: vscode.TextDocument
): Map<string, PropInfo[]> {
  const text = document.getText();
  const baseDir = path.dirname(document.uri.fsPath);
  const out = new Map<string, PropInfo[]>();

  const addFromFile = (tag: string, filePath: string) => {
    if (out.has(tag)) return;
    try {
      if (!fs.existsSync(filePath)) return;
      const src = fs.readFileSync(filePath, "utf8");
      out.set(tag, parsePropsBlock(src));
    } catch {
      /* ignore */
    }
  };

  let m: RegExpExecArray | null;
  IMPORT_NWIKI_FROM_RE.lastIndex = 0;
  while ((m = IMPORT_NWIKI_FROM_RE.exec(text))) {
    const tag = m[1];
    const rel = m[2] || m[3];
    if (!tag || !rel) continue;
    const resolved = path.isAbsolute(rel) ? rel : path.resolve(baseDir, rel);
    addFromFile(tag, resolved);
  }

  IMPORT_LEGACY_RE.lastIndex = 0;
  while ((m = IMPORT_LEGACY_RE.exec(text))) {
    const name = m[1] || m[2] || m[3];
    if (!name || name.toLowerCase().endsWith(".json")) continue;
    if (name.toLowerCase().endsWith(".nwiki")) {
      const resolved = path.isAbsolute(name)
        ? name
        : path.resolve(baseDir, name);
      addFromFile(path.basename(name, ".nwiki"), resolved);
      continue;
    }
    for (const dir of [
      baseDir,
      path.join(baseDir, "components"),
      path.join(path.dirname(baseDir), "components"),
    ]) {
      const candidate = path.join(dir, `${name}.nwiki`);
      if (fs.existsSync(candidate)) {
        addFromFile(name, candidate);
        break;
      }
    }
  }

  return out;
}

/** Parse `props { name: required, age }` entries (order preserved). */
export function parsePropsBlock(source: string): PropInfo[] {
  const m = PROPS_BLOCK_RE.exec(source);
  if (!m) return [];
  return parsePropsBody(m[1]);
}

export function componentPropCompletions(
  props: PropInfo[],
  present: Set<string>
): vscode.CompletionItem[] {
  return props
    .filter((p) => !present.has(p.name))
    .map((p) => {
      const item = new vscode.CompletionItem(
        p.name,
        vscode.CompletionItemKind.Property
      );
      item.detail = p.optional ? "optional String" : "required String";
      item.insertText = new vscode.SnippetString(`${p.name}="$1"`);
      item.sortText = p.optional ? `1_${p.name}` : `0_${p.name}`;
      item.documentation = new vscode.MarkdownString(
        p.optional
          ? "Optional prop (bare in `props { }`; always String)"
          : "Required prop (`name: required`; always String)"
      );
      return item;
    });
}

/** Completions while editing inside a `props { … }` block. */
export function propsBlockCompletions(
  linePrefix: string
): vscode.CompletionItem[] {
  const afterColon = /:\s*([A-Za-z_][\w]*)?$/.exec(linePrefix);
  if (afterColon) {
    const item = new vscode.CompletionItem(
      "required",
      vscode.CompletionItemKind.Keyword
    );
    item.detail = "mark prop as required";
    item.insertText = "required";
    item.documentation = new vscode.MarkdownString(
      "필수 prop. 선택이면 `:` 없이 이름만 적습니다."
    );
    return [item];
  }
  if (
    /[A-Za-z_][\w]*$/.test(linePrefix) ||
    /\{\s*$/.test(linePrefix) ||
    /,\s*$/.test(linePrefix)
  ) {
    const req = new vscode.CompletionItem(
      "name: required",
      vscode.CompletionItemKind.Snippet
    );
    req.insertText = new vscode.SnippetString("${1:name}: required");
    req.detail = "required prop";
    req.sortText = "0_required";

    const opt = new vscode.CompletionItem(
      "name (optional)",
      vscode.CompletionItemKind.Snippet
    );
    opt.insertText = new vscode.SnippetString("${1:age}");
    opt.detail = "optional prop (bare)";
    opt.sortText = "1_optional";
    return [req, opt];
  }
  return [];
}
