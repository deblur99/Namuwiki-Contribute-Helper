import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/** Set from activate() — extension install dir (contains runtime/). */
let extensionPath: string | undefined;

export function setExtensionPath(extPath: string): void {
  extensionPath = extPath;
}

export function getExtensionPath(): string | undefined {
  return extensionPath;
}

function looksLikeWikiKit(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "scripts", "build.py")) &&
    fs.existsSync(path.join(dir, "engine", "nwiki"))
  );
}

/**
 * Resolve toolchain root for build.py + engine.
 * Prefer bundled extension runtime, then sibling wiki-kit (dev), then workspace walk.
 */
export function findWikiKitRoot(start?: string): string | undefined {
  const seeds: string[] = [];

  if (extensionPath) {
    const runtime = path.join(extensionPath, "runtime");
    if (looksLikeWikiKit(runtime)) {
      return runtime;
    }
    const parent = path.dirname(extensionPath);
    if (looksLikeWikiKit(parent)) {
      seeds.push(parent);
    }
  }

  if (start) seeds.push(start);
  for (const f of vscode.workspace.workspaceFolders ?? []) {
    seeds.push(f.uri.fsPath);
  }

  for (const seed of seeds) {
    let cur = seed;
    for (let i = 0; i < 12; i++) {
      if (looksLikeWikiKit(cur)) {
        return cur;
      }
      const candidate = path.join(cur, "wiki-kit");
      if (looksLikeWikiKit(candidate)) {
        return candidate;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }
  return undefined;
}

/** Document project root: directory containing nwiki.json. */
export function findProjectRoot(nwikiFile: string): string | undefined {
  let cur = path.dirname(nwikiFile);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(cur, "nwiki.json"))) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return undefined;
}

/**
 * Build output: {project}/outputs/<stem>.md when nwiki.json exists,
 * else toolchain outputs/ (runtime or wiki-kit).
 */
export function outputPathFor(nwikiFile: string, wikiKitRoot: string): string {
  const stem = path.basename(nwikiFile, ".nwiki");
  const project = findProjectRoot(nwikiFile);
  if (project) {
    return path.join(project, "outputs", `${stem}.md`);
  }
  return path.join(wikiKitRoot, "outputs", `${stem}.md`);
}
