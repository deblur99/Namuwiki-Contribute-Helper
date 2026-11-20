import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/** Find wiki-kit root containing scripts/build.py */
export function findWikiKitRoot(
  start?: string
): string | undefined {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const seeds: string[] = [];
  if (start) seeds.push(start);
  for (const f of folders) seeds.push(f.uri.fsPath);

  for (const seed of seeds) {
    let cur = seed;
    for (let i = 0; i < 12; i++) {
      const candidate = path.join(cur, "wiki-kit");
      if (fs.existsSync(path.join(candidate, "scripts", "build.py"))) {
        return candidate;
      }
      if (fs.existsSync(path.join(cur, "scripts", "build.py")) &&
          fs.existsSync(path.join(cur, "engine", "nwiki"))) {
        return cur;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }
  return undefined;
}

export function outputPathFor(nwikiFile: string, wikiKitRoot: string): string {
  const stem = path.basename(nwikiFile, ".nwiki");
  return path.join(wikiKitRoot, "outputs", `${stem}.md`);
}
