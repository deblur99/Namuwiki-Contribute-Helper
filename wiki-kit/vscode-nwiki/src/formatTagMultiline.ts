import * as vscode from "vscode";

/**
 * Xcode Ctrl+M-style toggle: expand/collapse attributes inside `<Tag …>` /
 * `<Tag … />` around the cursor.
 */
export async function formatTagMultilineAtCursor(
  editor: vscode.TextEditor
): Promise<boolean> {
  const doc = editor.document;
  if (doc.languageId !== "nwiki") return false;

  const offset = doc.offsetAt(editor.selection.active);
  const span = findEnclosingTag(doc.getText(), offset);
  if (!span) {
    vscode.window.showWarningMessage(
      "nwiki: place the cursor inside a <Tag …> to format"
    );
    return false;
  }

  const original = doc.getText().slice(span.start, span.end);
  const baseIndent = leadingIndent(doc, span.start);
  const next = isMultilineTag(original)
    ? collapseTag(original)
    : expandTag(original, baseIndent);

  if (next === original) return false;

  const range = new vscode.Range(
    doc.positionAt(span.start),
    doc.positionAt(span.end)
  );
  const ok = await editor.edit((b) => b.replace(range, next));
  if (!ok) return false;

  editor.selection = new vscode.Selection(
    doc.positionAt(span.start + 1),
    doc.positionAt(span.start + 1)
  );
  return true;
}

function leadingIndent(doc: vscode.TextDocument, start: number): string {
  const line = doc.lineAt(doc.positionAt(start).line).text;
  const m = /^[ \t]*/.exec(line);
  return m?.[0] ?? "";
}

function isMultilineTag(tag: string): boolean {
  return /[\r\n]/.test(tag);
}

interface TagParts {
  name: string;
  attrs: string[];
  selfClosing: boolean;
}

function parseTag(tag: string): TagParts | undefined {
  const t = tag.trim();
  if (!t.startsWith("<") || t.startsWith("</")) return undefined;

  let selfClosing = false;
  let inner = t.slice(1);
  if (/\/>\s*$/.test(inner)) {
    selfClosing = true;
    inner = inner.replace(/\/>\s*$/, "");
  } else if (/>\s*$/.test(inner)) {
    inner = inner.replace(/>\s*$/, "");
  } else {
    return undefined;
  }

  inner = inner.trim();
  const nameMatch = /^([A-Za-z_][\w-]*)/.exec(inner);
  if (!nameMatch) return undefined;
  const name = nameMatch[1];
  const rest = inner.slice(name.length).trim();
  const attrs = rest ? splitTopLevelAttrs(rest) : [];
  return { name, attrs, selfClosing };
}

/** Expand one-line tag → multiline attributes (Xcode-style). */
function expandTag(tag: string, baseIndent: string): string {
  const parts = parseTag(flattenTagSource(tag));
  if (!parts || parts.attrs.length === 0) return tag;

  const pad = baseIndent + "  ";
  const lines = [`<${parts.name}`];
  for (const a of parts.attrs) {
    lines.push(`${pad}${a}`);
  }
  lines.push(parts.selfClosing ? `${baseIndent}/>` : `${baseIndent}>`);
  return lines.join("\n");
}

/** Collapse multiline tag → single line. */
function collapseTag(tag: string): string {
  const parts = parseTag(flattenTagSource(tag));
  if (!parts) return tag;
  if (parts.attrs.length === 0) {
    return parts.selfClosing ? `<${parts.name} />` : `<${parts.name}>`;
  }
  const body = parts.attrs.join(" ");
  return parts.selfClosing
    ? `<${parts.name} ${body} />`
    : `<${parts.name} ${body}>`;
}

function flattenTagSource(tag: string): string {
  return tag
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s*\/>\s*$/, "/>")
    .replace(/\s*>\s*$/, ">");
}

/**
 * Split attribute list on top-level whitespace (not inside quotes / ()[]{}).
 */
