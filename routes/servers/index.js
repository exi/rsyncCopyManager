var database = require('../../database.js');
var fs = require('fs');
var crypto = require('crypto');
var config = require('../../config.js');

function sendError(res, msg) {
    msg = msg || 'There was an error saving your server.';
    res.render(
        'error-box',
        { message: msg },
        function(err, content) {
            res.json({ type: 'error', content: content});
        }
    );
}

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
        sendError(res, err);
    });
}

module.exports.apply = function(dependencies, app) {
    app.post('/servers', function(req, res) {
        database(function(err, models) {
            req.session.user.getServers().success(function(servers) {
                res.render(
                    'servers',
                    {
                        servers: convertServersForView(servers),
                        pubkey: fs.readFileSync(config.pubkeyfile)
                    },
                    function(err, content) {
                        if (err) {
                            return sendError(res, err);
                        }
                        res.json({content: content});
                    }
                );
            }).error(function(err) {
                sendError(res, err);
            });
        });
    });

    app.post('/servers/add', function(req, res) {
        var username = req.body.username;
        if (username === '' || username === undefined) {
            return sendError(res, 'Username must not be empty!');
        }

        var hostname = req.body.hostname;
        if (hostname === '' || username === undefined) {
            return sendError(res, 'Hostname must not be empty!');
        }

        var path = req.body.path;
        if (path === undefined || path.trim() === '') {
            return sendError(res, 'Path must not be empty!');
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
                    sendError(res, err);
                });
            }).error(function(err) {
                sendError(res, err);
            });

        });
    });

    app.post('/servers/del', function(req, res) {
        if (!req.body || !req.body.id) {
            return sendError(res, 'Invalid request!');
        }

        database(function(err, models) {
            req.session.user.getServers({
                where: {
                    id: req.body.id
                }
            }).success(function(servers) {
                if (servers.length === 0) {
                    res.json({ type: 'error', content: 'Server not found!'});
                }
                dependencies.serverManager.delServer(servers[0].id).then(function() {
                    sendServerList(res, req.session.user);
                });
            });
        });
    });

    app.post('/servers/status', function(req, res) {
        if (!req.body || !req.body.id) {
            return sendError(res, 'Invalid request!');
        }
        database(function(err, models) {
            req.session.user.getServers({
                where: {
                    id: req.body.id
                }
            }).success(function(servers) {
                if (servers.length === 0) {
                    res.json({ type: 'error', content: 'Server not found!'});
                } else {
                    dependencies.serverManager.getServerStatus(req.body.id).then(function(status) {
                        var content = 'Idle';
                        var msgs = [];
                        if (status.fsCheckInProgress === true) {
                            msgs.push('Scanning filesystem');
                        }
                        if (status.waitForClose === true) {
                            msgs.push('Closing connection');
                        }
                        content = msgs.length === 0 ? content : msgs.join(', ');
                        res.json({ type: 'success', content: content});
                    }, function(status) {
                        res.json({ type: 'eror', content: status});
                    });
                }
            });
        });
    });

};
