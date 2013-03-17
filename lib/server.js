var rsync = require('./rsync');
var Promise = require('node-promise').Promise;
var All = require('node-promise').all;
var child_process = require('child_process');

var Server = module.exports = function(deps, serverId) {
    var api = {};
    var startupPromise = new Promise();
    var promises = {};
    var msgid = 0;

    var worker = child_process.fork(__dirname + '/server-worker.js');

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

    function sendMessage(data, callback) {
        var id = msgid++;
        var p = new Promise();
        if (callback) {
            p.then(callback);
        }
        promises[id] = p;
        worker.send({
            id: id,
            data: data
        });
    }

    api.closeAndDelete = function() {
        var p = new Promise();
        startupPromise.then(function() {
            sendMessage({ command: 'closeAndDelete' }, function() {
                worker.kill();
                p.resolve();
            });
        });
        return p;
    };

    api.close = function() {
        var p = new Promise();
        startupPromise.then(function() {
            worker.kill();
            p.resolve();
        });
        return p;
    };

    api.rescan = function() {
        var p = new Promise();
        startupPromise.then(function() {
            console.error('sending rescan command');
            sendMessage({ command: 'rescan' });
        });
        return p;
    };

    api.getStatus = function() {
        var p = new Promise();
        startupPromise.then(function() {
            sendMessage({ command: 'getStatus' }, function(data) {
                p.resolve(data.status);
            });
        });
        return p;
    };

    console.error('starting worker...');
    sendMessage({ command: 'start', serverId: serverId }, function(data) {
        console.error('worker started');
        startupPromise.resolve();
    });

    return api;
};
