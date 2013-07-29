var fs = require('fs');
var fsHelper = require('./fsHelper.js');
var wrench = require('wrench');
var Promise = require('node-promise').Promise;

module.exports = function mv(source, dest) {
    var p = new Promise();
    fs.rename(source, dest, function(err){
        if (!err) return p.resolve();
        if (err.code !== 'EXDEV') return p.reject(err);
        moveAcrossDevice(source, dest, p);
    });
    return p;
}

function moveAcrossDevice(source, dest, p) {
    var child, stdout, stderr, err;
    var parts = dest.split('/');
    parts.pop();
    dest = parts.join('/') + '/';
    console.error('rsync from ' + source + ' to ' + dest);
    child = require('child_process').spawn('rsync', ['-rl', source, dest], {stdio: 'pipe'});
    child.stderr.setEncoding('utf8');
    child.stdout.setEncoding('utf8');
    stderr = '';
    stdout = '';
    child.stderr.on('data', function(data) { stderr += data; });
    child.stdout.on('data', function(data) { stdout += data; });
    child.on('close', function(code) {
        if (code === 0) {
            try {
                if (fsHelper.isFileAndExist(source)) {
                    fs.unlinkSync(source)
                } else if (fsHelper.isDirAndExist(source)) {
                    wrench.rmdirSyncRecursive(source, false);
                }
            } catch (err) {
                return p.reject(err);
            }
            return p.resolve();
        } else {
            err = new Error("rsync had nonzero exit code");
            err.code = 'RETCODE';
            err.stdout = stdout;
            err.stderr = stderr;
            return p.reject(err);
        }
    });
}
