
/*
 * GET home page.
 */

exports.index = function(req, res) {
    if (req.session && req.session.user !== undefined) {
        res.render('index', { title: 'rsyncCopyManager' });
    } else {
        res.redirect('/login');
    }
};

exports.logout = function(req, res) {
    req.session = null;
    res.redirect('/');
};

exports.login = function(req, res) {
    if (req.body && req.body.user == 'exi' && req.body.password == 'pwd') {
        req.session = {
            user: {
                name: 'exi'
            }
        };
        res.redirect('/');
    } else {
        var renderdata = {
            title: 'rsyncCopyManager - Login'
        };

        if (req.body && req.body.user && req.body.password) {
            renderdata.error = 'Invalid username or password';
            res.render('login', renderdata);
        } else {
            renderdata.error = '';
            res.render('login', renderdata);
        }
    }
};

exports.downloads = function(req, res) {
    res.render('downloads', function(error, content) {
        res.json({content: content});
    });
};

exports.servers = function(req, res) {
    res.render('servers', function(error, content) {
        res.json({content: content});
    });
};
