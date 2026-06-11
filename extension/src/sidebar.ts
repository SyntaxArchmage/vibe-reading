import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type { FileAnalysis } from "./types";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "navigateTo") {
        this._navigateToAnchor(msg.file, msg.startLine, msg.startCol);
      }
    });
  }

  onActiveFileChanged(uri: vscode.Uri) {
    if (!this._view) {
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return;
    }

    const relativePath = path.relative(
      workspaceFolder.uri.fsPath,
      uri.fsPath
    );

    const dataPath = this._getDataPath(workspaceFolder.uri.fsPath, relativePath);
    const analysis = this._loadFileAnalysis(dataPath);

    this._view.webview.postMessage({
      type: "fileChanged",
      file: relativePath,
      entities: analysis?.entities ?? [],
      hasData: analysis !== null,
    });
  }

  private _getDataPath(workspaceRoot: string, relativePath: string): string {
    const sanitized = relativePath.replace(/[/\\]/g, "__");
    return path.join(workspaceRoot, ".vibe-reading", "files", `${sanitized}.json`);
  }

  private _loadFileAnalysis(dataPath: string): FileAnalysis | null {
    try {
      if (!fs.existsSync(dataPath)) {
        return null;
      }
      const raw = fs.readFileSync(dataPath, "utf-8");
      return JSON.parse(raw) as FileAnalysis;
    } catch {
      return null;
    }
  }

  private _navigateToAnchor(file: string, startLine: number, startCol: number) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const fileUri = vscode.Uri.file(
      path.join(workspaceFolders[0].uri.fsPath, file)
    );
    const position = new vscode.Position(startLine - 1, startCol);

    vscode.window.showTextDocument(fileUri, {
      selection: new vscode.Range(position, position),
      preserveFocus: false,
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "webview.js")
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Vibe Reading</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
