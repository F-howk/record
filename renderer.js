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
        cmd:'yarn ' + cmd
    });
}

function delItem(index) {
    let data = {
        path: start_path_list[index].path,
        pid: start_path_list[index].pid
    };
    start_path_list.splice(index, 1);
    $(`.path-${index}`).remove();
    ipcRenderer.send("delItem", data);
}

function stopItem(index) {
    ipcRenderer.send("stopItem", index);
}

let command = "";
let commands = {
    help: {
        f: (item) => {
            item.term.writeln([
                'Welcome to xterm.js! Try some of the commands below.',
                '',
                ...Object.keys(commands).map(e => `  ${e.padEnd(10)} ${commands[e].description}`)
            ].join('\n\r'));
            prompt(item);
        },
        description: 'Prints this help message',
    },
    ls: {
        f: (item) => {
            item.term.writeln(['a', 'bunch', 'of', 'fake', 'files'].join('\r\n'));
            item.term.prompt(item.term);
        },
        description: 'Prints a fake directory structure'
    },
    loadtest: {
        f: (item) => {
            let testData = [];
            let byteCount = 0;
            for (let i = 0; i < 50; i++) {
                let count = 1 + Math.floor(Math.random() * 79);
                byteCount += count + 2;
                let data = new Uint8Array(count + 2);
                data[0] = 0x0A; // \n
                for (let i = 1; i < count + 1; i++) {
                    data[i] = 0x61 + Math.floor(Math.random() * (0x7A - 0x61));
                }
                // End each line with \r so the cursor remains constant, this is what ls/tree do and improves
                // performance significantly due to the cursor DOM element not needing to change
                data[data.length - 1] = 0x0D; // \r
                testData.push(data);
            }
            let start = performance.now();
            for (let i = 0; i < 1024; i++) {
                for (const d of testData) {
                    item.term.write(d);
                }
            }
            // Wait for all data to be parsed before evaluating time
            item.term.write('', () => {
                let time = Math.round(performance.now() - start);
                let mbs = ((byteCount / 1024) * (1 / (time / 1000))).toFixed(2);
                item.term.write(`\n\r\nWrote ${byteCount}kB in ${time}ms (${mbs}MB/s) using the ${isWebglEnabled ? 'webgl' : 'canvas'} renderer`);
                item.term.prompt();
            });
        },
        description: 'Simulate a lot of data coming from a process'
    }
};
let baseTheme = {
    foreground: '#F8F8F8',
    background: '#2D2E2C',
    selection: '#5DA5D533',
    black: '#1E1E1D',
    brightBlack: '#262625',
    red: '#CE5C5C',
    brightRed: '#FF7272',
    green: '#5BCC5B',
    brightGreen: '#72FF72',
    yellow: '#CCCC5B',
    brightYellow: '#FFFF72',
    blue: '#5D5DD3',
    brightBlue: '#7279FF',
    magenta: '#BC5ED1',
    brightMagenta: '#E572FF',
    cyan: '#5DA5D5',
    brightCyan: '#72F0FF',
    white: '#F8F8F8',
    brightWhite: '#FFFFFF'
};

function initTerm(item, index) {
    item.term = new Terminal({
        cursorBlink: true,
        fontFamily: '"Cascadia Code", Menlo, monospace',
        theme: baseTheme,
    });
    item.links = new WebLinksAddon((e, url) => {
        shell.openPath(url)
    });
    item.fitAddon = new FitAddon();
    item.term.loadAddon(item.links);
    item.term.loadAddon(item.fitAddon);
    item.term.open($(`.path-${index} .process-info`)[0]);
    item.term.write("$ ");
    item.fitAddon.fit();
    item.term.prompt = () => {
        item.term.write('\r\n$ ');
    };
    item.term.onData(e => {
        switch (e) {
            case '\u0003': // Ctrl+C
                item.term.write('^C');
                if (item.pid) {
                    ipcRenderer.send("kill", item.pid);
                    item.pid = "";
                }
                prompt(item);
                break;
            case '\r': // Enter
                runCommand(item, command);
                command = '';
                break;
            case '\u007F': // del
                if (item.term._core.buffer.x > 2) {
                    item.term.write('\b \b');
                    if (command.length > 0) {
                        command = command.substr(0, command.length - 1);
                    }
                }
                break;
            default:
                if (e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7E) || e >= '\u00a0') {
                    command += e;
                    item.term.write(e);
                }
        }
    });
}

function prompt(item) {
    command = '';
    item.term.write('\r\n$ ');
}

function runCommand(item, text) {
    const command = text.trim().split(' ')[0];
    if (command.length > 0) {
        item.term.writeln('');
        // ipcRenderer.send("startItem", {
        //     path:item.path,
        //     cmd: text.trim()
        // });
        if (command in commands) {
            commands[command].f(item);
            return;
        }
        item.term.writeln(`${command}: command not found`);
    }
    prompt(item);
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
        initTerm(v, i);
    })
})

ipcRenderer.on("changeStartPath", (e, data) => {
    start_path_list[data.index] = data.data;
    let v = start_path_list[data.index];
    $(`.path-${data.index} .edit-btn`).text(v.path);
    let str = "";
    for (let index in v.scripts) {
        str += `<span class="item-btn item-btns" data-item="start&${data.index}&${index}">${index}</span>`
    }
    $($(`.path-${data.index} .scripts-btn-box`)[0]).html(str);
    $(`.path-${data.index} .process-info`).html("");
    initTerm(v, data.index);
})

ipcRenderer.on("addStartPath", (e, data) => {
    start_path_list.push(data);
    let index = start_path_list.length - 1;
    let v = start_path_list[index];
    let str = "";
    for (let i in data.scripts) {
        str += `<span class="item-btn item-btns" data-item="start&${index}&${i}">${i}</span>`
    }
    $(".start-path-list").append(`
        <tr class="path-${index}">
            <td style="width:100px">${index + 1}</td>
            <td style="min-width:200px" class="edit-btn" data-index="${index}" >${data.path}</td>
            <td style="width:300px">
                <div class="scripts-btn-box">${str}</div>
                <div class="scripts-btn-box">
                    <span class="item-btn" data-item="del&${index}">删除</span>
                </div>
            </td>
            <td style="width:400px">
                <div class="process-info"></div>
            </td>
        </tr>
    `)
    initTerm(v, index);
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
            if (!v.pid) {
                v.pid = data.pid;
            }
        }
    })
    let info = data.info;
    if (info) {
        start_path_list[index].term.writeln(info || "");
    }
    // let process_info = $(`.path-${index} .process-info`).html();
    // let info = replaceUrl(data.info || "");
    // $(`.path-${index} .process-info`).html(process_info + `<p class="chalk-html">${info}</p>`);
})