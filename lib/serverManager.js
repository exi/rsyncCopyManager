var Server = require('./server.js');
var Promise = require('node-promise').Promise;

var ServerManager = module.exports = function(deps) {
    var servers = {};
    var api = {};

    api.addServer = function(server) {
        if (server && server.id) {
            servers[server.id] = {
                model: server,
                manager: new Server(deps, server.id)
            };
        }
    };

    api.delServer = function(serverId) {
        var p = new Promise();

        if (servers.hasOwnProperty(serverId)) {
            var server = servers[serverId].manager;
            server.closeAndDelete().then(function() {
                delete servers[serverId];
                deps.eventBus.emit('server-removed', serverId);
                p.resolve();
            });
        } else {
            p.resolve();
        }

        return p;
    };

    api.rescanServer = function(serverId) {
        var p = new Promise();

        if (servers.hasOwnProperty(serverId)) {
            var server = servers[serverId].manager;
            console.error('sm rescan ' + serverId);
            server.rescan();
        }
        p.resolve();

        return p;
    };

    api.getServerStatus = function(serverId) {
        var p = new Promise();
        if (servers.hasOwnProperty(serverId)) {
            servers[serverId].manager.getStatus().then(function(status) {
                p.resolve(status);
            });
        } else {
            p.reject('Server not active.');
        }

        return p;
    };

    api.close = function() {
        for (var i in servers) {
            servers[i].manager.close();
        }
    };

    deps.database.get(function(err, models) {
        if (err) {
            throw err;
        }

        models.Server.all().success(function(s) {
            s.forEach(api.addServer);
        });
    });

    return api;
};
