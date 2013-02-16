var rsync = require('./rsync');
var database = require('./database.js');
var config = require('./config.js');

var Server = module.exports = function(modelInstance) {
    console.log('create server instance');
    console.log(require('util').inspect(modelInstance));

    var api = {};
    var stop = false;
    var checkTimer;
    var fsCheckInProgress = false;
    var consolePrefix = modelInstance.hostname + ': ';

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

    api.close = function() {
        console.log('closing server ' + modelInstance.id);
        stop = true;
    };

    function resetFSCheckTime() {
        modelInstance.last_filelist_update = new Date();
        modelInstance.save().success(function() {
            fsCheckInProgress = false;
        }).error(function() {
            fsCheckInProgress = false;
        });
    }

    function checkFileList() {
        if (fsCheckInProgress) {
            return;
        }

        console.log('checking files for server: ' + modelInstance.hostname);
        fsCheckInProgress = true;
        var r = new rsync.filelist({
            keyfile: config.keyfile,
            username: modelInstance.username,
            host: modelInstance.hostname,
            src: modelInstance.path
        });

        r.on('error', function(err) {
            console.error(consolePrefix + ' fscheck failed:');
            console.error(err);
            fsCheckInProgress = false;
        });

        r.on('finish', function(filelist) {
            console.log(consolePrefix + 'filelist');

            database(function(err, models) {
                if (err) {
                    console.error(err);
                    fsCheckInProgress = false;
                    return;
                }

                var paths = [];
                filelist.forEach(function(fse) {
                    paths.push(fse.path);
                });

                modelInstance.getFSEntries().success(function(matches) {
                    var fsentries = matches;
                    var pathmap = {};
                    var added = 0;

                    matches.forEach(function(fse) {
                        pathmap[fse.path] = fse;
                    });

                    filelist.forEach(function(fse) {
                        if (!pathmap.hasOwnProperty(fse.path.trim())) {
                            console.log('add ' + fse.path + ' ' + pathmap[fse.path.trim()]);
                            added += 1;
                            fsentries.push(models.FSEntry.build(fse));
                        } else {
                            delete pathmap[fse.path];
                        }
                    });


                    var chain = new database.chain();
                    for (var m in pathmap) {
                        if (pathmap.hasOwnProperty(m)) {
                            console.log('del ' + pathmap[m].path);
                            chain.add(pathmap[m].destroy());
                        }
                    }

                    if (added > 0) {
                        chain.add(modelInstance.setFSEntries(fsentries));
                    }

                    chain.run().success(function() {
                        resetFSCheckTime();
                    }).error(function() {
                        fsCheckInProgress = false;
                    });
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
