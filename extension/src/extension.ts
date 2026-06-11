import * as vscode from "vscode";
import { SidebarProvider } from "./sidebar";

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "vibeReading.sidebar",
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        sidebarProvider.onActiveFileChanged(editor.document.uri);
      }
    })
  );

  if (vscode.window.activeTextEditor) {
    sidebarProvider.onActiveFileChanged(
      vscode.window.activeTextEditor.document.uri
    );
  }
}

export function deactivate() {}
