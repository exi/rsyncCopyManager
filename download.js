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
    var lastActivity = null;

    api.getStatus = function() {
        var p = new Promise();
        startupPromise.then(function () {
            var status = {};

            if (modelInstance.complete === true) {
                status.complete = true;
            } else {
                if (serverOffline) {
                    status.serverOffline = true;
                    if (lastActivity) {
                        status.lastActivity = lastActivity;
                    }
                } else if (noMatchingServer) {
                    status.noMatchingServer = true;
                    if (lastActivity) {
                        status.lastActivity = lastActivity;
                    }
                } else {
                    if (downloading) {
                        status.active = true;
                    }

                    if (downloadStatus) {
                        status.downloadStatus = downloadStatus;
                    }

                    if (fileStatus) {
                        status.fileStatus = fileStatus;
                    }

                    if (queued) {
                        status.queued = true;
                        status.queuePosition = currentQueuePosition;
                    }
                }
            }

            p.resolve(status);
        });

        return p;
    };

    api.closeAndDelete = function(deleteData) {
        stop = true;

        var p = new Promise();
        var deletePromise = new Promise();

        api.close().then(function() {
            deletePromise.resolve();
        });

        var path = modelInstance.path;
        modelInstance.destroy().success(function() {
            deletePromise.then(function() {
                var parts = path.split('/');
                var completepath = config.downloadDir + '/' + parts.pop();

                if (deleteData) {
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
                }

                p.resolve();
            });
        });

        return p;
    };

    api.close = function() {
        stop = true;
        console.log('download api close');
        var p = new Promise();

        if (exitPromise) {
            console.log('waiting for exitPromise');
            exitPromise.then(function() {
                p.resolve();
            });
            rsyncp.kill();
        } else {
            finishToken();
            p.resolve();
        }

        return p;
    };

    function updateLastSeen(server) {
        server.last_seen = new Date();
        server.save(['last_seen']);
        lastActivity = new Date();
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
            if (stop) {
                return;
            }
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
            modelInstance.complete = true;
            modelInstance.save();
            onrsyncpEnd();
            updateLastSeen(server);
            finishToken();
        });

        rsyncp.on('error', function(code) {
            console.log('got error ' + code);
            onrsyncpEnd();
            if (restart === true) {
                restartDownload();
            } else {
                serverOffline = true;
                offlineServers[server.id] = new Date();
                finishToken();
                resetDownloadTimer();
            }
        });
    }

    function onrsyncpEnd() {
        stopDownload();
        rsyncp = null;
        if (exitPromise) {
            exitPromise.resolve();
            exitPromise = null;
        }
    }

    function finishToken() {
        if (token) {
            token.emit('finished');
            token = null;
        }
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
            return rsyncp.kill();
        } else {
            finishToken();
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
                    }, modelInstance.id);
                    queued = true;
                    token.on('reject', function() {
                        queued = false;
                        token = null;
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

    if (modelInstance.last_seen !== null) {
        lastActivity = modelInstance.last_seen;
    }

    process.on('exit', function() {
        console.log('killing download');
        api.close();
    });

    return api;
};
