var util = require('../util.js');
var database = require('../../database.js');
var Promise = require('node-promise').Promise;
var All = require('node-promise').all;

function sendUserList(res, models) {
    models.User.all().success(function(users) {
        res.render(
            'settings-userlist',
            {
                users: users
            },
            function(err, content) {
                if (err) {
                    return util.sendError(res, err);
                }

                util.sendSuccess(res, content);
            }
        );
    }).error(function(err) {
        util.sendError(res, err);
    });
}

module.exports.apply = function(dependencies, app) {
    function deleteUser(user, models) {
        var userPromise = new Promise();

        var promises = [];
        var serverPromise = new Promise();
        promises.push(serverPromise);
        var downloadPromise = new Promise();
        promises.push(downloadPromise);

        user.getServers().success(function(servers) {
            var sub = [];
            servers.forEach(function(server) {
                sub.push(dependencies.serverManager.delServer(server.id));
            });
            All(sub).then(function() {
                serverPromise.resolve();
            }, function() {
                serverPromise.reject();
            });
        }).error(function(err) {
            serverPromise.reject(err);
        });

        user.getDownloads().success(function(downloads) {
            var sub = [];
            downloads.forEach(function(download) {
                sub.push(dependencies.downloadManager.delDownload(download.id));
            });
            All(sub).then(function() {
                downloadPromise.resolve();
            }, function() {
                downloadPromise.reject();
            });
        }).error(function(err) {
            downloadPromise.reject(err);
        });


        All(promises).then(function() {
            user.destroy().success(function() {
                userPromise.resolve();
            }).error(function() {
                userPromise.reject();
            });
        });
        return userPromise;
    }

    app.post('/settings', function(req, res) {
        database(function(err, models) {
            if (err) {
                return util.sendError(res, 'Database error.');
            }

            if (req.session.user.isAdmin) {
                models.User.all().success(function(users) {
                    res.render(
                        'settings-admin',
                        {
                            user: req.session.user,
                            users: users
                        },
                        function(err, content) {
                            if (err) {
                                return util.sendError(res, err);
                            }
                            util.sendSuccess(res, content);
                        }
                    );
                }).error(function(err) {
                    util.sendError(res, err);
                });
            } else {
                res.render(
                    'settings',
                    {
                        user: req.session.user
                    },
                    function(err, content) {
                        if (err) {
                            return util.sendError(res, err);
                        }
                        util.sendSuccess(res, content);
                    }
                );
            }
        });
    });

    app.post('/settings/setAdmin', function(req, res) {
        if (!req.body || req.body.id === undefined || req.body.id === null) {
            return util.sendError(res, 'Invalid request.');
        }

        var id = parseInt(req.body.id, 10);
        console.log(req.body.isAdmin);
        var admin = req.body.isAdmin === 'true';
        console.log('admin:');
        console.log(admin);

        if (req.session.user.isAdmin) {
            database(function(err, models) {
                if (err) {
                    return util.sendError(res, 'Database error.');
                }

                models.User.find({
                    where: {
                        id: id
                    }
                }).success(function(user) {
                    user.isAdmin = admin;
                    user.save(['isAdmin']).success(function() {
                        util.sendSuccess(res);
                    }).error(function(err) {
                        util.sendError(res, err);
                    });
                }).error(function(err) {
                    util.sendError(res, err);
                });
            });
        } else {
            return util.sendError(res, 'Forbidden.');
        }
    });

    app.post('/settings/changePassword', function(req, res) {
        if (!req.body || req.body.id === undefined || req.body.id === null) {
            return util.sendError(res, 'Invalid request.');
        }

        var password = req.body.password;
        var passwordRepeat = req.body.passwordRepeat;
        var id = parseInt(req.body.id, 10);

        if (password === '') {
            return util.sendError(res, 'Password must not be empty!');
        }

        if (password !== passwordRepeat) {
            return util.sendError(res, 'Passwords do not match.');
        }

        if (req.session.user.isAdmin || req.session.user.id === id) {
            database(function(err, models) {
                if (err) {
                    return util.sendError(res, 'Database error.');
                }

                models.User.find({
                    where: {
                        id: id
                    }
                }).success(function(user) {
                    user.password = util.hash(password);
                    user.save(['password']).success(function() {
                        util.sendSuccessBox(res, 'Password changed.');
                    }).error(function(err) {
                        util.sendError(res, err);
                    });
                }).error(function(err) {
                    util.sendError(res, err);
                });
            });
        } else {
            return util.sendError(res, 'Forbidden.');
        }
    });

    app.post('/settings/addUser', function(req, res) {
        if (!req.body) {
            return util.sendError(res, 'Invalid request.');
        }

        if (!req.session.user.isAdmin) {
            return util.sendError(res, 'Forbidden.');
        }

        var password = req.body.password;
        var passwordRepeat = req.body.passwordRepeat;
        var username = req.body.username;
        var isAdmin = req.body.isAdmin;

        if (password === '') {
            return util.sendError(res, 'Password must not be empty!');
        }

        if (username === '') {
            return util.sendError(res, 'Username must not be empty!');
        }

        if (password !== passwordRepeat) {
            return util.sendError(res, 'Passwords do not match.');
        }

        database(function(err, models) {
            if (err) {
                return util.sendError(res, 'Database error.');
            }

            models.User.create({
                name: username,
                password: util.hash(password),
                isAdmin: !!isAdmin
            }).success(function() {
                sendUserList(res, models);
            }).error(function(err) {
                util.sendError(res, err);
            });
        });
    });

    app.post('/settings/delUser', function(req, res) {
        if (!req.body || req.body.id === undefined || req.body.id === null) {
            return util.sendError(res, 'Invalid request.');
        }

        var id = parseInt(req.body.id, 10);

        if (req.session.user.isAdmin) {
            database(function(err, models) {
                if (err) {
                    return util.sendError(res, 'Database error.');
                }

                models.User.find({
                    where: {
                        id: id
                    }
                }).success(function(user) {
                    if (user === null) {
                        util.sendError(res, 'User not found');
                    }

                    deleteUser(user, models).then(function() {
                        sendUserList(res, models);
                    }, function(err) {
                        sendError(res, err);
                    });
                }).error(function(err) {
                    util.sendError(res, err);
                });
            });
        } else {
            return util.sendError(res, 'Forbidden.');
        }
    });

};
