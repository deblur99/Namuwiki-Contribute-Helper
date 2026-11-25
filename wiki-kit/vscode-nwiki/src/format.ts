import * as vscode from "vscode";
import { formatNwiki } from "./formatCore";

export { formatNwiki };

export class NwikiFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument
  ): vscode.TextEdit[] {
    const full = document.getText();
    const formatted = formatNwiki(full);
    if (formatted === full) return [];
    const all = new vscode.Range(
      document.positionAt(0),
      document.positionAt(full.length)
    );
    return [vscode.TextEdit.replace(all, formatted)];
  }
}

export async function formatDocumentEditor(
  editor: vscode.TextEditor
): Promise<boolean> {
  const doc = editor.document;
  if (doc.languageId !== "nwiki") return false;
  const edits = new NwikiFormattingProvider().provideDocumentFormattingEdits(
    doc
  );
  if (!edits.length) return false;
  await editor.edit((b) => {
    for (const e of edits) b.replace(e.range, e.newText);
  });
  return true;
}
