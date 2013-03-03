/*
 * GET home page.
 */
var servers = require('./servers');
var filelist = require('./filelist');
var downloads = require('./downloads');
var settings = require('./settings');
var database = require('../database.js');
var util = require('./util.js');
var configHelper = require('../configHelper.js');
var config = require('../config.js');

configHelper.defineMultiple(
    [
        { key: 'defaultUser', defaultValue: 'admin' },
        { key: 'defaultPassword', defaultValue: 'admin' }
    ]
);

module.exports.apply = function(dependencies, app) {
    app.all('/login', function(req, res) {
        var renderdata = {
            title: 'rsyncCopyManager - Login'
        };

        database(function(err, models) {
            if (req.body && req.body.user && req.body.password) {
                models.User.find({
                    where: {
                        name: req.body.user
                    }
                }).success(function(user) {
                    if (user === null || !util.checkPassword(req.body.password, user.password)) {
                        renderdata.error = 'Invalid username or password';
                        res.render('login', renderdata);
                    } else  {
                        req.session = {
                            user: user
                        };
                        res.redirect('/');
                    }
                });
            } else {
                models.User.count().success(function(c) {
                    if (c === 0) {
                        models.User.create({
                            name: config.defaultUser,
                            password: util.hash(config.defaultPassword),
                            isAdmin: true
                        }).success(function(user) {
                            req.session.user = user;
                            res.redirect('/');
                        });
                    } else {
                        renderdata.error = '';
                        res.render('login', renderdata);
                    }
                });
            }
        });
    });

    app.all('*', function(req, res, next) {
        if (req.session.user) {
            database(function(err, models) {
                models.User.find({
                    where: {
                        id: req.session.user.id
                    }
                }).success(function(user) {
                    if (user !== null) {
                        req.session.user = user;
                        next();
                    } else {
                        req.session = undefined;
                        res.redirect('/login');
                    }
                });
            });
        } else {
            res.redirect('/login');
        }
    });

    app.get('/logout', function(req, res) {
        req.session = null;
        res.redirect('/');
    });

    app.get('/',  function(req, res) {
        res.render('index', { title: 'rsyncCopyManager' });
    });

    app.post('/spaceLeft', function(req, res) {
        dependencies.downloadManager.getSpaceLeft().then(function(spaceLeft) {
            util.sendSuccess(res, util.convertToHumanReadableSize(spaceLeft) + ' left on device');
        }, function(err) {
            util.sendError(res, err);
        });
    });

    servers.apply(dependencies, app);
    filelist.apply(dependencies, app);
    downloads.apply(dependencies, app);
    settings.apply(dependencies, app);
};
