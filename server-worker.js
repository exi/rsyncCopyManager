var fs = require('fs');
var rsync = require('./rsync');
var database = require('./database.js');
var config = require('./config.js');
var Promise = require('node-promise').Promise;
var All = require('node-promise').all;

var logfd = fs.openSync(config.logdir + '/server.log', 'a+');

var Server = function(modelInstance) {
    console.log('starting server worker ' + modelInstance.hostname + ' ' + modelInstance.path);
    var api = {};
    var stop = false;
    var checkTimer;
    var fsCheckInProgress = false;
    var consolePrefix = modelInstance.hostname + ': ';
    var checkFileListPromise = null;
    var waitForClose = false;
    var serverOffline;
    var lastErrorOutput = null;
    var rsyncp;

    function resetTimer() {
        stopTimer();
        if (stop) {
            return;
        }
        checkTimer = setTimeout(periodicCheck, 1000 * 60);
    }

    function stopTimer() {
        clearTimeout(checkTimer);
    }

    function setStopIndicators() {
        console.log('closing server ' + modelInstance.id);
        stopTimer();
        stop = true;
    }

    api.closeAndDelete = function() {
        var p = new Promise();

        api.close().then(function() {
            database(function(err, models, sequelize) {
                sequelize.query('DELETE FROM FSEntries WHERE ServerId=' + modelInstance.id + ';').done(function() {
                    modelInstance.destroy().done(function() {
                        p.resolve();
                    });
                });
            });
        });

        return p;
    };

    api.close = function() {
        var p = new Promise();
        setStopIndicators();
        waitForClose = true;

        var promises = [];
        if (checkFileListPromise !== null) {
            promises.push(checkFileListPromise);
            rsyncp.kill();
        }

        All(promises).then(function() {
            waitForClose = false;
            p.resolve();
        });

        return p;
    };

    api.getStatus = function() {
        var p = new Promise();

        status = { };

        if (fsCheckInProgress) {
            status.fsCheckInProgress = true;
        }

        if (waitForClose) {
            status.waitForClose = true;
        }

        if (serverOffline) {
            status.serverOffline = true;
        }

        if (lastErrorOutput) {
            status.lastErrorOutput = lastErrorOutput;
        }

        p.resolve(status);
        return p;
    };

    api.rescan = function() {
        if (stop) {
            return;
        }

        checkFileList();
    };

    function startedFsCheck() {
        fsCheckInProgress = true;
        checkFileListPromise = new Promise();
    }

    function finishedFsCheck() {
        fsCheckInProgress = false;
        checkFileListPromise.resolve();
        checkFileListPromise = null;
    }

    function resetFSCheckTime() {
        modelInstance.last_filelist_update = new Date();
        modelInstance.last_seen = new Date();
        modelInstance.save(['last_filelist_update', 'last_seen']).success(function() {
            finishedFsCheck();
        }).error(function() {
            finishedFsCheck();
        });
    }

    function checkFileList() {
        if (fsCheckInProgress || stop) {
            return;
        }

        console.log('checking files for server: ' + modelInstance.id);
        startedFsCheck();

        rsyncp = new rsync.filelist({
            keyfile: config.keyfile,
            username: modelInstance.username,
            host: modelInstance.hostname,
            src: modelInstance.path
        });

        rsyncp.on('error', function(code, msg) {
            console.error(consolePrefix + ' fscheck failed: ' + code);
            serverOffline = true;
            lastErrorOutput = msg;
            finishedFsCheck();
        });

        rsyncp.on('finish', function(filelist) {
            lastErrorOutput = null;
            serverOffline = false;
            database(function(err, models) {
                if (err) {
                    console.error(err);
                    finishedFsCheck();
                    return;
                }

                var paths = [];
                filelist.forEach(function(fse) {
                    paths.push(fse.path);
                });

                modelInstance.getFSEntries().success(function(matches) {
                    var fsentries = matches;
                    var pathmap = {};

                    matches.forEach(function(fse) {
                        pathmap[fse.path] = fse;
                    });

                    var promises = [];
                    var change = false;

                    filelist.forEach(function(fse) {
                        if (!pathmap.hasOwnProperty(fse.path.trim())) {
                            console.log('add ' + fse.path);
                            var entry = models.FSEntry.build(fse);
                            var p = new Promise();
                            promises.push(p);
                            change = true;
                            entry.save().success(function(entry) {
                                entry.setServer(modelInstance).success(function(fse) {
                                    p.resolve();
                                });
                            });
                        } else {
                            delete pathmap[fse.path];
                        }
                    });


                    for (var m in pathmap) {
                        if (pathmap.hasOwnProperty(m)) {
                            (function(s, path) {
                                var p = new Promise();
                                promises.push(p);
                                change = true;
                                s.destroy().success(function() {
                                    p.resolve();
                                    console.log('del ' + path);
                                });
                            })(pathmap[m], pathmap[m].path);
                        }
                    }

                    All(promises).then(function() {
                        if (change) {
                            process.send({ command: 'event', topic: 'fs-change' });
                        }
                        resetFSCheckTime();
                    }, resetFSCheckTime);
                });
            });
        });

    }

    function periodicCheck() {
        var fstime = modelInstance.last_filelist_update;
        var checkinterval = config.fs_check_interval * 60 * 1000;

        if (!fstime || fstime === null || fstime.getTime() + checkinterval < Date.now()) {
            checkFileList();
        }

        resetTimer();
    }

    resetTimer();

    return api;
};

var instance = null;
var startupPromise = new Promise();

process.on('message', function(data) {

    var id = data.id;

    function success(data) {
        var msg = {
            id: id,
            type: 'success',
            data: data
        };
        process.send(msg);
    }

    if (data.id !== undefined && data.data) {
        id = data.id;
        data = data.data;
        if (data.command === 'start' && data.serverId && instance === null) {
            database(function(err, models) {
                if (err) {
                    throw err;
                }
                models.Server.find({
                    where: {
                        id: data.serverId
                    }
                }).success(function(modelInstance) {
                    instance = new Server(modelInstance);
                    startupPromise.resolve();
                    success({ started: true });
                });
            });
        }

        if (data.command === 'getStatus') {
            startupPromise.then(function() {
                instance.getStatus().then(function(status) {
                    success({ status: status });
                });
            });
        }

        if (data.command === 'closeAndDelete') {
            startupPromise.then(function() {
                instance.closeAndDelete().then(function() {
                    success({});
                });
            });
        }

        if (data.command === 'rescan') {
            startupPromise.then(function() {
                instance.rescan();
                success({});
            });
        }
    }
});

function close() {
    if (instance !== null) {
        instance.close().then(function() {
            process.exit(1);
        });
    } else {
        process.exit(1);
    }
}

process.on('exit', function() {
    console.log('exiting server worker due to exit');
    close();
});

process.on('disconnect', function() {
    console.log('exiting server worker due to disconnect');
    close();
});
