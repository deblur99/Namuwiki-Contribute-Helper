import * as vscode from "vscode";
import { resolveDocsForSymbol, wordAt } from "./docs";

export class NwikiHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
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
