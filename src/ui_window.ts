import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { LOG_INFO, LOG_ERROR } from "./log";

interface Feature {
    line_number: number;
    location: string;
    prompt_word: string;
    relative_path: string;
}

interface FileContent {
    relative_path: string;
    file_content: string;
}

export class UIWindow {
    private workspace_path_: string = "";
    public readonly view_type_ = "newQtUiClass";
    public cmakelists_file_array_: string[] = [];
    private panel_: vscode.WebviewPanel | undefined;
    private readonly extension_uri_: vscode.Uri;
    private disposables_: vscode.Disposable[] = [];
    private target_dir_: string = "";
    private array_features_: Feature[] = [];
    private files_contents_: FileContent[] = [];

    public static CreateWindow(extension_uri: vscode.Uri, target_uri: vscode.Uri) {
        // 获取在文件管理器右键执行该命令时所在的目录
        if (target_uri == null) {
            LOG_INFO("target_uri is null");
            return;
        }
        let target_dir = "";
        const stats = fs.statSync(target_uri.fsPath);
        if (stats.isFile()) {
            target_dir = path.dirname(target_uri.fsPath);
        } else {
            target_dir = target_uri.fsPath;
        }
        LOG_INFO(`target_dir: ${target_dir}`);
        const window = new UIWindow(extension_uri, target_dir);

        if (!window.CheckEnv()) {
            LOG_INFO("CheckEnv fail");
            return;
        }

        window.Init();
    }

    private static GetWebviewOptions(extension_uri: vscode.Uri): vscode.WebviewOptions {
        return {
            // Enable javascript in the webview
            enableScripts: true,

            // And restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [vscode.Uri.joinPath(extension_uri, "media")],
        };
    }

    private constructor(extension_uri: vscode.Uri, target_dir: string) {
        this.extension_uri_ = extension_uri;
        this.target_dir_ = target_dir;
    }

    private update() {
        if (this.panel_) {
            this.panel_.webview.html = this.GetWebviewContent();
        }
    }

    private GetWebviewContent(): string {
        // 读取当前目录下的index.html文件的内容并返回
        // Local path to main script run in the webview
        const script_path_on_disk = vscode.Uri.joinPath(this.extension_uri_, "media", "main.js");

        // And the uri we use to load this script in the webview
        if (this.panel_) {
            const script_uri = this.panel_.webview.asWebviewUri(script_path_on_disk);
            const htmlPath = vscode.Uri.joinPath(this.extension_uri_, "media", "index.html").fsPath;
            let html = fs.readFileSync(htmlPath, "utf-8");
            html = html.replace("main.js", script_uri.toString());
            return html;
        }
        return "";
    }

