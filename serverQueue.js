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
            if (queue[i].done === true) {
                console.log('clean queue position ' + i);
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
        if (queue.length > 0) {
            var item = queue[0];
            var token = item.token;
            token.on('finished', function() {
                console.log('queue finished ' + token.id);
                server.running = false;
                item.done = true;
                cleanQueue(queue);
                schedule(serverId);
            });
            token.on('reject', function() {
                console.log('queue reject ' + token.id);
                server.running = false;
                item.done = true;
                cleanQueue(queue);
                schedule(serverId);
            });
            console.log('queue start ' + token.id);
            token.start();
        } else {
            server.running = false;
        }
    }

    dependencies.eventBus.on('server-removed', function(serverId) {
        if (servers.hasOwnProperty(serverId)) {
            console.log('server queue remove' + serverId);
            servers[serverId].queue.forEach(function(item) {
                console.log('reject token ' + item.token.id);
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
            notifyPositionChange(queue);
        }

        if (!servers[serverId].running) {
            runQueue(serverId);
        }
        console.log('queue ' + serverId + ' ' + queue.map(function(item) {
            return item.token.id;
        }).join(','));
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
        console.log('queue add ' + token.id + ' (' + (queue.length - 1) + ')');

        token.on('finished', function() {
            console.log('queue finish ' + token.id);
            item.done = true;
            cleanQueue(queue);
        });
        token.on('reject', function() {
            console.log('queue reject ' + token.id);
            item.done = true;
            cleanQueue(queue);
        });
        schedule(serverId);
        notifyPositionChange(queue);
    };

    return api;
};
