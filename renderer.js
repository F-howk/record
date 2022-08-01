const $ = require("jquery");
const os = require("os");
const fs = require("fs");
const path = require('path')
const log = require("electron-log");
const {
    ipcRenderer,
    shell
} = require('electron')

const {
    BrowserWindow,
    screen
} = require("@electron/remote")

const {
    Terminal
} = require('xterm');
const {
    WebLinksAddon
} = require('xterm-addon-web-links');
const {
    FitAddon
} = require('xterm-addon-fit');
const {
    SearchAddon
} = require('xterm-addon-search');

let win = null;

let fileSavePath = localStorage.getItem("fileSavePath");
if (!fileSavePath) {
    fileSavePath = os.homedir() + "/record";
}

let isDev = process.env.NODE_ENV == 'dev';

let videoList = [];

let start_path_list = [];


fs.opendir(fileSavePath, (e, dir) => {
    if (!dir) {
        fs.mkdir(fileSavePath, (err, dir) => {
            log.log(dir)
        })
    } else {
        renderList(dir.path);
    }
})

let $themeList = $("input[name=theme]");
let theme = localStorage.getItem("theme");
if (theme) setTheme(theme);

setLoginStart();
setOptions("contentProtection");
setOptions("login-start");

$("#filePath").val(fileSavePath);

$("#filePath").on('click', function () {
    shell.openPath(fileSavePath)
})

$('#nav').on("click", "li", function (e) {
    $('#nav').children().each((i, v) => {
        $(v).removeClass('active');
    })
    $(this).addClass("active");
    let $to = $(this).attr("data-to");
    $('.right').children().each((i, v) => {
        $(v).hide()
    });
    $("." + $to).show();
    ipcRenderer.send('setConfig', {
        name: 'activeSection',
        data: $to
    });
})

$("#start").on("click", function (e) {
    let $checkbox = $("input[name=record]");
    let flag = false;
    $checkbox.each((i, v) => {
        let checked = $(v)[0].checked;
        if (checked) flag = true;
    })
    if (!flag) {
        alert("请选择录制项")
    } else {
        record()
    }
})

$("#change").on("click", function (e) {
    log.log(fileSavePath)
    ipcRenderer.send("changePath", fileSavePath);
})

$("#theme-btn").on("change", "input", function (e) {
    let curTheme = $(this).attr("id");
    localStorage.setItem("theme", curTheme);
    setTheme(curTheme);
})

$("#content-btn").on("change", "input", function (e) {
    let value = $(this).attr("data-value");
    localStorage.setItem("contentProtection", value);
    setOptions("contentProtection");
})

$("#login-start-btn").on("change", "input", function (e) {
    let value = $(this).attr("data-value");
    localStorage.setItem("login-start", value);
    ipcRenderer.send('setAutoStart', value);
    setOptions("login-start");
})

$("#add-start").on("click", function (e) {
    ipcRenderer.send("changeStartPath");
})

$("#start-list").on("click", ".item-btn", function (e) {
    let item = $(this).attr("data-item");
    formateItem(item);
})

$("#start-list").on("click", ".edit-btn", function (e) {
    let index = $(this).attr("data-index");
    ipcRenderer.send("changeStartPath", index);
})




function record() {
    let w_width = 200;
    let w_height = 50;
    const {
        width,
        height
    } = screen.getPrimaryDisplay().workAreaSize;

    let options = {
        x: width - w_width - 10,
        y: height - w_height - 10,
        width: w_width,
        height: w_height,
        frame: false,
        resizable: false,
        transparent: true,
    }

    if (isDev) options = {};

    win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            contextIsolation: false,
            enableRemoteModule: true,
        },
        ...options,
        alwaysOnTop: true
    });
    let filePath = path.join('./pages/record.html');
    win.loadFile(filePath);
    let flag = localStorage.getItem("contentProtection");
    let _obj = {
        'true': true,
        'false': false
    }
    win.setContentProtection(_obj[flag]);
    if (!isDev) {
        win.setMenu(null);
    }
    ipcRenderer.send("hide");
    win.setSkipTaskbar(true);
    win.on('close', () => {
        ipcRenderer.send("show");
        win = null;
        renderList(fileSavePath);
    })
    win.on('system-context-menu', (event) => {
        event.preventDefault()
    })
}

