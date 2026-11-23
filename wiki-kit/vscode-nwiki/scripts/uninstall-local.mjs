#!/usr/bin/env node
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const id = `${pkg.publisher}.${pkg.name}`;

const candidates = [
  path.join(os.homedir(), ".cursor", "extensions"),
  path.join(os.homedir(), ".vscode", "extensions"),
].filter((d) => fs.existsSync(d));

let removed = 0;
for (const extDir of candidates) {
  for (const name of fs.readdirSync(extDir)) {
    if (name === id || name.startsWith(`${id}-`)) {
      const p = path.join(extDir, name);
      fs.rmSync(p, { recursive: true, force: true });
      console.log(`removed ${p}`);
      removed++;
    }
  }
}
if (!removed) console.log(`No local install of ${id} found.`);
else console.log("Reload Window to drop the extension.");