    // 递归搜索CMakeLists.txt文件，保存到数组中
    private static FindCMakeLists(dir: string, file_array: string[]) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fpath = path.join(dir, file);
            const stats = fs.statSync(fpath);
            if (stats.isDirectory()) {
                this.FindCMakeLists(fpath, file_array);
            } else if (stats.isFile() && file === "CMakeLists.txt") {
                file_array.push(fpath);
            }
        }
    }
    private CheckEnv() {
        LOG_INFO("CheckEnv");
        // 获取当前工作区的路径
        if (vscode.workspace.workspaceFolders == null) {
            LOG_INFO("No workspace folder");
            return false;
        }
        this.workspace_path_ = vscode.workspace.workspaceFolders[0].uri.fsPath;
        UIWindow.FindCMakeLists(this.workspace_path_, this.cmakelists_file_array_);
        for (const file of this.cmakelists_file_array_) {
            LOG_INFO(`CMakeLists.txt file: ${file}`);
        }
        if (this.cmakelists_file_array_.length == 0) {
            return false;
        }
        return true;
    }

    private FillArrayFeatures() {
        if (vscode.workspace.workspaceFolders == null) {
            LOG_INFO("No workspace folder");
            return;
        }
        this.workspace_path_ = vscode.workspace.workspaceFolders[0].uri.fsPath;
        for (const file of this.cmakelists_file_array_) {
            const content = fs.readFileSync(file, "utf-8");
            // 根据workspace_path取相对路径
            const relative_path = path.relative(this.workspace_path_, file);
            // 遍历行
            const lines = content.split("\n");
            var line_number = 0;
            const old_len = this.array_features_.length;
            for (const line of lines) {
                line_number++;
                // 拼接字符串 relative_path:line_number
                const location = relative_path + ":" + line_number;
                this.AnalyseLine(line, line_number, location, relative_path, this.array_features_);
            }
            const new_len = this.array_features_.length;
            if (old_len != new_len) {
                this.files_contents_.push({ relative_path: relative_path, file_content: content });
            }
        }
    }

    private AnalyseLine(
        line: string,
        line_number: number,
        location: string,
        relative_path: string,
        array_features: Feature[]
    ) {
        // 排除第一个可见字符是#的行
        const match_line = line.trim();
        if (match_line.startsWith("#")) {
            return;
        }
        // 无法去分析set或者SET，因为我无法排除不是路径的情况，如set(CMAKE_AUTOMOC ON)
        // 因为有的是 set(app_icon_macos ${ICON_PATH})，需要去解析ICON_PATH，这需要解析CMakeLists.txt文件
        // 从第一个字符开始正则匹配set(.*)
        // const reg = /^set\((.*)\)/;
        // const result = reg.exec(match_line);
        // if (result != null) {
        //     array_features.push(GetFeature(match_line, file, line_number));
        //     return;
        // }
        // // 从第一个字符开始正则匹配SET(.*)
        // const reg2 = /^SET\((.*)\)/;
        // const result2 = reg2.exec(match_line);
        // if (result2 != null) {
        //     array_features.push(GetFeature(match_line, file, line_number));
        //     return;
        // }
        // 从第一个字符开始正则匹配add_executable(.*)
        const reg3 = /^add_executable\((.*)\)/;
        const result3 = reg3.exec(match_line);
        if (result3 != null) {
            array_features.push(this.GetFeature(match_line, line_number, location, relative_path));
            return;
        }
        // 从第一个字符开始正则匹配add_library(.*)
        const reg4 = /^add_library\((.*)\)/;
        const result4 = reg4.exec(match_line);
        if (result4 != null) {
            array_features.push(this.GetFeature(match_line, line_number, location, relative_path));
            return;
        }
    }

    private GetFeature(
        match_line: string,
        line_number: number,
        location: string,
        relative_path: string
    ) {
        // 用一个空格分割字符串match_line
        const words = match_line.split(" ");
        const prompt_word = words[0];
        let feature: Feature = {
            line_number: line_number,
            location: location,
            prompt_word: prompt_word,
            relative_path: relative_path,
        };
        return feature;
    }

    public dispose() {
        // Clean up our resources
        if (this.panel_) {
            this.panel_.dispose();

            while (this.disposables_.length) {
                const x = this.disposables_.pop();
                if (x) {
                    x.dispose();
                }
            }
        }
    }

    private OnOKBtnClick(
        name: string,
        file_name_base: string,
        parent_class: string,
        namespace: string,
        array_location: string[]
    ) {
        if (name != "" && file_name_base != "" && parent_class != "" && namespace != "") {
            this.GenerateHeaderFile(name, file_name_base, parent_class, namespace);
            this.GenerateClassFile(name, file_name_base, parent_class, namespace);
            this.GenerateUIFile(name, file_name_base, parent_class, namespace);
            this.InsertToCMakeLists(array_location, file_name_base);
        }
    }

    private InsertToCmakeLists(array_location: string[]) {}

    private GenerateHeaderFile(
        name: string,
        file_name_base: string,
        parent_class: string,
        namespace: string
    ) {
        // 获取this.workspace_path_最后一个目录名
        const workspace_path_array = this.workspace_path_.split("/");
        const project_name = workspace_path_array[workspace_path_array.length - 1];
        let include_guard = `${project_name.toUpperCase()}_${name.toUpperCase()}_H`;
        // 读取media中的template目录中的qt_class_header.txt文件
        const template_path = vscode.Uri.joinPath(this.extension_uri_, "media", "template");
        const template_file = vscode.Uri.joinPath(template_path, "qt_class_header.txt");
        const template_content = fs.readFileSync(template_file.fsPath, "utf-8");
        // 替换模板中的变量
        let file_content = template_content.replaceAll("${INCLUDE_GUARD}", include_guard);
        file_content = file_content.replaceAll("${PARENT_CLASS}", parent_class);
        file_content = file_content.replaceAll(
            "${USER_BEGIN_NAMESPACE}",
            `namespace ${namespace} {`
        );
        file_content = file_content.replaceAll("${USER_END_NAMESPACE}", `} // ${namespace}`);
        file_content = file_content.replaceAll("${NAME}", name);
        // 创建文件
        const file_path = path.join(this.target_dir_, `${file_name_base}.h`);
        fs.writeFile(file_path, file_content, (err) => {
            if (err) {
                let err_msg: string = `Failed to create file: ${err.message}`;
                vscode.window.showErrorMessage(err_msg);
                LOG_ERROR(err_msg);
                return;
            }
            // vscode.window.showInformationMessage(`Created file: ${file_path}`);
        });
    }

    private GenerateClassFile(
        name: string,
        file_name_base: string,
        parent_class: string,
        namespace: string
    ) {
        // 读取media中的template目录中的qt_class_header.txt文件
        const template_path = vscode.Uri.joinPath(this.extension_uri_, "media", "template");
        const template_file = vscode.Uri.joinPath(template_path, "qt_class.txt");
        const template_content = fs.readFileSync(template_file.fsPath, "utf-8");
        // 替换模板中的变量
        let file_content = template_content.replaceAll("${HEADER_FILENAME}", `${file_name_base}.h`);
        file_content = file_content.replaceAll("${UI_HEADER_FILENAME}", `ui_${file_name_base}.h`);
        file_content = file_content.replaceAll("${PARENT_CLASS}", parent_class);
        file_content = file_content.replaceAll(
            "${USER_BEGIN_NAMESPACE}",
            `namespace ${namespace} {`
        );
        file_content = file_content.replaceAll("${USER_END_NAMESPACE}", `} // ${namespace}`);
        file_content = file_content.replaceAll("${NAME}", name);
        // 创建文件
        const file_path = path.join(this.target_dir_, `${file_name_base}.cpp`);
        fs.writeFile(file_path, file_content, (err) => {
            if (err) {
                let err_msg: string = `Failed to create file: ${err.message}`;
                vscode.window.showErrorMessage(err_msg);
                LOG_ERROR(err_msg);
                return;
            }
            // vscode.window.showInformationMessage(`Created file: ${file_path}`);
        });
    }

    private Init() {
        this.panel_ = vscode.window.createWebviewPanel(
            this.view_type_, // Identifies the type of the webview. Used internally
            "New Qt UI Class", // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            UIWindow.GetWebviewOptions(this.extension_uri_)
        );

        this.update();
        this.panel_.onDidDispose(() => this.dispose(), null, this.disposables_);
        // Update the content based on view changes
        this.panel_.onDidChangeViewState(
            (e) => {
                if (this.panel_) {
                    if (this.panel_.visible) {
                        e.webviewPanel.webview.postMessage({
                            command: "restoreState",
                            array_features: this.array_features_,
                            files_contents: this.files_contents_,
                        });
                        // this.update();
                    }
                }
            },
            null,
            this.disposables_
        );
        // Handle messages from the webview
        this.panel_.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case "cancel":
                        if (this.panel_) {
                            this.panel_.dispose();
                        }
                        return;
                    case "ok":
                        LOG_INFO(`name: ${message.name}`);
                        LOG_INFO(`filenameBase: ${message.filenameBase}`);
                        LOG_INFO(`parentClass: ${message.parentClass}`);
                        LOG_INFO(`namespace: ${message.namespace}`);
                        LOG_INFO(`array_location.length: ${message.array_location.length}`);
                        this.OnOKBtnClick(
                            message.name,
                            message.filenameBase,
                            message.parentClass,
                            message.namespace,
                            message.array_location
                        );
                    default:
                        // vscode.window.showInformationMessage(`创建新的 Qt UI 类：${message.name}`);
                        if (this.panel_) {
                            this.panel_.dispose();
                        }
                        return;
                }
            },
            null,
            this.disposables_
        );

        // 读取文件内容
        // const filePath =
        // "/Users/apple/Documents/git_repo/baowen/vest-int/android-stealth-x/android-stealth-x-qt/CMakeLists.txt";
        // const fileContent = fs.readFileSync(filePath, "utf-8");
        // const lines = fileContent.split("\n");

        this.FillArrayFeatures();

        // 发送文件列表到 Webview
        this.panel_.webview.postMessage({
            command: "setFileLines",
            array_features: this.array_features_,
            files_contents: this.files_contents_,
        });
    }

    private InsertToCMakeLists(array_location: string[], file_name_base: string) {
        // 得到 this.target_dir_相对于this.workspace_path_的路径
        const file_relative_path = path.relative(this.workspace_path_, this.target_dir_);
        LOG_INFO(`file_relative_path: ${file_relative_path}`);
        for (const location of array_location) {
            LOG_INFO(`location: ${location}`);
            // 根据:切割
            const array = location.split(":");
            const cmakelists_file = array[0];
            const line_number = parseInt(array[1]);
            const header_file =
                file_relative_path != ""
                    ? `${file_relative_path}/${file_name_base}.h`
                    : `${file_name_base}.h`;
            const class_file =
                file_relative_path != ""
                    ? `${file_relative_path}/${file_name_base}.cpp`
                    : `${file_name_base}.cpp`;
            const ui_file =
                file_relative_path != ""
                    ? `${file_relative_path}/${file_name_base}.ui`
                    : `${file_name_base}.ui`;
            // 遍历 file_contents_，找到对应的文件内容
            let cmakelists_content = "";
            for (const file_content of this.files_contents_) {
                if (file_content.relative_path == cmakelists_file) {
                    cmakelists_content = file_content.file_content;
                    break;
                }
            }
            // 在cmakelists_content中找到对应的行，按照")"切割，然后在最后一个")"前面插入新的文件名
            let lines = cmakelists_content.split("\n");
            for (let i = 0; i < lines.length; i++) {
                if (i == line_number - 1) {
                    const words = lines[i].split(")");
                    let new_line = `${words[0]} ${header_file} ${class_file} ${ui_file})`;
                    lines[i] = new_line;
                    break;
                }
            }
            // 重新组合lines
            let new_content = "";
            for (const line of lines) {
                new_content += line + "\n";
            }
            if (cmakelists_content != new_content) {
                // 更新 file_contents_
                for (const file_content of this.files_contents_) {
                    if (file_content.relative_path == cmakelists_file) {
                        file_content.file_content = new_content;
                        break;
                    }
                }
            }
            // 写入文件
            // 同步写入文件
            const cmakelists_file_path = path.join(this.workspace_path_, cmakelists_file);
            try {
                fs.writeFileSync(cmakelists_file_path, new_content);
                // vscode.window.showInformationMessage(`Created file: ${cmakelists_file_path}`);
            } catch (err: any) {
                let err_msg: string = `Failed to create file: ${err.message}`;
                vscode.window.showErrorMessage(err_msg);
                LOG_ERROR(err_msg);
                return;
            }
        }
    }

    private GenerateUIFile(
        name: string,
        file_name_base: string,
        parent_class: string,
        namespace: string
    ) {
        if (parent_class == "QMainWindow") {
            this.GenerateMainWindowUIFile(name, file_name_base, parent_class, namespace);
        } else {
            this.GenerateNormalUIFile(name, file_name_base, parent_class, namespace);
        }
    }

    private GenerateNormalUIFile(
        name: string,
        file_name_base: string,
        parent_class: string,
        namespace: string
    ) {
        // 读取media中的template目录中的qt_designer_form_normal.txt文件
        const template_path = vscode.Uri.joinPath(this.extension_uri_, "media", "template");
        const template_file = vscode.Uri.joinPath(template_path, "qt_designer_form_normal.txt");
        const template_content = fs.readFileSync(template_file.fsPath, "utf-8");
        // 替换模板中的变量
        let file_content = template_content.replaceAll("${NAMESPACE_SPECIFIER}", namespace + "::");
        file_content = file_content.replaceAll("${NAME}", name);
        file_content = file_content.replaceAll("${PARENT_CLASS}", parent_class);
        // 创建文件
        const file_path = path.join(this.target_dir_, `${file_name_base}.ui`);
        fs.writeFile(file_path, file_content, (err) => {
            if (err) {
                let err_msg: string = `Failed to create file: ${err.message}`;
                vscode.window.showErrorMessage(err_msg);
                LOG_ERROR(err_msg);
                return;
            }
            // vscode.window.showInformationMessage(`Created file: ${file_path}`);
        });
    }

    private GenerateMainWindowUIFile(
        name: string,
        file_name_base: string,
        parent_class: string,
        namespace: string
    ) {
        // 读取media中的template目录中的qt_designer_form_mainwindow.txt文件
        const template_path = vscode.Uri.joinPath(this.extension_uri_, "media", "template");
        const template_file = vscode.Uri.joinPath(template_path, "qt_designer_form_mainwindow.txt");
        const template_content = fs.readFileSync(template_file.fsPath, "utf-8");
        // 替换模板中的变量
        let file_content = template_content.replaceAll("${NAMESPACE_SPECIFIER}", namespace + "::");
        file_content = file_content.replaceAll("${NAME}", name);
        file_content = file_content.replaceAll("${PARENT_CLASS}", parent_class);
        // 创建文件
        const file_path = path.join(this.target_dir_, `${file_name_base}.ui`);
        fs.writeFile(file_path, file_content, (err) => {
            if (err) {
                let err_msg: string = `Failed to create file: ${err.message}`;
                vscode.window.showErrorMessage(err_msg);
                LOG_ERROR(err_msg);
                return;
            }
            // vscode.window.showInformationMessage(`Created file: ${file_path}`);
        });
    }
}
