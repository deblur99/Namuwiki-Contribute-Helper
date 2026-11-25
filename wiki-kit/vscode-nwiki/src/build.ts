import { spawn } from "child_process";
import * as path from "path";
import * as vscode from "vscode";
import { findWikiKitRoot, outputPathFor } from "./paths";

let output: vscode.OutputChannel | undefined;

export function getOutput(): vscode.OutputChannel {
  if (!output) {
    output = vscode.window.createOutputChannel("nwiki");
  }
  return output;
}

export async function buildNwikiFile(
  filePath: string
): Promise<{ ok: boolean; outputPath?: string; stderr: string }> {
  const root = findWikiKitRoot(filePath);
  if (!root) {
    const msg =
      "nwiki toolchain not found (extension runtime/). Run npm run compile / install:local.";
    getOutput().appendLine(msg);
    return { ok: false, stderr: msg };
  }

  const python = vscode.workspace
    .getConfiguration("nwiki")
    .get<string>("pythonPath", "python3");
  const script = path.join(root, "scripts", "build.py");
  const outPath = outputPathFor(filePath, root);

  getOutput().appendLine(`$ ${python} ${script} build ${filePath}`);

  return new Promise((resolve) => {
    const child = spawn(python, [script, "build", filePath], {
      cwd: root,
      env: process.env,
    });
    let stderr = "";
    let stdout = "";
    let settled = false;
    const finish = (result: {
      ok: boolean;
      outputPath?: string;
      stderr: string;
    }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, stderr: "build timed out after 30s" });
    }, 30_000);
    child.stdout.on("data", (d) => {
      stdout += d.toString();
      getOutput().append(d.toString());
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      getOutput().append(d.toString());
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      finish({ ok: false, stderr: String(err) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        finish({ ok: true, outputPath: outPath, stderr });
      } else {
        finish({ ok: false, stderr: stderr || stdout || `exit ${code}` });
      }
    });
  });
}

export async function openBuildOutput(filePath: string): Promise<void> {
  const root = findWikiKitRoot(filePath);
  if (!root) {
    vscode.window.showErrorMessage("wiki-kit root not found");
    return;
  }
  const outPath = outputPathFor(filePath, root);
  const uri = vscode.Uri.file(outPath);
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
      preserveFocus: true,
    });
  } catch {
    vscode.window.showWarningMessage(`Output not found: ${outPath}`);
  }
}
