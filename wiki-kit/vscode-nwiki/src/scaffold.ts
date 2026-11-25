import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { findProjectRoot } from "./paths";

const COMPONENT_SKELETON = `props {
}

<template>
</template>
`;

const IDENT_RE = /^[A-Za-z_][\w]*$/;

const DEFAULT_DESIGN_SYSTEM = `{
  "accentColor": "#87CEEB",
  "white": "#ffffff",
  "whiteShort": "#fff",
  "black": "#000000",
  "defaultColor": "#222,#ddd",
  "defaultBgColor": "#ddd,#222"
}
`;

function safeFolderName(title: string): string {
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 120) || "untitled";
}

function indexNwiki(title: string): string {
  const escaped = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `document("${escaped}")
import DesignSystem from "./data/design-system.json"

<template>
</template>
`;
}

function nwikiJson(title: string): string {
  return JSON.stringify(
    { title, entry: "index.nwiki" },
    null,
    2
  ) + "\n";
}

function vscodeSettings(): string {
  return JSON.stringify(
    {
      "nwiki.buildOnSave": true,
      "nwiki.openOutputAfterBuild": true,
      "nwiki.previewAfterBuild": true,
      "nwiki.formatOnSave": true,
    },
    null,
    2
  ) + "\n";
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfMissing(filePath: string, contents: string): void {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, contents, "utf8");
}

