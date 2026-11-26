import assert from "node:assert/strict";
import { importPathQuery } from "../out/importPathQuery.js";

assert.deepEqual(importPathQuery('import DesignSystem from "'), {
  typed: "",
  typedStartInLine: 'import DesignSystem from "'.length,
});

assert.deepEqual(importPathQuery('import DesignSystem from "./data/'), {
  typed: "./data/",
  typedStartInLine: 'import DesignSystem from "'.length,
});

assert.deepEqual(
  importPathQuery('import ProfileTable from "./components/Pro'),
  {
    typed: "./components/Pro",
    typedStartInLine: 'import ProfileTable from "'.length,
  }
);

assert.deepEqual(importPathQuery("import X from './a"), {
  typed: "./a",
  typedStartInLine: "import X from '".length,
});

assert.deepEqual(importPathQuery('import("./data/'), {
  typed: "./data/",
  typedStartInLine: 'import("'.length,
});

assert.equal(importPathQuery("import Foo from "), undefined);
assert.equal(importPathQuery('<Text text="'), undefined);

console.log("import path query ok");
