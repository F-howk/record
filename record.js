const $ = require("jquery");
const log = require("electron-log");
const fs = require("fs");
const {
    ipcRenderer
} = require("electron");

const ffmpeg = require("fluent-ffmpeg");


log.transports.file.level = "silly";


$("#start").on("click", function () {
    $(this).hide();
    $("#pause").show();
    start();
    if (stream){
        recorder.resume();
    };
    ipcRenderer.send('getStream');
})
$("#pause").on("click", function () {
    $(this).hide();
    $("#start").show();
    pause();
})
$("#stop").on("click", function () {
    stop();
})

let timer = null;
let recordTime = 0;
let stream = null;
let audioStream = null;
let recorder = null;
let fileSavePath = localStorage.getItem("fileSavePath")

function start() {
    timer = setInterval(() => {
        recordTime++
        $("#timeNum")[0].innerHTML = formateTime(recordTime)
    }, 1000)
}

function pause() {
    clearInterval(timer);
    recorder.pause();
}

function stop(){
    if(recorder){
        clearInterval(timer);
        recorder.stop();
    }
    else{
        window.close()
    }
}

function saveThumbnail(path) {
    ffmpeg(path + "/video.webm")
        .setFfmpegPath(process.cwd() + "/bin/ffmpeg.exe")
        .noAudio()
        .setStartTime(1)
        .frames(1)
        .save(path + "/img.png");
}



function formateTime(recordTime) {
    let hour = parseInt(recordTime / 3600);
    let minute = parseInt((recordTime % 3600) / 60);
    let second = recordTime % 3600 % 60;
    hour = hour < 10 ? '0' + hour : hour;
    minute = minute < 10 ? '0' + minute : minute;
    second = second < 10 ? '0' + second : second;
    let timeStr = `${hour}:${minute}:${second}`;
    return timeStr;
}

async function getStream(source_id) {
    fileSavePath = `${fileSavePath}/${new Date().getTime()}`;
    await fs.mkdirSync(fileSavePath);
    console.log(fileSavePath)
    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: source_id,
                maxWidth: window.screen.width,
                maxHeight: window.screen.height,
            },
        },
        audio: {
            mandatory: {
                chromeMediaSource: "desktop",
            },
            autoGainControl: {
                ConstrainBoolean: true,
            },
            ConstrainBoolean: true,
        },
    });
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            noiseSuppression: true,
        });
        this.audioStream = audioStream;
    } catch (error) {
        console.log(error);
        console.log("获取麦克风权限失败，请检查设备权限是否开启");
    }
    // audioStream.getTracks().forEach((track) => {
    //     streams.addTrack(track);
    //   });
    console.log(stream)
    recorder = new MediaRecorder(stream);
    recorder.start(1000);
    recorder.ondataavailable = (event) => {
        saveMedia(new Blob([event.data], {
            type: "video/webm",
        }));
    }
    recorder.onstop = (e)=>{
        console.log("stop")
        saveThumbnail(fileSavePath);
        $("#timeBox").css("pointer-events","none");
        setTimeout(()=>{
            window.close()
        },2000)
    }
}

function saveMedia(blob) {
    let reader = new FileReader();
    reader.onload = () => {
        let buffer = new Buffer(reader.result);
        fs.appendFile(
            fileSavePath + "/video.webm",
            buffer, {},
            (err, res) => {
                if (err) return console.error(err);
            }
        );
    }

    reader.onerror = (err) => console.error(err);
    reader.readAsArrayBuffer(blob);
}

ipcRenderer.on("streamId", (e, id) => {
    getStream(id)
})