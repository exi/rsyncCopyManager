
/**
 * Module deps.
 */

var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    configHelper = require('./configHelper.js'),
    database = require('./database.js'),
    serverManager = require('./serverManager.js'),
    downloadManager = require('./downloadManager.js'),
    serverQueue = require('./serverQueue.js').Queue,
    pathMapper = require('./pathMapper.js'),
    lessMiddleware = require('less-middleware'),
    eventEmitter = require('events').EventEmitter,
    Promise = require('node-promise').Promise,
    util = require('./routes/util.js'),
    all = require('node-promise').all;

var config;
try {
    config = require('../config.js');
} catch (e) {
    console.error('error loading config');
    console.error(e);
    process.exit(1);
}

var app = module.exports = express();

// Configuration

app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.cookieParser());
    app.use(express.cookieSession({ secret: config.cookieSecret }));
    app.use(express.logger('dev'));
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

// Routes

var eventBus = new eventEmitter();
var deps = {
    eventBus: eventBus,
    config: config
};

deps.configHelper = new configHelper(deps);

deps.configHelper.defineMultiple(
    [
        { key: 'cookieSecret', defaultValue: 'soosecret' },
        { key: 'port', defaultValue: 8080 },
        { key: 'uid', defaultValue: process.getuid() },
        { key: 'defaultUser.name', defaultValue: 'admin' },
        { key: 'defaultUser.password', defaultValue: 'admin' },
        { key: 'defaultCategory.name', defaultValue: 'Default' },
        { key: 'defaultCategory.destination', defaultValue: __dirname + '/download' }
    ]
);

deps.database = new database(deps);
deps.serverManager = new serverManager(deps);
deps.downloadManager = new downloadManager(deps);
deps.serverQueue = new serverQueue(deps);
deps.pathMapper = new pathMapper(deps);

routes.apply(deps, app);

// sync db
deps.database(function(err, models) {
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
        var server = http.createServer(app);
        function listenCallback() {
            process.setuid(config.uid);
            console.log("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
        }

        if (config.ip) {
            server.listen(config.port, config.ip, listenCallback);
        } else {
            server.listen(config.port, listenCallback);
        }
    });
});


process.on('uncaughtException', function(e) {
    console.log(e);
    if (e.stack) {
        console.log(e.stack);
    }
    console.trace();
    deps.downloadManager.close();
    deps.serverManager.close();
    process.exit(1);
});
