var database = require('../../database.js');
var fs = require('fs');
var config = require('../../config.js');
var util = require('../util.js');
var Promise = require('node-promise').Promise;

function getServers(user) {
    var p = new Promise();

    function resolve(servers) {
        p.resolve(servers);
    }

    function reject(err) {
        p.reject(err);
    }

    if (user.isAdmin) {
        database(function(err, models) {
            if (err) {
                return reject(err);
            }
            models.Server.all().success(resolve).error(reject);
        });
    } else {
        user.getServers().success(resolve).error(reject);
    }
    return p;
}

function convertServersForView(servers) {
    var ret = [];
    servers.forEach(function(server) {
        var limit = !server.bwlimit ? '0' : server.bwlimit;
        ret.push({
            id: server.id,
            username: server.username,
            hostname: server.hostname,
            limit: limit,
            path: server.path
        });
    });

    return ret;
}

function sendServerList(res, user) {
    getServers(user).then(function(servers) {
        servers = convertServersForView(servers);
        res.render(
            'servers-list',
            { servers: servers },
            function(err, content) {
                if (err) {
                    return util.sendError(err);
                }
                util.sendSuccess(res, content);
            }
        );
    }, function(err) {
        util.sendError(err);
    });
}

function getServerWithId(req, id) {
    var p = new Promise();

    function resolve(servers) {
        if (servers.length > 0) {
            p.resolve(servers[0]);
        } else {
            p.reject();
        }
    }

    function reject(err) {
        p.reject(err);
    }

    if (req.session.user.isAdmin) {
        database(function(err, models) {
            if (err) {
                return reject(err);
            }
            models.Server.findAll({
                where: {
                    id: id
                }
            }).success(resolve).error(reject);
        });
    } else {
        req.session.user.getServers({
            where: {
                id: id
            }
        }).success(resolve).error(reject);
    }

    return p;
}

module.exports.apply = function(dependencies, app) {
    app.post('/servers', function(req, res) {
        getServers(req.session.user).then(function(servers) {
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
                    util.sendSuccess(res, content);
                }
            );
        }, function(err) {
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

    app.post('/servers/setLimit', function(req, res) {
        if (!req.body || !req.body.id || !req.body.limit) {
            return util.sendError(res, 'Invalid request!');
        }
        var limit = parseInt(req.body.limit, 10);

        getServerWithId(req, req.body.id).then(function(server) {
            if (limit === 0) {
                limit = null;
            }
            server.bwlimit = limit;
            server.save(['bwlimit']).success(function() {
                console.log('new limit: ' + limit);
                util.sendSuccess(res);
                dependencies.eventBus.emit('server-change', server.id);
            }).error(function() {
                util.sendError(res, 'Error saving the settings.');
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
                util.sendSuccess(res, content);
            }, function(status) {
                util.sendError(res, status);
            });
        }, function() {
            util.sendError(res, 'Server not found!');
        });
    });

};
