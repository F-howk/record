const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    desktopCapturer
} = require('electron')
const path = require('path')

let filePath = path.join(__dirname, './pages/index.html')

let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1200,
        minHeight: 800,
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
        win.hide();
    })
    ipcMain.on("show", (e) => {
        win.show();
    })
    ipcMain.on("getStream", (e) => {
        desktopCapturer.getSources({
            types: ['screen']
        }).then(async sources => {
            e.sender.send('streamId', sources[0].id)
        })
    })
    let isDev = process.env.NODE_ENV == 'dev';
    if(!isDev){
        win.setMenu(null);
    }
    else{
        win.setAutoHideMenuBar(true);
    }
}

app.allowRendererProcessReuse = false;

app.whenReady().then(() => {
    let remote = require("@electron/remote/main");
    remote.initialize();
    createWindow();
    remote.enable(win.webContents)

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