var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var util = require('util');
var _ = require('lodash');
var util = require('util');
var events = require('events');
var Promise = require('node-promise').Promise;

function escapeSrc(src) {
    return '"' + src + '"';
}

function buildargs(options, mandatory) {
    options = options || {};

    mandatory = mandatory || [];
    mandatory.forEach(function(item) {
        if (!options[item]) {
            throw (new Error('"' + item + '" is missing from options'));
        }
    });

    var args = [];

    args.push('--rsh=ssh -i"' + options.keyfile + '" -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no');
    args.push('--recursive');
    args.push('--timeout=120');
    args.push('--copy-links');
    if (options.filelist !== true) {
        args.push('--partial');
        args.push('--progress');

        switch (options.compareMode) {
            case 'sizeOnly':
                args.push('--size-only');
                break;
            case 'checksum':
                args.push('--checksum');
                break;
        }
    }

    if (options.args && util.isArray(options.args)) {
        args = _.union(args, options.args);
    }

    args = _.unique(args);
    if (options.bwlimit) {
        args.push('--bwlimit=' + options.bwlimit);
    }

    var src = options.username + '@' + options.host + ':' + escapeSrc(options.src);

    args.push(src);

    if (options.dest) {
        args.push(options.dest);
    }

    console.log(args.join(' '));

    return args;
}

var download = module.exports.download = function (options) {
    events.EventEmitter.call(this);

    var args = buildargs(options, ['username', 'host', 'src', 'dest', 'keyfile']);
    var rsync;

    try {
        rsync = spawn('rsync', args);
        var progressregex = /\s*(\d+)\s+(\d+)%\s+(\d*\.*\d+[a-zA-Z]B\/s)\s*(\d+:\d+:\d+)/;
        var xferregex = /to-check=(\d+)\/(\d+)\)/;
        var self = this;

        rsync.stdout.on('data', function (data) {
            if (progressregex.test(data)) {
                var m = progressregex.exec(data);
                self.emit('progress', {
                    bytes: m[1],
                    percent: m[2],
                    rate: m[3],
                    eta: m[4]
                });
            }
            if (xferregex.test(data)) {
                var m = xferregex.exec(data);
                self.emit('files', {
                    left: m[1],
                    total: m[2]
                });
            }
        });

        rsync.stderr.on('data', function (data) {
        });

        rsync.on('exit', function (code) {
            if (code === 0) {
                self.emit('finish');
            } else {
                self.emit('error', code);
            }
        });
    } catch (error) {
        this.emit('error', error);
    }

    this.kill = function() {
        if (rsync && rsync.kill) {
            console.log('killing rsync');
            rsync.kill('SIGINT');
            rsync.kill('SIGTERM');
            rsync.kill('SIGHUP');
        }
    };
};

util.inherits(download, events.EventEmitter);

var filelist = module.exports.filelist = function (options) {
    events.EventEmitter.call(this);

    if (options && options.dest) {
        delete options.dest;
    }
    options.filelist = true;

    var args = buildargs(options, ['username', 'host', 'src', 'keyfile']);
    var rsync;

    try {
        rsync = spawn('rsync', args);
        var self = this;
        var filelistregex = /([d\-])[rwx\-]{9}\s+(\d+)\s+\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s(.*)/;
        var stdoutdata = '';

        rsync.stdout.on('data', function (data) {
            stdoutdata += data;
        });

        rsync.stderr.on('data', function (data) {
            data = 'err: ' + data;
        });

        rsync.on('exit', function (code) {
            if (code === 0) {
                var filelist = [];
                var lines = stdoutdata.split('\n');

                lines.forEach(function(line) {
                    if (filelistregex.test(line)) {
                        var m = filelistregex.exec(line);
                        filelist.push({
                            isDir: m[1] === 'd',
                            size: m[2],
                            path: '' + m[3]
                        });
                    }
                });
                self.emit('finish', filelist);
            } else {
                self.emit('error', code);
            }
        });
    } catch (error) {
        this.emit('error', error);
    }

    this.kill = function() {
        console.log('killing rsync');
        if (rsync && rsync.kill) {
            rsync.kill('SIGINT');
            rsync.kill('SIGTERM');
            rsync.kill('SIGHUP');
        }
    };
};

util.inherits(filelist, events.EventEmitter);
