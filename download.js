var database = require('./database.js');
var rsync = require('./rsync');
var Promise = require('node-promise').Promise;
var All = require('node-promise').all;
var config = require('./config.js');
var fs = require('fs');
var wrench = require('wrench');

var Download = module.exports = function(dependencies, modelInstance) {
    var api = {};
    var startupPromise = new Promise();
    var downloading = false;
    var serverOffline = false;
    var downloadStatus = null;
    var complete = false;
    var process;
    var stop = false;
    var exitPromise;
    var downloadTimer;

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

            if (serverOffline) {
                status.serverOffline = true;
            }

            if (complete) {
                status.complete = true;
            }

            p.resolve(status);
        });

        return p;
    };

    api.closeAndDelete = function() {
        stop = true;

        var p = new Promise();
        var deletePromise = new Promise();

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
                var stat = fs.statSync(completepath);

                if (stat.isDirectory()) {
                    wrench.rmdirSyncRecursive(completepath, true);
                } else if (stat.isFile()) {
                    fs.unlink(completepath);
                }

                p.resolve();
            });
        });

        return p;
    };

    function download(server) {
        if (stop) {
            return stopDownload();
        }

        console.log('starting download');
        exitPromise = new Promise();
        process = new rsync.download({
            keyfile: config.keyfile,
            username: server.username,
            host: server.hostname,
            src: server.path + '/' + modelInstance.path,
            dest: config.downloadDir + '/'
        });

        process.on('progress', function(data) {
            serverOffline = false;
            downloadStatus = data;
            modelInstance.progress = data.progress;
            modelInstance.save();
            console.log('progress');
            console.log(data);
        });

        process.on('finish', function() {
            complete = true;
            stopDownload();
            console.log('finished');
            downloadStatus.rate = 0;
            downloadStatus.percent = 100;
            modelInstance.progress = 100;
            modelInstance.complete = 1;
            modelInstance.save();
            process = null;
            exitPromise.resolve();
            exitPromise = null;
        });

        process.on('error', function(code) {
            console.log('got error ' + code);
            serverOffline = true;
            stopDownload();
            process = null;
            exitPromise.resolve();
            exitPromise = null;
            resetDownloadTimer();
        });
    }

    function resetDownloadTimer() {
        if (complete) {
            return;
        }

        clearTimeout(downloadTimer);
        downloadtimer = setTimeout(startDownload, 10000);
    }

    function stopDownload() {
        downloading = false;
    }

    function startDownload() {
        if (stop) {
            return;
        }
        startupPromise.then(function(models) {
            if (downloading === false) {
                downloading = true;
                models.FSEntry.find({
                    where: {
                        path: modelInstance.path
                    }
                }).success(function(fse) {
                    if (stop) {
                        return stopDownload();
                    }
                    fse.getServer().success(function(server) {
                        download(server);
                    }).error(function() {
                        console.log('Server not found');
                        return stopDownload();
                    });
                }).error(function() {
                    console.log('path not found');
                    return stopDownload();
                });
            }
        });
    }

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
    } else {
        complete = true;
    }

    return api;
};
