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

    app.all('*', function (req, res, next) {
        if (req.protocol === 'http' && deps.config.https && deps.config.https.httpRedirect) {
            return res.redirect(deps.config.https.httpRedirect);
        }

        next();
    });

    app.all('/login', function(req, res) {
        var renderdata = {
            title: 'rsyncCopyManager - Login'
        };

        function efun(err) {
            renderdata.error = err && err.message ? err.message : '';
            res.render('login', renderdata);
        }

        if (req.body && req.body.user && req.body.password) {
            deps.database.get(function(err, models) {
                if (err) {
                    console.error(err);
                    return efun({ message: 'database error' });
                }
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
                        var sess = models.Session.create({
                            lastUpdate: new Date(),
                            token: token
                        }).success(function(sess) {
                            if (sess === null) {
                                return efun({message: 'Session save error'});
                            }

                            user.addSession(sess).success(function(s) {
                                if (s === null) {
                                    return efun({message: 'Session save error'});
                                }

                                req.session = {
                                    token: token
                                };
                                res.redirect('/');
                            }).error(efun);
                        }).error(efun);

                    }
                });
            });
        } else if (req.body && Object.keys(req.body).length > 0) {
            efun({ message: 'Username or password missing' });
        } else {
            efun();
        }
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
                        console.error('token ' + req.session.token + ' not found');
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
