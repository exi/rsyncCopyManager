var Promise = require('node-promise').Promise;
var events = require('events');
var util = require('util');

module.exports = function(deps) {
    deps.configHelper.defineMultiple(
        [
            { key: 'keyfile', fileMustExist: true }
        ]
    );

    var rsync = new (require('./rsync.js'))(deps);

    var Scanner = function(serverInstance) {

        var rsyncp = new rsync.filelist({
            keyfile: deps.config.keyfile,
            username: serverInstance.username,
            host: serverInstance.hostname,
            src: serverInstance.path
        });

        var this_  = this;

        this.kill = function() {
            if (rsyncp) {
                rsyncp.kill();
                rsyncp = null;
            }
        };

        this.suspend = function() {
            rsyncp.suspend();
        };

        this.resume = function() {
            rsyncp.resume();
        };

        this.isSuspended = function() {
            return rsyncp.suspended;
        };

        rsyncp.on('files', function(files) {
            this_.emit('files', files);
        });

        rsyncp.on('finish', function() {
            this_.emit('finish');
        });

        rsyncp.on('error', function(code, msg) {
            console.error('rsync scanner error code ' + code);
            this_.emit('error', msg);
        });
    };

    util.inherits(Scanner, events.EventEmitter);
    return Scanner;
};
