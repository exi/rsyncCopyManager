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

    function runQueue(serverId) {
        var server = servers[serverId];
        var queue = server.queue;
        if (queue.length > 0) {
            var token = queue[0];
            token.on('finished', function() {
                queue.shift();
                runQueue(serverId);
            });
            token.start();
        }
    }

    dependencies.eventBus.on('server-removed', function(serverId) {
        if (servers.hasOwnProperty(serverId)) {
            servers[serverId].queue.forEach(function(token) {
                token.emit('reject');
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
                removed: false,
                queue: []
            };
        }

        servers[serverId].queue.push(token);
        schedule(serverId);
    };

    return api;
};
