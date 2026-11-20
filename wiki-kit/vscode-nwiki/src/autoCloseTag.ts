import * as vscode from "vscode";
import { TAG_ATTRS } from "./catalog";

/** Avoid re-entrancy when we insert `>` / `</Tag>` / pad edits. */
let applying = false;

type SlashPadSession = {
  kind: "slashPad";
  uri: string;
  /** Absolute offset of the first pad space (` ·|· /`). */
  padStart: number;
  padLen: number;
};

type PairGapSession = {
  kind: "pairGap";
  uri: string;
  /** Offset right after opening `>`. */
  gapOffset: number;
  tagName: string;
  /** Column of `<` (indent of open tag). */
  openIndentCol: number;
};

type Session = SlashPadSession | PairGapSession | undefined;

let session: Session;

/**
 * Inside an open `<Tag …` (no `>` yet), at end-of-content (trailing comments OK):
 * - `/` → `/>` (+ attr pad slot when applicable)
 * - `>` → `></Tag>` with cursor in the gap; Enter expands to multiline
 */
export function registerAutoCloseTag(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (applying) return;
      if (e.document.languageId !== "nwiki") return;

      if (session && session.uri === e.document.uri.toString()) {
        // User edit while a session is active → drop session, keep text
        if (e.contentChanges.length > 0) {
          clearSession();
        }
      }

      if (e.contentChanges.length !== 1) return;
      const change = e.contentChanges[0];
      if (change.text !== "/" && change.text !== ">") return;
      if (change.rangeLength !== 0) return;

      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== e.document) return;
      if (editor.selections.length !== 1) return;

      const doc = e.document;
      const posAfter = change.range.start.translate(0, change.text.length);
      const open = findOpenTag(doc, change.range.start);
      if (!open) return;
      if (isInsideAttrString(doc, open.ltPos, change.range.start)) return;
      if (!isAtTagClosePoint(doc, posAfter)) return;

      if (change.text === "/") {
        const beforeSlash = doc.getText(
          new vscode.Range(open.ltPos, change.range.start)
        );
        if (beforeSlash.startsWith("/")) return;
        void applySlashClose(editor, open, change.range.start, posAfter);
        return;
      }

      const charBefore = doc.getText(
        new vscode.Range(
          change.range.start.translate(0, -1),
          change.range.start
        )
      );
      if (charBefore === "/") return;

      void applyGtClose(editor, open, posAfter);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (!session) return;
      if (e.textEditor.document.uri.toString() !== session.uri) return;
      // Keyboard/mouse move away from pad/gap → drop session
      if (
        e.kind === vscode.TextEditorSelectionChangeKind.Keyboard ||
        e.kind === vscode.TextEditorSelectionChangeKind.Mouse
      ) {
        if (
          !selectionMatchesSession(
            e.textEditor.document,
            e.selections[0],
            session
          )
        ) {
          clearSession();
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nwiki.slashPadArrow",
      async (dir: "up" | "down") => {
        const editor = vscode.window.activeTextEditor;
        if (
          !editor ||
          !session ||
          session.kind !== "slashPad" ||
          editor.document.uri.toString() !== session.uri
        ) {
          clearSession();
          await vscode.commands.executeCommand("cursorMove", {
            to: dir,
            by: "line",
            value: 1,
          });
          return;
        }
        await collapseSlashPad(editor, session);
        clearSession();
        await vscode.commands.executeCommand("cursorMove", {
          to: dir,
          by: "line",
          value: 1,
        });
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nwiki.expandTagPair", async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        !session ||
        session.kind !== "pairGap" ||
        editor.document.uri.toString() !== session.uri ||
        !selectionMatchesSession(editor.document, editor.selection, session)
      ) {
        clearSession();
        applying = true;
        try {
          await editor?.edit((b) => {
            b.insert(editor.selection.active, "\n");
          });
        } finally {
          applying = false;
        }
        return;
      }
      await expandPairGap(editor, session);
      clearSession();
    })
  );
}

function setContextFlags(): void {
  void vscode.commands.executeCommand(
    "setContext",
    "nwiki.slashPad",
    session?.kind === "slashPad"
  );
  void vscode.commands.executeCommand(
    "setContext",
    "nwiki.pairGap",
    session?.kind === "pairGap"
  );
}

function clearSession(): void {
  session = undefined;
  setContextFlags();
}

function activateSession(next: NonNullable<Session>): void {
  session = next;
  setContextFlags();
}

function selectionMatchesSession(
  doc: vscode.TextDocument,
  sel: vscode.Selection,
  s: NonNullable<Session>
): boolean {
  if (!sel.isEmpty) return false;
  const off = doc.offsetAt(sel.active);
  if (s.kind === "slashPad") {
    return off === s.padStart + 1;
  }
  return off === s.gapOffset;
}

interface OpenTag {
  name: string;
  ltPos: vscode.Position;
}

function findOpenTag(
  doc: vscode.TextDocument,
  at: vscode.Position
): OpenTag | undefined {
  const offset = doc.offsetAt(at);
  const text = doc.getText();
  let i = offset - 1;
  let inDq = false;
  let inSq = false;
  while (i >= 0) {
    const ch = text[i];
    if (inDq) {
      if (ch === '"' && text[i - 1] !== "\\") inDq = false;
      i -= 1;
      continue;
    }
    if (inSq) {
      if (ch === "'" && text[i - 1] !== "\\") inSq = false;
      i -= 1;
      continue;
    }
    if (ch === '"') {
      inDq = true;
      i -= 1;
      continue;
    }
    if (ch === "'") {
      inSq = true;
      i -= 1;
      continue;
    }
    if (ch === ">") return undefined;
    if (ch === "<") {
      const after = text.slice(i + 1, offset);
      if (after.startsWith("/")) return undefined;
      const m = /^([A-Za-z_][\w-]*)/.exec(after);
      if (!m) return undefined;
      if (after.includes(">")) return undefined;
      return { name: m[1], ltPos: doc.positionAt(i) };
    }
    i -= 1;
  }
  return undefined;
}

