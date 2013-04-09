var fs = require('fs');
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
    child = require('child_process').spawn('rsync', ['-a', source, dest], {stdio: 'pipe'});
    child.stderr.setEncoding('utf8');
    child.stdout.setEncoding('utf8');
    stderr = '';
    stdout = '';
    child.stderr.on('data', function(data) { stderr += data; });
    child.stdout.on('data', function(data) { stdout += data; });
    child.on('close', function(code) {
        if (code === 0) {
            wrench.rmdirSyncRecursive(source, true);
            p.resolve();
        } else {
            err = new Error("rsync had nonzero exit code");
            err.code = 'RETCODE';
            err.stdout = stdout;
            err.stderr = stderr;
            p.reject(err);
        }
    });
}
