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
    var fileStatus = null;
    var rsyncp;
    var stop = false;
    var exitPromise;
    var downloadTimer;
    var token = null;
    var queued = false;
    var noMatchingServer = false;
    var currentServer = null;
    var restart = false;
    var currentQueuePosition = 0;
    var offlineServers = {};

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

            if (fileStatus !== null) {
                status.fileStatus = fileStatus;
            }

            if (noMatchingServer) {
                status.noMatchingServer = true;
            }

            if (queued) {
                status.queued = true;
                status.queuePosition = currentQueuePosition;
            }

            if (modelInstance.complete === true) {
                status.complete = true;
            }

            if (serverOffline) {
                status.serverOffline = true;
            }

            console.log(status);
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

        api.close().then(function() {
            deletePromise.resolve();
        });

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

    api.close = function() {
        console.log('download api close');
        var p = new Promise();

        if (exitPromise) {
            console.log('waiting for exitPromise');
            exitPromise.then(function() {
                p.resolve();
            });
            rsyncp.kill();
            stopDownload();
        } else {
            p.resolve();
        }

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

        rsyncp = new rsync.download(options);

        rsyncp.on('progress', function(data) {
            serverOffline = false;
            downloadStatus = data;
            modelInstance.progress = data.progress;
            modelInstance.save();
            updateLastSeen(server);
        });

        rsyncp.on('files', function(data) {
            fileStatus = data;
        });

        rsyncp.on('finish', function() {
            downloadStatus.rate = 0;
            downloadStatus.percent = modelInstance.progress = 100;
            modelInstance.complete = true;
            downloadStatus = null;
            fileStatus = null;
            modelInstance.save();
            onrsyncpEnd();
            updateLastSeen(server);
            console.log('finished');
            finishToken();
        });

        rsyncp.on('error', function(code) {
            console.log('got error ' + code);
            serverOffline = true;
            onrsyncpEnd();
            if (restart === true) {
                restartDownload();
            } else {
                offlineServers[server.id] = new Date();
                finishToken();
                resetDownloadTimer();
            }
        });
    }

    function onrsyncpEnd() {
        stopDownload();
        rsyncp = null;
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
        downloadtimer = setTimeout(startDownload, parseInt(config.download_retry_interval * 60 * 1000, 10));
    }

    function restartDownload() {
        if (stop) {
            return stopDownload();
        }
        console.log('restarting download');
        restart = false;
        if (rsyncp) {
            restart = true;
            rsyncp.kill();
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
            models.FSEntry.findAll({
                where: {
                    path: modelInstance.path
                }
            }).success(function(fses) {
                if (stop) {
                    return stopDownload();
                }

                if (fses.length === 0) {
                    stopDownload();
                    noMatchingServer = true;
                    return resetDownloadTimer();
                }

                noMatchingServer = false;

                var fse;
                var servers = [];
                for (var i in fses) {
                    if (!offlineServers.hasOwnProperty(fses[i].ServerId)) {
                        fse = fses[i];
                        break;
                    } else {
                        servers.push({
                            when: offlineServers[fses[i].ServerId].getTime(),
                            fse: fses[i]
                        });
                    }
                }

                if (fse === undefined) {
                    var sort = function(a, b) {
                        return a.when - b.when;
                    };
                    servers.sort(sort);
                    fse = servers[0].fse;
                }

                fse.getServer().success(function(server) {
                    token = new Token(function() {
                        download(server);
                    });
                    queued = true;
                    token.on('reject', function() {
                        queued = false;
                        restartDownload();
                    });
                    token.on('position-change', function(newPosition) {
                        currentQueuePosition = newPosition;
                    });
                    dependencies.serverQueue.queue(server.id, token);
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

    process.on('exit', function() {
        console.log('killing download');
        api.close();
    });

    return api;
};
