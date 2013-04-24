var Promise = require('node-promise').Promise;
var Model = require('./model.js');
var events = require('events');
var util = require('util');

module.exports = function(deps) {
    deps.configHelper.defineMultiple(
        [
            { key: 'keyfile', fileMustExist: true }
        ]
    );

    var rsync = new (require('./rsync.js'))(deps);
    var model = Model(deps);

    var Scanner = function(serverInstance) {
        var rsyncp = null;
        var this_  = this;

        model.getInfo(serverInstance.id).then(function(data) {
            rsyncp = new rsync.filelist({
                keyfile: deps.config.keyfile,
                username: data.username,
                host: data.hostname,
                src: data.path
            });

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
        }, function(err) {
            this_.emit('error', err);
        });

        this.kill = function() {
            if (rsyncp) {
                rsyncp.kill();
                rsyncp = null;
            }
        };

        this.suspend = function() {
            if (rsyncp) {
                rsyncp.suspend();
            }
        };

        this.resume = function() {
            if (rsyncp) {
                rsyncp.resume();
            }
        };

        this.isSuspended = function() {
            return rsyncp ? rsyncp.suspended : false;
        };
    };

    util.inherits(Scanner, events.EventEmitter);
    return Scanner;
};
