var fs = require('fs');
var providerHelper = require('./providerHelper.js');

var deps = {
    config: require('../config.js')
};

deps.configHelper = new (require('./configHelper.js'))(deps);
deps.database = new (require('./database.js'))(deps);

var Promise = require('node-promise').Promise;
var All = require('node-promise').all;

deps.configHelper.defineMultiple(
    [
        { key: 'fs_check_interval', defaultValue: 60 * 24 }
    ]
);

var Server = function(modelInstance) {
    console.error('starting server worker ' + modelInstance.id);
    var api = {};
    var stop = false;
    var checkTimer;
    var fsCheckInProgress = false;
    var checkFileListPromise = null;
    var waitForClose = false;
    var serverOffline;
    var lastErrorOutput = null;
    var processingStatus = null;
    var scanner;

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
        console.error('closing server ' + modelInstance.id);
        stopTimer();
        stop = true;
    }

    api.closeAndDelete = function() {
        var p = new Promise();

        api.close().then(function() {
            deps.database.query('DELETE FROM FSEntries WHERE ServerId=' + modelInstance.id + ';').done(function() {
                modelInstance.destroy().done(function() {
                    p.resolve();
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
            scanner.kill();
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
            if (processingStatus !== null) {
                status.processingStatus = processingStatus;
            }
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
        if (fsCheckInProgress) {
            fsCheckInProgress = false;
            checkFileListPromise.resolve();
            checkFileListPromise = null;
        }
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
        startedFsCheck();

        deps.database.get(function(err, models) {
            if (stop) {
                return finishedFsCheck();
            }

            if (err) {
                console.error(err);
                finishedFsCheck();
                return;
            }
            console.error('checking files for server: ' + modelInstance.id);

            var revision = modelInstance.fse_revision + 1;
            var promises = [];
            var change = false;
            var total = 0;
            var toFind = [];
            var packSize = 100;
            var packChain = new Promise();
            var chainLength = 0;
            var minChainLength = 5;
            var maxChainLength = 10;
            packChain.resolve();

            processingStatus = {
                total: 0,
                complete: 0
            };

            function packFind(path, force) {
                var p = new Promise();
                toFind.push({
                    path: path,
                    promise: p,
                    finishPromise: new Promise()
                });
                if (toFind.length > packSize || force) {
                    fetchPack();
                }
                return p;
            }

            function fetchPack() {
                var tf = toFind;
                var newChain = new Promise();
                packChain.then(function() {
                    if (stop) {
                        return finishedFsCheck();
                    }

                    if (tf.length > 0) {
                        var pmap = {};
                        var fpromises = [];
                        var paths = tf.map(function(item, idx) {
                            pmap[item.path] = idx;
                            fpromises.push(item.finishPromise);
                            return item.path;
                        });

                        models.FSEntry.findAll({
                            where: {
                                path: paths
                            }
                        }).done(function(err, matches) {
                            if (stop) {
                                return finishedFsCheck();
                            }
                            if (err) {
                                return newChain.reject();
                            }
                            matches.forEach(function(m) {
                                if (pmap.hasOwnProperty(m.path)) {
                                    var idx = pmap[m.path];
                                    tf[idx].promise.resolve([m, tf[idx].finishPromise]);
                                    delete pmap[m.path];
                                }
                            });

                            for (var i in pmap) {
                                if (pmap.hasOwnProperty(i)) {
                                    var idx = pmap[i];
                                    tf[idx].promise.resolve([null, tf[idx].finishPromise]);
                                }
                            }

                            All(fpromises).then(function() {
                                newChain.resolve();
                            });
                        });
                    } else {
                        newChain.resolve();
                    }

                    newChain.addBoth(function() {
                        if (stop) {
                            return finishedFsCheck();
                        }
                        chainLength--;
                        if (chainLength < minChainLength && scanner.suspended === true) {
                            scanner.resume();
                        }
                    });
                });
                toFind = [];
                chainLength++;
                packChain = newChain;
                return newChain;
            }

            function insertOrUpdate(fse) {
                packFind(fse.path).then(function(d) {
                    if (stop) {
                        return finishedFsCheck();
                    }
                    var match = d[0];
                    var p = d[1];

                    var handle;
                    if (match === null) {
                        fse.ServerId = modelInstance.id;
                        fse.revision = revision;
                        handle = models.FSEntry.create(fse);
                    } else {
                        match.size = fse.size;
                        match.revision = revision;
                        match.isDir = fse.isDir;
                        handle = match.save(['size', 'revision', 'isDir']);
                    }
                    handle.done(function(err) {
                        if (stop) {
                            return finishedFsCheck();
                        }
                        if (err) {
                            return p.reject(err);
                        }
                        change = true;
                        processingStatus.complete++;
                        p.resolve();
                    });
                });
            }

            scanner = getScannerForServer(modelInstance);

            scanner.on('error', function(msg) {
                console.error('fscheck failed: ' + msg);
                serverOffline = true;
                lastErrorOutput = msg;
                finishedFsCheck();
            });

            scanner.on('files', function(files) {
                if (stop) {
                    return finishedFsCheck();
                }
                files.forEach(insertOrUpdate);
                serverOffline = false;
                lastErrorOutput = null;
                processingStatus.total += files.length;
                if (chainLength > maxChainLength && scanner.isSuspended() === false) {
                    scanner.suspend();
                }
            });

            scanner.on('finish', function() {
                fetchPack().then(function() {
                    console.error('fetchpack done');
                    var p = new Promise();
                    modelInstance.fse_revision = revision;
                    modelInstance.save().done(function(err) {
                        if (err) {
                            return p.reject(err);
                        }
                        deps.database.query(
                            'DELETE FROM FSEntries WHERE ServerId=' + modelInstance.id + ' AND revision<' + revision + ';'
                        ).done(function(err) {
                            if (err) {
                                return p.reject(err);
                            }
                            p.resolve();
                        });
                    });
                    return p;
                }).then(function() {
                    if (change) {
                        process.send({ command: 'event', topic: 'fs-change' });
                    }
                    processingStatus = null;
                    resetFSCheckTime();
                }, resetFSCheckTime);
            });
        });

    }

    function periodicCheck() {
        var fstime = modelInstance.last_filelist_update;
        var checkinterval = deps.config.fs_check_interval * 60 * 1000;

        if (!fstime || fstime === null || fstime.getTime() + checkinterval < Date.now()) {
            checkFileList();
        }

        resetTimer();
    }

    function getScannerForServer(server) {
        //todo, update db
        var scanner = providerHelper.getScanner(server.type, deps);
        if (scanner) {
            return new scanner(server);
        } else {
            throw new Error('scanner for type ' + type + ' not found');
        }
    }

    periodicCheck();

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
            deps.database.get(function(err, models) {
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
    console.trace();
    console.error('exiting server worker due to exit');
    close();
});

process.on('uncaughtException', function(e) {
    console.error(e);
    if (e.stack) {
        console.error(e.stack);
    }
    console.trace();
    process.exit(1);
});

process.on('disconnect', function() {
    console.error('exiting server worker due to disconnect');
    close();
});
