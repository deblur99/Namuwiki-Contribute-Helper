import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { findWikiKitRoot, outputPathFor } from "./paths";

let panel: vscode.WebviewPanel | undefined;

/** Open / refresh approximate namuwiki preview for a built .md output. */
export async function showBuildPreview(nwikiFilePath: string): Promise<void> {
  const root = findWikiKitRoot(nwikiFilePath);
  if (!root) {
    vscode.window.showErrorMessage("wiki-kit root not found");
    return;
  }
  const outPath = outputPathFor(nwikiFilePath, root);
  let raw: string;
  try {
    raw = fs.readFileSync(outPath, "utf8");
  } catch {
    vscode.window.showWarningMessage(`Output not found: ${outPath}`);
    return;
  }

  const html = wrapPreviewHtml(namuwikiToApproxHtml(raw), outPath);

  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside, true);
    panel.webview.html = html;
    panel.title = `nwiki preview — ${path.basename(outPath)}`;
    return;
  }

  panel = vscode.window.createWebviewPanel(
    "nwikiPreview",
    `nwiki preview — ${path.basename(outPath)}`,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: false, retainContextWhenHidden: true }
  );
  panel.webview.html = html;
  panel.onDidDispose(() => {
    panel = undefined;
  });
}

export function disposePreview(): void {
  panel?.dispose();
  panel = undefined;
}

