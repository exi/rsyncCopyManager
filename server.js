var rsync = require('./rsync');
var database = require('./database.js');
var config = require('./config.js');
var Promise = require('node-promise').Promise;
var All = require('node-promise').all;

var Server = module.exports = function(dependencies, modelInstance) {

    var api = {};
    var stop = false;
    var checkTimer;
    var fsCheckInProgress = false;
    var consolePrefix = modelInstance.hostname + ': ';
    var checkFileListPromise = null;
    var waitForClose = false;

    function resetTimer() {
        stopTimer();
        if (stop) {
            return;
        }
        checkTimer = setTimeout(periodicCheck, 1000);
    }

    function stopTimer() {
        clearTimeout(checkTimer);
    }

    function setStopIndicators() {
        console.log('closing server ' + modelInstance.id);
        stopTimer();
        stop = true;
        waitForClose = true;
    }

    api.closeAndDelete = function() {
        var p = new Promise();

        api.close().then(function() {
            modelInstance.getFSEntries().success(function(fses) {
                var chain = new database.chain();
                fses.forEach(function(fse) {
                    chain.add(fse.destroy());
                });
                chain.run().success(function() {
                    modelInstance.destroy().success(function() {
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

        var promises = [];
        if (checkFileListPromise !== null) {
            promises.push(checkFileListPromise);
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

        p.resolve(status);
        return p;
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
        modelInstance.save().success(function() {
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

        var r = new rsync.filelist({
            keyfile: config.keyfile,
            username: modelInstance.username,
            host: modelInstance.hostname,
            src: modelInstance.path
        });

        r.on('error', function(err) {
            console.error(consolePrefix + ' fscheck failed:');
            console.error(err);
            finishedFsCheck();
        });

        r.on('finish', function(filelist) {
            console.log(consolePrefix + 'filelist');

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

                console.log('my instance: ' + modelInstance.id);
                modelInstance.getFSEntries().success(function(matches) {
                    var fsentries = matches;
                    var pathmap = {};

                    matches.forEach(function(fse) {
                        pathmap[fse.path] = fse;
                    });

                    var promises = [];

                    filelist.forEach(function(fse) {
                        if (!pathmap.hasOwnProperty(fse.path.trim())) {
                            console.log('add ' + fse.path);
                            var entry = models.FSEntry.build(fse);
                            var p = new Promise();
                            promises.push(p);
                            entry.save().success(function(entry) {
                                entry.setServer(modelInstance).success(function(fse) {
                                    dependencies.eventBus.emit('fs-add', fse);
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
                                s.destroy().success(function() {
                                    p.resolve();
                                    console.log('del ' + path);
                                    dependencies.eventBus.emit('fs-del', path);
                                });
                            })(pathmap[m], pathmap[m].path);
                        }
                    }

                    All(promises).then(resetFSCheckTime, resetFSCheckTime);
                });
            });
        });
    }

    function periodicCheck() {
        var fstime = modelInstance.last_filelist_update;
        var checkintervall = config.fs_check_interval * 60 * 1000;

        if (!fstime || fstime === null || fstime.getTime() + checkintervall < Date.now()) {
            checkFileList();
        }

        resetTimer();
    }

    resetTimer();

    return api;
};
