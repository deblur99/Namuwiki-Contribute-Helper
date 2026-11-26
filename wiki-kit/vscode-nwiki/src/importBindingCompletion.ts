import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  designSystemImportPath,
  profileTableImportPath,
} from "./docTitle";

export type ImportCandidate = {
  name: string;
  relPath: string;
  detail: string;
};

/** Prefer DesignSystem / ProfileTable, then nearby .json / .nwiki. */
export function discoverImportCandidates(filePath: string): ImportCandidate[] {
  const byName = new Map<string, ImportCandidate>();

  const add = (name: string, relPath: string, detail: string) => {
    if (!byName.has(name)) {
      byName.set(name, { name, relPath, detail });
    }
  };

  add(
    "DesignSystem",
    designSystemImportPath(filePath),
    "JSON design tokens"
  );
  add(
    "ProfileTable",
    profileTableImportPath(filePath),
    "nwiki component"
  );

  const baseDir = path.dirname(filePath);
  const searchDirs = [
    path.join(baseDir, "data"),
    path.join(baseDir, "components"),
    path.join(baseDir, "assets"),
    path.join(baseDir, "..", "data"),
    path.join(baseDir, "..", "components"),
    path.join(baseDir, "..", "assets"),
    baseDir,
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent);
      if (!fs.statSync(full).isFile()) continue;
      const lower = ent.toLowerCase();
      if (lower.endsWith(".json")) {
        const stem = path.basename(ent, path.extname(ent));
        const name =
          stem === "design-system" || stem === "designSystem"
            ? "DesignSystem"
            : toPascalOrKeep(stem);
        const rel = toPosixRel(baseDir, full);
        add(name, rel, "JSON data");
      } else if (lower.endsWith(".nwiki")) {
        const name = path.basename(ent, path.extname(ent));
        if (!/^[A-Za-z_][\w]*$/.test(name)) continue;
        const rel = toPosixRel(baseDir, full);
        add(name, rel, "nwiki component");
      } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(lower)) {
        const stem = path.basename(ent, path.extname(ent));
        const name = toPascalOrKeep(stem.replace(/[^\w\-]+/g, "_"));
        if (!/^[A-Za-z_][\w]*$/.test(name)) continue;
        const rel = toPosixRel(baseDir, full);
        add(name, rel, "image asset");
      }
    }
  }

  return [...byName.values()];
}

function toPascalOrKeep(stem: string): string {
  if (/^[A-Z]/.test(stem) && !stem.includes("-")) return stem;
  return stem
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

function toPosixRel(fromDir: string, absolute: string): string {
  let rel = path.relative(fromDir, absolute);
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel.split(path.sep).join("/");
}

/**
 * Completions for `import Desig|` — full `import Name from "path"` + newline cursor.
 */
export function importBindingCompletions(
  document: vscode.TextDocument,
  position: vscode.Position,
  linePrefix: string
): vscode.CompletionItem[] | undefined {
  const m = /^(\s*)import\s+([A-Za-z_][\w]*)?$/.exec(linePrefix);
  if (!m) return undefined;

  const indent = m[1];
  const partial = m[2] ?? "";
  const replaceRange = new vscode.Range(
    new vscode.Position(position.line, indent.length),
    position
  );

  const filter = partial.toLowerCase();
  const items: vscode.CompletionItem[] = [];

  for (const c of discoverImportCandidates(document.uri.fsPath)) {
    if (filter && !c.name.toLowerCase().startsWith(filter)) continue;
    const item = new vscode.CompletionItem(
      c.name,
      vscode.CompletionItemKind.Module
    );
    item.detail = `from "${c.relPath}"`;
    item.documentation = new vscode.MarkdownString(
      `\`import ${c.name} from "${c.relPath}"\`\n\n${c.detail}`
    );
    item.insertText = new vscode.SnippetString(
      `import ${c.name} from "${c.relPath}"\n$0`
    );
    item.range = replaceRange;
    item.filterText = `import ${c.name}`;
    item.sortText =
      c.name === "DesignSystem"
        ? `0_${c.name}`
        : c.name === "ProfileTable"
          ? `1_${c.name}`
          : `2_${c.name}`;
    items.push(item);
  }

  return items;
}
