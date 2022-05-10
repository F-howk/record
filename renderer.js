const $ = require("jquery");
const os = require("os");
const fs = require("fs");
const path = require('path')
const {
    ipcRenderer
} = require('electron')

const {
    BrowserWindow
} = require("@electron/remote")

let fileSavePath = localStorage.getItem("fileSavePath");
if (!fileSavePath) {
    fileSavePath = os.homedir() + "/record";
}

let videoList = [];

fs.opendir(fileSavePath, (e, dir) => {
    if (!dir) {
        fs.mkdir(fileSavePath, (err, dir) => {
            console.log(dir)
        })
    }
    else{
        fs.readdir(dir.path,(err,subDir) =>{
            subDir.forEach(v =>{
                fs.stat(dir.path + '/' +v,(suberr,stats)=>{
                    if(stats.isDirectory()){
                        fs.readdir(dir.path + '/' + v,(file_err,sub_file)=>{
                            let obj = {
                                video:"",
                                img:""
                            }
                            sub_file.forEach(val =>{
                                let res = getExtend(val);
                                if(res){
                                    if(res.video){
                                        obj.video = res.video || '';
                                    }
                                    if(res.img){
                                        obj.img = res.img || '';
                                    }
                                }
                            })
                            obj.video = dir.path + '/' + v + '/' + obj.video;
                            obj.img = dir.path + '/' + v + '/' + obj.img;
                            videoList.push(obj)
                            $("#video-list")[0].innerHTML += `<video src="${obj.video}" poster="${obj.img}" controls></video>`
                        })
                    }
                })
            })
        })
    }
})

let $themeList = $("input[name=theme]");
let theme = localStorage.getItem("theme");
if (theme) setTheme(theme);

$("#video-list").on("click",'video',function(e){
    console.log($(this))
})

$("#filePath").val(fileSavePath);

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
    console.log(fileSavePath)
    ipcRenderer.send("changePath", fileSavePath);
})

ipcRenderer.on("selectedPath", (e, path) => {
    localStorage.setItem("fileSavePath", path[0]);
    $("#filePath").val(path[0]);
    fileSavePath = path[0];
})

$("#theme-btn").on("change", "input", function (e) {
    let curTheme = $(this).attr("id");
    localStorage.setItem("theme", curTheme);
    setTheme(curTheme);
})


function record() {
    let win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            contextIsolation: false,
            enableRemoteModule: true,
        }
    });
    let filePath = path.join('./pages/record.html');
    win.loadFile(filePath);
    win.setContentProtection(true);
    ipcRenderer.send("hide");
    win.on('close',()=>{
        ipcRenderer.send("show");
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

function getExtend(str){
    let index = str.lastIndexOf(".");
    if(index == -1) return;
    let result = str.substring(index);
    if([".webm",".mp4"].includes(result)){
        return {video:str}
    }
    if([".png",".jpg",".jpeg"].includes(result)){
        return {img:str}
    }
}