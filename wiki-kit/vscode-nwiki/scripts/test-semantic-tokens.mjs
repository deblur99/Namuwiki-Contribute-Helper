import assert from "node:assert/strict";
import {
  RESERVED_TYPES,
  collectImportBindings,
} from "../out/semanticTokensCore.js";

const text = `
import DesignSystem from "./data/design-system.json"
import Logo from "./assets/logo.png"
import ProfileTable from "./components/ProfileTable.nwiki"

<template>
  <Text color=HexColor(light="\${DesignSystem.white}" dark="#000") />
  <Image fileName=Logo />
  <ProfileTable name="x" />
</template>
`;

const imports = collectImportBindings(text);
assert.ok(imports.has("DesignSystem"));
assert.ok(imports.has("Logo"));
assert.ok(imports.has("ProfileTable"));
assert.ok(RESERVED_TYPES.has("HexColor"));
assert.ok(!RESERVED_TYPES.has("DesignSystem"));

console.log("test-semantic-tokens: ok");
