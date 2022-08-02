const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    desktopCapturer,
    globalShortcut,
    Menu,
    Tray
} = require('electron')
const path = require('path')
const log = require("electron-log");
const {autoUpdater} = require('electron-updater');
const settings = require("electron-settings");
const {startProcess} = require('./extend/index.js');

let filePath = path.join(__dirname, './pages/index.html')

let win = null;

let isClose = false;

let isSubWin = false;

let tray  = null;

let process_list = [];

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1200,
        minHeight: 800,
        icon:path.join(__dirname, './assets/logo.ico'),
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            contextIsolation: false,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    win.loadFile(filePath);

    ipcMain.on("changePath", (e, fileSavePath) => {
        dialog.showOpenDialog({
            title: "选择文件夹",
            defaultPath: fileSavePath,
            properties: ['openDirectory']
        }).then(res => {
            if (res.filePaths?.length > 0) {
                e.sender.send('selectedPath', res.filePaths)
            }
        })
    })
    ipcMain.on("hide", (e) => {
        isSubWin = true;
        win.hide();
    })
    ipcMain.on("show", (e) => {
        isSubWin = false;
        win.show();
    })
    ipcMain.on("getStream", (e) => {
        desktopCapturer.getSources({
            types: ['screen']
        }).then(async sources => {
            e.sender.send('streamId', sources[0].id)
        })
    })
    let ex = process.execPath;
    log.log(ex);
    let res = app.getLoginItemSettings({
        path: ex,
        args: []
    });
    log.log(res)
    if (res.openAtLogin) {
        // win.setSkipTaskbar(true);
        // win.hide();
    }
    ipcMain.on("setAutoStart", (e,type) => {
        let isAt = true;
        if(type === "false"){
            isAt = false;
        }
        log.log(isAt);
        app.setLoginItemSettings({
            openAtLogin: isAt,
            path: ex,
            args: []
        });
    })

    ipcMain.on("getConfig", async (e,name) => {
        let config = await settings.get(name);
        log.log(config,'getConfig',name);
        if(config){
            e.sender.send(name, config);
        }
    })

    ipcMain.on("setConfig", async (e, {name,data}) => {
        await settings.set(name, data);
        let config = await settings.get(name);
        log.log(config,'setConfig',name);
        if(config){
            e.sender.send(name, config);
        }
    })

    ipcMain.on("changeStartPath",async (e,index) => {
        let config = await settings.get("startPath");
        log.log(config,'setConfig','startPath');
        if(!config){
            config = [];
        }
        let defaultObj = config[index] || {};
        dialog.showOpenDialog({
            title: "选择启动路径",
            defaultPath:defaultObj.path,
            properties: ['openDirectory']
        }).then(async res => {
            if (res.filePaths?.length > 0) {
                let selectPath = res.filePaths[0];
                let scripts = "";
                try {
                    scripts = require(selectPath + "/package.json").scripts;
                } catch (error) {
                    log.error(error);
                    dialog.showErrorBox('An Error Message', String(error));
                    return;
                }
                if(Object.values(defaultObj).length > 0){
                    config[index].path = selectPath;
                    config[index].scripts = scripts;
                    e.sender.send('changeStartPath', {
                        index,
                        data: config[index]
                    });
                }
                else{
                    let selectIndex = config.map(v => v.path).indexOf(selectPath);
                    if(selectIndex > -1){
                        dialog.showErrorBox('An Error Message', '该路径已存在');
                    }
                    else{
                        let obj = {
                            path:selectPath,
                            scripts:scripts
                        }
                        config.push(obj);
                        e.sender.send('addStartPath', obj);
                    }
                }
                await settings.set("startPath", config);
            }
        })
    })

    ipcMain.on("startItem",async (e,{path,cmd}) => {
        let str = `cd ${path} && ${cmd}`;
        startProcess(str,(_process) => {
            _process.stdout.on('data', function (data) {
                e.sender.send('item_process', {
                    path,
                    info:data
                });
            })
            _process.stderr.on('data', function (data) {
                e.sender.send('item_process', {
                    path,
                    info:data
                });
            })
            _process.on('close', function (code) {
                e.sender.send('item_process', {
                    path,
                    info:code
                });
            })
            _process.on("exit",function(code){
                e.sender.send('item_process', {
                    path,
                    info:code
                });
            })
            process_list.push(_process);
            e.sender.send('item_process', {
                path,
                pid:_process.pid
            });
        })
    })
    
    ipcMain.on("delItem",async (e,{path,pid}) => {
        let config = await settings.get("startPath");
        let index = config.map(v => v.path).indexOf(path);
        if(index !== -1){
            config.splice(index,1);
            if(pid){
                process.kill(pid);
            };
            await settings.set('startPath', config);
        }
    })


    ipcMain.on("stopItem",async (e,index) => {
        let config = await settings.get("startPath");
        if(!config){
            return;
        }
        console.log(config);
    })

    ipcMain.on("kill",(e,pid)=>{
        process.kill(pid);
    })

    win.on("close", (e) => {
        if (isClose) {
            win.close();
            return;
        }
        win.hide();
        e.preventDefault();
    })
    let isDev = process.env.NODE_ENV == 'dev';
    if (!isDev) {
        win.setMenu(null);
    } else {
        win.setAutoHideMenuBar(true);
    }

    globalShortcut.register("Ctrl+Alt+Enter", () => {
        win.webContents.send("shortcut", "start")
    })
    globalShortcut.register("Ctrl+Alt+S", () => {
        win.webContents.send("shortcut", "stop")
    })
    globalShortcut.register("Ctrl+Alt+P", () => {
        win.webContents.send("shortcut", "pause")
    })
    globalShortcut.register("Ctrl+Alt+G+O", () => {
        win.webContents.send("go", "go")
    })

}

app.allowRendererProcessReuse = false;

app.whenReady().then(() => {
    let remote = require("@electron/remote/main");
    remote.initialize();
    createWindow();
    remote.enable(win.webContents)

    let iconPath = path.join(__dirname, './assets/logo.png');
    let tray = new Tray(iconPath)
    let contextMenu = Menu.buildFromTemplate([{
        label: '关闭',
        click: () => {
            isClose = true;
            tray.destroy();
            let wins = BrowserWindow.getAllWindows();
            wins.forEach(v =>{
                v.close();
            })
        }
    }])
    tray.setToolTip('record')
    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
        if(!isSubWin){
            win.show();
        }
    })

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', (event) => {
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
            win.show()
        }
    })
}

autoUpdater.autoDownload = false;

let updating = false;
autoUpdater.on('error', function (e) {
    log.log('error',e);
    updating = false;

})

autoUpdater.on('update-available', function (info) {
    log.log('update-available');
    updating = true;
    autoUpdater.downloadUpdate()
})

autoUpdater.on('update-downloaded', function (event, releaseNotes, releaseName, releaseDate, updateUrl, quitAndUpdate) {
    autoUpdater.quitAndInstall(true, true)
    win.destroy()
})

ipcMain.on('checkForUpdate', () => {
    if (updating) return
  // 执行自动更新检查
    log.log('checkForUpdate');
    autoUpdater.checkForUpdates()
})