function wrapPreviewHtml(body: string, sourcePath: string): string {
  const name = path.basename(sourcePath);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:;" />
<style>
  :root {
    color-scheme: light dark;
    --bg: #f7f7f8;
    --fg: #1c1d1f;
    --muted: #666;
    --border: #ccc;
    --cat: #e8f0fe;
    --inc: #fff3cd;
    --table-border: #87ceeb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1c1d1f;
      --fg: #e8e8e8;
      --muted: #aaa;
      --border: #444;
      --cat: #243044;
      --inc: #3d3420;
    }
  }
  body {
    font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 14px;
    line-height: 1.55;
    color: var(--fg);
    background: var(--bg);
    margin: 0;
    padding: 16px 20px 40px;
  }
  .banner {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .cat {
    display: inline-block;
    background: var(--cat);
    border-radius: 4px;
    padding: 1px 6px;
    margin: 2px 4px 2px 0;
    font-size: 12px;
  }
  .include {
    background: var(--inc);
    border-left: 3px solid #c9a227;
    padding: 6px 10px;
    margin: 8px 0;
    font-size: 12px;
    font-family: ui-monospace, monospace;
  }
  nav.toc {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 13px;
  }
  nav.toc .toc-hint { color: var(--muted); font-weight: 400; }
  .clearfix { clear: both; height: 0; }
  table.wiki {
    border-collapse: collapse;
    margin: 10px 0;
    max-width: 100%;
  }
  table.wiki td {
    border: 1px solid var(--table-border);
    padding: 4px 8px;
    vertical-align: top;
  }
  .wiki-box {
    margin: 8px 0;
  }
  details.fold {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    margin: 8px 0;
  }
  details.fold > summary {
    cursor: pointer;
    font-weight: 600;
  }
  h1,h2,h3,h4,h5,h6 { margin: 1em 0 0.4em; font-weight: 700; }
  a { color: #0645ad; }
  @media (prefers-color-scheme: dark) {
    a { color: #8ab4f8; }
  }
  .footnote {
    font-size: 11px;
    color: var(--muted);
    vertical-align: super;
  }
  .size-up { font-size: 1.15em; }
  .size-down { font-size: 0.85em; }
  img { max-width: 100%; height: auto; }
  blockquote {
    margin: 0.6em 0;
    padding: 0.25em 0.75em;
    border-left: 3px solid var(--muted);
    color: var(--muted);
  }
</style>
</head>
<body>
  <div class="banner">근사 프리뷰 · 나무위키와 다를 수 있음 · <code>${escapeHtml(name)}</code></div>
  ${body}
</body>
</html>`;
}

/** Best-effort namuwiki raw → HTML (not pixel-perfect). */
export function namuwikiToApproxHtml(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");
  s = convertWikiBlocks(s);
  s = convertTables(s);
  s = convertToc(s);
  s = convertHeadings(s);
  s = convertQuotes(s);
  s = convertInline(s);
  // remaining bare newlines → <br> outside block tags is noisy; keep paragraphs
  s = s
    .split(/\n{2,}/)
    .map((p) => {
      const t = p.trim();
      if (!t) return "";
      if (/^<(?:div|table|h\d|details|p)\b/i.test(t)) return t;
      return `<p>${t.replace(/\n/g, "<br>\n")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
  return s;
}

function convertWikiBlocks(s: string): string {
  // Iteratively replace innermost {{{ ... }}}
  let prev = "";
  let guard = 0;
  while (s !== prev && guard++ < 40) {
    prev = s;
    s = s.replace(/\{\{\{#!wiki style="([^"]*)"([\s\S]*?)\}\}\}/g, (_m, style, body) => {
      return `<div class="wiki-box" style="${escapeAttr(style)}">${body.trim()}</div>`;
    });
    s = s.replace(/\{\{\{#!folding\s*([^\n]*)\n([\s\S]*?)\}\}\}/g, (_m, title, body) => {
      const t = String(title).trim() || "접기";
      return `<details class="fold"><summary>${escapeHtml(t)}</summary>${body.trim()}</details>`;
    });
    s = s.replace(/\{\{\{([+-]\d+)\s+([\s\S]*?)\}\}\}/g, (_m, step, body) => {
      const n = parseInt(step, 10);
      const cls = n >= 0 ? "size-up" : "size-down";
      return `<span class="${cls}">${body}</span>`;
    });
    // leftover plain {{{ ... }}} → unwrap
    s = s.replace(/\{\{\{([\s\S]*?)\}\}\}/g, "$1");
  }
  return s;
}

function convertTables(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("||")) {
      const rows: string[] = [];
      let tableAttrs = "";
      while (i < lines.length && lines[i].startsWith("||")) {
        rows.push(lines[i]);
        i += 1;
      }
      // pull table* attrs from first cell markup
      const first = rows[0] ?? "";
      const am = /<tablealign=([^>]+)>/.exec(first);
      const wm = /<tablewidth=([^>]+)>/.exec(first);
      const styles: string[] = [];
      if (am) {
        const a = am[1];
        if (a === "right") styles.push("margin-left:auto");
        if (a === "center") styles.push("margin-left:auto;margin-right:auto");
      }
      if (wm) styles.push(`width:${wm[1]}${/^\d+$/.test(wm[1]) ? "px" : ""}`);
      tableAttrs = styles.length ? ` style="${styles.join(";")}"` : "";
      const htmlRows = rows.map(rowToHtml).join("");
      out.push(`<table class="wiki"${tableAttrs}>${htmlRows}</table>`);
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return out.join("\n");
}

function rowToHtml(line: string): string {
  // ||cell||cell||  — cells may contain <attrs>
  let body = line;
  if (body.startsWith("||")) body = body.slice(2);
  if (body.endsWith("||")) body = body.slice(0, -2);
  const cells = body.split("||");
  const tds = cells.map((cell) => {
    let c = cell;
    let attrs = "";
    // consume leading <...> control tokens
    for (;;) {
      const m = /^<([^>]+)>/.exec(c);
      if (!m) break;
      const tok = m[1];
      c = c.slice(m[0].length);
      if (/^-\d+$/.test(tok) || tok.startsWith("-")) {
        const n = tok.replace(/^-/, "");
        if (/^\d+$/.test(n)) attrs += ` colspan="${n}"`;
      } else if (tok.startsWith("width=")) {
        attrs += ` style="width:${tok.slice(6)}"`;
      } else if (tok === "nopad") {
        attrs += ` style="padding:0"`;
      }
      // skip table*/col* — already handled at table level
    }
    return `<td${attrs}>${c.trim()}</td>`;
  });
  return `<tr>${tds.join("")}</tr>`;
}

function convertToc(s: string): string {
  return s
    .replace(
      /^\[목차\]\s*$/gm,
      '<nav class="toc"><strong>목차</strong> <span class="toc-hint">(위키에서 문단으로 채움)</span></nav>'
    )
    .replace(/^\[clearfix\]\s*$/gm, '<div class="clearfix"></div>');
}

function convertHeadings(s: string): string {
  return s.replace(
    /^(={1,6})#?\s*(.+?)\s*#?\1\s*$/gm,
    (_m, eq: string, title: string) => {
      const level = Math.min(eq.length, 6);
      return `<h${level}>${title}</h${level}>`;
    }
  );
}

/** Consecutive `> …` lines → one blockquote (namuwiki 인용구). */
function convertQuotes(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const inner = buf.map((l) => l.replace(/^>\s?/, "")).join("<br>\n");
    out.push(`<blockquote>${inner}</blockquote>`);
    buf = [];
  };
  for (const line of lines) {
    if (/^>\s?/.test(line)) {
      buf.push(line);
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join("\n");
}

function convertInline(s: string): string {
  // categories
  s = s.replace(/\[\[분류:([^\]]+)\]\]/g, (_m, name) => {
    return `<span class="cat">분류:${escapeHtml(name)}</span>`;
  });
  // include macros
  s = s.replace(/\[include\(([^)]*)\)\]/g, (_m, body) => {
    return `<div class="include">[include(${escapeHtml(body)})]</div>`;
  });
  // images [[파일:name|width=…]]
  s = s.replace(/\[\[파일:([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_m, name) => {
    return `<span class="cat">[파일:${escapeHtml(name)}]</span>`;
  });
  // links [[url|label]] or [[doc|label]] or [[doc]]
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, href, label) => {
    const h = String(href);
    if (/^https?:\/\//.test(h)) {
      return `<a href="${escapeAttr(h)}">${label}</a>`;
    }
    return `<a href="#">${label}</a>`;
  });
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, doc) => {
    return `<a href="#">${escapeHtml(doc)}</a>`;
  });
  // footnotes [* …]
  s = s.replace(/\[\*\s*([^\]]*)\]/g, (_m, note) => {
    return `<span class="footnote" title="${escapeAttr(note)}">[*]</span>`;
  });
  s = s.replace(/\[br\]/gi, "<br>");
  // bold / italic / strike (order matters)
  s = s.replace(/'''([\s\S]*?)'''/g, "<strong>$1</strong>");
  s = s.replace(/''([\s\S]*?)''/g, "<em>$1</em>");
  s = s.replace(/--([\s\S]*?)--/g, "<s>$1</s>");
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
