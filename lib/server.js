var Promise = require('node-promise').Promise;
var All = require('node-promise').all;
var child_process = require('child_process');

var Server = module.exports = function(deps, serverId) {
    var api = {};
    var startupPromise = new Promise();
    var promises = {};
    var msgid = 0;
    var worker = null;
    var closed = false;

    function startWorker() {
        if (closed) {
            return;
        }
        console.error('trying to start worker', serverId);
        worker = child_process.fork(__dirname + '/server-worker.js');
        worker.on('message', function(data) {
            if (data.id !== undefined && promises[data.id]) {
                if (data.type === 'error') {
                    promises[data.id].reject(data.data);
                } else {
                    promises[data.id].resolve(data.data);
                }
                delete promises[data.id];
            } else if (data.command === 'event' && data.topic !== undefined) {
                deps.eventBus.emit(data.topic, data.data);
            }
        });

        worker.on('exit', function(code) {
            console.error('worker exit with', code);
            for (var i in promises) {
                if (promises.hasOwnProperty(i)) {
                    promises[i].reject(new Error('Worker Lost'));
                }
            }
            promises = {};
            worker.removeAllListeners();
            worker = null;
            startupPromise = new Promise();

            if (code !== 0 && !closed) {
                setTimeout(startWorker, 1000);
            }
        });

        sendMessage({ command: 'start', serverId: serverId }, function(err, data) {
            console.error('worker', serverId, 'started');
            startupPromise.resolve();
        });
    }

    startWorker();

    function sendMessage(data, callback) {
        var id = msgid++;
        var p = new Promise();

        if (callback) {
            p.then(function(data) {
                callback(null, data);
            }, callback);
        }

        promises[id] = p;
        try {
            worker.send({
                id: id,
                data: data
            });
        } catch (e) {
            console.error('worker error', e);
            delete promises[id];
            p.reject(e);
        }
    }

    api.closeAndDelete = function() {
        var p = new Promise();
        closed = true;
        startupPromise.then(function() {
            sendMessage({ command: 'closeAndDelete' }, function(err) {
                if (err) {
                    return p.reject(err);
                }
                worker.kill();
                p.resolve();
            });
        });
        return p;
    };

    api.close = function() {
        var p = new Promise();
        closed = true;
        startupPromise.then(function() {
            worker.kill();
            p.resolve();
        });
        return p;
    };

    api.rescan = function() {
        var p = new Promise();
        startupPromise.then(function() {
            sendMessage({ command: 'rescan' });
        });
        return p;
    };

    api.getStatus = function() {
        var p = new Promise();
        startupPromise.then(function() {
            sendMessage({ command: 'getStatus' }, function(err, data) {
                if (err) {
                    return p.reject(err);
                }

                p.resolve(data.status);
            });
        });
        return p;
    };

    return api;
};
