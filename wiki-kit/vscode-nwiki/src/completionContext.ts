/**
 * Pure completion-context helpers (no vscode). Testable with string fixtures.
 */

import {
  ATTR_ENUMS,
  ATTR_TYPES,
  TYPE_MEMBERS,
  TypeMember,
} from "./members";

/** Attribute names whose value is `[Enum, …]` (snippet `attr=[$0]`). */
export const ATTR_LIST_ATTRS = new Set<string>(["decoration"]);

/** Keyword args for `Type(…)` constructors (label completion). */
export const CALL_KWARGS: Record<string, string[]> = {
  Spacing: ["vertical", "horizontal", "top", "right", "bottom", "left"],
  Border: ["width", "style", "color"],
  HexColor: ["light", "dark"],
  ColorStop: ["at", "until"],
  LinearGradient: ["direction", "angle"],
  RadialGradient: ["atX", "atY"],
};

/** Enum values after `label:` (or bare `.` for Spacing sides). */
export const CALL_KWARG_VALUE_ENUMS: Record<
  string,
  Record<string, string[]>
> = {
  Spacing: {
    "*": [".auto"],
    vertical: [".auto"],
    horizontal: [".auto"],
    top: [".auto"],
    right: [".auto"],
    bottom: [".auto"],
    left: [".auto"],
  },
  Border: {
    style: [".solid", ".dashed", ".dotted", ".double", ".none"],
  },
  LinearGradient: {
    direction: [
      ".toRight",
      ".toLeft",
      ".toBottom",
      ".toTop",
      ".toBottomRight",
      ".toBottomLeft",
      ".toTopRight",
      ".toTopLeft",
    ],
  },
  RadialGradient: {
    "*": [".circle", ".ellipse"],
  },
  ColorStop: {
    "*": [".transparent"],
  },
};

export type OpenCall = {
  name: string;
  /** Args text from `(` up to cursor (position checks). */
  inside: string;
  /** Full args text until matching `)` (or EOF) — for “already set” filtering. */
  fullInside: string;
};

/**
 * Innermost known `Name(…` call containing `offset`.
 */
export function openCallFromText(
  text: string,
  offset: number
): OpenCall | undefined {
  let i = offset - 1;
  let depth = 0;
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
    if (ch === ")") {
      depth += 1;
      i -= 1;
      continue;
    }
    if (ch === "(") {
      if (depth === 0) {
        const before = text.slice(0, i);
        const m = /([A-Za-z_][\w]*)\s*$/.exec(before);
        if (m && CALL_KWARGS[m[1]]) {
          const fullInside = sliceBalancedArgs(text, i + 1);
          return {
            name: m[1],
            inside: text.slice(i + 1, offset),
            fullInside,
          };
        }
        return undefined;
      }
      depth -= 1;
      i -= 1;
      continue;
    }
    i -= 1;
  }
  return undefined;
}

/** From first char inside `(`, take until matching `)` (quotes respected). */
function sliceBalancedArgs(text: string, start: number): string {
  let depth = 0;
  let inDq = false;
  let inSq = false;
  for (let j = start; j < text.length; j++) {
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
      depth += 1;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) return text.slice(start, j);
      depth -= 1;
    }
  }
  return text.slice(start);
}

export function presentCallKwargs(inside: string): Set<string> {
  const present = new Set<string>();
  const re = /\b([A-Za-z_][\w]*)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inside))) present.add(m[1]);
  return present;
}

/** True when cursor is in a kwarg value (`label: …`) before the next comma. */
export function inCallKwargValue(inside: string): boolean {
  return /:\s*[^,]*$/.test(inside);
}

/**
 * Unset constructor labels for Space / identifier completion inside a call.
 */
export function unsetCallKwargs(call: OpenCall): string[] | undefined {
  const labels = CALL_KWARGS[call.name];
  if (!labels?.length) return undefined;
  if (inCallKwargValue(call.inside)) return undefined;
  const present = presentCallKwargs(call.fullInside);
  return labels.filter((l) => !present.has(l));
}

export type CallValueEnumQuery = {
  values: string[];
  afterDot: boolean;
};

/** `.` / value enums inside `Type(label: .` or Spacing(`.`. */
export function callKwargValueEnumQuery(
  call: OpenCall
): CallValueEnumQuery | undefined {
  const table = CALL_KWARG_VALUE_ENUMS[call.name];
  if (!table) return undefined;
  const inside = call.inside;

  const labeled = /([A-Za-z_][\w]*)\s*:\s*(\.?[-\w]*)$/.exec(inside);
  if (labeled) {
    const values = table[labeled[1]] ?? table["*"];
    if (!values?.length) return undefined;
    return { values, afterDot: labeled[2].startsWith(".") };
  }

  // Positional bare dot: Spacing(. / ColorStop(.
  if (!/\.[-\w]*$/.test(inside)) return undefined;
  if (!/(?:^|[(,])\s*\.[-\w]*$/.test(inside)) return undefined;
  const values = table["*"];
  if (!values?.length) return undefined;
  return { values, afterDot: true };
}

/**
 * Open-tag start index `<` if `offset` is inside an unclosed start tag.
 */
function findOpenTagStart(text: string, offset: number): number | undefined {
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
      if (!/^([A-Za-z_][\w-]*)/.test(after)) return undefined;
      if (after.includes(">")) return undefined;
      return i;
    }
    i -= 1;
  }
  return undefined;
}

