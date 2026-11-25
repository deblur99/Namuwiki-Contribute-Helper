import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const IMPORT_NWIKI_FROM_RE =
  /\bimport\s+([A-Za-z_][\w]*)\s+from\s+(?:"([^"]+\.nwiki)"|'([^']+\.nwiki)')/gi;
const IMPORT_LEGACY_RE =
  /\bimport\s*\(\s*(?:([A-Za-z_][\w]*)|"([^"]+)"|'([^']+)')\s*\)/g;
const PROPS_BLOCK_RE = /\bprops\s*\{([^}]*)\}/s;
const PROP_LINE_RE = /([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w]*)(\?)?/g;

export interface PropInfo {
  name: string;
  typeName: string;
  optional: boolean;
}

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

export function parsePropsBlock(source: string): PropInfo[] {
  const m = PROPS_BLOCK_RE.exec(source);
  if (!m) return [];
  const body = m[1];
  const props: PropInfo[] = [];
  let pm: RegExpExecArray | null;
  PROP_LINE_RE.lastIndex = 0;
  while ((pm = PROP_LINE_RE.exec(body))) {
    props.push({
      name: pm[1],
      typeName: pm[2],
      optional: Boolean(pm[3]),
    });
  }
  return props;
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
      item.detail = `${p.typeName}${p.optional ? "?" : ""}`;
      item.insertText = new vscode.SnippetString(`${p.name}="$1"`);
      item.documentation = new vscode.MarkdownString(
        p.optional
          ? `Optional prop (\`${p.typeName}?\`)`
          : `Required prop (\`${p.typeName}\`)`
      );
      return item;
    });
}
