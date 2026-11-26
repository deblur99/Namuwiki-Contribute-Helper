/** Built-in value types / constructors (not import bindings). */
export const RESERVED_TYPES = new Set([
  "HexColor",
  "RgbaColor",
  "LayoutLength",
  "TextSize",
  "Spacing",
  "Border",
  "ColorStop",
  "LinearGradient",
  "RepeatingLinearGradient",
  "RadialGradient",
  "Date",
  "CommonFrame",
]);

const IMPORT_FROM_RE =
  /\bimport\s+([A-Za-z_][\w]*)\s+from\s+(?:"[^"]*"|'[^']*')/g;

/** Collect `import Name from "…"` bindings (json + nwiki + assets). */
export function collectImportBindings(text: string): Set<string> {
  const names = new Set<string>();
  IMPORT_FROM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_FROM_RE.exec(text))) {
    names.add(m[1]);
  }
  return names;
}

export function rangesForWord(
  text: string,
  word: string
): { start: number; length: number }[] {
  const out: { start: number; length: number }[] = [];
  const re = new RegExp(
    `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, length: word.length });
  }
  return out;
}

/** Whether offset is inside a // or /* or <!-- comment (rough). */
export function inComment(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  if (/\/\/[^\n]*$/.test(before.split("\n").pop() ?? "")) return true;
  const lastBlock = before.lastIndexOf("/*");
  const lastBlockEnd = before.lastIndexOf("*/");
  if (lastBlock > lastBlockEnd) return true;
  const lastHtml = before.lastIndexOf("<!--");
  const lastHtmlEnd = before.lastIndexOf("-->");
  if (lastHtml > lastHtmlEnd) return true;
  return false;
}
