
/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    config = require('./config.js'),
    database = require('./database.js'),
    serverManager = require('./serverManager.js'),
    lessMiddleware = require('less-middleware');

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
    app.use(lessMiddleware({ src : __dirname + '/public', paths: [__dirname + '/vendor/twitter/bootstrap/less'] }));
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

routes.apply(app, {
    serverManager: new serverManager()
});

// sync db
database(function() {});

var server = http.createServer(app);
server.listen(config.port, function() {
    console.log("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
});
