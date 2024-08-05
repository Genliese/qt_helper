let is_inited = false;
if (!is_inited) {
    is_inited = true;
    console.log("webview.js loaded");
}

const vscode = acquireVsCodeApi();

document.getElementById("parentClass").addEventListener("change", function () {
    const customClassNameInput = document.getElementById("customClassName");
    if (this.value === "custom") {
        customClassNameInput.classList.remove("hidden");
        customClassNameInput.required = true;
    } else {
        customClassNameInput.classList.add("hidden");
        customClassNameInput.required = false;
    }
});

document.getElementById("targets").addEventListener("change", function () {
    const targetContainer = document.getElementById("targetContainer");
    if (this.checked) {
        targetContainer.classList.remove("disabled");
    } else {
        targetContainer.classList.add("disabled");
    }
});

document.getElementById("qtUiForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = {
        name: document.getElementById("name").value,
        filenameBase: document.getElementById("filenameBase").value,
        parentClass:
            document.getElementById("parentClass").value === "custom"
                ? document.getElementById("customClassName").value
                : document.getElementById("parentClass").value,
        namespace: document.getElementById("namespace").value,
        targets: document.getElementById("targets").checked,
    };

    vscode.postMessage(formData);
});

document.getElementById("cancelButton").addEventListener("click", () => {
    vscode.postMessage({ command: "cancel" });
});

function FillFileListContainer(array_features, files_contents) {
    const fileListContainer = document.getElementById("fileListContainer");
    const contentArea = document.getElementById("contentArea");
    const lineNumbers = document.getElementById("lineNumbers");
    fileListContainer.innerHTML = ""; // 清空现有的列表项
    // 删除fileListContainer.appendChild(div);

    const div = document.createElement("div");
    // div.innerHTML = `<input type="checkbox"><span>"good"</span><span>"damn"</span>`;
    // fileListContainer.appendChild(div);
    array_features.forEach((feature) => {
        const div = document.createElement("div");
        // div.innerHTML = `<input type="checkbox"><span>${feature.prompt_word}</span><span>${feature.location}</span>`;
        div.innerHTML = `
            <input type="checkbox">
            <span class="prompt-word">${feature.prompt_word}</span>
            <span class="location">${feature.location}</span>
        `;
        div.addEventListener("click", function () {
            const relative_path = feature.relative_path;
            var file_content = "";
            files_contents.forEach((pair) => {
                if (pair.relative_path === relative_path) {
                    file_content = pair.file_content;
                }
            });
            const lines = file_content.split("\n");
            contentArea.innerHTML = lines
                .map((line, index) => {
                    if (index === feature.line_number - 1) {
                        return `<span class="highlight">${line}</span>`;
                    }
                    return line;
                })
                .join("\n");
            lineNumbers.innerHTML = lines
                .map((_, index) => `<div class="line-number">${index + 1}</div>`)
                .join("");
            syncScroll(contentArea, lineNumbers);
            scrollToHighlight(contentArea);
        });
        fileListContainer.appendChild(div);
    });
}

function restoreFileListContainer() {
    FillFileListContainer();
}

// 接收来自扩展的消息
window.addEventListener("message", (event) => {
    console.log("window.addEventListener");
    const message = event.data;
    switch (message.command) {
        case "setFileLines":
            array_features = message.array_features;
            files_contents = message.files_contents;
            console.log("message.command setFileLines");
            FillFileListContainer(array_features, files_contents);
            break;
        case "restoreState":
            console.log("message.command restoreState");
            array_features = message.array_features;
            files_contents = message.files_contents;
            FillFileListContainer(array_features, files_contents);
            break;
    }
});

// 确保行号和内容同步滚动
function syncScroll(contentArea, lineNumbers) {
    contentArea.addEventListener("scroll", () => {
        lineNumbers.scrollTop = contentArea.scrollTop;
    });
}

// 滚动到高亮行
function scrollToHighlight(contentArea) {
    const highlight = contentArea.querySelector(".highlight");
    if (highlight) {
        contentArea.scrollTop =
            highlight.offsetTop - contentArea.clientHeight / 2 + highlight.clientHeight / 2;
    }
}

document.getElementById("okButton").addEventListener("click", () => {
    //从 <input type="text" id="name" name="name" required /> 中获取用户输入的值
    const name = document.getElementById("name").value;
    //从 <input type="text" id="filenameBase" name="filenameBase" required /> 中获取用户输入的值
    const filenameBase = document.getElementById("filenameBase").value;
    //从 <select id="parentClass" name="parentClass" required /> 中获取用户选择的值
    var parentClass = document.getElementById("parentClass").value;
    //从 <input type="text" id="customClassName" name="customClassName" required /> 中获取用户输入的值
    const customClassName = document.getElementById("customClassName").value;
    if (parentClass == "custom") {
        parentClass = customClassName;
    }
    const namespace = document.getElementById("namespace").value;
    let array_location = [];
    // 检查id=targets的checkbox是否被选中
    var check_targets = document.getElementById("targets").checked;
    if (check_targets) {
        // 检查id=fileListContainer的div是否存在
        var check_fileListContainer = document.getElementById("fileListContainer");
        if (check_fileListContainer) {
            // 检查id=fileListContainer的div是否有子元素
            var check_fileListContainer_child =
                document.getElementById("fileListContainer").children;
            if (check_fileListContainer_child.length > 0) {
                // 遍历id=fileListContainer的div的子元素
                for (var i = 0; i < check_fileListContainer_child.length; i++) {
                    // 检查id=fileListContainer的div的子元素是否被选中
                    var check_fileListContainer_child_checked =
                        check_fileListContainer_child[i].children[0].checked;
                    if (check_fileListContainer_child_checked) {
                        // 获取 <span class="location">${feature.location}</span> 的值
                        var location = check_fileListContainer_child[i].children[2].innerText;
                        array_location.push(location);
                    }
                }
            }
        }
    }
    // 发送消息到扩展
    vscode.postMessage({
        command: "ok",
        name,
        filenameBase,
        parentClass,
        namespace,
        array_location,
    });
});
