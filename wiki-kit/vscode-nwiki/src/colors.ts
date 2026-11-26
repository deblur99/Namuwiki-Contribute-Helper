import * as vscode from "vscode";

const HEX_LIT = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
const CALL_HEAD = /\b(?:HexColor|\.hex)\s*\(/g;
const PRESET_HEX: Record<string, string> = {
  white: "#fff",
  black: "#000",
};

export type HexEntry = {
  label?: "light" | "dark";
  hex: string;
  range: vscode.Range;
  color: vscode.Color;
};

/** Parse #RGB / #RRGGBB → Color. Alpha lengths rejected. */
export function parseHexColor(raw: string): vscode.Color | undefined {
  let s = raw.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  const body = s.slice(1);
  if (body.length === 4 || body.length === 8) return undefined;
  if (body.length !== 3 && body.length !== 6) return undefined;
  if (!/^[0-9A-Fa-f]+$/.test(body)) return undefined;
  const full =
    body.length === 3
      ? body
          .split("")
          .map((c) => c + c)
          .join("")
      : body;
  const n = parseInt(full, 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return new vscode.Color(r, g, b, 1);
}

function colorToHex6(color: vscode.Color): string {
  const c = (x: number) =>
    Math.round(Math.min(1, Math.max(0, x)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(color.red)}${c(color.green)}${c(color.blue)}`;
}

function swatchHtml(hex: string): string {
  const c = parseHexColor(hex);
  if (!c) return "";
  const css = colorToHex6(c);
  // ~75% of prior 12px swatch — single-color hover only
  return `<span style="display:inline-block;width:9px;height:9px;border:1px solid #888;background:${css};vertical-align:middle;margin-right:4px;"></span>`;
}

/** Single-color hover line (no light/dark pair — picker shows one color at a time). */
export function formatHexHover(entry: HexEntry): vscode.MarkdownString {
  const md = new vscode.MarkdownString(
    `${swatchHtml(entry.hex)}\`${entry.hex}\``
  );
  md.supportHtml = true;
  md.isTrusted = false;
  return md;
}

function findCallBody(
  text: string,
  openParen: number
): { inner: string; start: number; end: number } | undefined {
  let depth = 1;
  let i = openParen + 1;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return {
          inner: text.slice(openParen + 1, i),
          start: openParen + 1,
          end: i,
        };
      }
    } else if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < text.length && text[i] !== q) {
        if (text[i] === "\\") i++;
        i++;
      }
    }
    i++;
  }
  return undefined;
}

function labelNearHex(inner: string, localIndex: number): "light" | "dark" | undefined {
  const before = inner.slice(0, localIndex);
  const light = /(?:^|[,(\s])light\s*[:=]\s*["']?$/i.exec(before);
  if (light) return "light";
  const dark = /(?:^|[,(\s])dark\s*[:=]\s*["']?$/i.exec(before);
  if (dark) return "dark";
  return undefined;
}

/** Static hex literals inside HexColor(...) / .hex(...) across the document. */
export function collectHexEntries(
  document: vscode.TextDocument
): HexEntry[] {
  const text = document.getText();
  const out: HexEntry[] = [];
  const seen = new Set<string>();

  const push = (absStart: number, match: string, label?: "light" | "dark") => {
    const color = parseHexColor(match);
    if (!color) return;
    const key = `${absStart}:${match}`;
    if (seen.has(key)) return;
    seen.add(key);
    const start = document.positionAt(absStart);
    const end = document.positionAt(absStart + match.length);
    out.push({
      label,
      hex: match.startsWith("#") ? match : `#${match}`,
      range: new vscode.Range(start, end),
      color,
    });
  };

  CALL_HEAD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CALL_HEAD.exec(text))) {
    const open = m.index + m[0].length - 1;
    const body = findCallBody(text, open);
    if (!body) continue;
    HEX_LIT.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = HEX_LIT.exec(body.inner))) {
      // skip interpolations: ${...} nearby
      const around = body.inner.slice(
        Math.max(0, hm.index - 2),
        hm.index + hm[0].length + 2
      );
      if (around.includes("${")) continue;
      const label = labelNearHex(body.inner, hm.index);
      push(body.start + hm.index, hm[0], label);
    }
  }

  return out;
}

export function hexHoverAt(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Hover | undefined {
  // Literal #hex: ColorProvider already shows the native picker (one color).
  // Do not append light/dark footer — it widens the hover and duplicates the picker.
  const entries = collectHexEntries(document);
  if (entries.some((e) => e.range.contains(position))) {
    return undefined;
  }

  // HexColor.white / .black preset (no ColorInformation range)
  const wordRange = document.getWordRangeAtPosition(
    position,
    /[A-Za-z_][\w]*/
  );
  if (!wordRange) return undefined;
  const word = document.getText(wordRange);
  const preset = PRESET_HEX[word];
  if (!preset) return undefined;
  const line = document.lineAt(position.line).text;
  const before = line.slice(0, wordRange.start.character);
  if (!/HexColor\.$/.test(before)) return undefined;
  const color = parseHexColor(preset);
  if (!color) return undefined;
  return new vscode.Hover(
    formatHexHover({ hex: preset, range: wordRange, color }),
    wordRange
  );
}

export class NwikiColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument
  ): vscode.ColorInformation[] {
    return collectHexEntries(document).map(
      (e) => new vscode.ColorInformation(e.range, e.color)
    );
  }

  provideColorPresentations(
    color: vscode.Color,
    context: { document: vscode.TextDocument; range: vscode.Range }
  ): vscode.ColorPresentation[] {
    const original = context.document.getText(context.range);
    const body = original.startsWith("#") ? original.slice(1) : original;
    const prefer3 = body.length === 3;
    const hex6 = colorToHex6(color);
    const presentations: vscode.ColorPresentation[] = [
      new vscode.ColorPresentation(hex6),
    ];
    if (prefer3) {
      const r = hex6.slice(1, 3);
      const g = hex6.slice(3, 5);
      const b = hex6.slice(5, 7);
      if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1]) {
        presentations.unshift(
          new vscode.ColorPresentation(`#${r[0]}${g[0]}${b[0]}`)
        );
      }
    }
    return presentations;
  }
}
