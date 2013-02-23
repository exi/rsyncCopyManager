var events = require('events');
var util = require('util');

var Token = module.exports.Token = function(startFunction) {
    events.EventEmitter.call(this);
    this.start = startFunction;
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
        var queue = server.queue;
        if (queue.length > 0) {
            var item = queue[0];
            item.token.on('finished', function() {
                queue.shift();
                notifyPositionChange(queue);
                runQueue(serverId);
            });
            item.token.start();
        }
    }

    dependencies.eventBus.on('server-removed', function(serverId) {
        console.log('server queue remove' + serverId);
        if (servers.hasOwnProperty(serverId)) {
            console.log('reallay server queue remove' + serverId);
            servers[serverId].queue.forEach(function(item) {
                item.token.emit('reject');
            });
            servers[serverId].queue = [];
        }
    });

    function schedule(serverId) {
        if (servers[serverId].queue.length === 1) {
            runQueue(serverId);
        }
    }

    api.queue = function(serverId, token) {
        if (!servers.hasOwnProperty(serverId)) {
            servers[serverId] = {
                queue: []
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
        schedule(serverId);
        notifyPositionChange(servers[serverId].queue);
    };

    return api;
};
