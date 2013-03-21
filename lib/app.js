
/**
 * Module deps.
 */

var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    https = require('https'),
    fs = require('fs'),
    configHelper = require('./configHelper.js'),
    database = require('./database.js'),
    serverManager = require('./serverManager.js'),
    downloadManager = require('./downloadManager.js'),
    serverQueue = require('./serverQueue.js').Queue,
    pathMapper = require('./pathMapper.js'),
    lessMiddleware = require('less-middleware'),
    eventEmitter = require('events').EventEmitter,
    Promise = require('node-promise').Promise,
    util = require('./util.js'),
    logger = require('./logger.js'),
    all = require('node-promise').all;

var config;
try {
    config = require('../config.js');
} catch (e) {
    console.error('error loading config');
    console.error(e);
    process.exit(1);
}

var eventBus = new eventEmitter();
var deps = {
    eventBus: eventBus,
    config: config
};

deps.configHelper = new configHelper(deps);

deps.configHelper.defineMultiple(
    [
        { key: 'session.secret', defaultValue: 'soosecret' },
        { key: 'session.name', defaultValue: 'rsyncCopyManager' },
        { key: 'uid', defaultValue: process.getuid() },
        { key: 'defaultUser.name', defaultValue: 'admin' },
        { key: 'defaultUser.password', defaultValue: 'admin' },
        { key: 'defaultCategory.name', defaultValue: 'Default' },
        { key: 'defaultCategory.destination', defaultValue: __dirname + '/../download' },
        { key: 'http.ip', requiredOnParent: true, defaultValue: '0.0.0.0' },
        { key: 'http.port', requiredOnParent: true, defaultValue: 3000 },
        { key: 'https.keyfile', fileMustExist: true, requiredOnParent: true },
        { key: 'https.crtfile', fileMustExist: true, requiredOnParent: true },
        { key: 'https.ip', requiredOnParent: true, defaultValue: '0.0.0.0' },
        { key: 'https.port', requiredOnParent: true, defaultValue: 3001 }
    ]
);

deps.database = new database(deps);

var app = module.exports = express();

// Configuration

app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.cookieParser(config.session.name));
    app.use(express.cookieSession({ secret: config.session.secret }));
    app.use(new logger(deps));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(lessMiddleware({ src : __dirname + '/public' }));
    app.use(express.static(__dirname + '/public'));
    app.use(app.router);
});

app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
    app.use(express.errorHandler());
});

function startUp() {
    deps.serverManager = new serverManager(deps);
    deps.downloadManager = new downloadManager(deps);
    deps.serverQueue = new serverQueue(deps);
    deps.pathMapper = new pathMapper(deps);
    routes.apply(deps, app);
}

// sync db
deps.database.get(function(err, models) {
    var userp = new Promise();
    var categoryp = new Promise();

    models.User.count().success(function(c) {
        if (c > 0) {
            userp.resolve();
        } else {
            models.User.create({
                name: config.defaultUser.name,
                password: util.hash(config.defaultUser.password),
                isAdmin: true
            }).success(function(user) {
                userp.resolve();
            });
        }
    });

    models.Category.count().success(function(c) {
        if (c > 0) {
            categoryp.resolve();
        } else {
            models.Category.create({
                name: config.defaultCategory.name,
                destination: config.defaultCategory.destination
            }).success(function(user) {
                categoryp.resolve();
            });
        }
    });

    all([userp, categoryp]).then(function() {
        var listens = 0;

        function listenCallback(server) {
            return function () {
                listens--;
                if (listens === 0) {
                    process.setuid(config.uid);
                    startUp();
                }
                console.error("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
            };
        }

        if (config.http) {
            var httpServer = http.createServer(app);
            listens++;
            process.nextTick(function() {
                httpServer.listen(config.http.port, config.http.ip, listenCallback(httpServer));
            });
        }

        if (config.https) {
            var options = {
                key: fs.readFileSync(config.https.keyfile),
                cert: fs.readFileSync(config.https.crtfile)
            };

            if (config.https.passphrase) {
                options.passphrase = config.https.passphrase;
            }

            try {
                var httpsServer = https.createServer(options, app);
            } catch (e) {
                console.error('1', require('util').inspect(e));
                throw e;
            }
            listens++;
            process.nextTick(function() {
                httpsServer.listen(config.https.port, config.https.ip, listenCallback(httpsServer));
            });
        }

        if (listens === 0) {
            console.error('At least on server (http or https) should be configured.');
            console.error('Please look at config.js.sample on how to do it.');
            process.exit(1);
        }
    });
});


process.on('uncaughtException', function(e) {
    console.error(e);
    if (e.stack) {
        console.error(e.stack);
    }
    console.trace();
    if (deps.downloadManager) {
        deps.downloadManager.close();
    }
    if (deps.serverManager) {
        deps.serverManager.close();
    }
    process.exit(1);
});
