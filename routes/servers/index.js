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
    }).error(function() {
        sendError(res);
    });
}

module.exports.apply = function(app, dependencies) {
    app.post('/servers', function(req, res) {
        database(function(err, models) {
            req.session.user.getServers().success(function(servers) {
                res.render(
                    'servers',
                    {
                        servers: convertServersForView(servers),
                        pubkey: fs.readFileSync(config.keyfile)
                    },
                    function(err, content) {
                        if (err) {
                            return sendError(res);
                        }
                        res.json({content: content});
                    }
                );
            }).error(function() {
                sendError(res);
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
            var server = models.Server.build({
                username: username,
                hostname: hostname,
                path: path
            });

            req.session.user.addServer(server).success(function() {
                dependencies.serverManager.addServer(server);
                sendServerList(res, req.session.user);
            }).error(function() {
                sendError(res);
            });
        });
    });

    app.post('/servers/del', function(req, res) {
        if (!req.body || !req.body.id) {
            return sendError(res);
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
                dependencies.serverManager.delServer(servers[0].id);
                servers[0].destroy().success(function() {
                    sendServerList(res, req.session.user);
                });
            });
        });
    });
};
