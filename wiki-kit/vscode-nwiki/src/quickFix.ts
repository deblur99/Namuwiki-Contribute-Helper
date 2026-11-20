import * as vscode from "vscode";

export class NwikiQuickFixProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of context.diagnostics) {
      if (diag.source !== "nwiki") continue;
      const code = String(diag.code ?? "");

      if (code.startsWith("unknown-tag:")) {
        const hint = code.slice("unknown-tag:".length);
        const action = new vscode.CodeAction(
          `Replace with <${hint}>`,
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diag];
        action.isPreferred = true;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, diag.range, hint);
        action.edit = edit;
        actions.push(action);
      }

      if (code === "typo-delimiter") {
        const action = new vscode.CodeAction(
          "Replace 'delimeter' with 'delimiter'",
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diag];
        action.isPreferred = true;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, diag.range, "delimiter");
        action.edit = edit;
        actions.push(action);
      }

      if (code === "parse-error" || code === "unknown-tag") {
        const help = new vscode.CodeAction(
          "Show nwiki grammar help",
          vscode.CodeActionKind.QuickFix
        );
        help.diagnostics = [diag];
        help.command = {
          command: "nwiki.showDiagnosticHelp",
          title: "Show help",
          arguments: [diag.message],
        };
        actions.push(help);
      }

      // Wrap suggestion when message mentions TableColumn
      if (/TableColumn/i.test(diag.message) || /TableRow/i.test(diag.message)) {
        const wrap = new vscode.CodeAction(
          "Wrap selection in <TableColumn>",
          vscode.CodeActionKind.QuickFix
        );
        wrap.diagnostics = [diag];
        const line = document.lineAt(diag.range.start.line);
        const edit = new vscode.WorkspaceEdit();
        const indent = line.text.match(/^\s*/)?.[0] ?? "";
        const content = line.text.trim();
        edit.replace(
          document.uri,
          line.range,
          `${indent}<TableColumn>\n${indent}\t${content}\n${indent}</TableColumn>`
        );
        wrap.edit = edit;
        actions.push(wrap);
      }
    }
    return actions;
  }
}
