import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ImportPathQuery } from "./importPathQuery";

export type { ImportPathQuery };
export { importPathQuery } from "./importPathQuery";

/**
 * Completions for relative import paths (.json / .nwiki / images + directories).
 */
export function importPathCompletions(
  document: vscode.TextDocument,
  position: vscode.Position,
  query: ImportPathQuery
): vscode.CompletionItem[] {
  const baseDir = path.dirname(document.uri.fsPath);
  const typed = query.typed;

  let dirPart = "";
  let filePart = typed;
  const lastSlash = typed.lastIndexOf("/");
  if (lastSlash >= 0) {
    dirPart = typed.slice(0, lastSlash + 1);
    filePart = typed.slice(lastSlash + 1);
  }

  const absDir = path.resolve(baseDir, dirPart || ".");
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    return [];
  }

  const replaceRange = new vscode.Range(
    new vscode.Position(position.line, query.typedStartInLine),
    position
  );

  const items: vscode.CompletionItem[] = [];
  const filter = filePart.toLowerCase();

  // Bare start: offer ./ and ../
  if (!typed) {
    for (const hint of ["./", "../"]) {
      const item = new vscode.CompletionItem(
        hint,
        vscode.CompletionItemKind.Folder
      );
      item.insertText = hint;
      item.range = replaceRange;
      item.sortText = `0_${hint}`;
      item.detail = "relative path";
      item.command = {
        command: "editor.action.triggerSuggest",
        title: "Re-trigger completions",
      };
      items.push(item);
    }
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return items;
  }

  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    if (filter && !ent.name.toLowerCase().startsWith(filter)) continue;

    if (ent.isDirectory()) {
      const label = dirPart + ent.name + "/";
      const item = new vscode.CompletionItem(
        label,
        vscode.CompletionItemKind.Folder
      );
      item.insertText = label;
      item.range = replaceRange;
      item.sortText = `1_${ent.name}`;
      item.detail = "directory";
      item.command = {
        command: "editor.action.triggerSuggest",
        title: "Re-trigger completions",
      };
      items.push(item);
      continue;
    }

    if (!/\.(json|nwiki|png|jpe?g|gif|svg|webp)$/i.test(ent.name)) continue;
    const label = dirPart + ent.name;
    const item = new vscode.CompletionItem(
      label,
      vscode.CompletionItemKind.File
    );
    item.insertText = label;
    item.range = replaceRange;
    item.sortText = `2_${ent.name}`;
    const lower = ent.name.toLowerCase();
    item.detail = lower.endsWith(".json")
      ? "JSON data"
      : lower.endsWith(".nwiki")
        ? "nwiki component"
        : "image asset";
    items.push(item);
  }

  return items;
}