function isAtTagClosePoint(
  doc: vscode.TextDocument,
  pos: vscode.Position
): boolean {
  const line = doc.lineAt(pos.line).text;
  const after = line.slice(pos.character);
  return /^\s*$/.test(stripTrailingComments(after));
}

function stripTrailingComments(s: string): string {
  let out = s;
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  out = out.replace(/\/\/\/.*$/g, "");
  return out;
}

function isInsideAttrString(
  doc: vscode.TextDocument,
  ltPos: vscode.Position,
  to: vscode.Position
): boolean {
  const text = doc.getText(new vscode.Range(ltPos, to));
  let inDq = false;
  let inSq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inDq) {
      if (ch === '"' && text[i - 1] !== "\\") inDq = false;
      continue;
    }
    if (inSq) {
      if (ch === "'" && text[i - 1] !== "\\") inSq = false;
      continue;
    }
    if (ch === '"') inDq = true;
    else if (ch === "'") inSq = true;
  }
  return inDq || inSq;
}

function tagHasNoAttrs(
  doc: vscode.TextDocument,
  open: OpenTag,
  beforeSlash: vscode.Position
): boolean {
  const body = doc.getText(new vscode.Range(open.ltPos, beforeSlash));
  return new RegExp(`^<${escapeReg(open.name)}\\s*$`).test(body);
}

function tagSupportsAttrs(name: string): boolean {
  const attrs = TAG_ATTRS[name];
  return Array.isArray(attrs) && attrs.length > 0;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function applySlashClose(
  editor: vscode.TextEditor,
  open: OpenTag,
  slashPos: vscode.Position,
  afterSlash: vscode.Position
): Promise<void> {
  const doc = editor.document;
  const noAttrs = tagHasNoAttrs(doc, open, slashPos);
  const usePad = !(noAttrs && !tagSupportsAttrs(open.name));

  applying = true;
  try {
    if (!usePad) {
      const ok = await editor.edit((b) => {
        b.insert(afterSlash, ">");
      });
      if (!ok) return;
      const afterGt = afterSlash.translate(0, 1);
      editor.selection = new vscode.Selection(afterGt, afterGt);
      clearSession();
      return;
    }

    // `<Tag…` (trim trailing space) + `  />`, cursor between the two spaces
    const before = doc.getText(new vscode.Range(open.ltPos, slashPos));
    const trimmed = before.replace(/\s+$/, "");
    const contentEndOffset = doc.offsetAt(open.ltPos) + trimmed.length;
    const contentEnd = doc.positionAt(contentEndOffset);

    const ok = await editor.edit((b) => {
      b.replace(new vscode.Range(contentEnd, afterSlash), "  />");
    });
    if (!ok) return;

    const padStart = contentEndOffset;
    const cursor = editor.document.positionAt(padStart + 1);
    editor.selection = new vscode.Selection(cursor, cursor);
    activateSession({
      kind: "slashPad",
      uri: editor.document.uri.toString(),
      padStart,
      padLen: 2,
    });
  } finally {
    applying = false;
  }
}

async function collapseSlashPad(
  editor: vscode.TextEditor,
  s: SlashPadSession
): Promise<void> {
  applying = true;
  try {
    const doc = editor.document;
    const start = doc.positionAt(s.padStart);
    const end = doc.positionAt(s.padStart + s.padLen);
    if (doc.getText(new vscode.Range(start, end)) !== "  ") return;
    await editor.edit((b) => {
      b.delete(new vscode.Range(start, end));
    });
  } finally {
    applying = false;
  }
}

async function applyGtClose(
  editor: vscode.TextEditor,
  open: OpenTag,
  afterGt: vscode.Position
): Promise<void> {
  applying = true;
  try {
    const close = `</${open.name}>`;
    const ok = await editor.edit((b) => {
      b.insert(afterGt, close);
    });
    if (!ok) return;
    editor.selection = new vscode.Selection(afterGt, afterGt);
    activateSession({
      kind: "pairGap",
      uri: editor.document.uri.toString(),
      gapOffset: editor.document.offsetAt(afterGt),
      tagName: open.name,
      openIndentCol: open.ltPos.character,
    });
  } finally {
    applying = false;
  }
}

async function expandPairGap(
  editor: vscode.TextEditor,
  s: PairGapSession
): Promise<void> {
  applying = true;
  try {
    const doc = editor.document;
    const tabSize = editor.options.tabSize;
    const indentUnit =
      typeof tabSize === "number" ? " ".repeat(Math.max(1, tabSize)) : "  ";
    const openIndent = " ".repeat(Math.max(0, s.openIndentCol));
    const innerIndent = openIndent + indentUnit;
    const close = `</${s.tagName}>`;
    const gapPos = doc.positionAt(s.gapOffset);
    const closeEnd = doc.positionAt(s.gapOffset + close.length);
    if (doc.getText(new vscode.Range(gapPos, closeEnd)) !== close) return;

    const replacement = `\n${innerIndent}\n${openIndent}${close}`;
    const ok = await editor.edit((b) => {
      b.replace(new vscode.Range(gapPos, closeEnd), replacement);
    });
    if (!ok) return;

    const freshOff = s.gapOffset + 1 + innerIndent.length;
    const pos = editor.document.positionAt(freshOff);
    editor.selection = new vscode.Selection(pos, pos);
  } finally {
    applying = false;
  }
}