function setTheme(theme) {
    $themeList.each((i, v) => {
        $(v).attr("checked", false);
    })
    $(`#${theme}`).attr("checked", true);
    document.documentElement.style.setProperty("--bgColor", `var(--${theme}-bgColor)`);
    document.documentElement.style.setProperty("--fontColor", `var(--${theme}-fontColor)`);
    document.documentElement.style.setProperty("--btn-bgColor", `var(--${theme}-btn-bgColor)`);
}

function setOptions(option) {
    let _option = localStorage.getItem(option);
    if (!_option) {
        localStorage.setItem(option, "true");
        _option = 'true';
    }
    let $option = $(`input[name=${option}]`);
    $option.each((i, v) => {
        $(v).attr("checked", false);
    })
    if (_option == 'false') {
        $(`#${option}-off`).attr("checked", true);
    } else {
        $(`#${option}-on`).attr("checked", true);
    }
}

function getExtend(str) {
    let index = str.lastIndexOf(".");
    if (index == -1) return;
    let result = str.substring(index);
    //".webm", 
    if ([".mp4"].includes(result)) {
        return {
            video: str
        }
    }
    if ([".png", ".jpg", ".jpeg"].includes(result)) {
        return {
            img: str
        }
    }
}

function getList(path) {
    videoList = [];
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, subDir) => {
            subDir.forEach((v, index) => {
                fs.stat(path + '/' + v, (suberr, stats) => {
                    if (stats.isDirectory()) {
                        fs.readdir(path + '/' + v, (file_err, sub_file) => {
                            let obj = {
                                video: "",
                                img: "",
                                time: v,
                            }
                            sub_file.forEach(val => {
                                let res = getExtend(val);
                                if (res) {
                                    if (res.video) {
                                        obj.video = res.video || '';
                                    }
                                    if (res.img) {
                                        obj.img = res.img || '';
                                    }
                                }
                            })
                            obj.video = path + '/' + v + '/' + obj.video;
                            obj.img = path + '/' + v + '/' + obj.img;
                            videoList.push(obj)
                            if (videoList.length == subDir.length) {
                                resolve(videoList)
                            }
                        })
                    }
                })
            })
        })
    })
}

function renderList(path) {
    getList(path).then(res => {
        res.sort((a, b) => {
            return b.time - a.time
        })
        let str = "";
        res.forEach((v, i) => {
            str += `<video id="${i}-video" class="video" src="${v.video}" poster="${v.img}" controls preload="none"></video>`;
        })
        $("#video-list").html(str);
        $("#video-list video").on("play", function (e) {
            $('#video-list video').each((index, item) => {
                if ($(item).attr('id') !== $(this).attr('id')) {
                    item.pause()
                }
            })
        })
    })
}

function setLoginStart() {
    let _option = localStorage.getItem("login-start");
    if (!_option) {
        ipcRenderer.send('setAutoStart', true);
    }
}

function formateItem(item) {
    let list = item.split("&");
    if (list[0] == "start") {
        startItem(list[1], list[2]);
    } else if (list[0] == "stop") {
        stopItem(list[1]);
    } else {
        delItem(list[1]);
    }
}

function startItem(index, cmd) {
    let path = start_path_list[index].path;
    ipcRenderer.send("startItem", {
        path,
        cmd
    });
}

function delItem(index) {
    start_path_list.splice(index, 1);
    ipcRenderer.send("setConfig", {
        name: "startPath",
        data: start_path_list
    })
}

function stopItem(index) {
    ipcRenderer.send("stopItem", index);
}

function initTerm(tags, msg) {
    let trem = new Terminal();
    trem.open(tags);
    trem.write(msg);
}

function replaceUrl(str) {
    let reg = /(http|https):\/\/([\w.]+\/?)\S*/;
    return str
    return str.replace(reg, '<span class="jump-url" data-href="$&">$&</span>');
}


