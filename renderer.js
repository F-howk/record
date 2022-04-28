const $ = require("jquery");
const os = require("os");
const fs = require("fs");
const path = require('path')
const {ipcRenderer} = require('electron')

const {BrowserWindow} = require("@electron/remote")

let fileSavePath = localStorage.getItem("fileSavePath");
if(!fileSavePath){
    fileSavePath = os.homedir() + "/record";
}

fs.opendir(fileSavePath,(e,dir)=>{
    if(!dir){
        fs.mkdir(fileSavePath,(err,dir)=>{
            console.log(dir)
        })
    }
})

let $themeList = $("input[name=theme]");
let theme = localStorage.getItem("theme");
if(theme) setTheme(theme);

$("#filePath").val(fileSavePath);

$('#nav').on("click","li",function (e){
    $('#nav').children().each((i,v)=>{
        $(v).removeClass('active');
    })
    $(this).addClass("active");
    let $to = $(this).attr("data-to");
    $('.right').children().each((i,v)=>{$(v).hide()});
    $("." + $to).show();
})

$("#start").on("click",function(e){
    let $checkbox = $("input[name=record]");
    let flag = false;
    $checkbox.each((i,v)=>{
        let checked = $(v)[0].checked;
        if(checked) flag = true;
    })
    if(!flag){
        alert("请选择录制项")
    }
    else{
        record()
    }
})

$("#change").on("click",function(e){
    console.log(fileSavePath)
    ipcRenderer.send("changePath",fileSavePath);
})

ipcRenderer.on("selectedPath",(e,path)=>{
    localStorage.setItem("fileSavePath",path[0]);
    $("#filePath").val(path[0]);
    fileSavePath = path[0];
})

$("#theme-btn").on("change","input",function(e){
    let curTheme = $(this).attr("id");
    localStorage.setItem("theme",curTheme);
    setTheme(curTheme);
})


function record(){
    let win = new BrowserWindow();
    let filePath = path.join('./pages/record.html');
    win.loadFile(filePath);
}

function setTheme(theme){
    $themeList.each((i,v)=>{
        $(v).attr("checked",false);
    })
    $(`#${theme}`).attr("checked",true);
    document.documentElement.style.setProperty("--bgColor",`var(--${theme}-bgColor)`);
    document.documentElement.style.setProperty("--fontColor",`var(--${theme}-fontColor)`);
    document.documentElement.style.setProperty("--btn-bgColor",`var(--${theme}-btn-bgColor)`);
}