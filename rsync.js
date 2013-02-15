var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var util = require('util');
var _ = require('lodash');
var util = require('util');
var events = require('events');

var rsync = module.exports = function (options) {
    events.EventEmitter.call(this);

    options = options || {};

    var mandatory = ['dest', 'username', 'host', 'filename', 'keyfile'];
    mandatory.forEach(function(item) {
        if (typeof options[item] === 'undefined') {
            throw (new Error('"' + item + '" is missing from options'));
        }
    });

    var src = options.username + '@' + options.host + ':' + options.filename;

    var args = [];

    args.push('--rsh=ssh -i"' + options.keyfile + '"');
    args.push('--recursive');
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

    if (typeof options.args !== 'undefined' && util.isArray(options.args)) {
        args = _.union(args, options.args);
    }

    args = _.unique(args);
    args.push('--bwlimit=10');
    args.push(src);
    args.push(options.dest);

    var cmd = 'rsync ' + args.join(' ');
    console.log('cmd: ' + cmd);

    try {
        var process = spawn('rsync', args);
        var progressregex = /\s*(\d+)\s+(\d+)%\s+(\d*\.*\d+[a-zA-Z]B\/s)\s*(\d+:\d+:\d+)/;
        var self = this;

        process.stdout.on('data', function (data) {
            if (progressregex.test(data)) {
                var m = progressregex.exec(data);
                self.emit('progress', {
                    transferred: m[1],
                    percent: m[2],
                    speed: m[3],
                    eta: m[4]
                });
            }
        });

        process.stderr.on('data', function (data) {
        });

        process.on('exit', function (code) {
            if (code === 0) {
                self.emit('finish');
            } else {
                self.emit('error', code);
            }
        });
    } catch (error) {
        this.emit('error', error);
    }
};

util.inherits(rsync, events.EventEmitter);
