
/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    config = require('./config.js'),
    database = require('./database.js'),
    serverManager = require('./serverManager.js'),
    downloadManager = require('./downloadManager.js'),
    serverQueue = require('./serverQueue.js').Queue,
    pathMapper = require('./pathMapper.js'),
    lessMiddleware = require('less-middleware'),
    eventEmitter = require('events').EventEmitter;

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
var dependencies = {
    eventBus: eventBus
};

dependencies.serverManager = new serverManager(dependencies);
dependencies.downloadManager = new downloadManager(dependencies);
dependencies.serverQueue = new serverQueue(dependencies);
dependencies.pathMapper = new pathMapper(dependencies);

routes.apply(dependencies, app);

// sync db
database(function() {});

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

process.on('uncaughtException', function(e) {
    console.log(e);
    console.log(e.stack);
    console.trace();
    dependencies.downloadManager.close();
    dependencies.serverManager.close();
    process.exit(1);
});
