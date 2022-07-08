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

let filePath = path.join(__dirname, './pages/index.html')

let win = null;

let isClose = false;

let isSubWin = false;

let tray  = null;

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