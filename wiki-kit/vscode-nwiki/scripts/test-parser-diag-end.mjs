import assert from "node:assert/strict";

/** Mirror of parserDiagnosticEnd in diagnostics.ts (no vscode import). */
function parserDiagnosticEnd(text, start) {
  const n = text.length;
  if (start >= n) return n;
  const lineEnd = text.indexOf("\n", start);
  const limit = lineEnd < 0 ? n : lineEnd;
  let i = start;
  if (/[A-Za-z_]/.test(text[i])) {
    i += 1;
    while (i < limit && /[A-Za-z0-9_-]/.test(text[i])) i += 1;
    return Math.max(i, start + 1);
  }
  return Math.min(start + 24, limit);
}

const line =
  '      <TableColumn bgColor=HexColor("#fff") HexColor(light="#ffffff")>';
const start = line.indexOf(" HexColor(") + 1;
assert.equal(line.slice(start, start + 8), "HexColor");
assert.equal(parserDiagnosticEnd(line, start), start + "HexColor".length);
assert.equal(parserDiagnosticEnd("x\n", 0), 1);
assert.equal(parserDiagnosticEnd("!!!", 0), 3);

console.log("test-parser-diag-end: ok");
