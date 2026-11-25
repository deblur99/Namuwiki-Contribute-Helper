import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { resolveDocumentTitle } from "./docTitle";
import { findWikiKitRoot, getExtensionPath } from "./paths";
import {
  articleTemplate,
  frameTemplate,
  profileTableTemplate,
} from "./starterTemplates";

type Kind = "frame" | "profile" | "article";

function requireNwikiEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "nwiki") {
    vscode.window.showWarningMessage(
      "nwiki: open a .nwiki file (language mode nwiki) first"
    );
    return undefined;
  }
  return editor;
}

function ensureCompanionFile(filePath: string, contents: string): boolean {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  return true;
}

async function insertAtCursor(kind: Kind): Promise<void> {
  const editor = requireNwikiEditor();
  if (!editor) return;
  const title = await resolveDocumentTitle(editor);
  if (!title) return;

  const filePath = editor.document.uri.fsPath;
  const projectDir = path.dirname(filePath);
  // index.nwiki at project root; components/*.nwiki under components/
  const inComponents = path.basename(projectDir) === "components";
  const rootDir = inComponents ? path.dirname(projectDir) : projectDir;

  let body: string;
  const created: string[] = [];
  switch (kind) {
    case "frame": {
      body = frameTemplate(title, filePath);
      const framePath = path.join(rootDir, "components", "Frame.nwiki");
      if (filePath !== framePath && ensureCompanionFile(framePath, body)) {
        created.push("components/Frame.nwiki");
      }
      break;
    }
    case "profile": {
      body = profileTableTemplate(title);
      const ptPath = path.join(rootDir, "components", "ProfileTable.nwiki");
      if (filePath !== ptPath && ensureCompanionFile(ptPath, body)) {
        created.push("components/ProfileTable.nwiki");
      }
      break;
    }
    case "article": {
      body = articleTemplate(title, filePath);
      const ptPath = path.join(rootDir, "components", "ProfileTable.nwiki");
      if (ensureCompanionFile(ptPath, profileTableTemplate(title))) {
        created.push("components/ProfileTable.nwiki");
      }
      break;
    }
  }

  const pos = editor.selection.active;
  await editor.edit((eb) => {
    eb.insert(pos, body);
  });
  const extra = created.length ? ` (+ ${created.join(", ")})` : "";
  vscode.window.showInformationMessage(
    `nwiki: inserted ${kind} template (${title})${extra}`
  );
}

export async function insertFrameTemplate(): Promise<void> {
  await insertAtCursor("frame");
}

export async function insertProfileTableTemplate(): Promise<void> {
  await insertAtCursor("profile");
}

export async function insertArticleTemplate(): Promise<void> {
  await insertAtCursor("article");
}

/** Open SPEC.nwiki from bundled runtime or wiki-kit. */
export async function openSpecGuide(
  extensionPath?: string
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const start = editor?.document.uri.fsPath;
  const roots: string[] = [];
  const wk = findWikiKitRoot(start);
  if (wk) roots.push(wk);
  const ext = extensionPath || getExtensionPath();
  if (ext) {
    roots.push(path.join(ext, "runtime"));
    roots.push(path.resolve(ext, ".."));
  }

  for (const root of roots) {
    const spec = path.join(root, "docs", "SPEC.nwiki");
    if (fs.existsSync(spec)) {
      const doc = await vscode.workspace.openTextDocument(spec);
      await vscode.window.showTextDocument(doc, { preview: false });
      return;
    }
  }

  vscode.window.showErrorMessage(
    "nwiki: SPEC.nwiki not found (run npm run compile to sync runtime/)"
  );
}
