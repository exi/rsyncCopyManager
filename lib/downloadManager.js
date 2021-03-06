var Download = require('./download.js');
var Promise = require('node-promise').Promise;
var exec = require('child_process').exec;

var DownloadManager = module.exports = function(deps) {
    deps.configHelper.define({ key: 'downloadDir', dirMustExist: true, defaultValue: __dirname + '/../download' });

    var downloads = {};
    var api = {};
    var spaceLeft = 0;
    var spaceQueryTimer;

    api.addDownload = function(model) {
        if (model && model.id) {
            downloads[model.id] = {
                model: model,
                manager: new Download(deps, model)
            };
        } else {
            console.error('could not add download, missing model or model ID');
        }
    };

    api.delDownload = function(downloadId, deleteData) {
        var p = new Promise();

        if (downloads.hasOwnProperty(downloadId)) {
            var download = downloads[downloadId].manager;
            download.closeAndDelete(deleteData).then(function() {
                delete downloads[downloadId];
                console.error('download removed');
                p.resolve();
            }, function(err) {
                p.reject(err);
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
            p.reject({message: 'Download with not active.'});
        }

        return p;
    };

    api.close = function() {
        for (var i in downloads) {
            downloads[i].manager.close();
        }
    };

    api.getSpaceLeft = function() {
        var p = new Promise();
        p.resolve(spaceLeft);
        return p;
    };

    function updateSpace() {
        exec('df -PBK "' + deps.config.downloadDir + '" | tail -n1', function(err, stdout, stderr) {
            if (!err) {
                var regex = /[^ ]+\s+[^ ]+\s+[^ ]+\s+([^ ]+)\s+[^ ]/;
                var m = regex.exec(stdout);
                if (null !== m) {
                    spaceLeft = parseInt(m[1], 10) * 1024;
                }
            }
            spaceQueryTimer = setTimeout(updateSpace, 1000 * 120);
        });
    }

    updateSpace();

    deps.database.get(function(err, models) {
        if (err) {
            throw err;
        }

        models.Download.all().success(function(s) {
            s.sort(function(a, b) {
                return a.id - b.id;
            });
            s.forEach(api.addDownload);
        });
    });
    return api;
};

