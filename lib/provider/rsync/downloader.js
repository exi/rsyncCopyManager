var Promise = require('node-promise').Promise;
var events = require('events');
var util = require('util');

module.exports = function(deps) {
    deps.configHelper.defineMultiple(
        [
            { key: 'keyfile', fileMustExist: true }
        ]
    );
    var rsync = (new require('./rsync'))(deps);

    var Downloader = function(src, dest, serverInstance) {
        var options = {
            keyfile: deps.config.keyfile,
            username: serverInstance.username,
            host: serverInstance.hostname,
            src: src,
            dest: dest
        };

        if (serverInstance.bwlimit !== undefined) {
            options.bwlimit = serverInstance.bwlimit;
        }

        var rsyncp = new rsync.download(options);
        var this_  = this;

        this.kill = function() {
            if (rsyncp) {
                rsyncp.kill();
                rsyncp = null;
            }
        };

        rsyncp.on('progress', function(data) {
            this_.emit('progress', data);
        });

        rsyncp.on('fileProgress', function(data) {
            this_.emit('fileProgress', data);
        });

        rsyncp.on('finish', function() {
            this_.emit('finish');
            rsyncp = null;
        });

        rsyncp.on('error', function(code, msg) {
            console.error('rsync got error code ' + code);
            this_.emit('error', msg);
            rsyncp = null;
        });
    };

    util.inherits(Downloader, events.EventEmitter);
    return Downloader;
};
