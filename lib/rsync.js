var spawn = require('child_process').spawn;
var util = require('util');
var events = require('events');
var Promise = require('node-promise').Promise;
var errorHelper = require('./errorHelper.js');

module.exports = function(deps) {
    deps.configHelper.defineMultiple(
        [
            { key: 'rsync.maxDepth', defaultValue: -1 },
            { key: 'rsync.cipher', defaultValue: false }
        ]
    );

    var MissingOptionError = errorHelper.customError('Missing option Error');

    function escapeSrc(src) {
        return '"' + src + '"';
    }

    function buildargs(options, mandatory) {
        options = options || {};

        mandatory = mandatory || [];
        mandatory.forEach(function(item) {
            if (!options[item]) {
                throw new MissingOptionError('"' + item + '" is missing from options');
            }
        });

        var args = [];
        var sshargs = [
            '--rsh=ssh',
            '-C',
            '-i"' + options.keyfile + '"',
            '-o UserKnownHostsFile=/dev/null',
            '-o StrictHostKeyChecking=no',
            '-o BatchMode=yes'
        ];

        if (deps.config.rsync.cipher) {
            sshargs.push('-c ' + deps.config.rsync.cipher);
        }

        args.push(sshargs.join(' '));
        args.push('--recursive');
        args.push('--copy-links');

        if (deps.config.rsync.maxDepth > 0) {
            args.push('--exclude=' + Array(deps.config.rsync.maxDepth + 1).join('/*') + '/**');
        }

        if (options.filelist !== true) {
            args.push('--partial');
            args.push('--progress');
            args.push('--append-verify');
            args.push('--size-only');
        }

        if (options.bwlimit) {
            args.push('--bwlimit=' + options.bwlimit);
        }

        var src = options.username + '@' + options.host + ':' + escapeSrc(options.src);

        args.push(src);

        if (options.dest && !options.filelist) {
            args.push(options.dest);
        }

        return args;
    }

    var download = function (options) {
        events.EventEmitter.call(this);

        var args = buildargs(options, ['username', 'host', 'src', 'dest', 'keyfile']);
        var rsync = spawn('rsync', args, { uid: process.getuid() });
        var progressregex = /\s*(\d+)\s+(\d+)%\s+(\d*\.*\d+[a-zA-Z]B\/s)\s*(\d+:\d+:\d+)/;
        var xferregex = /to-check=(\d+)\/(\d+)\)/;
        var self = this;
        var stderrdata = '';

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
            stderrdata += data;
        });

        rsync.on('exit', function (code) {
            if (code === 0) {
                self.emit('finish');
            } else {
                self.emit('error', code, stderrdata);
            }
        });

        this.kill = function() {
            if (rsync && rsync.kill) {
                rsync.kill('SIGINT');
                rsync.kill('SIGTERM');
                rsync.kill('SIGHUP');
            }
        };
    };

    util.inherits(download, events.EventEmitter);

    var filelist = function (options) {
        events.EventEmitter.call(this);
        options.filelist = true;

        var args = buildargs(options, ['username', 'host', 'src', 'keyfile']);
        var rsync = spawn('rsync', args, { uid: process.getuid() });
        var self = this;
        var filelistregex = /([d\-])[rwx\-]{9}\s+((\d|,)+)\s+\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s(.*)/;
        var lastline = '';
        var stdoutdata = '';
        var stderrdata = '';
        var filecount = 0;

        rsync.stdout.on('data', function (data) {
            stdoutdata += data;
            var filelist = [];
            var lines = (lastline + '' + data).split('\n');
            var lastline = lines.pop();

            lines.forEach(function(line) {
                if (filelistregex.test(line)) {
                    var m = filelistregex.exec(line);
                    if (m[3] !== '.' && m[3]) {
                        var fse = {
                            isDir: m[1] === 'd',
                            size: m[1] === 'd' ? -1 : parseInt(m[2].replace(',', ''), 10), //otherwise size would be fs dependent
                            path: '' + m[4]
                        };
                        filelist.push(fse);
                    }
                }
            });

            if (filelist.length > 0) {
                filecount += filelist.length;
                self.emit('files', filelist);
            }
        });

        rsync.stderr.on('data', function (data) {
            stderrdata += data;
        });

        rsync.on('exit', function (code) {
            //the code 23 exception skips 'permission denied' errors if the rest of the transfer was successfull
            if (code === 0 || (code === 23 && filecount > 0)) {
                self.emit('finish');
            } else {
                self.emit('error', code, stderrdata);
            }
        });

        this.suspended = false;

        this.kill = function() {
            console.error('kill');
            if (rsync && rsync.kill) {
                rsync.kill('SIGINT');
                rsync.kill('SIGTERM');
                rsync.kill('SIGHUP');
            }
        };

        this.suspend = function() {
            console.error('suspend');
            if (rsync && rsync.kill) {
                rsync.kill('SIGSTOP');
                this.suspended = true;
            }
        };

        this.resume = function() {
            console.error('resume');
            if (rsync && rsync.kill) {
                rsync.kill('SIGCONT');
                this.suspended = false;
            }
        };
    };

    util.inherits(filelist, events.EventEmitter);

    return {
        MissingOptionError: MissingOptionError,
        filelist: filelist,
        download: download
    };
};
