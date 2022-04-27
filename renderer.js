const $ = require("jquery");
const os = require("os");
const fs = require("fs");
const {ipcRenderer} = require('electron')

let fileSavePath = localStorage.getItem("fileSavePath");
if(!fileSavePath){
    fileSavePath = os.homedir() + "/record";
}

fs.opendir(fileSavePath,(e,dir)=>{
    console.log(dir)
    if(!dir){
        fs.mkdir(fileSavePath,(err,dir)=>{
            console.log(dir)
        })
    }
})


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

ipcRenderer.once("selectedPath",(e,path)=>{
    localStorage.setItem("fileSavePath",path[0]);
    $("#filePath").val(path[0]);
    fileSavePath = path[0];
})

function record(){
    console.log(1)
}