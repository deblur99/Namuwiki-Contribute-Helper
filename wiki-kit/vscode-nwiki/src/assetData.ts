import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const ASSET_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
]);

const IMPORT_ASSET_FROM_RE =
  /\bimport\s+([A-Za-z_][\w]*)\s+from\s+(?:"([^"]+)"|'([^']+)')/gi;

export function isAssetPath(p: string): boolean {
  return ASSET_EXTS.has(path.extname(p).toLowerCase());
}

/** binding name → wiki basename (from successful local resolve). */
export function loadAssetBindings(
  document: vscode.TextDocument
): Map<string, string> {
  const text = document.getText();
  const baseDir = path.dirname(document.uri.fsPath);
  const out = new Map<string, string>();

  IMPORT_ASSET_FROM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_ASSET_FROM_RE.exec(text))) {
    const name = m[1];
    const rel = m[2] || m[3];
    if (!name || !rel || !isAssetPath(rel)) continue;
    if (out.has(name)) continue;
    const resolved = path.isAbsolute(rel)
      ? rel
      : path.resolve(baseDir, rel);
    if (!fs.existsSync(resolved)) continue;
    out.set(name, path.basename(resolved));
  }
  return out;
}

/** Failed / missing image import("…") ranges. */
export function assetImportDiagnostics(
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const text = document.getText();
  const baseDir = path.dirname(document.uri.fsPath);
  const diags: vscode.Diagnostic[] = [];

  IMPORT_ASSET_FROM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_ASSET_FROM_RE.exec(text))) {
    const rel = m[2] || m[3];
    if (!rel || !isAssetPath(rel)) continue;
    const resolved = path.isAbsolute(rel)
      ? rel
      : path.resolve(baseDir, rel);
    if (fs.existsSync(resolved)) continue;
    const start = document.positionAt(m.index);
    const end = document.positionAt(m.index + m[0].length);
    const d = new vscode.Diagnostic(
      new vscode.Range(start, end),
      `cannot load image import("${rel}"): file not found`,
      vscode.DiagnosticSeverity.Error
    );
    d.source = "nwiki";
    d.code = "asset-import";
    diags.push(d);
  }
  return diags;
}

export function assetBindingCompletions(
  document: vscode.TextDocument
): vscode.CompletionItem[] {
  return [...loadAssetBindings(document).entries()].map(([name, file]) => {
    const item = new vscode.CompletionItem(
      name,
      vscode.CompletionItemKind.Variable
    );
    item.detail = file;
    item.insertText = name;
    item.documentation = new vscode.MarkdownString(
      `\`import ${name}\` → \`[[파일:${file}]]\``
    );
    return item;
  });
}

/** Relative image paths under doc dir / assets/ for `from "…"`. */
export function assetPathCompletions(
  document: vscode.TextDocument,
  prefixInQuotes: string
): vscode.CompletionItem[] {
  const baseDir = path.dirname(document.uri.fsPath);
  const seeds = [baseDir, path.join(baseDir, "assets")];
  const parentAssets = path.join(baseDir, "..", "assets");
  if (fs.existsSync(parentAssets)) seeds.push(parentAssets);

  const items: vscode.CompletionItem[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    if (!fs.existsSync(seed) || !fs.statSync(seed).isDirectory()) continue;
    let entries: string[];
    try {
      entries = fs.readdirSync(seed);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = path.join(seed, name);
      if (!fs.statSync(full).isFile() || !isAssetPath(name)) continue;
      let rel = path.relative(baseDir, full).replace(/\\/g, "/");
      if (!rel.startsWith(".")) rel = `./${rel}`;
      if (prefixInQuotes && !rel.includes(prefixInQuotes) && !name.includes(prefixInQuotes)) {
        continue;
      }
      if (seen.has(rel)) continue;
      seen.add(rel);
      const item = new vscode.CompletionItem(
        rel,
        vscode.CompletionItemKind.File
      );
      item.insertText = rel;
      item.detail = "image asset";
      items.push(item);
    }
  }
  return items;
}