function splitTopLevelAttrs(s: string): string[] {
  const attrs: string[] = [];
  let buf = "";
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let inDq = false;
  let inSq = false;

  const flush = () => {
    const t = buf.trim();
    if (t) attrs.push(t);
    buf = "";
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inDq) {
      buf += ch;
      if (ch === '"' && s[i - 1] !== "\\") inDq = false;
      continue;
    }
    if (inSq) {
      buf += ch;
      if (ch === "'" && s[i - 1] !== "\\") inSq = false;
      continue;
    }
    if (ch === '"') {
      inDq = true;
      buf += ch;
      continue;
    }
    if (ch === "'") {
      inSq = true;
      buf += ch;
      continue;
    }
    if (ch === "(") {
      depthParen += 1;
      buf += ch;
      continue;
    }
    if (ch === ")") {
      depthParen = Math.max(0, depthParen - 1);
      buf += ch;
      continue;
    }
    if (ch === "[") {
      depthBracket += 1;
      buf += ch;
      continue;
    }
    if (ch === "]") {
      depthBracket = Math.max(0, depthBracket - 1);
      buf += ch;
      continue;
    }
    if (ch === "{") {
      depthBrace += 1;
      buf += ch;
      continue;
    }
    if (ch === "}") {
      depthBrace = Math.max(0, depthBrace - 1);
      buf += ch;
      continue;
    }
    if (
      /\s/.test(ch) &&
      depthParen === 0 &&
      depthBracket === 0 &&
      depthBrace === 0
    ) {
      flush();
      continue;
    }
    buf += ch;
  }
  flush();
  return attrs;
}

/** Find enclosing opening tag `[start, end)` containing `offset`. */
export function findEnclosingTag(
  text: string,
  offset: number
): { start: number; end: number } | undefined {
  let i = Math.min(Math.max(offset, 0), Math.max(text.length - 1, 0));
  if (text.length === 0) return undefined;
  if (text[i] === ">") i = Math.max(0, i - 1);

  let start = -1;
  let inDq = false;
  let inSq = false;
  let depthParen = 0;

  for (let j = i; j >= 0; j--) {
    const ch = text[j];
    if (inDq) {
      if (ch === '"' && text[j - 1] !== "\\") inDq = false;
      continue;
    }
    if (inSq) {
      if (ch === "'" && text[j - 1] !== "\\") inSq = false;
      continue;
    }
    if (ch === '"') {
      inDq = true;
      continue;
    }
    if (ch === "'") {
      inSq = true;
      continue;
    }
    if (ch === ")") {
      depthParen += 1;
      continue;
    }
    if (ch === "(") {
      depthParen = Math.max(0, depthParen - 1);
      continue;
    }
    if (depthParen > 0) continue;
    if (ch === ">") {
      // crossed into a previous tag's end → not inside an open tag
      return undefined;
    }
    if (ch === "<") {
      if (text[j + 1] === "/") return undefined;
      start = j;
      break;
    }
  }
  if (start < 0) return undefined;

  inDq = false;
  inSq = false;
  depthParen = 0;
  for (let j = start + 1; j < text.length; j++) {
    const ch = text[j];
    if (inDq) {
      if (ch === '"' && text[j - 1] !== "\\") inDq = false;
      continue;
    }
    if (inSq) {
      if (ch === "'" && text[j - 1] !== "\\") inSq = false;
      continue;
    }
    if (ch === '"') {
      inDq = true;
      continue;
    }
    if (ch === "'") {
      inSq = true;
      continue;
    }
    if (ch === "(") {
      depthParen += 1;
      continue;
    }
    if (ch === ")") {
      depthParen = Math.max(0, depthParen - 1);
      continue;
    }
    if (depthParen > 0) continue;
    if (ch === "<") return undefined;
    if (ch === ">") {
      const end = j + 1;
      if (offset >= start && offset <= end) return { start, end };
      return undefined;
    }
  }
  return undefined;
}
