import * as vscode from "vscode";
import {
  isOffsetInsideTemplate,
  toggleBlockCommentText,
  toggleLineCommentText,
} from "./commentCore";

export {
  isOffsetInsideTemplate,
  toggleBlockCommentText,
  toggleLineCommentText,
} from "./commentCore";

export async function toggleLineComment(
  editor: vscode.TextEditor
): Promise<void> {
  const doc = editor.document;
  const text = doc.getText();
  await editor.edit((edit) => {
    for (const sel of editor.selections) {
      const startLine = sel.start.line;
      const endLine =
        sel.isEmpty || sel.end.character > 0
          ? sel.end.line
          : Math.max(sel.start.line, sel.end.line - 1);
      for (let line = startLine; line <= endLine; line++) {
        const range = doc.lineAt(line).range;
        const offset = doc.offsetAt(range.start);
        const next = toggleLineCommentText(
          doc.lineAt(line).text,
          isOffsetInsideTemplate(text, offset)
        );
        edit.replace(range, next);
      }
    }
  });
}

export async function toggleBlockComment(
  editor: vscode.TextEditor
): Promise<void> {
  const doc = editor.document;
  const text = doc.getText();
  await editor.edit((edit) => {
    for (const sel of editor.selections) {
      const range = sel.isEmpty ? doc.lineAt(sel.active.line).range : sel;
      const chunk = doc.getText(range);
      const inside = isOffsetInsideTemplate(text, doc.offsetAt(range.start));
      edit.replace(range, toggleBlockCommentText(chunk, inside));
    }
  });
}

export function registerCommentCommands(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "nwiki.toggleLineComment",
      (editor) => {
        if (editor.document.languageId !== "nwiki") return;
        return toggleLineComment(editor);
      }
    ),
    vscode.commands.registerTextEditorCommand(
      "nwiki.toggleBlockComment",
      (editor) => {
        if (editor.document.languageId !== "nwiki") return;
        return toggleBlockComment(editor);
      }
    )
  );
}
