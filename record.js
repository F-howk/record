const $ = window.require("jquery");
const log = require("electron-log");

log.transports.file.level = "silly";

$("#start").on("click",function(){
    $(this).hide();
    $("#pause").show();
    start();
})
$("#pause").on("click",function(){
    $(this).hide();
    $("#start").show();
    pause();
})
$("#stop").on("click",function(){
    pause();
    window.close()
})

let timer = null;
let recordTime = 0;

function start(){
    timer = setInterval(()=>{
        recordTime++
        $("#timeNum")[0].innerHTML = formateTime(recordTime)
    },1000)
}
function pause(){
    clearInterval(timer);
}
function formateTime(recordTime){
    let hour = parseInt(recordTime / 3600);
    let minute = parseInt((recordTime % 3600) / 60);
    let second = recordTime % 3600 % 60;
    hour = hour < 10 ? '0' + hour : hour;
    minute = minute < 10 ? '0' + minute : minute;
    second = second < 10 ? '0' + second : second;
    let timeStr = `${hour}:${minute}:${second}`;
    return timeStr;
}