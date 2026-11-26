/**
 * nwiki formatter: tag-tree indent, props braces outside <template>,
 * and region-aware comment style (HTML comments inside template; // and block
 * comments outside).
 */

import {
  formatPropItem,
  parsePropsBody,
  sortPropsRequiredFirst,
} from "./propsSyntax";

const BRACE_OPEN_RE = /^(props)\s*\{(.*)$/;

/** Format props body lines with required-first order when parseable. */
function formatPropsBodyLines(items: string[]): string[] {
  const joined = items.filter((x) => x.trim()).join(", ");
  const parsed = parsePropsBody(joined);
  if (parsed.length === 0) {
    return items.filter((x) => x.trim() !== "" || items.length === 1);
  }
  // Only reorder when every non-empty item parsed (avoid scrambling comments).
  const nonEmpty = items.filter((x) => x.trim());
  if (parsed.length !== nonEmpty.length) {
    return nonEmpty;
  }
  return sortPropsRequiredFirst(parsed).map(formatPropItem);
}

export function formatNwiki(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let depth = 0;
  let inTemplate = false;
  let inScript = false;
  let inCBlock = false; // /* … */ spanning lines
  let inHtmlBlock = false; // <!-- … --> spanning lines
  let htmlBlockBuf: string[] = [];
  let cBlockBuf: string[] = [];
  let braceMode: null | { head: string; baseDepth: number; body: string[] } =
    null;

  const flushHtmlBlock = () => {
    const body = htmlBlockBuf.join("\n");
    htmlBlockBuf = [];
    inHtmlBlock = false;
    const inner = body
      .replace(/^<!--/, "")
      .replace(/-->$/, "")
      .trim();
    if (inTemplate) {
      out.push(indent(depth) + `<!-- ${inner.replace(/\n/g, "\n" + indent(depth) + "     ")} -->`);
    } else {
      const parts = inner.split("\n");
      out.push(indent(0) + "/*");
      for (const p of parts) {
        out.push(indent(0) + "  " + p.trim());
      }
      out.push(indent(0) + "*/");
    }
  };

  const flushCBlock = () => {
    const body = cBlockBuf.join("\n");
    cBlockBuf = [];
    inCBlock = false;
    const inner = body
      .replace(/^\/\*/, "")
      .replace(/\*\/$/, "")
      .trim();
    if (inTemplate) {
      out.push(
        indent(depth) +
          `<!-- ${inner.replace(/\n/g, "\n" + indent(depth) + "     ")} -->`
      );
    } else {
      const parts = inner.split("\n");
      out.push("/*");
      for (const p of parts) {
        out.push("  " + p.trim());
      }
      out.push("*/");
    }
  };

  const emitNormalizedLineComment = (trimmed: string, base: number) => {
    // /// doc comments: never rewrite
    if (/^\/\/\//.test(trimmed)) {
      out.push(indent(base) + trimmed);
      return;
    }
    if (/^\/\//.test(trimmed)) {
      const body = trimmed.replace(/^\/\/\s?/, "");
      if (inTemplate) {
        out.push(indent(base) + `<!-- ${body} -->`);
      } else {
        out.push(indent(base) + `// ${body}`);
      }
      return;
    }
    if (/^<!--/.test(trimmed) && /-->$/.test(trimmed)) {
      const body = trimmed.replace(/^<!--\s?/, "").replace(/\s?-->$/, "");
      if (inTemplate) {
        out.push(indent(base) + `<!-- ${body} -->`);
      } else {
        out.push(indent(base) + `// ${body}`);
      }
      return;
    }
    if (/^\/\*/.test(trimmed) && /\*\/$/.test(trimmed) && trimmed !== "/*" && trimmed !== "*/") {
      const body = trimmed.replace(/^\/\*\s?/, "").replace(/\s?\*\/$/, "");
      if (inTemplate) {
        out.push(indent(base) + `<!-- ${body} -->`);
      } else {
        out.push(indent(base) + `/* ${body} */`);
      }
      return;
    }
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const trimmed = raw.trim();

    // ---- multi-line HTML comment gather ----
    if (inHtmlBlock) {
      htmlBlockBuf.push(raw);
      if (trimmed.includes("-->")) flushHtmlBlock();
      continue;
    }
    if (inCBlock) {
      cBlockBuf.push(raw);
      if (trimmed.includes("*/")) flushCBlock();
      continue;
    }

    // Start multi-line HTML comment
    if (trimmed.startsWith("<!--") && !trimmed.includes("-->")) {
      inHtmlBlock = true;
      htmlBlockBuf = [raw];
      continue;
    }
    // Start multi-line /* */
    if (trimmed.startsWith("/*") && !trimmed.includes("*/")) {
      inCBlock = true;
      cBlockBuf = [raw];
      continue;
    }

    // ---- script passthrough (legacy) ----
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

    // ---- brace block (props) outside template ----
    if (braceMode) {
      if (trimmed === "}" || trimmed.endsWith("}")) {
        const before = trimmed === "}" ? "" : trimmed.slice(0, -1).trim();
        if (before) braceMode.body.push(before);
        const formatted = formatPropsBodyLines(braceMode.body);
        for (const b of formatted) {
          out.push(indent(braceMode.baseDepth + 1) + b);
        }
        out.push(indent(braceMode.baseDepth) + "}");
        braceMode = null;
        continue;
      }
      if (trimmed) {
        braceMode.body.push(trimmed.replace(/,\s*$/, "").trim());
      } else if (braceMode.body.length) {
        braceMode.body.push("");
      }
      continue;
    }

    if (!trimmed) {
      out.push("");
      continue;
    }

    // One-line or opening props outside template
    if (!inTemplate) {
      const bm = BRACE_OPEN_RE.exec(trimmed);
      if (bm) {
        const head = bm[1].replace(/\s+/g, " ").trim();
        const rest = (bm[2] || "").trim();
        if (rest.endsWith("}")) {
          // one-liner → expand (required first)
          const inner = rest.slice(0, -1).trim();
          out.push(`${head} {`);
          if (inner) {
            const parts = formatPropsBodyLines(splitBraceItems(inner));
            for (const part of parts) {
              out.push(indent(1) + part);
            }
          }
          out.push("}");
          continue;
        }
        if (rest === "") {
          out.push(`${head} {`);
          braceMode = { head, baseDepth: 0, body: [] };
          continue;
        }
        // `props { name: required` without close yet
        out.push(`${head} {`);
        braceMode = { head, baseDepth: 0, body: [rest.replace(/,\s*$/, "").trim()] };
        continue;
      }
    }

    // Template boundary — children start at depth 1
    if (/^<template\b/i.test(trimmed)) {
      inTemplate = true;
      out.push(trimmed);
      depth = 1;
      continue;
    }
    if (/^<\/template>/i.test(trimmed)) {
      inTemplate = false;
      out.push(trimmed);
      depth = 0;
      continue;
    }

    // Single-line comment / doc / block on one line
    if (
      /^\/\/\//.test(trimmed) ||
      /^\/\//.test(trimmed) ||
      (/^<!--/.test(trimmed) && /-->$/.test(trimmed)) ||
      (/^\/\*/.test(trimmed) && /\*\/$/.test(trimmed))
    ) {
      emitNormalizedLineComment(trimmed, inTemplate ? depth : 0);
      continue;
    }

    if (!inTemplate) {
      // top-level calls / other lines: keep trimmed at column 0
      out.push(trimmed);
      continue;
    }

    // Inside template: tag tree
    for (const part of explodeGluedTags(trimmed)) {
      depth = emitTagLine(out, part, depth);
    }
  }

  // Unclosed gathers — emit raw-ish
  if (inHtmlBlock && htmlBlockBuf.length) {
    for (const l of htmlBlockBuf) out.push(l);
  }
  if (inCBlock && cBlockBuf.length) {
    for (const l of cBlockBuf) out.push(l);
  }
  if (braceMode) {
    for (const b of braceMode.body) {
      out.push(indent(braceMode.baseDepth + 1) + b);
    }
  }

  return (
    out.join("\n").replace(/\n{3,}/g, "\n\n") + (text.endsWith("\n") ? "\n" : "")
  );
}

/** Split `name: required, age` on commas outside nested structures. */
function splitBraceItems(inner: string): string[] {
  const items: string[] = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      const t = buf.trim();
      if (t) items.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const t = buf.trim();
  if (t) items.push(t);
  return items.length ? items : [inner];
}

/**
 * Split `/> <Tag` / `></Tag` / `</A><B` glued on one line (quotes respected).
 */
export function explodeGluedTags(line: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let inDq = false;
  let inSq = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inDq) {
      buf += ch;
      if (ch === '"' && line[i - 1] !== "\\") inDq = false;
      continue;
    }
    if (inSq) {
      buf += ch;
      if (ch === "'" && line[i - 1] !== "\\") inSq = false;
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

    buf += ch;
    if (ch === ">") {
      let j = i + 1;
      while (j < line.length && /\s/.test(line[j])) j++;
      if (j < line.length && line[j] === "<") {
        const t = buf.trim();
        if (t) parts.push(t);
        buf = "";
        i = j - 1;
      }
    }
  }
  const rest = buf.trim();
  if (rest) parts.push(rest);
  return parts.length ? parts : [line];
}

function emitTagLine(out: string[], trimmed: string, depth: number): number {
  const isClose = /^<\//.test(trimmed);
  const isSelfCloseEnd = /^\/>$/.test(trimmed);
  const isOpenAngleEnd = /^>$/.test(trimmed);
  const isSelfOneLine =
    /^<[A-Za-z_]/.test(trimmed) && /\/>$/.test(trimmed);
  const isVoidTag = /^<(br|Space)\b/i.test(trimmed);
  const opensNest =
    /^<[A-Za-z_]/.test(trimmed) &&
    !isClose &&
    !isSelfOneLine &&
    !isVoidTag &&
    !/>.*<\//.test(trimmed);

  if (isClose || isSelfCloseEnd || isOpenAngleEnd) {
    depth = Math.max(0, depth - 1);
  }
  out.push(indent(depth) + trimmed);
  if (opensNest) depth += 1;
  if (isOpenAngleEnd) depth += 1;
  return depth;
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}
