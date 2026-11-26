import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  titleFromFolder,
  titleFromNwikiJson,
  titleFromSource,
} from "./docTitle";
import { findWikiKitRoot, outputPathFor } from "./paths";

let panel: vscode.WebviewPanel | undefined;

/** Resolve preview page title from nwiki source (sync; no input prompt). */
function resolvePreviewTitle(nwikiFilePath: string, outPath: string): string {
  const fromJson = titleFromNwikiJson(nwikiFilePath);
  if (fromJson) return fromJson;
  try {
    const fromSrc = titleFromSource(fs.readFileSync(nwikiFilePath, "utf8"));
    if (fromSrc) return fromSrc;
  } catch {
    /* missing source */
  }
  const fromFolder = titleFromFolder(nwikiFilePath);
  if (fromFolder) return fromFolder;
  return path.basename(outPath, ".md");
}

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

  const docTitle = resolvePreviewTitle(nwikiFilePath, outPath);
  const html = wrapPreviewHtml(namuwikiToApproxHtml(raw), outPath, docTitle);

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
    { enableScripts: true, retainContextWhenHidden: true }
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

function wrapPreviewHtml(
  body: string,
  sourcePath: string,
  docTitle: string
): string {
  const name = path.basename(sourcePath);
  return `<!DOCTYPE html>
<html lang="ko" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https: data:;" />
<style>
  :root, html[data-theme="light"] {
    color-scheme: light;
    --bg: #f7f7f8;
    --fg: #1c1d1f;
    --muted: #666;
    --border: #ccc;
    --cat: #e8f0fe;
    --inc: #fff3cd;
    --table-border: #87ceeb;
    --chrome: #ececef;
    --chrome-fg: #333;
    --stage: #d8d8dc;
    --frame: #fff;
    --link: #0645ad;
  }
  html[data-theme="dark"] {
    color-scheme: dark;
    --bg: #1c1d1f;
    --fg: #e8e8e8;
    --muted: #aaa;
    --border: #444;
    --cat: #243044;
    --inc: #3d3420;
    --table-border: #87ceeb;
    --chrome: #2a2b2e;
    --chrome-fg: #ddd;
    --stage: #121314;
    --frame: #1c1d1f;
    --link: #8ab4f8;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
  }
  body {
    font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 14px;
    line-height: 1.55;
    color: var(--fg);
    background: var(--chrome);
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .toolbar {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    padding: 8px 12px;
    background: var(--chrome);
    border-bottom: 1px solid var(--border);
    color: var(--chrome-fg);
    font-size: 12px;
    position: sticky;
    top: 0;
    z-index: 5;
  }
  .toolbar label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .toolbar select, .toolbar button, .toolbar input[type="text"] {
    font: inherit;
    color: var(--chrome-fg);
    background: var(--frame);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
  }
  .toolbar input[type="text"] {
    cursor: text;
    width: 4.2em;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .toolbar button.active {
    outline: 2px solid var(--table-border);
    outline-offset: 1px;
  }
  .toolbar .sep {
    width: 1px;
    height: 18px;
    background: var(--border);
  }
  .toolbar .spacer {
    flex: 1 1 auto;
    min-width: 12px;
  }
  .toolbar .meta {
    color: var(--muted);
  }
  .toolbar .size-label {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    min-width: 7.5em;
  }
  .toolbar .zoom-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .toolbar .notice {
    color: var(--muted);
    font-size: 11px;
    max-width: 14em;
    line-height: 1.3;
  }
  .stage {
    flex: 1 1 auto;
    overflow: auto;
    background: var(--stage);
    padding: 16px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  .viewport-slot {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  .viewport {
    background: var(--frame);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,.18);
    overflow: auto;
    width: 100%;
    max-width: none;
    min-height: 120px;
    transform-origin: top center;
  }
  .viewport.phone {
    border-radius: 18px;
  }
  .doc {
    padding: 16px 20px 40px;
    background: var(--bg);
    color: var(--fg);
    min-height: 100%;
  }
  .doc-title {
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    font-size: calc(1.15em * 1.15 * 1.15);
    font-weight: 700;
    line-height: 1.25;
    color: var(--fg);
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
  .wiki-box { margin: 8px 0; }
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
  a { color: var(--link); }
  .footnote {
    font-size: 11px;
    color: var(--muted);
    vertical-align: super;
  }
  .size-up { font-size: 1.15em; }
  .size-down { font-size: 0.85em; }
  .wiki-color[data-dark] { color: var(--wiki-color-light); }
  html[data-theme="dark"] .wiki-color[data-dark] { color: var(--wiki-color-dark); }
  td.wiki-dual-fg, .wiki-dual-fg { color: var(--wiki-dual-fg-light); }
  html[data-theme="dark"] td.wiki-dual-fg,
  html[data-theme="dark"] .wiki-dual-fg { color: var(--wiki-dual-fg-dark); }
  img { max-width: 100%; height: auto; }
  blockquote {
    margin: 0.6em 0;
    padding: 0.25em 0.75em;
    border-left: 3px solid var(--muted);
    color: var(--muted);
  }
  ul {
    margin: 0.4em 0;
    padding-left: 1.4em;
    list-style-type: disc;
  }
  ul ul { list-style-type: circle; }
</style>
</head>
<body>
  <div class="toolbar" role="toolbar" aria-label="프리뷰 컨트롤">
    <label>테마
      <button type="button" id="theme-light" data-theme-btn="light" title="라이트">라이트</button>
      <button type="button" id="theme-dark" data-theme-btn="dark" title="다크">다크</button>
    </label>
    <span class="sep" aria-hidden="true"></span>
    <label>뷰포트
      <select id="viewport-preset" aria-label="뷰포트 프리셋">
        <optgroup label="유동">
          <option value="fluid">전체 너비</option>
        </optgroup>
        <optgroup label="모바일">
          <option value="phone-s">폰 소형 · 360×640</option>
          <option value="phone-m" selected>폰 중형 · 390×844</option>
          <option value="phone-l">폰 대형 · 430×932</option>
        </optgroup>
        <optgroup label="태블릿">
          <option value="tablet-p">태블릿 세로 · 768×1024</option>
          <option value="tablet-l">태블릿 가로 · 1024×768</option>
        </optgroup>
        <optgroup label="데스크탑">
          <option value="desk-s">데스크탑 소형 · 1024×768</option>
          <option value="desk-m">데스크탑 중형 · 1280×800</option>
          <option value="desk-l">데스크탑 대형 · 1440×900</option>
        </optgroup>
      </select>
    </label>
    <span class="size-label" id="size-label">390 × 844</span>
    <span class="spacer" aria-hidden="true"></span>
    <span class="meta">근사 프리뷰 · <code>${escapeHtml(name)}</code></span>
    <span class="sep" aria-hidden="true"></span>
    <label class="zoom-group">배율
      <input type="text" id="zoom-input" value="100%" inputmode="numeric" aria-label="배율 퍼센트" />
      <select id="zoom-preset" aria-label="배율 프리셋">
        <option value="50">50%</option>
        <option value="75">75%</option>
        <option value="100" selected>100%</option>
        <option value="125">125%</option>
        <option value="150">150%</option>
        <option value="200">200%</option>
      </select>
    </label>
    <span class="notice">나무위키와 다를 수 있음</span>
  </div>
  <div class="stage">
    <div class="viewport-slot" id="viewport-slot">
      <div class="viewport phone" id="viewport">
        <div class="doc">
          <h1 class="doc-title">${escapeHtml(docTitle)}</h1>
          ${body}
        </div>
      </div>
    </div>
  </div>
<script>
(function () {
  var PRESETS = {
    fluid: { w: null, h: null, phone: false, label: "유동" },
    "phone-s": { w: 360, h: 640, phone: true, label: "360 × 640" },
    "phone-m": { w: 390, h: 844, phone: true, label: "390 × 844" },
    "phone-l": { w: 430, h: 932, phone: true, label: "430 × 932" },
    "tablet-p": { w: 768, h: 1024, phone: false, label: "768 × 1024" },
    "tablet-l": { w: 1024, h: 768, phone: false, label: "1024 × 768" },
    "desk-s": { w: 1024, h: 768, phone: false, label: "1024 × 768" },
    "desk-m": { w: 1280, h: 800, phone: false, label: "1280 × 800" },
    "desk-l": { w: 1440, h: 900, phone: false, label: "1440 × 900" }
  };
  var ZOOM_OPTIONS = [50, 75, 100, 125, 150, 200];
  var ZOOM_MIN = 25;
  var ZOOM_MAX = 300;
  var ZOOM_STEP = 5;

  var root = document.documentElement;
  var slot = document.getElementById("viewport-slot");
  var vp = document.getElementById("viewport");
  var sel = document.getElementById("viewport-preset");
  var sizeLabel = document.getElementById("size-label");
  var zoomInput = document.getElementById("zoom-input");
  var zoomSel = document.getElementById("zoom-preset");
  var KEY_THEME = "nwiki.preview.theme";
  var KEY_VP = "nwiki.preview.viewport";
  var KEY_ZOOM = "nwiki.preview.zoom";
  var currentVp = "phone-m";
  var zoomPct = 100;

  function clampZoom(n) {
    n = Math.round(n / ZOOM_STEP) * ZOOM_STEP;
    if (n < ZOOM_MIN) return ZOOM_MIN;
    if (n > ZOOM_MAX) return ZOOM_MAX;
    return n;
  }

  function parseZoom(text) {
    var m = String(text || "").trim().match(/^(\\d+(?:\\.\\d+)?)\\s*%?$/);
    if (!m) return null;
    return clampZoom(parseFloat(m[1]));
  }

  function setTheme(theme) {
    var dark = theme === "dark";
    root.setAttribute("data-theme", dark ? "dark" : "light");
    try { localStorage.setItem(KEY_THEME, dark ? "dark" : "light"); } catch (e) {}
    document.querySelectorAll("[data-theme-btn]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-theme-btn") === (dark ? "dark" : "light"));
    });
    document.querySelectorAll("[data-bg-light],[data-bd-light]").forEach(function (el) {
      var bgL = el.getAttribute("data-bg-light");
      var bgD = el.getAttribute("data-bg-dark") || bgL;
      var bdL = el.getAttribute("data-bd-light");
      var bdD = el.getAttribute("data-bd-dark") || bdL;
      if (bgL) el.style.backgroundColor = dark ? bgD : bgL;
      if (bdL) el.style.borderColor = dark ? bdD : bdL;
    });
  }

  function syncZoomControls() {
    zoomInput.value = zoomPct + "%";
    var match = ZOOM_OPTIONS.indexOf(zoomPct) >= 0 ? String(zoomPct) : "";
    if (match) {
      zoomSel.value = match;
    } else {
      // keep select showing closest without forcing a preset value
      zoomSel.selectedIndex = -1;
    }
  }

  function applyLayout() {
    var p = PRESETS[currentVp] || PRESETS.fluid;
    var z = zoomPct / 100;
    vp.classList.toggle("phone", !!p.phone);
    sizeLabel.textContent = p.label;
    vp.style.transform = "scale(" + z + ")";
    vp.style.transformOrigin = "top center";

    if (p.w == null) {
      vp.style.width = "100%";
      vp.style.height = "auto";
      vp.style.maxHeight = "none";
      slot.style.width = "100%";
      slot.style.height = "auto";
    } else {
      vp.style.width = p.w + "px";
      vp.style.height = p.h + "px";
      vp.style.maxHeight = "none";
      slot.style.width = Math.round(p.w * z) + "px";
      slot.style.height = Math.round(p.h * z) + "px";
    }
  }

  function setZoom(pct, persist) {
    zoomPct = clampZoom(pct);
    syncZoomControls();
    applyLayout();
    if (persist !== false) {
      try { localStorage.setItem(KEY_ZOOM, String(zoomPct)); } catch (e) {}
    }
  }

  function applyViewport(id) {
    currentVp = PRESETS[id] ? id : "phone-m";
    applyLayout();
    try { localStorage.setItem(KEY_VP, currentVp); } catch (e) {}
  }

  function bumpZoom(delta) {
    setZoom(zoomPct + delta);
  }

  document.querySelectorAll("[data-theme-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTheme(btn.getAttribute("data-theme-btn"));
    });
  });
  sel.addEventListener("change", function () {
    applyViewport(sel.value);
  });
  zoomSel.addEventListener("change", function () {
    setZoom(parseInt(zoomSel.value, 10));
  });
  zoomInput.addEventListener("change", function () {
    var n = parseZoom(zoomInput.value);
    if (n == null) {
      syncZoomControls();
      return;
    }
    setZoom(n);
  });
  zoomInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      zoomInput.blur();
    }
  });

  window.addEventListener("wheel", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    bumpZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    var inField = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT");
    if (inField && (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "0")) {
      // allow typing in zoom field; still handle when not composing digits awkwardly
      if (e.target === zoomInput) return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      bumpZoom(ZOOM_STEP);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      bumpZoom(-ZOOM_STEP);
    } else if (e.key === "0") {
      e.preventDefault();
      setZoom(100);
    }
  });

  var savedTheme = "light";
  var savedVp = "phone-m";
  var savedZoom = 100;
  try {
    savedTheme = localStorage.getItem(KEY_THEME) || savedTheme;
    savedVp = localStorage.getItem(KEY_VP) || savedVp;
    var zRaw = localStorage.getItem(KEY_ZOOM);
    if (zRaw != null) savedZoom = clampZoom(parseFloat(zRaw));
  } catch (e) {}
  if (!PRESETS[savedVp]) savedVp = "phone-m";
  setTheme(savedTheme);
  sel.value = savedVp;
  currentVp = savedVp;
  zoomPct = savedZoom;
  syncZoomControls();
  applyLayout();
})();
</script>
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
  s = convertLists(s);
  s = convertInline(s);
  // remaining bare newlines → <br> outside block tags is noisy; keep paragraphs
  s = s
    .split(/\n{2,}/)
    .map((p) => {
      const t = p.trim();
      if (!t) return "";
      if (/^<(?:div|table|h\d|details|p|ul|ol|li|blockquote)\b/i.test(t)) return t;
      return `<p>${t.replace(/\n/g, "<br>\n")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
  return s;
}

/**
 * Convert {{{ … }}} blocks using brace depth so nested wiki/size/color
 * do not stop at the first }}}. Innermost balanced blocks first.
 */
function convertWikiBlocks(s: string): string {
  let guard = 0;
  while (guard++ < 80) {
    const block = findInnermostTripleBrace(s);
    if (!block) break;
    const rendered = renderTripleBraceInner(block.inner);
    s = s.slice(0, block.start) + rendered + s.slice(block.end);
  }
  return s;
}

/** Find the first {{{ … }}} whose body has no nested {{{ (innermost). */
function findInnermostTripleBrace(
  s: string
): { start: number; end: number; inner: string } | null {
  let i = 0;
  while (i < s.length) {
    if (!s.startsWith("{{{", i)) {
      i += 1;
      continue;
    }
    const open = i;
    let j = i + 3;
    let depth = 1;
    let firstNested = -1;
    while (j < s.length && depth > 0) {
      if (s.startsWith("{{{", j)) {
        if (depth === 1 && firstNested < 0) firstNested = j;
        depth += 1;
        j += 3;
        continue;
      }
      if (s.startsWith("}}}", j)) {
        depth -= 1;
        j += 3;
        continue;
      }
      j += 1;
    }
    if (depth !== 0) {
      i += 1;
      continue;
    }
    if (firstNested < 0) {
      return {
        start: open,
        end: j,
        inner: s.slice(open + 3, j - 3),
      };
    }
    // Dive into the first nested open inside this block.
    i = firstNested;
  }
  return null;
}

function renderTripleBraceInner(inner: string): string {
  // {{{#!wiki style="…"\nbody}}} or {{{#!wiki\nbody}}}
  const wikiStyle = /^#!wiki\s+style="([^"]*)"\s*\n?([\s\S]*)$/.exec(inner);
  if (wikiStyle) {
    const style = wikiStyle[1];
    const body = wikiStyle[2].trim();
    return `<div class="wiki-box" style="${escapeAttr(style)}">${body}</div>`;
  }
  const wikiPlain = /^#!wiki\s*\n?([\s\S]*)$/.exec(inner);
  if (wikiPlain) {
    return `<div class="wiki-box">${wikiPlain[1].trim()}</div>`;
  }

  const folding = /^#!folding\s*([^\n]*)\n([\s\S]*)$/.exec(inner);
  if (folding) {
    const t = folding[1].trim() || "접기";
    return `<details class="fold"><summary>${escapeHtml(t)}</summary>${folding[2].trim()}</details>`;
  }

  const size = /^([+-]\d+)\s+([\s\S]*)$/.exec(inner);
  if (size) {
    const n = parseInt(size[1], 10);
    const cls = n >= 0 ? "size-up" : "size-down";
    return `<span class="${cls}">${size[2]}</span>`;
  }

  // {{{#RRGGBB text}}} / {{{#fff text}}} / {{{#light,#dark text}}}
  const color = /^(#[0-9A-Fa-f]{3,8}(?:,#[0-9A-Fa-f]{3,8})?)\s+([\s\S]*)$/.exec(
    inner
  );
  if (color) {
    return wikiColorSpan(color[1], color[2]);
  }

  // leftover plain {{{ … }}} → unwrap
  return inner;
}

function wikiColorSpan(colorToken: string, body: string): string {
  const parts = colorToken.split(",").map((c) => c.trim());
  const light = parts[0] ?? colorToken;
  if (parts.length >= 2) {
    const dark = parts[1];
    return (
      `<span class="wiki-color" data-dark` +
      ` style="color:${escapeAttr(light)};--wiki-color-light:${escapeAttr(light)};--wiki-color-dark:${escapeAttr(dark)}">` +
      `${body}</span>`
    );
  }
  return `<span class="wiki-color" style="color:${escapeAttr(light)}">${body}</span>`;
}

function convertTables(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("||")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("||")) {
        rows.push(lines[i]);
        i += 1;
      }
      // pull table* attrs from first cell markup
      const first = rows[0] ?? "";
      const am = /<tablealign=([^>]+)>/.exec(first);
      const wm = /<tablewidth=([^>]+)>/.exec(first);
      const bm = /<tablebordercolor=([^>]+)>/.exec(first);
      const bgm = /<tablebgcolor=([^>]+)>/.exec(first);
      const styles: string[] = [];
      if (am) {
        const a = am[1].trim();
        if (a === "right") styles.push("margin-left:auto");
        if (a === "center") {
          // Position the table; also inherit text-align so single-cell
          // banners with only tablealign=center read as centered (wiki
          // cell center is normally <:> — both are honored).
          styles.push("margin-left:auto");
          styles.push("margin-right:auto");
          styles.push("text-align:center");
        }
        if (a === "left") styles.push("margin-right:auto");
      }
      if (wm) {
        const w = wm[1].trim();
        styles.push(`width:${w}${/^\d+$/.test(w) ? "px" : ""}`);
      }
      const tableBg = bgm ? splitThemeColors(bgm[1].trim()) : undefined;
      const tableBd = bm ? splitThemeColors(bm[1].trim()) : undefined;
      const styleAttr = styles.length ? ` style="${styles.join(";")}"` : "";
      const htmlRows = rows
        .map((row) => rowToHtml(row, tableBg, tableBd))
        .join("");
      out.push(`<table class="wiki"${styleAttr}>${htmlRows}</table>`);
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return out.join("\n");
}

