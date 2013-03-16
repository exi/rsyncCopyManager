var events = require('events');
var util = require('util');

var Token = module.exports.Token = function(startFunction, id) {
    events.EventEmitter.call(this);
    this.start = startFunction;
    this.id = id || 9999999;
};

util.inherits(Token, events.EventEmitter);

var Queue = module.exports.Queue = function(deps) {
    var api = {};

    var servers = {};

    function notifyPositionChange(queue) {
        queue.forEach(function(item, idx) {
            item.token.emit('position-change', idx);
        });
    }

    function cleanQueue(queue) {
        var l = queue.length;
        var change = false;
        for (var i = 0; i < l ; i++) {
            if (queue[i].done === true) {
                queue.splice(i, 1);
                l--;
                i--;
                change = true;
            }
        }

        if (change) {
            notifyPositionChange(queue);
        }
    }

    function runQueue(serverId) {
        var server = servers[serverId];
        server.running = true;
        var queue = server.queue;
        cleanQueue(queue);
        if (queue.length > 0) {
            var item = queue[0];
            var token = item.token;
            token.on('finished', function() {
                server.running = false;
                schedule(serverId);
            });
            token.on('reject', function() {
                server.running = false;
                schedule(serverId);
            });
            token.start();
        } else {
            server.running = false;
        }
    }

    deps.eventBus.on('server-removed', function(serverId) {
        if (servers.hasOwnProperty(serverId)) {
            var queue = servers[serverId].queue;
            cleanQueue(queue);
            queue.forEach(function(item) {
                process.nextTick(function() {
                    item.token.emit('reject');
                });
            });
            servers[serverId].queue = [];
        }
    });

    function schedule(serverId) {
        var queue = servers[serverId].queue;
        cleanQueue(queue);
        if (queue.length > 1) {
            var first = queue[0].token;
            queue.sort(function(a, b) {
                return a.token.id - b.token.id;
            });
            if (queue[0].token.id !== first.id && servers[serverId].running) {
                first.emit('reject');
            }
            notifyPositionChange(queue);
        }

        if (!servers[serverId].running) {
            runQueue(serverId);
        }
    }

    api.queue = function(serverId, token) {
        if (!servers.hasOwnProperty(serverId)) {
            servers[serverId] = {
                queue: [],
                running: false
            };
        }

        var item = {
            done: false,
            token: token
        };

        var queue = servers[serverId].queue;

        queue.push(item);

        token.on('finished', function() {
            item.done = true;
        });
        token.on('reject', function() {
            item.done = true;
        });
        schedule(serverId);
        notifyPositionChange(queue);
    };

    return api;
};
