// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { UIWindow } from "./ui_window";
import { LOG_INFO, LOG_ERROR } from "./log";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    LOG_INFO('Congratulations, your extension "qt-helper" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand("qt-helper.newQtUiClass", (target_uri) => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        // vscode.window.showInformationMessage("newQtUiClass from qt_helper!");
        UIWindow.CreateWindow(context.extensionUri, target_uri);
    });

    context.subscriptions.push(disposable);

    // const disposable2 = vscode.commands.registerCommand("qt-helper.newfile", (target_uri) => {
    //     // The code you place here will be executed every time your command is executed
    //     // Display a message box to the user
    //     vscode.window.showInformationMessage("newfile from qt_helper!");
    //     const workspaceFolders = vscode.workspace.workspaceFolders;
    //     if (!workspaceFolders) {
    //         vscode.window.showErrorMessage("No workspace folder is open.");
    //         return;
    //     }

    //     const workspacePath = workspaceFolders[0].uri.fsPath;

    //     const name = vscode.window.showInputBox({ prompt: "Class Name" });
    //     const includeGuard = vscode.window.showInputBox({ prompt: "Include Guard" });
    //     const parentClass = vscode.window.showInputBox({
    //         prompt: "Parent Class",
    //         value: "QWidget",
    //     });
    //     const userBeginNamespace = vscode.window.showInputBox({ prompt: "User Begin Namespace" });
    //     const userEndNamespace = vscode.window.showInputBox({ prompt: "User End Namespace" });

    //     if (
    //         !name ||
    //         !includeGuard ||
    //         !parentClass ||
    //         userBeginNamespace === undefined ||
    //         userEndNamespace === undefined
    //     ) {
    //         vscode.window.showErrorMessage("Input cancelled or invalid.");
    //         return;
    //     }

    //     const template = `#ifndef ${includeGuard}
    // 		#define ${includeGuard}

    // 		#include <${parentClass}>

    // 		${userBeginNamespace}
    // 		QT_BEGIN_NAMESPACE
    // 		namespace Ui { class ${name}; }
    // 		QT_END_NAMESPACE

    // 		class ${name} : public ${parentClass} {
    // 		Q_OBJECT

    // 		public:
    // 			explicit ${name}(QWidget *parent = nullptr);
    // 			~${name}() override;

    // 		private:
    // 			Ui::${name} *ui;
    // 		};
    // 		${userEndNamespace}

    // 		#endif //${includeGuard}
    // 		`;

    //     const filePath = path.join(workspacePath, `${name}.h`);
    //     fs.writeFile(filePath, template, (err) => {
    //         if (err) {
    //             vscode.window.showErrorMessage(`Failed to create file: ${err.message}`);
    //             return;
    //         }
    //         vscode.window.showInformationMessage(`File created: ${filePath}`);
    //         vscode.workspace.openTextDocument(filePath).then((doc) => {
    //             vscode.window.showTextDocument(doc);
    //         });
    //     });
    // });

    // context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {}
