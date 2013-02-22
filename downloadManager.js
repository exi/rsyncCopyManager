var database = require('./database.js');
var Download = require('./download.js');
var Promise = require('node-promise').Promise;
var rsync = require('./rsync');

var DownloadManager = module.exports = function(dependencies) {
    var downloads = {};
    var api = {};

    api.addDownload = function(model) {
        if (model && model.id) {
            downloads[model.id] = {
                model: model,
                manager: new Download(dependencies, model)
            };
        }
    };

    api.delDownload = function(downloadId) {
        var p = new Promise();

        if (downloads.hasOwnProperty(downloadId)) {
            var download = downloads[downloadId].manager;
            download.closeAndDelete().then(function() {
                delete downloads[downloadId];
                console.log('download removed');
                p.resolve();
            });
        } else {
            p.resolve();
        }

        return p;
    };

    api.getDownloadStatus = function(downloadId) {
        var p = new Promise();
        if (downloads.hasOwnProperty(downloadId)) {
            downloads[downloadId].manager.getStatus().then(function(status) {
                p.resolve(status);
            });
        } else {
            p.reject('Download not active.');
        }

        return p;
    };

    api.close = function() {
        for (var i in downloads) {
            downloads[i].close();
        }
    };

    database(function(err, models) {
        if (err) {
            throw err;
        }

        models.Download.all().success(function(s) {
            s.forEach(api.addDownload);
        });
    });
    return api;
};

