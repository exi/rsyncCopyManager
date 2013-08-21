var Promise = require('node-promise').Promise;
var all = require('node-promise').all;
var when = require('node-promise').when;
var fs = require('fs');
var wrench = require('wrench');
var events = require('events');
var util = require('./util.js');
var Token = require('./serverQueue.js').Token;
var mv = require('./move.js');

var Download = module.exports = function(deps, modelInstance) {
    deps.configHelper.defineMultiple(
        [
            { key: 'downloadDir', dirMustExist: true, defaultValue: __dirname + '/download' },
            { key: 'keyfile', fileMustExist: true },
            { key: 'download_retry_interval', defaultValue: 5 }
        ]
    );

    var rsync = (new require('./rsync'))(deps);
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
            console.error(err);
            p.reject(err);
        }
        var deletePromise = new Promise();

        api.close().then(function() {
            if (!deleteData) {
                deletePromise.resolve();
            } else {
                try {
                    var currentPath = modelInstance.currentPath;
                    var stat = fs.statSync(currentPath);

                    if (stat.isDirectory()) {
                        wrench.rmdirSyncRecursive(currentPath, false);
                    } else if (stat.isFile()) {
                        fs.unlink(currentPath);
                    }

                    deletePromise.resolve();
                } catch (err) {
                    console.error(err);
                    if (err.code === 'ENOENT') {
                        return deletePromise.resolve();
                    }
                    deletePromise.reject(err);
                }
            }
        });

        deletePromise.then(function() {
            modelInstance.destroy().success(function() {
                p.resolve();
            }).error(efun);
        }, efun);

        return p;
    };

    api.close = function() {
        stop = true;
        console.error('download api close');
        var p = new Promise();

        if (exitPromise) {
            console.error('waiting for exitPromise');
            exitPromise.then(function() {
                p.resolve();
            });
            rsyncp.kill();
        } else if (movePromise) {
            console.error('waiting for file Move');
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

        deps.database.get(function(err, models) {
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

        console.error('starting download');
        exitPromise = new Promise();
        queued = false;
        downloading = true;
        serverOffline = false;
        var parts = modelInstance.currentPath.split('/');
        parts.pop();

        var options = {
            keyfile: deps.config.keyfile,
            username: server.username,
            host: server.hostname,
            src: server.path + '/' + modelInstance.path,
            dest: parts.join('/') + '/'
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
            console.error('got error ' + code);
            console.error(msg);
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
        downloadtimer = setTimeout(startDownload, parseInt(deps.config.download_retry_interval * 60 * 1000, 10));
    }

    function restartDownload() {
        if (stop) {
            return stopDownloadAndFinish();
        }
        console.error('restarting download');
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
        deps.serverQueue.queue(server.id, token);
    }

    function reloadServerInfoAndDownload(server) {
        reload = false;
        startupPromise.then(function(models) {
            models.Server.find({
                where: { id: server.id }
            }).success(function(server) {
                console.error('reload complete ' + server.bwlimit);
                reload = false;
                download(server);
            }).error(function(err) {
                console.error('reload  failed');
                stopDownloadAndFinish();
                startDownload();
            });
        });
    }

    function startDownload() {
        if (stop) {
            return;
        }
        findBestServer(modelInstance.path).then(function(server) {
            if (server === null) {
                noMatchingServer = true;
                resetDownloadTimer();
                return stopDownload();
            }

            noMatchingServer = false;
            getTokenAndQueue(server);
        }, function(err) {
            resetDownloadTimer();
            return stopDownload();
        });
    }

    function findBestServer(path) {
        var p = new Promise();

        startupPromise.then(function(models) {
            models.FSEntry.findAll({
                where: {
                    path: modelInstance.path
                }
            }).success(function(fses) {
                if (stop) {
                    return p.reject();
                }

                if (fses.length === 0) {
                    return p.resolve(null);
                }

                var fse;
                var offservers = [];
                var onservers = [];

                for (var i in fses) {
                    if (!offlineServers.hasOwnProperty(fses[i].ServerId)) {
                        onservers.push(fses[i]);
                    } else {
                        offservers.push({
                            when: offlineServers[fses[i].ServerId].getTime(),
                            fse: fses[i]
                        });
                    }
                }

                if (onservers.length === 0) {
                    var sort = function(a, b) {
                        return a.when - b.when;
                    };
                    offservers.sort(sort);
                    onservers.push(offservers[0].fse);
                }

                var sids = onservers.map(function(f) { return f.ServerId; });
                models.Server.findAll({
                    where: {
                        id: sids
                    }
                }).success(function(servers) {
                    servers.sort(function(a, b) {
                        if (a.bwlimit === null) {
                            return -1;
                        } else if (b.bwlimit === null) {
                            return 1;
                        }

                        return b.bwlimit - a.bwlimit;
                    });
                    p.resolve(servers[0]);
                }).error(function() {
                    console.error('Server not found');
                    p.reject();
                });
            }).error(function() {
                console.error('path not found');
                p.reject();
            });
        });

        return p;
    }

    function completeDownload(newPath) {
        var p = new Promise();

        modelInstance.complete = true;
        modelInstance.currentPath = newPath;
        modelInstance.save(['complete', 'currentPath']).success(function() {
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
            console.error(err);
            if (err.stack) {
                console.error(err.stack);
            }

            movePromise.resolve();

        }

        findCategoryDir().then(function(dir) {
            var src = modelInstance.currentPath;
            var dst = util.getAbsolutePathForDownload(dir, src);
            console.error('move',src,dst);
            movingFiles = true;
            mv(src, dst).then(function() {
                completeDownload(dst).then(function() {
                    movingFiles = false;
                    movePromise.resolve();
                }, moveErr);
            }, moveErr);
        }, moveErr);
    }

    function findCategoryDir() {
        var p = new Promise();
        var efun = function(err) {
            p.reject(err);
        };

        deps.database.get(function(err, models) {
            if (err) {
                return efun(err);
            }
            refreshModelInstance().then(function(model) {
                models.Category.find(model.CategoryId).success(function(cat) {
                    if (cat === null) {
                        return p.resolve(deps.config.downloadDir);
                    }
                    p.resolve(cat.destination);
                }).error(efun);
            }, efun);
        });
        return p;
    }

    deps.eventBus.on('server-change', function(serverId) {
        if (currentServer && currentServer.id === serverId) {
            console.error('download ' + modelInstance.id + ' server change');
            if (rsyncp) {
                console.error('trigger reload');
                reload = true;
                rsyncp.kill();
            } else if (token) {
                console.error('rejecting token');
                token.emit('reject');
            }
        }
    });

    deps.database.get(function(err, models) {
        if (err) {
            throw err;
        }
        console.error('download ' + modelInstance.id + ' ready');
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
        console.error('killing download');
        api.close();
    });

    return api;
};
