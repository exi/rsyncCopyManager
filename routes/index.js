/*
 * GET home page.
 */
var servers = require('./servers');
var database = require('../database.js');

module.exports.apply = function(app) {
    app.all('/login', function(req, res) {
        var renderdata = {
            title: 'rsyncCopyManager - Login'
        };

        if (req.body && req.body.user && req.body.password) {
            database(function(err, models) {
                models.User.find({
                    where: {
                        name: req.body.user,
                        password: req.body.password
                    }
                }).success(function(user) {
                    if (user === null) {
                        renderdata.error = 'Invalid username or password';
                        res.render('login', renderdata);
                    } else {
                        req.session = {
                            user: user
                        };
                        res.redirect('/');
                    }
                });
            });
        } else {
            renderdata.error = '';
            res.render('login', renderdata);
        }
    });

    app.all('*', function(req, res, next) {
        if (req.session.user) {
            next();
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

    app.post('/downloads', function(req, res) {
        res.render('downloads', function(error, content) {
            res.json({content: content});
        });
    });

    servers.apply(app);
};
