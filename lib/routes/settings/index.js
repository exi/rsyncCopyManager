var util = require('../../util.js');
var Promise = require('node-promise').Promise;
var All = require('node-promise').all;
var fsHelper = require('../../fsHelper.js');

module.exports.apply = function(deps, app) {

    function sendList(res, model, template, key) {
        var efun = util.wrapErrorFunction(res);
        model.all().success(function(data) {
            var d = {};
            d[key] = data;
            res.render(
                template,
                d,
                function(err, content) {
                    if (err) {
                        return efun(err);
                    }

                    util.sendSuccess(res, content);
                }
                );
        }).error(efun);
    }

    function sendUserList(res, models) {
        sendList(res, models.User, 'settings-userlist', 'users');
    }

    function sendCategoryList(res, models) {
        sendList(res, models.Category, 'settings-categorylist', 'categories');
    }

    function deleteCategory(category) {
        var p = new Promise();
        function reject(err) {
            p.reject(err);
        }

        deps.database.query(
                deps.database.format(['UPDATE Downloads SET CategoryId = 1 WHERE CategoryId = ?;', category.id])
                ).success(function() {
                    category.destroy().success(function() {
                        p.resolve();
                    }).error(reject);
                }).error(reject);

        return p;
    }

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
                sub.push(deps.serverManager.delServer(server.id));
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
                sub.push(deps.downloadManager.delDownload(download.id));
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
        var efun = util.wrapErrorFunction(res);
        deps.database.get(function(err, models) {
            if (err) {
                return efun('Database error.');
            }

            if (req.session.user.isAdmin) {
                models.User.all().success(function(users) {
                    models.Category.all().success(function(categories) {
                        res.render(
                            'settings-admin',
                            {
                                user: req.session.user,
                                users: users,
                                categories: categories
                            },
                            function(err, content) {
                                if (err) {
                                    return efun(err);
                                }
                                util.sendSuccess(res, content);
                            }
                            );
                    }).error(efun);
                }).error(efun);
            } else {
                res.render(
                    'settings',
                    {
                        user: req.session.user
                    },
                    function(err, content) {
                        if (err) {
                            return efun(err);
                        }
                        util.sendSuccess(res, content);
                    }
                );
            }
        });
    });

    app.post('/settings/setAdmin', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || req.body.id === undefined || req.body.id === null) {
            return efun('Invalid request.');
        }

        var id = parseInt(req.body.id, 10);
        var admin = req.body.isAdmin === 'true';

        if (req.session.user.isAdmin) {
            deps.database.get(function(err, models) {
                if (err) {
                    return efun('Database error.');
                }

                models.User.find({
                    where: {
                        id: id
                    }
                }).success(function(user) {
                    user.isAdmin = admin;
                    user.save(['isAdmin']).success(function() {
                        util.sendSuccess(res);
                    }).error(efun);
                }).error(efun);
            });
        } else {
            return efun('Forbidden.');
        }
    });

    app.post('/settings/changePassword', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || req.body.id === undefined || req.body.id === null) {
            return efun('Invalid request.');
        }

        var password = req.body.password;
        var passwordRepeat = req.body.passwordRepeat;
        var id = parseInt(req.body.id, 10);

        if (password === '') {
            return efun('Password must not be empty!');
        }

        if (password !== passwordRepeat) {
            return efun('Passwords do not match.');
        }

        if (req.session.user.isAdmin || req.session.user.id === id) {
            deps.database.get(function(err, models) {
                if (err) {
                    return efun('Database error.');
                }

                models.User.find({
                    where: {
                        id: id
                    }
                }).success(function(user) {
                    user.password = util.hash(password);
                    user.save(['password']).success(function() {
                        util.sendSuccessBox(res, 'Password changed.');
                    }).error(efun);
                }).error(efun);
            });
        } else {
            return efun('Forbidden.');
        }
    });

    app.post('/settings/addUser', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body) {
            return efun('Invalid request.');
        }

        if (!req.session.user.isAdmin) {
            return efun('Forbidden.');
        }

        var password = req.body.password || '';
        var passwordRepeat = req.body.passwordRepeat || '';
        var username = req.body.username || '';
        var isAdmin = req.body.isAdmin;

        if (password === '') {
            return efun('Password must not be empty!');
        }

        if (username === '') {
            return efun('Username must not be empty!');
        }

        if (password !== passwordRepeat) {
            return efun('Passwords do not match.');
        }

        deps.database.get(function(err, models) {
            if (err) {
                return efun('Database error.');
            }

            models.User.create({
                name: username,
                password: util.hash(password),
                isAdmin: !!isAdmin
            }).success(function() {
                sendUserList(res, models);
            }).error(efun);
        });
    });

    app.post('/settings/delUser', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || req.body.id === undefined || req.body.id === null) {
            return efun('Invalid request.');
        }

        var id = parseInt(req.body.id, 10);

        if (req.session.user.isAdmin) {
            deps.database.get(function(err, models) {
                if (err) {
                    return efun('Database error.');
                }

                models.User.find({
                    where: {
                        id: id
                    }
                }).success(function(user) {
                    if (user === null) {
                        efun('User not found');
                    }

                    deleteUser(user, models).then(function() {
                        sendUserList(res, models);
                    }, efun);
                }).error(efun);
            });
        } else {
            return efun('Forbidden.');
        }
    });

    app.post('/settings/addCategory', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body) {
            return efun('Invalid request.');
        }

        if (!req.session.user.isAdmin) {
            return efun('Forbidden.');
        }

        var name = req.body.name || '';
        var destination = req.body.destination || '';

        if (name === '') {
            return efun('Name must not be empty!');
        }

        if (destination === '') {
            return efun('Destination must not be empty!');
        }

        if (!fsHelper.isDirAndExist(destination)) {
            return efun('Destination is not a Directory!');
        }

        deps.database.get(function(err, models) {
            if (err) {
                return efun('Database error.');
            }

            models.Category.create({
                name: name,
                destination: destination
            }).success(function() {
                sendCategoryList(res, models);
            }).error(efun);
        });
    });

    app.post('/settings/changeCategory', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || !req.body.hasOwnProperty('id') || !req.body.id) {
            return efun('Invalid request.');
        }

        if (!req.session.user.isAdmin) {
            return efun('Forbidden.');
        }

        var id = parseInt(req.body.id, 10);
        var name = req.body.name || '';
        var destination = req.body.destination || '';

        if (name === '' && destination === '') {
            return efun('Name or destination must be set!');
        }

        if (destination !== '' && !fsHelper.isDirAndExist(destination)) {
            return efun('Destination is not a Directory!');
        }

        deps.database.get(function(err, models) {
            if (err) {
                return efun('Database error.');
            }

            models.Category.find(id).success(function(cat) {
                if (cat === null) {
                    return efun('Category not found!');
                }

                var handle;
                var changes = [];
                if (name !== '') {
                    cat.name = name;
                    changes.push('name');
                }
                if (destination !== '') {
                    cat.destination = destination;
                    changes.push('destination');
                }

                cat.save(changes).success(function() {
                    util.sendSuccess(res);
                }).error(efun);
            }).error(efun);
        });
    });

    app.post('/settings/delCategory', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || !req.body.id) {
            return efun('Invalid request.');
        }

        var id = parseInt(req.body.id, 10);

        if (id === 1) {
            return efun('Cannot delete default Category!');
        }

        if (req.session.user.isAdmin) {
            deps.database.get(function(err, models) {
                if (err) {
                    return efun('Database error.');
                }

                models.Category.find(id).success(function(cat) {
                    if (cat === null) {
                        efun('Category not found');
                    }

                    deleteCategory(cat).then(function() {
                        sendCategoryList(res, models);
                    }, efun);
                }).error(efun);
            });
        } else {
            return efun('Forbidden.');
        }
    });
};
