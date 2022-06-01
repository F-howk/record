const $ = require("jquery");
const log = require("electron-log");
const fs = require("fs");
const {
    ipcRenderer
} = require("electron");

const ffmpeg = require("fluent-ffmpeg");


log.transports.file.level = "silly";


$("#start").on("click", handleStart)
$("#pause").on("click", handlePause)
$("#stop").on("click", handleStop)

let lock = false;
let timer = null;
let recordTime = 0;
let stream = null;
let audioStream = null;
let recorder = null;
let fileSavePath = localStorage.getItem("fileSavePath")

function start() {
    if(timer)clearInterval(timer);
    timer = setInterval(() => {
        recordTime++
        $("#timeNum")[0].innerHTML = formateTime(recordTime)
    }, 1000)
}

function pause() {
    clearInterval(timer);
    recorder.pause();
}

function stop() {
    if (recorder) {
        clearInterval(timer);
        recorder.stop();
    } else {
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
    log.log(fileSavePath)
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
        log.log(error);
        log.warn("获取麦克风权限失败，请检查设备权限是否开启");
    }
    // audioStream.getTracks().forEach((track) => {
    //     streams.addTrack(track);
    //   });
    log.log('stream:',stream);
    recorder = new MediaRecorder(stream);
    log.log('recorder:',recorder);
    recorder.start(1000);
    recorder.ondataavailable = (event) => {
        saveMedia(new Blob([event.data], {
            type: "video/webm",
        }));
    }
    recorder.onstop = (e) => {
        log.log("stop")
        saveThumbnail(fileSavePath);
        $("#timeBox").css("pointer-events", "none");
        transcoding().then(res =>{
            lock = false;
            window.close()
        })
    }
    recorder.onresume = (e)=>{
        log.log("resume");
        lock = false;
    }
    recorder.onpause = (e)=>{
        log.log("pause");
        lock = false;
    }
    recorder.onstart = (e)=>{
        log.log("start");
        lock = false;
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

function transcoding() {
    return new Promise((resolve,reject)=>{
        let options = [
            "-vcodec",
            "copy",
            "-codec",
            "copy",
            "-f",
            "mp4",
        ]
        ffmpeg(fileSavePath + "/video.webm")
            .setFfmpegPath(process.cwd() + "/bin/ffmpeg.exe")
            .outputOptions(options)
            .save(fileSavePath + "/video.mp4")
            .on("start", function (e) {
                log.log("ffmpeg is start: " + e);
            })
            .on("end", function (e) {
                log.log("ffmpeg is end");
                resolve();
            })
            .on("error", function (err) {
                log.log("ffmpeg is error! " + err);
                reject();
            })
    })
}

function handleStart(){
    if(recorder?.state == 'recording'){
        lock = false;
        return;
    };
    $("#start").hide();
    $("#pause").show();
    start();
    if (stream) {
        recorder.resume();
    }else{
        ipcRenderer.send('getStream');
    }
}

function handlePause(){
    if(recorder?.state == 'paused'){
        lock = false;
        return;
    };
    $("#pause").hide();
    $("#start").show();
    pause();
}
function handleStop(){
    if(recorder?.state == 'inactive'){
        lock = false;
        return;
    };
    stop();
}

function handleShortcut(type){
    switch(type){
        case "start" : handleStart();break;
        case "pause" : handlePause();break;
        case "stop" : handleStop();break;
    }
}

ipcRenderer.on("streamId", (e, id) => {
    getStream(id)
})

ipcRenderer.on("shortcut",(e,data)=>{
    if(lock) return;
    lock = true;
    handleShortcut(data);
})