/** Command: nwiki.newDocument — scaffold a document project folder. */
export async function newDocumentCommand(): Promise<void> {
  const title = await vscode.window.showInputBox({
    title: "nwiki: New Document",
    prompt: "문서명 (document 제목)",
    placeHolder: "문서명",
    validateInput: (v) =>
      v.trim() ? undefined : "문서명을 입력하세요",
  });
  if (title === undefined) return;
  const trimmed = title.trim();

  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "여기에 문서 폴더 생성",
    title: "부모 폴더 선택",
  });
  if (!folders?.length) return;

  const parent = folders[0].fsPath;
  const folderName = safeFolderName(trimmed);
  const root = path.join(parent, folderName);

  if (fs.existsSync(root)) {
    const overwrite = await vscode.window.showWarningMessage(
      `폴더가 이미 있습니다: ${root}. 빈 슬롯만 채울까요?`,
      "Continue",
      "Cancel"
    );
    if (overwrite !== "Continue") return;
  }

  try {
    ensureDir(root);
    ensureDir(path.join(root, "components"));
    ensureDir(path.join(root, "data"));
    ensureDir(path.join(root, "outputs"));
    ensureDir(path.join(root, "scripts"));
    ensureDir(path.join(root, ".vscode"));

    writeIfMissing(path.join(root, "components", ".gitkeep"), "");
    writeIfMissing(path.join(root, "outputs", ".gitkeep"), "");
    writeIfMissing(path.join(root, "scripts", ".gitkeep"), "");
    writeIfMissing(
      path.join(root, "data", "design-system.json"),
      DEFAULT_DESIGN_SYSTEM
    );
    writeIfMissing(path.join(root, "nwiki.json"), nwikiJson(trimmed));
    writeIfMissing(
      path.join(root, ".vscode", "settings.json"),
      vscodeSettings()
    );
    writeIfMissing(path.join(root, "index.nwiki"), indexNwiki(trimmed));

    const indexUri = vscode.Uri.file(path.join(root, "index.nwiki"));
    const doc = await vscode.workspace.openTextDocument(indexUri);
    await vscode.window.showTextDocument(doc);
    const pick = await vscode.window.showInformationMessage(
      `nwiki: created ${root}`,
      "Open Spec",
      "Insert Article"
    );
    if (pick === "Open Spec") {
      await vscode.commands.executeCommand("nwiki.openSpecGuide");
    } else if (pick === "Insert Article") {
      await vscode.commands.executeCommand("nwiki.insertArticleTemplate");
    }
  } catch (e) {
    vscode.window.showErrorMessage(
      `nwiki: scaffold failed — ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

function resolveActiveProjectRoot(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId === "nwiki") {
    const fromFile = findProjectRoot(editor.document.uri.fsPath);
    if (fromFile) return fromFile;
  }
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId !== "nwiki") continue;
    const root = findProjectRoot(doc.uri.fsPath);
    if (root) return root;
  }
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (fs.existsSync(path.join(folder.uri.fsPath, "nwiki.json"))) {
      return folder.uri.fsPath;
    }
  }
  return undefined;
}

async function openCreatedFile(filePath: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(doc);
}

/** Command: nwiki.newComponent — create components/<Name>.nwiki (or targetPath). */
export async function newComponentCommand(
  targetPath?: string
): Promise<void> {
  try {
    let filePath: string;
    let name: string;

    if (targetPath) {
      filePath = path.resolve(targetPath);
      name = path.basename(filePath, path.extname(filePath));
      if (!IDENT_RE.test(name)) {
        vscode.window.showErrorMessage(
          `nwiki: invalid component name "${name}" (use identifier)`
        );
        return;
      }
      if (!/\.nwiki$/i.test(filePath)) {
        filePath = `${filePath}.nwiki`;
      }
    } else {
      const input = await vscode.window.showInputBox({
        title: "nwiki: New Component",
        prompt: "컴포넌트 이름 (PascalCase 식별자)",
        placeHolder: "ProfileTable",
        validateInput: (v) => {
          const t = v.trim();
          if (!t) return "컴포넌트 이름을 입력하세요";
          if (!IDENT_RE.test(t)) return "식별자만 사용하세요 (예: ProfileTable)";
          return undefined;
        },
      });
      if (input === undefined) return;
      name = input.trim();

      const root = resolveActiveProjectRoot();
      if (!root) {
        vscode.window.showWarningMessage(
          "nwiki: project root not found (open a .nwiki with nwiki.json)"
        );
        return;
      }
      filePath = path.join(root, "components", `${name}.nwiki`);
    }

    if (fs.existsSync(filePath)) {
      await openCreatedFile(filePath);
      vscode.window.showInformationMessage(
        `nwiki: already exists — opened ${path.basename(filePath)}`
      );
      return;
    }

    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, COMPONENT_SKELETON, "utf8");
    await openCreatedFile(filePath);
    vscode.window.showInformationMessage(
      `nwiki: created component ${path.basename(filePath)}`
    );
  } catch (e) {
    vscode.window.showErrorMessage(
      `nwiki: new component failed — ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/** Command: nwiki.createMissingJson — write `{}` at path and open. */
export async function createMissingJsonCommand(
  targetPath?: string
): Promise<void> {
  try {
    let filePath = targetPath?.trim();
    if (!filePath) {
      const input = await vscode.window.showInputBox({
        title: "nwiki: Create Missing JSON",
        prompt: "생성할 .json 절대/상대 경로",
        placeHolder: "./data/example.json",
        validateInput: (v) =>
          v.trim() ? undefined : "경로를 입력하세요",
      });
      if (input === undefined) return;
      filePath = input.trim();
      if (!path.isAbsolute(filePath)) {
        const editor = vscode.window.activeTextEditor;
        const base = editor
          ? path.dirname(editor.document.uri.fsPath)
          : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!base) {
          vscode.window.showWarningMessage("nwiki: no base path for relative JSON");
          return;
        }
        filePath = path.resolve(base, filePath);
      }
    } else {
      filePath = path.resolve(filePath);
    }

    if (!/\.json$/i.test(filePath)) {
      vscode.window.showErrorMessage("nwiki: path must end with .json");
      return;
    }

    if (fs.existsSync(filePath)) {
      await openCreatedFile(filePath);
      return;
    }

    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, "{}\n", "utf8");
    await openCreatedFile(filePath);
    vscode.window.showInformationMessage(
      `nwiki: created ${path.basename(filePath)}`
    );
  } catch (e) {
    vscode.window.showErrorMessage(
      `nwiki: create JSON failed — ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
