import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const DOC_CALL_RE =
  /\b(?:document|frame)\s*\(\s*(?:"([^"]*)"|'([^']*)')\s*\)/;

/** Walk parents for nwiki.json `"title"`. */
export function titleFromNwikiJson(startFile: string): string | undefined {
  let cur = path.dirname(startFile);
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(cur, "nwiki.json");
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8")) as {
          title?: unknown;
        };
        if (typeof raw.title === "string" && raw.title.trim()) {
          return raw.title.trim();
        }
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return undefined;
}

/** First document("…") / frame("…") in source; strip 틀: from frame. */
export function titleFromSource(text: string): string | undefined {
  const m = DOC_CALL_RE.exec(text);
  if (!m) return undefined;
  let title = (m[1] ?? m[2] ?? "").trim();
  if (!title) return undefined;
  if (title.startsWith("틀:")) title = title.slice(2);
  return title || undefined;
}

export function titleFromFolder(filePath: string): string | undefined {
  const dir = path.basename(path.dirname(filePath));
  if (!dir || dir === "." || dir === "components" || dir === "pages") {
    const parent = path.basename(path.dirname(path.dirname(filePath)));
    if (parent && parent !== ".") return parent;
    return undefined;
  }
  return dir;
}

/**
 * Resolve document title for templates.
 * nwiki.json → document/frame() → folder → optional input fallback.
 */
export async function resolveDocumentTitle(
  editor: vscode.TextEditor
): Promise<string | undefined> {
  const fsPath = editor.document.uri.fsPath;
  const fromJson = titleFromNwikiJson(fsPath);
  if (fromJson) return fromJson;

  const fromSrc = titleFromSource(editor.document.getText());
  if (fromSrc) return fromSrc;

  const fromFolder = titleFromFolder(fsPath);
  if (fromFolder) return fromFolder;

  const typed = await vscode.window.showInputBox({
    title: "nwiki: document title",
    prompt: "문서명을 찾을 수 없습니다. 입력하세요.",
    placeHolder: "문서명",
    validateInput: (v) => (v.trim() ? undefined : "문서명을 입력하세요"),
  });
  return typed?.trim();
}

/** Escape for use inside nwiki "…" string literals. */
export function escapeNwikiString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * DesignSystem import path relative to the file being edited.
 * components/*.nwiki → ../data/… ; else ./data/…
 */
export function designSystemImportPath(filePath: string): string {
  const parent = path.basename(path.dirname(filePath));
  if (parent === "components") {
    return "../data/design-system.json";
  }
  return "./data/design-system.json";
}

export function profileTableImportPath(filePath: string): string {
  const parent = path.basename(path.dirname(filePath));
  if (parent === "components") {
    return "./ProfileTable.nwiki";
  }
  return "./components/ProfileTable.nwiki";
}
