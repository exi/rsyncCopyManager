var database = require('./database.js');
var rsync = require('./rsync');
var Promise = require('node-promise').Promise;
var All = require('node-promise').all;
var config = require('./config.js');
var fs = require('fs');
var wrench = require('wrench');
var events = require('events');
var util = require('util');
var Token = require('./serverQueue.js').Token;

var Download = module.exports = function(dependencies, modelInstance) {
    var api = {};
    var startupPromise = new Promise();
    var downloading = false;
    var serverOffline = false;
    var downloadStatus = null;
    var process;
    var stop = false;
    var exitPromise;
    var downloadTimer;
    var token = null;
    var queued = false;
    var noMatchingServer = false;
    var currentServer = null;
    var restart = false;

    api.getStatus = function() {
        var p = new Promise();
        startupPromise.then(function () {
            var status = {};

            if (downloading) {
                status.active = true;
            }

            if (downloadStatus !== null) {
                status.downloadStatus = downloadStatus;
            }

            if (noMatchingServer) {
                status.noMatchingServer = true;
            }

            if (queued) {
                status.queued = true;
            }

            if (modelInstance.complete === true) {
                status.complete = true;
            }

            if (serverOffline) {
                status.serverOffline = true;
            }

            p.resolve(status);
        });

        return p;
    };

    api.closeAndDelete = function() {
        stop = true;

        var p = new Promise();
        var deletePromise = new Promise();

        if (token !== null) {
            token.emit('finished');
        }

        if (exitPromise) {
            console.log('awiting for exitPromise');
            process.kill();
            exitPromise.then(function() {
                deletePromise.resolve();
            });
            stopDownload();
        } else {
            deletePromise.resolve();
        }

        var path = modelInstance.path;
        modelInstance.destroy().success(function() {
            deletePromise.then(function() {
                var parts = path.split('/');
                var completepath = config.downloadDir + '/' + parts.pop();
                try {
                    var stat = fs.statSync(completepath);

                    if (stat.isDirectory()) {
                        wrench.rmdirSyncRecursive(completepath, true);
                    } else if (stat.isFile()) {
                        fs.unlink(completepath);
                    }
                } catch (e) {
                    console.log(e);
                }

                p.resolve();
            });
        });

        return p;
    };

    function updateLastSeen(server) {
        server.last_seen = new Date();
        server.save(['last_seen']);
    }

    function download(server) {
        if (stop) {
            return stopDownload();
        }

        console.log('starting download');
        exitPromise = new Promise();
        queued = false;
        downloading = true;
        currentServer = server;

        var options = {
            keyfile: config.keyfile,
            username: server.username,
            host: server.hostname,
            src: server.path + '/' + modelInstance.path,
            dest: config.downloadDir + '/'
        };

        if (server.bwlimit !== undefined) {
            options.bwlimit = server.bwlimit;
        }

        process = new rsync.download(options);

        process.on('progress', function(data) {
            serverOffline = false;
            downloadStatus = data;
            modelInstance.progress = data.progress;
            modelInstance.save();
            updateLastSeen(server);
        });

        process.on('finish', function() {
            downloadStatus.rate = 0;
            downloadStatus.percent = modelInstance.progress = 100;
            modelInstance.complete = 1;
            modelInstance.save();
            onProcessEnd();
            updateLastSeen(server);
            console.log('finished');
            finishToken();
        });

        process.on('error', function(code) {
            console.log('got error ' + code);
            serverOffline = true;
            onProcessEnd();
            if (restart === true) {
                restartDownload();
            } else {
                finishToken();
                resetDownloadTimer();
            }
        });
    }

    function onProcessEnd() {
        stopDownload();
        process = null;
        exitPromise.resolve();
        exitPromise = null;
    }

    function finishToken() {
        token.emit('finished');
        token = null;
    }

    function resetDownloadTimer() {
        if (modelInstance.complete || stop) {
            return;
        }

        clearTimeout(downloadTimer);
        downloadtimer = setTimeout(startDownload, config.download_retry_interval * 60 * 1000);
    }

    function restartDownload() {
        if (stop) {
            return stopDownload();
        }
        console.log('restarting download');
        restart = false;
        if (process) {
            restart = true;
            process.kill();
        } else if (token) {
            token.emit('finished');
            startDownload();
        }
    }


    function stopDownload() {
        downloading = false;
    }

    function startDownload() {
        if (stop) {
            return;
        }
        startupPromise.then(function(models) {
            models.FSEntry.find({
                where: {
                    path: modelInstance.path
                }
            }).success(function(fse) {
                if (stop) {
                    return stopDownload();
                }

                if (fse === null) {
                    stopDownload();
                    noMatchingServer = true;
                    return resetDownloadTimer();
                }

                noMatchingServer = false;

                fse.getServer().success(function(server) {
                    token = new Token(function() {
                        download(server);
                    });
                    queued = true;
                    dependencies.serverQueue.queue(server.id, token);
                    token.on('rejected', function() {
                        queued = false;
                        restartDownload();
                    });
                }).error(function() {
                    console.log('Server not found');
                    return stopDownload();
                });
            }).error(function() {
                console.log('path not found');
                return stopDownload();
            });
        });
    }

    dependencies.eventBus.on('server-change', function(serverId) {
        if (currentServer && currentServer.id === serverId) {
            restartDownload();
        }
    });

    database(function(err, models) {
        if (err) {
            throw err;
        }
        startupPromise.resolve(models);
    });

    if (modelInstance.complete !== true) {
        downloadStatus = {
            percent: modelInstance.progress
        };
        startupPromise.then(startDownload);
    }

    return api;
};