window.addEventListener("contextmenu", function (e) {
    if ($(e.target).attr("class") == 'video') {
        let flag = confirm('确认删除吗？');
        if (flag) {
            let path = $(e.target).attr('src').replace("/video.mp4", "")
            fs.rm(path, {
                recursive: true
            }, (err) => {
                renderList(fileSavePath);
            })
        }
    }
})


ipcRenderer.on("selectedPath", (e, path) => {
    localStorage.setItem("fileSavePath", path[0]);
    $("#filePath").val(path[0]);
    fileSavePath = path[0];
})

ipcRenderer.on("shortcut", (e, data) => {
    if (!win) return;
    win.webContents.send("shortcut", data)
})

ipcRenderer.on("go", (e, data) => {
    let $checkbox = $("input[name=record]");
    let flag = false;
    $checkbox.each((i, v) => {
        let checked = $(v)[0].checked;
        if (checked) flag = true;
    })
    if (!flag) {
        alert("请选择录制项")
    } else {
        record()
    }
})

ipcRenderer.send("checkForUpdate");

ipcRenderer.send("getConfig", 'startPath');

ipcRenderer.send("getConfig", 'activeSection');

ipcRenderer.send("getStartState");

ipcRenderer.on("startPath", (e, data) => {
    let list = [...new Set(data)];
    let str = "";
    list.forEach((v, i) => {
        str += `
        <tr class="path-${i}">
            <td style="width:100px">${i + 1}</td>
            <td style="min-width:200px" class="edit-btn" data-index="${i}" >${v.path}</td>
            <td style="width:300px">
                <div class="scripts-btn-box">`
        for (let index in v.scripts) {
            str += `<span class="item-btn item-btns" data-item="start&${i}&${index}">${index}</span>`
        }
        str += `</div>
                <div class="scripts-btn-box">
                    <span class="item-btn" data-item="del&${i}">删除</span>
                </div>
            </td>
            <td style="width:400px">
                <div class="process-info"></div>
            </td>
        </tr>
        `
    })
    $(".start-path-list").html(str);

    start_path_list = JSON.parse(JSON.stringify(list));
    start_path_list.forEach((v, i) => {
        v.term = new Terminal({
            disableStdin: false
        });
        v.links = new WebLinksAddon((e, url) => {
            shell.openPath(url)
        });
        v.fitAddon = new FitAddon();
        v.term.loadAddon(v.links);
        v.term.loadAddon(v.fitAddon);
        v.term.open($(`.path-${i} .process-info`)[0]);
        v.fitAddon.fit();
        v.term.onKey(e => {
            const printable = !e.domEvent.altKey && !e.domEvent.altGraphKey && !e.domEvent.ctrlKey && !e.domEvent.metaKey
            if (e.domEvent.keyCode === 13) {
                v.term.prompt()
            } else if (e.domEvent.keyCode === 8) { // back 删除的情况
                v.term.write(' ')
                if (v.term._core.buffer.x > 2) {}
            } else if (printable) {
                v.term.write(e.key)
            }
            console.log(1, 'print', e.key)
        })
        v.term.onData(key => { // 粘贴的情况
            if (key.length > 1) v.term.write(key)
        })
    })
})

ipcRenderer.on("activeSection", (e, data) => {
    $('#nav').children().each((i, v) => {
        $(v).removeClass('active');
    })
    $(`[data-to=${data}]`).addClass("active");
    $('.right').children().each((i, v) => {
        $(v).hide()
    });
    $("." + data).show();
})

ipcRenderer.on("item_process", (e, data) => {
    let index = 0;
    start_path_list.forEach((v, i) => {
        if (v.path == data.path) {
            index = i;
        }
    })
    let info = data.info;
    if (info) {
        start_path_list[index].term.write(info + '\r' || '\r');
    }
    // let process_info = $(`.path-${index} .process-info`).html();
    // let info = replaceUrl(data.info || "");
    // $(`.path-${index} .process-info`).html(process_info + `<p class="chalk-html">${info}</p>`);
})