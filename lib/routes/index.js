/*
 * GET home page.
 */
var servers = require('./servers');
var filelist = require('./filelist');
var downloads = require('./downloads');
var settings = require('./settings');
var util = require('../util.js');

module.exports.apply = function(deps, app) {

    deps.configHelper.define({ key: 'session.lifeTime', defaultValue: 48 * 60 });

    app.all('/login', function(req, res) {
        var renderdata = {
            title: 'rsyncCopyManager - Login'
        };

        function efun() {
            renderdata.error = '';
            res.render('login', renderdata);
        }

        deps.database.get(function(err, models) {
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
                        var token = util.generateToken();
                        var sess = models.Session.build({
                            lastUpdate: new Date(),
                            token: token
                        });

                        user.addSession(sess).success(function() {
                            req.session = {
                                token: token
                            };
                            res.redirect('/');
                        }).error(efun);
                    }
                });
            } else {
                efun();
            }
        });
    });

    app.all('*', function(req, res, next) {
        function efun() {
            res.redirect('/login');
        }

        if (req.session.token) {
            deps.database.get(function(err, models) {
                models.Session.find({
                    where: deps.database.format([
                        'token = ? AND lastUpdate > ?',
                        req.session.token,
                        new Date(Date.now() - deps.config.session.lifeTime * 1000 * 60)
                    ])
                }).success(function(session) {
                    if (session !== null) {
                        session.getUser().success(function(user) {
                            if (user === null) {
                                return efun();
                            }

                            session.lastUpdate = new Date();
                            session.save(['lastUpdate']);
                            req.user = user;
                            next();
                        }).error(efun);
                    } else {
                        req.session = undefined;
                        efun();
                    }
                });
            });
        } else {
            efun();
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
        deps.downloadManager.getSpaceLeft().then(function(spaceLeft) {
            util.sendSuccess(res, util.convertToHumanReadableSize(spaceLeft) + ' left on device');
        }, function(err) {
            util.sendError(res, err);
        });
    });

    servers.apply(deps, app);
    filelist.apply(deps, app);
    downloads.apply(deps, app);
    settings.apply(deps, app);
};
