import * as vscode from "vscode";
import { registerAutoCloseTag } from "./autoCloseTag";
import { buildNwikiFile, getOutput, openBuildOutput } from "./build";
import { NwikiCompletionProvider } from "./completion";
import {
  clearDiagnostics,
  collection,
  diagnose,
  scheduleDiagnose,
} from "./diagnostics";
import {
  formatDocumentEditor,
  NwikiFormattingProvider,
} from "./format";
import { formatTagMultilineAtCursor } from "./formatTagMultiline";
import { NwikiHoverProvider } from "./hover";
import { disposePreview, showBuildPreview } from "./preview";
import { NwikiQuickFixProvider } from "./quickFix";

export function activate(context: vscode.ExtensionContext): void {
  const out = getOutput();
  out.appendLine("nwiki extension activated");

  const selector: vscode.DocumentSelector = { language: "nwiki" };

  context.subscriptions.push(collection);
  registerAutoCloseTag(context);

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new NwikiCompletionProvider(),
      "<",
      "/",
      "=",
      ".",
      '"'
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      selector,
      new NwikiHoverProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      selector,
      new NwikiQuickFixProvider(),
      {
        providedCodeActionKinds: NwikiQuickFixProvider.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      selector,
      new NwikiFormattingProvider()
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "nwiki") scheduleDiagnose(doc);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === "nwiki") scheduleDiagnose(e.document);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      clearDiagnostics(doc.uri);
    })
  );

  // format on newline (optional)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (e.document.languageId !== "nwiki") return;
      const cfg = vscode.workspace.getConfiguration("nwiki");
      if (!cfg.get<boolean>("formatOnNewline")) return;
      if (!e.contentChanges.some((c) => c.text.includes("\n"))) return;
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== e.document) return;
      await formatDocumentEditor(editor);
    })
  );

  // save: format → build → open
  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((e) => {
      if (e.document.languageId !== "nwiki") return;
      const cfg = vscode.workspace.getConfiguration("nwiki");
      if (!cfg.get<boolean>("formatOnSave")) return;
      const edits = new NwikiFormattingProvider().provideDocumentFormattingEdits(
        e.document
      );
      if (edits.length) e.waitUntil(Promise.resolve(edits));
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId !== "nwiki") return;
      await diagnose(doc);
      const cfg = vscode.workspace.getConfiguration("nwiki");
      if (!cfg.get<boolean>("buildOnSave")) return;
      await runBuildFlow(doc.uri.fsPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nwiki.build", async () => {
      const editor = requireNwikiEditor();
      if (!editor) return;
      await runBuildFlow(editor.document.uri.fsPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nwiki.openOutput", async () => {
      const editor = requireNwikiEditor();
      if (!editor) return;
      await openBuildOutput(editor.document.uri.fsPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nwiki.previewOutput", async () => {
      const editor = requireNwikiEditor();
      if (!editor) return;
      await showBuildPreview(editor.document.uri.fsPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nwiki.formatDocument", async () => {
      const editor = requireNwikiEditor();
      if (!editor) return;
      const changed = await formatDocumentEditor(editor);
      vscode.window.showInformationMessage(
        changed ? "nwiki: formatted" : "nwiki: already formatted"
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nwiki.formatTagMultiline", async () => {
      const editor = requireNwikiEditor();
      if (!editor) return;
      await formatTagMultilineAtCursor(editor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nwiki.showDiagnosticHelp",
      async (message?: string) => {
        const text =
          message ||
          "See wiki-kit/docs/SPEC.nwiki for grammar rules. TableRow children must be TableColumn; use delimiter (not delimeter); Link needs toDocument or toExternal.";
        getOutput().clear();
        getOutput().appendLine(text);
        getOutput().show(true);
      }
    )
  );

  // diagnose already open nwiki docs
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === "nwiki") scheduleDiagnose(doc);
  }
}

function requireNwikiEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "nwiki") {
    vscode.window.showWarningMessage(
      "nwiki: open a .nwiki file (language mode nwiki) first"
    );
    return undefined;
  }
  return editor;
}

async function runBuildFlow(filePath: string): Promise<void> {
  const result = await buildNwikiFile(filePath);
  if (!result.ok) {
    vscode.window.showErrorMessage(`nwiki build failed: ${result.stderr.slice(0, 200)}`);
    getOutput().show(true);
    return;
  }
  vscode.window.showInformationMessage("nwiki: build ok");
  const cfg = vscode.workspace.getConfiguration("nwiki");
  if (cfg.get<boolean>("openOutputAfterBuild")) {
    await openBuildOutput(filePath);
  }
  if (cfg.get<boolean>("previewAfterBuild", true)) {
    await showBuildPreview(filePath);
  }
}

export function deactivate(): void {
  disposePreview();
  collection.dispose();
}
