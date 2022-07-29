const childProcess = require('child_process'); // nodeJS 自带
const exec = childProcess.exec;
const log = require('electron-log');
function startProcess(cmd, cb) {
    let _process = exec(cmd, function (err, stdout, stderr) {
        if (err) {
            return console.error(err)
        }
        log.log(`stdout: ${stdout}`);
        log.log(`stderr: ${stderr}`);
    })
    return cb(_process);
}

module.exports = {
    startProcess
}