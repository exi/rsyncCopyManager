var database = require('../../database.js');
var util = require('../util.js');

module.exports.apply = function(dependencies, app) {
    app.post('/filelist', function(req, res) {
        res.render(
            'filelist',
            function(err, content) {
                res.json({content: content});
            }
        );
    });

    app.post('/filelist/download', function(req, res) {
        if (req.body.path !== undefined) {
            var path = req.body.path;
            res.render(
                'filelist-download',
                { path: path },
                function(err, content) {
                    res.json({ type: 'success', content: content});
                }
            );
        } else {
            res.render(
                'error-box',
                { message: 'Invalid request!' },
                function(err, content) {
                    res.json({ type: 'error', content: content});
                }
            );
        }
    });

    function getExtFromName(name) {
        var extstart = name.lastIndexOf('.');
        var ext = extstart === -1 ? '' : name.substring(extstart + 1, name.length);
        return ext;
    }

    function fseSortFunction(a, b) {
        return a.name.localeCompare(b.name);
    }

    app.post('/filelist/getDir', function(req, res) {
        if (req.body.dir !== undefined) {
            var dir = unescape(req.body.dir);
            dir = dir.length === 1 ? '' : dir.substring(1, dir.length - 1);
            var words = req.body.searchWords || [];
            dependencies.pathMapper.getDirectoryContent(dir, words).then(function(fse) {
                var dirs = [];
                var files = [];
                for (var name in fse.contents) {
                    var item = fse.contents[name];
                    if (item.stats) {
                        if (item.stats.isDir) {
                            dirs.push({
                                name: name,
                                rel: '/' + item.stats.path + '/',
                                path: item.stats.path
                            });
                        } else {
                            files.push({
                                name: name,
                                rel: '/' + item.stats.path,
                                ext: getExtFromName(name),
                                path: item.stats.path,
                                size: util.convertToHumanReadableSize(item.stats.size)
                            });
                        }
                    }
                }

                dirs.sort(fseSortFunction);
                files.sort(fseSortFunction);

                res.render('filelist-tree', { dirs: dirs, files: files });
            }, function(err) {
                res.end(err);
            });
        } else {
            res.end();
        }
    });

    app.post('/filelist/download-confirm', function(req, res) {
        if (req.body.path !== undefined) {
            database(function(err, models) {
                models.Download.create({
                    path: req.body.path,
                    progress: 0
                }).success(function(download) {
                    download.setUser(req.session.user).success(function(download) {
                        dependencies.downloadManager.addDownload(download);
                        util.sendSuccess(res);
                    }).error(function(err) {
                        download.destroy().success(function() {
                            util.sendError(res, err);
                        }).error(function() {
                            util.sendError(res, err);
                        });
                    });
                });
            });
        } else {
            res.end();
        }
    });
};