function splitThemeColors(token: string): { light: string; dark?: string } {
  const parts = token
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return { light: parts[0], dark: parts[1] };
  return { light: parts[0] || token };
}

/**
 * `#light` or `#light,#dark` → inline CSS vars + class that follows data-theme.
 * kind: bg (background) | fg (color) | bd (border-color)
 */
function dualThemeStyle(
  kind: "bg" | "fg" | "bd",
  token: string
): { styles: string[]; className: string } {
  const { light, dark } = splitThemeColors(token);
  const prop =
    kind === "bg"
      ? "background-color"
      : kind === "fg"
        ? "color"
        : "border-color";
  if (!dark) {
    return { styles: [`${prop}:${light}`], className: "" };
  }
  const className =
    kind === "bg" ? "wiki-dual-bg" : kind === "fg" ? "wiki-dual-fg" : "wiki-dual-bd";
  const varL =
    kind === "bg"
      ? "--wiki-dual-bg-light"
      : kind === "fg"
        ? "--wiki-dual-fg-light"
        : "--wiki-dual-bd-light";
  const varD =
    kind === "bg"
      ? "--wiki-dual-bg-dark"
      : kind === "fg"
        ? "--wiki-dual-fg-dark"
        : "--wiki-dual-bd-dark";
  return {
    styles: [`${varL}:${light}`, `${varD}:${dark}`, `${prop}:var(${varL})`],
    className,
  };
}

