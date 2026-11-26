import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/** `import Name from "path"` / `'path'` */
const IMPORT_FROM_RE =
  /\bimport\s+([A-Za-z_][\w]*)\s+from\s+(?:"([^"]+)"|'([^']+)')/g;

/** Legacy `import("path")` / `import('path')` */
const IMPORT_CALL_PATH_RE =
  /\bimport\s*\(\s*(?:"([^"]+)"|'([^']+)')\s*\)/g;

const WORD_RE = /[A-Za-z_][\w]*/;

type ImportBinding = {
  name: string;
  rel: string;
  /** Absolute path if file exists */
  resolved?: string;
  bindingStart: number;
  bindingEnd: number;
};

function resolveImportPath(baseDir: string, rel: string): string | undefined {
  const trimmed = rel.trim();
  if (!trimmed) return undefined;
  const resolved = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(baseDir, trimmed);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }
  return undefined;
}

function locationAtFileStart(filePath: string): vscode.Location {
  return new vscode.Location(
    vscode.Uri.file(filePath),
    new vscode.Position(0, 0)
  );
}

function offsetToPosition(text: string, offset: number): vscode.Position {
  const slice = text.slice(0, offset);
  const lines = slice.split("\n");
  const line = lines.length - 1;
  const character = lines[line]!.length;
  return new vscode.Position(line, character);
}

/** Jump to `"key":` in a flat JSON object when possible. */
function locationOfJsonKey(
  filePath: string,
  key: string
): vscode.Location {
  const text = fs.readFileSync(filePath, "utf8");
  const re = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`);
  const m = re.exec(text);
  if (!m) return locationAtFileStart(filePath);
  return new vscode.Location(
    vscode.Uri.file(filePath),
    offsetToPosition(text, m.index)
  );
}

function collectImports(
  text: string,
  baseDir: string
): ImportBinding[] {
  const out: ImportBinding[] = [];
  IMPORT_FROM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_FROM_RE.exec(text))) {
    const name = m[1];
    const rel = m[2] || m[3];
    if (!name || !rel) continue;
    const bindingStart = m.index + m[0].indexOf(name);
    out.push({
      name,
      rel,
      resolved: resolveImportPath(baseDir, rel),
      bindingStart,
      bindingEnd: bindingStart + name.length,
    });
  }
  return out;
}

function bindingByName(
  imports: ImportBinding[],
  name: string
): ImportBinding | undefined {
  return imports.find((b) => b.name === name);
}

/**
 * Cmd/Ctrl+Click on import binding, path, or any usage (incl. inside
 * `<template>`) → open the resolved file (JSON key when clicking `.key`).
 */
export class NwikiDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Definition | undefined {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const baseDir = path.dirname(document.uri.fsPath);
    const imports = collectImports(text, baseDir);

    // 1) Click on import line binding or path
    for (const b of imports) {
      if (offset >= b.bindingStart && offset < b.bindingEnd) {
        if (!b.resolved) return undefined;
        return locationAtFileStart(b.resolved);
      }
    }

    IMPORT_FROM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_FROM_RE.exec(text))) {
      const rel = m[2] || m[3];
      if (!rel) continue;
      const quoteChar = m[2] !== undefined ? '"' : "'";
      const pathLiteral = `${quoteChar}${rel}${quoteChar}`;
      const pathStart = m.index + m[0].lastIndexOf(pathLiteral);
      const pathEnd = pathStart + pathLiteral.length;
      if (offset >= pathStart && offset < pathEnd) {
        const resolved = resolveImportPath(baseDir, rel);
        if (!resolved) return undefined;
        return locationAtFileStart(resolved);
      }
    }

    IMPORT_CALL_PATH_RE.lastIndex = 0;
    while ((m = IMPORT_CALL_PATH_RE.exec(text))) {
      const rel = m[1] || m[2];
      if (!rel) continue;
      const quoteChar = m[1] !== undefined ? '"' : "'";
      const pathLiteral = `${quoteChar}${rel}${quoteChar}`;
      const pathStart = m.index + m[0].indexOf(pathLiteral);
      const pathEnd = pathStart + pathLiteral.length;
      if (offset < pathStart || offset >= pathEnd) continue;
      const resolved = resolveImportPath(baseDir, rel);
      if (!resolved) return undefined;
      return locationAtFileStart(resolved);
    }

    // 2) Usage anywhere (template / attrs / ${…}): binding or Binding.key
    const wordRange = document.getWordRangeAtPosition(position, WORD_RE);
    if (!wordRange) return undefined;
    const word = document.getText(wordRange);

    const asBinding = bindingByName(imports, word);
    if (asBinding?.resolved) {
      return locationAtFileStart(asBinding.resolved);
    }

    // DesignSystem.white — cursor on `white`
    const linePrefix = document
      .lineAt(position.line)
      .text.slice(0, wordRange.start.character);
    const ns = /([A-Za-z_][\w]*)\.\s*$/.exec(linePrefix);
    if (ns) {
      const parent = bindingByName(imports, ns[1]);
      if (parent?.resolved) {
        if (/\.json$/i.test(parent.resolved)) {
          return locationOfJsonKey(parent.resolved, word);
        }
        return locationAtFileStart(parent.resolved);
      }
    }

    return undefined;
  }
}
