#!/usr/bin/env node
/**
 * Compile (caller) + symlink this extension into Cursor/VS Code extensions dir.
 * After install: Developer: Reload Window
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(extRoot, "package.json"), "utf8"));
const id = `${pkg.publisher}.${pkg.name}`;
const folderName = `${id}-${pkg.version}`;

const candidates = [
  path.join(os.homedir(), ".cursor", "extensions"),
  path.join(os.homedir(), ".vscode", "extensions"),
].filter((d) => fs.existsSync(d));

if (candidates.length === 0) {
  console.error("No Cursor/VS Code extensions directory found (~/.cursor/extensions).");
  process.exit(1);
}

const main = path.join(extRoot, "out", "extension.js");
if (!fs.existsSync(main)) {
  console.error("Missing out/extension.js — run npm run compile first.");
  process.exit(1);
}

for (const extDir of candidates) {
  for (const name of fs.readdirSync(extDir)) {
    if (name === folderName) continue;
    if (name === id || name.startsWith(`${id}-`)) {
      const old = path.join(extDir, name);
      fs.rmSync(old, { recursive: true, force: true });
      console.log(`removed ${old}`);
    }
  }
  const target = path.join(extDir, folderName);
  fs.rmSync(target, { recursive: true, force: true });
  fs.symlinkSync(extRoot, target, "dir");
  console.log(`linked ${target} → ${extRoot}`);
}

console.log(`\nInstalled ${id}@${pkg.version}`);
console.log("Reload Window (Cmd+Shift+P → Developer: Reload Window) to activate.");
