var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var util = require('util');
var _ = require('lodash');
var util = require('util');
var events = require('events');
var Promise = require('node-promise').Promise;
var config = require('./config.js');

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

    args.push('--rsh=ssh -C -i"' + options.keyfile + '" -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -oBatchMode=yes');
    args.push('--recursive');
    args.push('--copy-links');

    if (config.rsync.maxDepth > 0) {
        args.push('--exclude="' + Array(config.rsync.maxDepth + 1).join('/*') + '/**"');
    }

    if (options.filelist !== true) {
        args.push('--partial');
        args.push('--progress');
        args.push('--append-verify');

        if (config.rsync.compareMode) {
            switch (config.rsync.compareMode) {
                case 'sizeOnly':
                    args.push('--size-only');
                    break;
                case 'checksum':
                    args.push('--checksum');
                    break;
            }
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
        var stderrmsg = '';

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
            stderrmsg += data;
        });

        rsync.on('exit', function (code) {
            if (code === 0) {
                self.emit('finish');
            } else {
                self.emit('error', code, stderrmsg);
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
        var lastline = '';
        var stdoutdata = '';
        var stderrdata = '';

        rsync.stdout.on('data', function (data) {
            var filelist = [];
            var lines = (lastline + '' + data).split('\n');
            var lastline = lines.pop();

            lines.forEach(function(line) {
                if (filelistregex.test(line)) {
                    var m = filelistregex.exec(line);
                    if (m[3] !== '.' && m[3]) {
                        var fse = {
                            isDir: m[1] === 'd',
                            size: parseInt(m[2], 10),
                            path: '' + m[3]
                        };
                        filelist.push(fse);
                    } else {
                        console.log('exclude', m[3]);
                    }
                }
            });

            if (filelist.length > 0) {
                self.emit('files', filelist);
            }
        });

        rsync.stderr.on('data', function (data) {
            stderrdata += data;
        });

        rsync.on('exit', function (code) {
            //the code 23 exception skips 'permission denied' errors if the rest of the transfer was successfull
            if (code === 0 || (code === 23 && filelist.length > 0)) {
                self.emit('finish', filelist);
            } else {
                self.emit('error', code, stderrdata);
            }
        });
    } catch (error) {
        this.emit('error', error);
    }

    this.suspended = false;

    this.kill = function() {
        console.log('killing rsync');
        if (rsync && rsync.kill) {
            rsync.kill('SIGINT');
            rsync.kill('SIGTERM');
            rsync.kill('SIGHUP');
        }
    };

    this.suspend = function() {
        if (rsync && rsync.kill) {
            rsync.kill('SIGSTOP');
            console.log('##### rsync suspend');
            this.suspended = true;
        }
    };

    this.resume = function() {
        if (rsync && rsync.kill) {
            rsync.kill('SIGCONT');
            this.suspended = false;
            console.log('##### rsync resume');
        }
    };
};

util.inherits(filelist, events.EventEmitter);
