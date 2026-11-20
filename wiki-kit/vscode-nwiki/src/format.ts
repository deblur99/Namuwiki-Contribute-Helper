import * as vscode from "vscode";

/**
 * Simple nwiki formatter: indent tag tree by 2 spaces.
 * Preserves script/template blocks and top-level calls.
 */
export function formatNwiki(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let depth = 0;
  let inBlockComment = false;
  let inScript = false;

  for (const raw of lines) {
    const line = raw; // keep for comment detection
    const trimmed = line.trim();

    if (inBlockComment) {
      out.push(raw);
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      inBlockComment = !trimmed.includes("*/");
      out.push(raw);
      continue;
    }
    if (trimmed.startsWith("<!--") && !trimmed.includes("-->")) {
      out.push(raw);
      continue;
    }

    if (/^<script\b/i.test(trimmed)) {
      inScript = true;
      out.push(indent(depth) + trimmed);
      continue;
    }
    if (/^<\/script>/i.test(trimmed)) {
      out.push(indent(depth) + trimmed);
      inScript = false;
      continue;
    }
    if (inScript) {
      out.push(raw);
      continue;
    }

    if (!trimmed) {
      out.push("");
      continue;
    }

    const isClose = /^<\//.test(trimmed);
    const isSelf = /\/>$/.test(trimmed) || /^<(br|Space)\b/i.test(trimmed);
    const isOpen =
      /^<[A-Za-z_]/.test(trimmed) && !isClose && !isSelf && !/>.*<\//.test(trimmed);

    if (isClose) depth = Math.max(0, depth - 1);
    out.push(indent(depth) + trimmed);
    if (isOpen) depth += 1;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n") + (text.endsWith("\n") ? "\n" : "");
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

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
  const edits = new NwikiFormattingProvider().provideDocumentFormattingEdits(doc);
  if (!edits.length) return false;
  await editor.edit((b) => {
    for (const e of edits) b.replace(e.range, e.newText);
  });
  return true;
}