/**
 * Slice from the open `<Tag` before `offset` up to `offset`, or undefined
 * if not inside an unclosed start tag.
 */
export function openTagPrefixFromText(
  text: string,
  offset: number
): string | undefined {
  const start = findOpenTagStart(text, offset);
  if (start === undefined) return undefined;
  return text.slice(start, offset);
}

/**
 * Full start-tag slice `<Tag …>` (or through EOF if `>` not yet typed).
 * Used so attrs after the cursor still count as “already set”.
 */
export function openTagFullFromText(
  text: string,
  offset: number
): string | undefined {
  const start = findOpenTagStart(text, offset);
  if (start === undefined) return undefined;
  let inDq = false;
  let inSq = false;
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
    if (ch === "<") return text.slice(start, j);
    if (ch === ">") return text.slice(start, j + 1);
  }
  return text.slice(start);
}

export function findOpenTagName(prefix: string): string | undefined {
  const idx = prefix.lastIndexOf("<");
  if (idx < 0) return undefined;
  const slice = prefix.slice(idx);
  if (slice.includes(">")) return undefined;
  const m = /^<\/?([A-Za-z_][\w-]*)/.exec(slice);
  if (!m || slice.startsWith("</")) return undefined;
  return m[1];
}

/** True if cursor is inside a "…" or '…' within the open-tag prefix. */
export function inOpenTagString(prefix: string): boolean {
  const idx = prefix.lastIndexOf("<");
  if (idx < 0) return false;
  const slice = prefix.slice(idx);
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (c === "\\" && quote) {
      i++;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
  }
  return quote !== null;
}

export function presentAttrsInOpenTag(prefix: string): Set<string> {
  const idx = prefix.lastIndexOf("<");
  if (idx < 0) return new Set();
  const slice = prefix.slice(idx);
  const present = new Set<string>();
  const re = /\b([A-Za-z_][\w]*)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice))) present.add(m[1]);
  return present;
}

/** Cursor is in an attribute value (after `=` / inside `[…]`), not a new attr name. */
export function inAttrValuePosition(prefix: string): boolean {
  if (/([A-Za-z_][\w]*)\s*=\s*\[[^\]]*$/.test(prefix)) return true;
  if (/=\s*[-\w.]*$/.test(prefix) || /=\s*$/.test(prefix)) return true;
  return false;
}

export type AttrEnumQuery = {
  attr: string;
  values: string[];
  afterDot: boolean;
};

export type AttrTypeMemberQuery = {
  attr: string;
  typeName: string;
  members: TypeMember[];
  afterDot: boolean;
};

/**
 * Typed-attribute members for `size=.` / `size=.st` (method / prop / enum).
 * Init is excluded so `size=.TextSize(…)` is never suggested.
 */
export function attrTypeMemberQuery(
  prefix: string
): AttrTypeMemberQuery | undefined {
  const sc = /([A-Za-z_][\w]*)\s*=\s*(\.?[-\w]*)$/.exec(prefix);
  if (!sc) return undefined;
  const attr = sc[1];
  const typeName = ATTR_TYPES[attr];
  if (!typeName || !TYPE_MEMBERS[typeName]) return undefined;
  const tail = sc[2];
  const afterDot = tail.startsWith(".");
  if (!afterDot) return undefined;
  const members = TYPE_MEMBERS[typeName].members.filter(
    (m) => m.kind === "method" || m.kind === "prop" || m.kind === "enum"
  );
  if (!members.length) return undefined;
  return { attr, typeName, members, afterDot };
}

/**
 * Enum members for `attr=.…` or `attr=[… .…]` (hyphenated names ok).
 */
export function attrEnumQuery(prefix: string): AttrEnumQuery | undefined {
  // List: decoration=[.italic, .
  const arr = /([A-Za-z_][\w]*)\s*=\s*\[([^\]]*)$/.exec(prefix);
  if (arr) {
    const attr = arr[1];
    const enums = ATTR_ENUMS[attr];
    if (!enums) return undefined;
    const inside = arr[2];
    if (!/\.[-\w]*$/.test(inside)) return undefined;

    const present = new Set<string>();
    for (const m of inside.matchAll(/\.[-\w]+/g)) {
      present.add(m[0]);
    }
    const partial = /\.([-\w]*)$/.exec(inside);
    if (partial) present.delete(partial[0]);

    return {
      attr,
      values: enums.filter((e) => !present.has(e)),
      afterDot: true,
    };
  }

  // Scalar: weight=.medium / weight=.
  const sc = /([A-Za-z_][\w]*)\s*=\s*(\.?[-\w]*)$/.exec(prefix);
  if (sc) {
    const attr = sc[1];
    const enums = ATTR_ENUMS[attr];
    if (!enums) return undefined;
    const tail = sc[2];
    const afterDot = tail.startsWith(".");
    return { attr, values: enums, afterDot };
  }

  return undefined;
}
