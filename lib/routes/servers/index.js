var fs = require('fs');
var util = require('../../util.js');
var Promise = require('node-promise').Promise;
var all = require('node-promise').all;
var providerHelper = require('../../providerHelper.js');

module.exports.apply = function(deps, app) {
    deps.configHelper.define({ key: 'pubkeyfile', fileMustExist: true });

    function getServers(user) {
        var p = new Promise();

        function resolve(servers) {
            p.resolve(servers);
        }

        function reject(err) {
            p.reject(err);
        }

        if (user.isAdmin) {
            deps.database.get(function(err, models) {
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
        console.error('convert servers');
        var promises = [];
        var ret = new Promise();

        servers.forEach(function(server) {
            var p = new Promise();
            promises.push(p);
            var convertPromise = providerHelper.convertServerForView(server.type, deps, server);
            if (convertPromise) {
                convertPromise.then(function(data) {
                    var limit = server.bwlimit ? server.bwlimit : '0';
                    p.resolve({
                        id: server.id,
                        type: server.type,
                        bwlimit: limit,
                        data: data
                    });
                }, function(err) {
                    p.resolve(null);
                });
            } else {
                console.error('converter for server ' + server.id + 'not found');
                p.resolve(null);
            }
        });

        all(promises).then(function(data) {
            console.error('all done');
            data = data.filter(function(item) {
                if (item) {
                    return true;
                }
            });
            ret.resolve(data);
        }, function(err) {
            console.error('error in all');
            console.error(err);
        });

        return ret;
    }

    function sendServerList(res, user) {
        var efun = util.wrapErrorFunction(res);

        getServers(user).then(function(servers) {
            convertServersForView(servers).then(function(servers) {
                res.render(
                    'servers-list',
                    { servers: servers },
                    function(err, content) {
                        if (err) {
                            return efun(err);
                        }
                        util.sendSuccess(res, content);
                    }
                );
            }, efun);
        }, efun);
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

        if (req.user.isAdmin) {
            deps.database.get(function(err, models) {
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
            req.user.getServers({
                where: {
                    id: id
                }
            }).success(resolve).error(reject);
        }

        return p;
    }

    function getFileCount(serverId) {
        var p = new Promise();

        function reject(err) {
            p.reject(err);
        }

        deps.database.get(function(err, models) {
            if (err) {
                return reject(err);
            }
            models.Server.find(serverId).success(function(server) {
                if (server === null) {
                    return reject('server not found');
                }
                models.FSEntry.count({ where: { ServerId: server.id }}).success(function(c) {
                    p.resolve(c);
                }).error(reject);
            }).error(reject);
        });

        return p;
    }

    app.post('/servers', function(req, res) {
        var efun = util.wrapErrorFunction(res);

        getServers(req.user).then(function(servers) {
            convertServersForView(servers).then(function(servers) {
                res.render(
                    'servers',
                    {
                        servers: servers,
                        pubkey: fs.readFileSync(deps.config.pubkeyfile)
                    },
                    function(err, content) {
                        if (err) {
                            return efun(err);
                        }
                        util.sendSuccess(res, content);
                    }
                );
            }, efun);
        }, efun);
    });

    app.post('/servers/add', function(req, res) {
        var type = req.body.type;
        if (type === undefined || type.trim() === '' || /\.\./.test(type)) {
            return util.sendError(res, 'type must not be empty!');
        }

        if (providerHelper.getProvider(type) === null) {
            return util.sendError(res, 'provider for type ' + type + ' does not exist!');
        }


        deps.database.get(function(err, models) {
            models.Server.create({
                type: type,
                UserId: req.user.id
            }).success(function(server) {
                var model = providerHelper.getModel(req.body.type, deps);
                model.addServer(server, req.body).then(function() {
                    sendServerList(res, req.user);
                    deps.serverManager.addServer(server);
                }, function(err) {
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
            deps.serverManager.delServer(server.id).then(function() {
                util.sendSuccess(res);
            });
        }, function() {
            util.sendError(res, 'Server not found!');
        });
    });

    app.post('/servers/addForm', function(req, res) {
        if (!req.body || !req.body.type) {
            return util.sendError(res, 'Invalid request!');
        }

        var type = req.body.type;
        if (providerHelper.getProvider(type) === null) {
            return util.sendError(res, 'Type not found!');
        }

        res.render(
            'provider/' + type + '/addForm',
            {},
            function(err, content) {
                if (err) {
                    return util.sendError(err);
                }
                util.sendSuccess(res, content);
            }
        );
    });

    app.post('/servers/rescan', function(req, res) {
        if (!req.body || !req.body.id) {
            return util.sendError(res, 'Invalid request!');
        }

        getServerWithId(req, req.body.id).then(function(server) {
            deps.serverManager.rescanServer(server.id);
            util.sendSuccess(res);
        }, function() {
            util.sendErrorBox(res, 'Server not found!');
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
                console.error('new limit: ' + limit);
                util.sendSuccess(res);
                deps.eventBus.emit('server-change', server.id);
            }).error(function() {
                util.sendError(res, 'Error saving the settings.');
            });
        }, function() {
            util.sendError(res, 'Server not found!');
        });
    });

    app.post('/servers/status', function(req, res) {
        getServers(req.user).then(function(servers) {
            var promises = [];
            var statuses = [];
            servers.forEach(function(server) {
                promises.push(all([
                        deps.serverManager.getServerStatus(server.id),
                        getFileCount(server.id)
                    ]).then(function(data) {
                        var status = data[0];
                        var filecount = data[1];
                        var msgs = [];

                        if (status.fsCheckInProgress === true) {
                            msgs.push('Scanning filesystem');
                        }

                        if (status.processingStatus) {
                            msgs.push('processing ' + status.processingStatus.complete + '/' + status.processingStatus.total);
                        }

                        if (status.waitForClose === true) {
                            msgs.push('Closing connection');
                        }

                        if (status.serverOffline === true) {
                            msgs.push('Offline');
                        }

                        var msg = msgs.length === 0 ? 'Idle' : msgs.join(', ');
                        var content = {
                            id: server.id,
                            msg: util.escapeHtml(msg),
                            filecount: filecount
                        };

                        if (status.lastErrorOutput) {
                            content.errorOutput = util.escapeHtml(status.lastErrorOutput);
                        }

                        statuses.push(content);
                    }, function(err) {
                        if (err) {
                            statuses.push({
                                id: server.id,
                                msg: err.message
                            });
                        } else {
                            statuses.push({
                                id: server.id,
                                msg: 'Unknown error occured'
                            });
                        }
                    })
                );
            });
            all(promises).then(function() {
                util.sendSuccess(res, statuses);
            });
        }, function() {
            util.sendError(res, 'Server not found!');
        });
    });

};
