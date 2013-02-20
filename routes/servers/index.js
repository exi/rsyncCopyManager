var database = require('../../database.js');
var fs = require('fs');
var crypto = require('crypto');
var config = require('../../config.js');
var util = require('../util.js');
var Promise = require('node-promise').Promise;

function convertServersForView(servers) {
    var ret = [];
    servers.forEach(function(server) {
        ret.push({
            id: server.id,
            username: server.username,
            hostname: server.hostname,
            path: server.path
        });
    });

    return ret;
}

function sendServerList(res, user) {
    user.getServers().success(function(servers) {
        servers = convertServersForView(servers);
        res.render(
            'servers-list',
            { servers: servers },
            function(error, content) {
                res.json({ type: 'success', content: content });
            }
        );
    }).error(function(err) {
        util.sendError(res, err);
    });
}

function getServerWithId(req, id) {
    var p = new Promise();
    req.session.user.getServers({
        where: {
            id: id
        }
    }).success(function(servers) {
        if (servers.length > 0) {
            p.resolve(servers[0]);
        } else {
            p.reject();
        }
    });

    return p;
}

module.exports.apply = function(dependencies, app) {
    app.post('/servers', function(req, res) {
        req.session.user.getServers().success(function(servers) {
            res.render(
                'servers',
                {
                    servers: convertServersForView(servers),
                    pubkey: fs.readFileSync(config.pubkeyfile)
                },
                function(err, content) {
                    if (err) {
                        return util.sendError(res, err);
                    }
                    res.json({ content: content });
                }
                );
        }).error(function(err) {
            util.sendError(res, err);
        });
    });

    app.post('/servers/add', function(req, res) {
        var username = req.body.username;
        if (username === '' || username === undefined) {
            return util.sendError(res, 'Username must not be empty!');
        }

        var hostname = req.body.hostname;
        if (hostname === '' || username === undefined) {
            return util.sendError(res, 'Hostname must not be empty!');
        }

        var path = req.body.path;
        if (path === undefined || path.trim() === '') {
            return util.sendError(res, 'Path must not be empty!');
        }

        path = path.trim();
        if (path[path.length - 1] !== '/') {
            path += '/';
        }

        database(function(err, models) {
            models.Server.create({
                username: username,
                hostname: hostname,
                path: path
            }).success(function(server) {
                server.setUser(req.session.user).success(function() {
                    sendServerList(res, req.session.user);
                    dependencies.serverManager.addServer(server);
                }).error(function(err) {
                    util.sendError(res, err);
                });
            }).error(function(err) {
                util.sendError(res, err);
            });

        });
    });

    app.post('/servers/del', function(req, res) {
        if (!req.body || !req.body.id) {
            return util.sendError(res, 'Invalid request!');
        }

        getServerWithId(req, req.body.id).then(function(server) {
            dependencies.serverManager.delServer(server.id).then(function() {
                sendServerList(res, req.session.user);
            });
        }, function() {
            util.sendError(res, 'Server not found!');
        });
    });

    app.post('/servers/status', function(req, res) {
        if (!req.body || !req.body.id) {
            return util.sendError(res, 'Invalid request!');
        }
        getServerWithId(req, req.body.id).then(function(server) {
            dependencies.serverManager.getServerStatus(server.id).then(function(status) {
                var content = 'Idle';
                var msgs = [];

                if (status.fsCheckInProgress === true) {
                    msgs.push('Scanning filesystem');
                }

                if (status.waitForClose === true) {
                    msgs.push('Closing connection');
                }

                if (status.serverOffline === true) {
                    msgs.push('Offline');
                }

                content = msgs.length === 0 ? content : msgs.join(', ');
                res.json({ type: 'success', content: content });
            }, function(status) {
                util.sendError(res, status);
            });
        }, function() {
            util.sendError(res, 'Server not found!');
        });
    });

};
