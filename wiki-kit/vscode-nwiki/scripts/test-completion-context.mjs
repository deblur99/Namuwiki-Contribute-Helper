/**
 * Fixture checks for completionContext (run after npm run compile).
 */
import assert from "node:assert/strict";
import {
  ATTR_LIST_ATTRS,
  attrEnumQuery,
  attrTypeMemberQuery,
  callKwargValueEnumQuery,
  findOpenTagName,
  inAttrValuePosition,
  openCallFromText,
  openTagFullFromText,
  openTagPrefixFromText,
  presentAttrsInOpenTag,
  unsetCallKwargs,
} from "../out/completionContext.js";

const multiline = `<Text
        text="'말랑해'는 애칭이다."
        weight=.medium
        `;
const offset = multiline.length;
const tagPrefix = openTagPrefixFromText(multiline, offset);
assert.ok(tagPrefix, "openTagPrefix across lines");
assert.equal(findOpenTagName(tagPrefix), "Text");
assert.ok(presentAttrsInOpenTag(tagPrefix).has("weight"));
assert.ok(presentAttrsInOpenTag(tagPrefix).has("text"));
assert.equal(inAttrValuePosition(tagPrefix), false);

const arrDot = tagPrefix + "decoration=[.";
const q1 = attrEnumQuery(arrDot);
assert.ok(q1, "decoration=[. enum");
assert.equal(q1.attr, "decoration");
assert.ok(q1.values.includes(".italic"));
assert.ok(q1.values.includes(".line-through"));
assert.equal(q1.afterDot, true);

const arrPartial = tagPrefix + "decoration=[.italic, .";
const q2 = attrEnumQuery(arrPartial);
assert.ok(q2);
assert.ok(!q2.values.includes(".italic"), "filter already present");
assert.ok(q2.values.includes(".underline"));

const scalar = `<Text weight=.`;
assert.deepEqual(
  attrEnumQuery(scalar)?.values.slice(0, 2),
  [".bold", ".regular"]
);

const sizeDot = `<Text size=.`;
const sizeQ = attrTypeMemberQuery(sizeDot);
assert.ok(sizeQ, "size=. typed members");
assert.equal(sizeQ.typeName, "TextSize");
assert.ok(sizeQ.members.some((m) => m.name === "step"));
assert.ok(!sizeQ.members.some((m) => m.kind === "init"));
assert.equal(sizeQ.afterDot, true);

const sizePartial = `<Text size=.st`;
assert.ok(attrTypeMemberQuery(sizePartial)?.members.some((m) => m.name === "step"));

assert.ok(ATTR_LIST_ATTRS.has("decoration"));

// Cursor before an already-set attr — full tag still excludes it
const midCursorSrc = `<Box
      display=.flex
      |
      flexDirection=.column
      gap=12>`;
const midAt = midCursorSrc.indexOf("|");
const midText = midCursorSrc.replace("|", "");
const midFull = openTagFullFromText(midText, midAt);
assert.ok(midFull);
const midPresent = presentAttrsInOpenTag(midFull);
assert.ok(midPresent.has("display"));
assert.ok(midPresent.has("flexDirection"));
assert.ok(midPresent.has("gap"));
assert.ok(!midPresent.has("padding"));

const spacingSrc = `padding=Spacing(vertical: 5, horizontal: 10)`;
// cursor after "vertical: 5, "
const spacingAt = spacingSrc.indexOf("horizontal");
const spacingCall = openCallFromText(spacingSrc, spacingAt);
assert.ok(spacingCall);
assert.equal(spacingCall.name, "Spacing");
const labels = unsetCallKwargs(spacingCall);
assert.ok(labels.includes("top"));
assert.ok(!labels.includes("vertical"));
assert.ok(!labels.includes("horizontal"), "kwargs after cursor still present");

const autoSrc = `padding=Spacing(horizontal: .`;
const autoCall = openCallFromText(autoSrc, autoSrc.length);
assert.ok(autoCall);
const autoQ = callKwargValueEnumQuery(autoCall);
assert.ok(autoQ);
assert.ok(autoQ.values.includes(".auto"));
assert.equal(autoQ.afterDot, true);

const borderSrc = `border=Border(width: 1, style: .`;
const borderCall = openCallFromText(borderSrc, borderSrc.length);
assert.deepEqual(callKwargValueEnumQuery(borderCall)?.values.slice(0, 2), [
  ".solid",
  ".dashed",
]);

console.log("completionContext fixtures ok");