function rowToHtml(
  line: string,
  tableBg?: { light: string; dark?: string },
  tableBd?: { light: string; dark?: string }
): string {
  // ||cell||cell||  — cells may contain <attrs>
  let body = line;
  if (body.startsWith("||")) body = body.slice(2);
  if (body.endsWith("||")) body = body.slice(0, -2);
  const cells = body.split("||");
  const tds = cells.map((cell) => {
    let c = cell;
    const styleParts: string[] = [];
    const classNames: string[] = [];
    let attrs = "";
    let cellAlign: string | undefined;
    let hasOwnBg = false;
    const applyCellBg = (token: string) => {
      const { light, dark } = splitThemeColors(token);
      const d = dark ?? light;
      attrs += ` data-bg-light="${escapeAttr(light)}" data-bg-dark="${escapeAttr(d)}"`;
      styleParts.push(`background-color:${light}`);
    };
    // consume leading <...> control tokens
    // namuwiki: <:> center, <(> left, <)> right → tok is ":" / "(" / ")"
    for (;;) {
      const m = /^<([^>]+)>/.exec(c);
      if (!m) break;
      const tok = m[1];
      c = c.slice(m[0].length);
      if (tok === ":") {
        cellAlign = "center";
      } else if (tok === "(") {
        cellAlign = "left";
      } else if (tok === ")") {
        cellAlign = "right";
      } else if (/^-\d+$/.test(tok)) {
        attrs += ` colspan="${tok.slice(1)}"`;
      } else if (tok.startsWith("width=")) {
        styleParts.push(`width:${tok.slice(6)}`);
      } else if (tok === "nopad") {
        styleParts.push("padding:0");
      } else if (tok.startsWith("colbgcolor=")) {
        applyCellBg(tok.slice("colbgcolor=".length));
        hasOwnBg = true;
      } else if (tok.startsWith("colcolor=")) {
        const dual = dualThemeStyle("fg", tok.slice("colcolor=".length));
        styleParts.push(...dual.styles);
        if (dual.className) classNames.push(dual.className);
      } else if (tok.startsWith("bgcolor=")) {
        applyCellBg(tok.slice("bgcolor=".length));
        hasOwnBg = true;
      } else if (/^#[0-9A-Fa-f]{3,8}(?:,#[0-9A-Fa-f]{3,8})?$/.test(tok)) {
        applyCellBg(tok);
        hasOwnBg = true;
      } else if (
        tok.startsWith("tablealign=") ||
        tok.startsWith("tablewidth=") ||
        tok.startsWith("tablebordercolor=") ||
        tok.startsWith("tablebgcolor=")
      ) {
        // handled at table level → applied to each td below
      }
    }

    if (!hasOwnBg && tableBg) {
      const dark = tableBg.dark ?? tableBg.light;
      attrs += ` data-bg-light="${escapeAttr(tableBg.light)}" data-bg-dark="${escapeAttr(dark)}"`;
      styleParts.push(`background-color:${tableBg.light}`);
    }
    if (tableBd) {
      const dark = tableBd.dark ?? tableBd.light;
      attrs += ` data-bd-light="${escapeAttr(tableBd.light)}" data-bd-dark="${escapeAttr(dark)}"`;
      styleParts.push(`border-color:${tableBd.light}`);
    }

    if (cellAlign) {
      styleParts.push(`text-align:${cellAlign}`);
    }

    if (classNames.length) {
      attrs += ` class="${classNames.join(" ")}"`;
    }
    if (styleParts.length) {
      attrs += ` style="${styleParts.join(";")}"`;
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

/** Consecutive ` · …` / `  · …` lines → nested `<ul><li>` (middle-dot bullets). */
function convertLists(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  type Item = { depth: number; text: string };
  let buf: Item[] = [];

  const flush = () => {
    if (!buf.length) return;
    out.push(itemsToUlHtml(buf));
    buf = [];
  };

  for (const line of lines) {
    const m = /^( +)·(?: (.*)|)$/.exec(line);
    if (m) {
      buf.push({ depth: m[1].length, text: m[2] ?? "" });
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join("\n");
}

function itemsToUlHtml(items: { depth: number; text: string }[]): string {
  const rootDepth = Math.min(...items.map((i) => i.depth));
  let html = "";
  let depth = rootDepth - 1;
  for (const item of items) {
    while (depth < item.depth) {
      html += "<ul>";
      depth++;
    }
    while (depth > item.depth) {
      html += "</ul>";
      depth--;
    }
    html += `<li>${item.text}</li>`;
  }
  while (depth >= rootDepth) {
    html += "</ul>";
    depth--;
  }
  return html;
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
