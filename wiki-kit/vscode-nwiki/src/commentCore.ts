/**
 * Region-aware comment helpers (no vscode import).
 * HTML comments inside template; slash / C-style block outside.
 */

/** True if offset lies inside a `<template>…</template>` region. */
export function isOffsetInsideTemplate(text: string, offset: number): boolean {
  const head = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const open = [...head.matchAll(/<template\b[^>]*>/gi)];
  const close = [...head.matchAll(/<\/template\s*>/gi)];
  return open.length > close.length;
}

function lineIsHtmlCommented(trimmed: string): boolean {
  return /^<!--[\s\S]*-->$/.test(trimmed);
}

function lineIsSlashCommented(trimmed: string): boolean {
  return /^\/\//.test(trimmed) && !/^\/\/\//.test(trimmed);
}

function wrapHtmlLine(line: string): string {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const body = line.slice(indent.length);
  if (!body) return `${indent}<!--  -->`;
  return `${indent}<!-- ${body} -->`;
}

function unwrapHtmlLine(line: string): string {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const trimmed = line.trim();
  const body = trimmed.replace(/^<!--\s?/, "").replace(/\s?-->$/, "");
  return indent + body;
}

function wrapSlashLine(line: string): string {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const body = line.slice(indent.length);
  if (!body) return `${indent}// `;
  return `${indent}// ${body}`;
}

function unwrapSlashLine(line: string): string {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const trimmed = line.trim();
  const body = trimmed.replace(/^\/\/\s?/, "");
  return indent + body;
}

/** Pure line-comment toggle for one line. */
export function toggleLineCommentText(
  line: string,
  insideTemplate: boolean
): string {
  const trimmed = line.trim();
  if (insideTemplate) {
    if (lineIsHtmlCommented(trimmed)) return unwrapHtmlLine(line);
    // leftover // from language-config → uncomment
    if (lineIsSlashCommented(trimmed)) return unwrapSlashLine(line);
    return wrapHtmlLine(line);
  }
  if (lineIsSlashCommented(trimmed)) return unwrapSlashLine(line);
  if (lineIsHtmlCommented(trimmed)) return unwrapHtmlLine(line);
  return wrapSlashLine(line);
}

function stripOuter(
  text: string,
  open: string,
  close: string
): string | undefined {
  const t = text.trim();
  if (!t.startsWith(open) || !t.endsWith(close)) return undefined;
  return t
    .slice(open.length, t.length - close.length)
    .replace(/^\n/, "")
    .replace(/\n$/, "");
}

/** Pure block-comment toggle for a selected chunk. */
export function toggleBlockCommentText(
  text: string,
  insideTemplate: boolean
): string {
  if (insideTemplate) {
    const inner = stripOuter(text, "<!--", "-->");
    if (inner !== undefined) return inner;
    const slashBlock = stripOuter(text, "/*", "*/");
    if (slashBlock !== undefined) {
      return `<!--${slashBlock ? `\n${slashBlock}\n` : " "}-->`;
    }
    const body = text.replace(/^\n/, "").replace(/\n$/, "");
    return `<!--\n${body}\n-->`;
  }
  const cInner = stripOuter(text, "/*", "*/");
  if (cInner !== undefined) return cInner;
  const htmlInner = stripOuter(text, "<!--", "-->");
  if (htmlInner !== undefined) return htmlInner;
  const body = text.replace(/^\n/, "").replace(/\n$/, "");
  return `/*\n${body}\n*/`;
}
