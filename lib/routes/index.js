/*
 * GET home page.
 */
var servers = require('./servers');
var filelist = require('./filelist');
var downloads = require('./downloads');
var settings = require('./settings');
var util = require('./util.js');

module.exports.apply = function(deps, app) {
    app.all('/login', function(req, res) {
        var renderdata = {
            title: 'rsyncCopyManager - Login'
        };

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
                        req.session = {
                            user: user
                        };
                        res.redirect('/');
                    }
                });
            } else {
                renderdata.error = '';
                res.render('login', renderdata);
            }
        });
    });

    app.all('*', function(req, res, next) {
        if (req.session.user) {
            deps.database.get(function(err, models) {
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
