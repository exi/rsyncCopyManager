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

    var Downloader = function(src, dest, serverInstance) {
        var this_  = this;
        var rsyncp = null;

        model.getInfo(serverInstance.id).then(function(data) {
            src = src[0] === '/' ? src.substr(1) : src;
            var options = {
                keyfile: deps.config.keyfile,
                username: data.username,
                host: data.hostname,
                src: data.path + '/' + src,
                dest: dest
            };

            if (serverInstance.bwlimit !== undefined) {
                options.bwlimit = serverInstance.bwlimit;
            }

            rsyncp = new rsync.download(options);

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
        }, function(err) {
            this_.emit('error', err);
        });

        this.kill = function() {
            if (rsyncp) {
                rsyncp.kill();
                rsyncp = null;
            }
        };
    };

    util.inherits(Downloader, events.EventEmitter);
    return Downloader;
};
