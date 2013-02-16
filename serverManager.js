var database = require('./database.js');
var Server = require('./server.js');
var Promise = require('node-promise').Promise;

var ServerManager = module.exports = function(dependencies) {
    var servers = {};
    var api = {};

    api.addServer = function(server) {
        servers[server.id] = {
            modelInstance: server,
            manager: new Server(dependencies, server)
        };
    };

    api.delServer = function(serverId) {
        var p = new Promise();

        if (servers.hasOwnProperty(serverId)) {
            var server = servers[serverId].manager;
            server.closeAndDelete().then(function() {
                delete servers[serverId];
                dependencies.eventBus.emit('server-removed');
                p.resolve();
            });
        } else {
            p.resolve();
        }

        return p;
    };

    api.getServerStatus = function(serverId) {
        var p = new Promise();
        if (servers.hasOwnProperty(serverId)) {
            servers[serverId].manager.getStatus().then(p.resolve);
        } else {
            p.reject('Server not active.');
        }

        return p;
    };

    database(function(err, models) {
        if (err) {
            throw err;
        }

        models.Server.all().success(function(s) {
            s.forEach(api.addServer);
        });
    });

    return api;
};
