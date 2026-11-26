export type ImportPathQuery = {
  /** Path typed so far inside the quotes (no quotes). */
  typed: string;
  /** Character offset of `typed` start within the line. */
  typedStartInLine: number;
};

/**
 * Detect cursor inside `import Name from "…"` / `'…'` or legacy `import("…")`.
 * `linePrefix` = line text up to (not including) cursor.
 */
export function importPathQuery(linePrefix: string): ImportPathQuery | undefined {
  const fromM = /\bimport\s+[A-Za-z_][\w]*\s+from\s+(["'])([^"']*)$/.exec(
    linePrefix
  );
  if (fromM) {
    return {
      typed: fromM[2],
      typedStartInLine: fromM.index + fromM[0].length - fromM[2].length,
    };
  }
  const callM = /\bimport\s*\(\s*(["'])([^"']*)$/.exec(linePrefix);
  if (callM) {
    return {
      typed: callM[2],
      typedStartInLine: callM.index + callM[0].length - callM[2].length,
    };
  }
  return undefined;
}
