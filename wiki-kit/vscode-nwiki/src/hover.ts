import * as vscode from "vscode";
import { hexHoverAt } from "./colors";
import { resolveDocsForSymbol, wordAt } from "./docs";
import { loadJsonNamespaces } from "./jsonData";

export class NwikiHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const colorHover = hexHoverAt(document, position);
    if (colorHover) return colorHover;

    const jsonHover = hoverJsonKey(document, position);
    if (jsonHover) return jsonHover;

    const hit = wordAt(document, position);
    if (!hit) return undefined;
    const md = resolveDocsForSymbol(document, hit.word);
    if (!md) return undefined;
    const contents = new vscode.MarkdownString(md);
    contents.isTrusted = false;
    contents.supportHtml = false;
    return new vscode.Hover(contents, hit.range);
  }
}

function hoverJsonKey(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Hover | undefined {
  const line = document.lineAt(position.line).text;
  const wordRange = document.getWordRangeAtPosition(
    position,
    /[A-Za-z_][\w]*/
  );
  if (!wordRange) return undefined;
  const key = document.getText(wordRange);
  const before = line.slice(0, wordRange.start.character);
  const nsMatch = /([A-Za-z_][\w]*)\.$/.exec(before);
  if (!nsMatch) return undefined;
  const data = loadJsonNamespaces(document).get(nsMatch[1]);
  if (!data || !(key in data)) return undefined;
  const md = new vscode.MarkdownString(
    `\`${nsMatch[1]}.${key}\` = \`${data[key]}\``
  );
  return new vscode.Hover(md, wordRange);
}
