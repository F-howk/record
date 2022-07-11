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

let win = null;

let fileSavePath = localStorage.getItem("fileSavePath");
if (!fileSavePath) {
    fileSavePath = os.homedir() + "/record";
}

let isDev = process.env.NODE_ENV == 'dev';

let videoList = [];

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
    ipcRenderer.send('setAutoStart',value);
    setOptions("login-start");
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

function setLoginStart(){
    let _option = localStorage.getItem("login-start");
    if (!_option) {
        ipcRenderer.send('setAutoStart',true);
    }
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

ipcRenderer.send("checkForUpdate")