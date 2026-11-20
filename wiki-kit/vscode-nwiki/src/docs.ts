import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ATTR_DOCS, TAG_DOCS } from "./catalog";
import { collectImportedTags } from "./diagnostics";
import {
  COMMON_FRAME_MEMBERS,
  KNOWN_TYPE_NAMES,
  TYPE_DOCS,
  TYPE_MEMBERS,
} from "./members";
import { findWikiKitRoot } from "./paths";

const DOC_LINE = /^([ \t]*)\/\/\/[ \t]?(.*)$/;
const TAG_OPEN = /^[ \t]*<\/?([A-Za-z_][\w-]*)/;
const TYPE_DECL = /^[ \t]*(?:struct|enum|func)\s+([A-Za-z_][\w]*)/;
const BODY_START = /^[ \t]*(?:<script\b|<template\b|category\s*\(|include(?:Frame)?\s*\(|import\s*\()/i;

export interface DocIndex {
  /** symbol → markdown body (joined /// lines) */
  symbols: Map<string, string>;
  /** file stem component docs from header */
  fileStem?: string;
}

/** Extract consecutive /// blocks and bind to next significant symbol. */
export function indexDocument(
  text: string,
  filePath?: string
): DocIndex {
  const symbols = new Map<string, string>();
  const lines = text.split(/\r?\n/);
  let i = 0;
  let seenBody = false;
  let headerMarkdown: string | undefined;

  while (i < lines.length) {
    const doc = readDocBlock(lines, i);
    if (!doc) {
      if (!seenBody && BODY_START.test(lines[i] ?? "")) {
        seenBody = true;
      }
      i += 1;
      continue;
    }

    const { markdown, end } = doc;
    i = end;
    // skip blank lines between doc and target
    while (i < lines.length && /^[ \t]*$/.test(lines[i])) {
      i += 1;
    }
    const next = lines[i] ?? "";

    if (!seenBody && !BODY_START.test(next) && !TAG_OPEN.test(next) && !TYPE_DECL.test(next)) {
      // still in header — accumulate as file-level (last header block wins / merge)
      headerMarkdown = headerMarkdown
        ? `${headerMarkdown}\n\n${markdown}`
        : markdown;
      continue;
    }

    if (!seenBody && (BODY_START.test(next) || i >= lines.length)) {
      headerMarkdown = headerMarkdown
        ? `${headerMarkdown}\n\n${markdown}`
        : markdown;
      if (BODY_START.test(next)) seenBody = true;
      continue;
    }

    const tag = TAG_OPEN.exec(next);
    if (tag) {
      symbols.set(tag[1], markdown);
      if (BODY_START.test(next)) seenBody = true;
      continue;
    }

    const decl = TYPE_DECL.exec(next);
    if (decl) {
      symbols.set(decl[1], markdown);
      continue;
    }

    if (!seenBody) {
      headerMarkdown = headerMarkdown
        ? `${headerMarkdown}\n\n${markdown}`
        : markdown;
    }
  }

  const stem = filePath
    ? path.basename(filePath, path.extname(filePath))
    : undefined;
  if (headerMarkdown && stem) {
    symbols.set(stem, headerMarkdown);
  }

  return { symbols, fileStem: stem };
}

function readDocBlock(
  lines: string[],
  start: number
): { markdown: string; end: number } | undefined {
  if (!DOC_LINE.test(lines[start] ?? "")) return undefined;
  const parts: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = DOC_LINE.exec(lines[i]);
    if (!m) break;
    parts.push(m[2]);
    i += 1;
  }
  return { markdown: parts.join("\n").trimEnd(), end: i };
}

/** Resolve markdown docs for a symbol under the cursor. */
export function resolveDocsForSymbol(
  document: vscode.TextDocument,
  word: string
): string | undefined {
  const cleaned = word.replace(/^\./, "");
  if (!cleaned) return undefined;

  const text = document.getText();
  const local = indexDocument(text, document.uri.fsPath);
  if (local.symbols.has(cleaned)) {
    return local.symbols.get(cleaned);
  }

  // import(Name) → Name.nwiki header docs
  const imports = collectImportedTags(text);
  if (imports.has(cleaned)) {
    const imported = loadComponentDocs(cleaned, document.uri.fsPath);
    if (imported) return imported;
  }

  // Built-in types
  if (TYPE_DOCS[cleaned]) return TYPE_DOCS[cleaned];
  if (KNOWN_TYPE_NAMES.includes(cleaned) && TYPE_MEMBERS[cleaned]?.documentation) {
    return TYPE_MEMBERS[cleaned].documentation;
  }

  // CommonFrame case
  const frame = COMMON_FRAME_MEMBERS.find((m) => m.name === cleaned);
  if (frame?.documentation) return frame.documentation;
  if (frame?.detail) return `**CommonFrame.${cleaned}** — ${frame.detail}`;

  // Built-in tags
  if (TAG_DOCS[cleaned]) return TAG_DOCS[cleaned];

  // Attributes (one-line)
  if (ATTR_DOCS[cleaned]) return ATTR_DOCS[cleaned];

  return undefined;
}

function loadComponentDocs(
  name: string,
  fromFile: string
): string | undefined {
  const root = findWikiKitRoot(fromFile);
  const dirs: string[] = [path.dirname(fromFile)];
  if (root) {
    dirs.push(path.join(root, "examples"));
  }
  for (const d of dirs) {
    const candidate = path.join(d, `${name}.nwiki`);
    if (!fs.existsSync(candidate)) continue;
    try {
      const text = fs.readFileSync(candidate, "utf8");
      const idx = indexDocument(text, candidate);
      return idx.symbols.get(name);
    } catch {
      continue;
    }
  }
  return undefined;
}

export function wordAt(
  document: vscode.TextDocument,
  position: vscode.Position
): { word: string; range: vscode.Range } | undefined {
  const range = document.getWordRangeAtPosition(
    position,
    /[A-Za-z_][\w-]*/
  );
  if (!range) {
    // allow .adult under cursor on the name part
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, position.character);
    const m = /\.([A-Za-z_][\w]*)$/.exec(before);
    if (m) {
      const start = position.character - m[1].length;
      return {
        word: m[1],
        range: new vscode.Range(
          position.line,
          start,
          position.line,
          position.character
        ),
      };
    }
    return undefined;
  }
  return { word: document.getText(range), range };
}
