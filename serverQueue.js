var events = require('events');
var util = require('util');

var Token = module.exports.Token = function(startFunction, id) {
    events.EventEmitter.call(this);
    this.start = startFunction;
    this.id = id || 9999999;
};

util.inherits(Token, events.EventEmitter);

var Queue = module.exports.Queue = function(dependencies) {
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
            if (queue[i].finished === true) {
                queue.splice(i, 1);
                l--;
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
        if (queue.length > 0) {
            var item = queue[0];
            item.token.on('finished', function() {
                queue.shift();
                notifyPositionChange(queue);
                runQueue(serverId);
            });
            item.token.on('reject', function() {
                runQueue(serverId);
            });
            item.token.start();
        } else {
            server.running = false;
        }
    }

    dependencies.eventBus.on('server-removed', function(serverId) {
        console.log('server queue remove' + serverId);
        if (servers.hasOwnProperty(serverId)) {
            console.log('reallay server queue remove' + serverId);
            servers[serverId].queue.forEach(function(item) {
                console.log('reject token ' + item.token.id)
                item.token.emit('reject');
            });
            servers[serverId].queue = [];
        }
    });

    function schedule(serverId) {
        var queue = servers[serverId].queue;
        if (queue.length > 1) {
            var first = queue[0].token;
            queue.sort(function(a, b) {
                return a.token.id - b.token.id;
            });
            if (queue[0].token.id !== first.id && servers[serverId].running) {
                console.log('reject token ' + first.id);
                first.emit('reject');
            }
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
            finished: false,
            token: token
        };

        servers[serverId].queue.push(item);

        token.on('finished', function() {
            item.finished = true;
            cleanQueue(servers[serverId]);
        });
        process.nextTick(function() {
            schedule(serverId);
            notifyPositionChange(servers[serverId].queue);
        });
    };

    return api;
};
