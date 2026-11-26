import assert from "node:assert/strict";
import {
  isOffsetInsideTemplate,
  toggleBlockCommentText,
  toggleLineCommentText,
} from "../out/commentCore.js";

const doc = `document("t")
// top
<template>
  <Text text="a" />
</template>
`;

const inside = doc.indexOf("<Text");
const outside = doc.indexOf("// top");
assert.equal(isOffsetInsideTemplate(doc, inside), true);
assert.equal(isOffsetInsideTemplate(doc, outside), false);

assert.equal(
  toggleLineCommentText("  <Text text=\"a\" />", true),
  "  <!-- <Text text=\"a\" /> -->"
);
assert.equal(
  toggleLineCommentText("  <!-- <Text text=\"a\" /> -->", true),
  "  <Text text=\"a\" />"
);
assert.equal(toggleLineCommentText("  // leftover", true), "  leftover");
assert.equal(toggleLineCommentText("// top", false), "top");
assert.equal(toggleLineCommentText("top", false), "// top");

assert.equal(
  toggleBlockCommentText("<Text />", true),
  "<!--\n<Text />\n-->"
);
assert.equal(toggleBlockCommentText("<!--\n<Text />\n-->", true), "<Text />");
assert.equal(toggleBlockCommentText("x", false), "/*\nx\n*/");

console.log("test-comment: ok");
