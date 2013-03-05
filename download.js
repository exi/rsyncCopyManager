var database = require('./database.js');
var rsync = require('./rsync');
var Promise = require('node-promise').Promise;
var all = require('node-promise').all;
var when = require('node-promise').when;
var configHelper = require('./configHelper.js');
var config = require('./config.js');
var fs = require('fs');
var wrench = require('wrench');
var events = require('events');
var util = require('util');
var Token = require('./serverQueue.js').Token;
var mv = require('mv');

configHelper.defineMultiple(
    [
        { key: 'downloadDir', dirMustExist: true, defaultValue: __dirname + '/download' },
        { key: 'keyfile', fileMustExist: true },
        { key: 'download_retry_interval', defaultValue: 5 }
    ]
);

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
    var movePromise;
    var downloadTimer;
    var token = null;
    var queued = false;
    var noMatchingServer = false;
    var currentServer = null;
    var reload = false;
    var restart = false;
    var currentQueuePosition = 0;
    var offlineServers = {};
    var lastActivity = null;
    var movingFiles = false;
    var moveError = false;

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
                        if (downloadStatus) {
                            status.downloadStatus = downloadStatus;
                        }

                        if (fileStatus) {
                            status.fileStatus = fileStatus;
                        }
                    }

                    if (movingFiles) {
                        status.movingFiles = movingFiles;
                    }

                    if (moveError) {
                        status.moveError = moveError;
                    }
                }

                if (queued) {
                    status.queued = true;
                    status.queuePosition = currentQueuePosition;
                }
            }

            p.resolve(status);
        });

        return p;
    };

    api.closeAndDelete = function(deleteData) {
        stop = true;
        var p = new Promise();

        function efun(err) {
            console.log(err);
            p.reject(err);
        }
        var deletePromise = new Promise();

        api.close().then(function() {
            if (!deleteData) {
                deletePromise.resolve();
            } else {
                var parts = path.split('/');
                var basePath = modelInstance.complete ? findCategoryDir() : config.downloadDir;
                when(basePath, function(path) {
                    var completepath = path + '/' + parts.pop();
                    try {
                        var stat = fs.statSync(completepath);

                        if (stat.isDirectory()) {
                            wrench.rmdirSyncRecursive(completepath, true);
                        } else if (stat.isFile()) {
                            fs.unlink(completepath);
                        }

                        deletePromise.resolve();
                    } catch (err) {
                        console.log(err);
                        if (err.code === 'ENOENT') {
                            return deletePromise.resolve();
                        }
                        deletePromise.reject(err);
                    }
                }, efun);
            }
        });

        var path = modelInstance.path;
        deletePromise.then(function() {
            modelInstance.destroy().success(function() {
                p.resolve();
            }).error(efun);
        }, efun);

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
        } else if (movePromise) {
            console.log('waiting for file Move');
            movePromise.then(function() {
                p.resolve();
            });
        } else {
            finishToken();
            p.resolve();
        }

        return p;
    };

    function refreshModelInstance() {
        var p = new Promise();
        var efun = function(err) {
            p.reject(err);
        };

        database(function(err, models) {
            if (err) {
                efun(err);
            }
            models.Download.find(modelInstance.id).success(function(model) {
                if (model === null) {
                    return efun(new Error('Download not found!'));
                }
                modelInstance = model;
                p.resolve(model);
            }).error(efun);
        });
        return p;
    }

    function updateLastSeen(server) {
        server.last_seen = new Date();
        server.save(['last_seen']);
        lastActivity = new Date();
    }

    function download(server) {
        if (stop) {
            return stopDownloadAndFinish();
        }

        console.log('starting download');
        exitPromise = new Promise();
        queued = false;
        downloading = true;
        serverOffline = false;

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
            modelInstance.save(['progress']);
            updateLastSeen(server);
        });

        rsyncp.on('files', function(data) {
            fileStatus = data;
        });

        rsyncp.on('finish', function() {
            onrsyncpEnd();
            updateLastSeen(server);
            finishToken();
            moveFilesAndComplete();
        });

        rsyncp.on('error', function(code, msg) {
            console.log('got error ' + code);
            console.log(msg);
            onrsyncpEnd();
            if (reload === true) {
                reload = false;
                reloadServerInfoAndDownload(server);
            } else if (restart === true) {
                restart = false;
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
            return stopDownloadAndFinish();
        }
        console.log('restarting download');
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

    function stopDownloadAndFinish() {
        stopDownloadAndFinish();
        finishToken();
    }

    function getTokenAndQueue(server) {
        finishToken();
        queued = true;
        currentServer = server;

        token = new Token(function() {
            download(server);
        }, modelInstance.id);

        token.on('reject', function() {
            queued = false;
            token = null;
            restartDownload();
        });
        token.on('position-change', function(newPosition) {
            currentQueuePosition = newPosition;
        });
        dependencies.serverQueue.queue(server.id, token);
    }

    function reloadServerInfoAndDownload(server) {
        reload = false;
        startupPromise.then(function(models) {
            models.Server.find({
                where: { id: server.id }
            }).success(function(server) {
                console.log('reload complete ' + server.bwlimit);
                reload = false;
                download(server);
            }).error(function(err) {
                console.log('reload  failed');
                stopDownloadAndFinish();
                startDownload();
            });
        });
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
                    if (server === null) {
                        noMatchingServer = true;
                        resetDownloadTimer();
                        return stopDownload();
                    }
                    getTokenAndQueue(server);
                }).error(function() {
                    console.log('Server not found');
                    resetDownloadTimer();
                    return stopDownload();
                });
            }).error(function() {
                console.log('path not found');
                resetDownloadTimer();
                return stopDownload();
            });
        });
    }

    function completeDownload() {
        var p = new Promise();

        modelInstance.complete = true;
        modelInstance.save(['complete']).success(function() {
            p.resolve();
        }).error(function(err) {
            p.reject();
        });

        return p;
    }

    function moveFilesAndComplete() {
        movePromise = new Promise();

        function moveErr(err) {
            moveError = true;
            movingFiles = false;
            movePromise.resolve();

        }

        findCategoryDir().then(function(dir) {
            var parts = modelInstance.path.split('/');
            var name = parts.pop();
            var src = config.downloadDir + '/' + name;
            var dst = dir + '/' + name;
            mv(src, dst, function(err) {
                if (err) {
                    return moveErr(err);
                }
                completeDownload().then(function() {
                    movingFiles = false;
                    movePromise.resolve();
                }, moveErr);
            });
        }, moveErr);
    }

    function findCategoryDir() {
        var p = new Promise();
        var efun = function(err) {
            p.reject(err);
        };

        database(function(err, models) {
            if (err) {
                return efun(err);
            }
            refreshModelInstance().then(function(model) {
                models.Category.find(model.CategoryId).success(function(cat) {
                    if (cat === null) {
                        return p.resolve(config.downloadDir);
                    }
                    p.resolve(cat.destination);
                }).error(efun);
            }, efun);
        });
        return p;
    }

    dependencies.eventBus.on('server-change', function(serverId) {
        if (currentServer && currentServer.id === serverId) {
            console.log('download ' + modelInstance.id + ' server change');
            if (rsyncp) {
                console.log('trigger reload');
                reload = true;
                rsyncp.kill();
            } else if (token) {
                console.log('rejecting token');
                token.emit('reject');
            }
        }
    });

    database(function(err, models) {
        if (err) {
            throw err;
        }
        console.log('download ' + modelInstance.id + ' ready');
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
