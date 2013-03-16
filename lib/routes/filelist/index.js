var util = require('../util.js');
var Promise = require('node-promise').Promise;
var when = require('node-promise').when;
var _ = require('lodash');

module.exports.apply = function(deps, app) {

    function getExtFromName(name) {
        var extstart = name.lastIndexOf('.');
        var ext = extstart === -1 ? '' : name.substring(extstart + 1, name.length);
        return ext;
    }

    function fseSortFunction(a, b) {
        return a.name.localeCompare(b.name);
    }

    function getServerIds(user) {
        var p = new Promise();

        user.getServers().success(function(servers) {
            servers = servers.map(function(s) {
                return s.id;
            });
            p.resolve(servers);
        }).error(function reject(err) {
            p.reject(err);
        });

        return p;
    }

    function includeOwnServerIds(user) {
        var p = new Promise();

        getServerIds(user).then(function(ids) {
            p.resolve({ include: ids });
        }, function(err) {
            p.reject(err);
        });

        return p;
    }

    function excludeOwnServerIds(user) {
        var p = new Promise();

        getServerIds(user).then(function(ids) {
            p.resolve({ exclude: ids });
        }, function(err) {
            p.reject(err);
        });

        return p;
    }

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
            deps.database.get(function(err, models) {
                models.Category.all().success(function(categories) {
                    res.render(
                        'filelist-download',
                        {
                            path: path,
                            categories: categories
                        },
                        function(err, content) {
                            res.json({ type: 'success', content: content});
                        }
                    );
                }).error(function() {
                    util.sendError(res, 'Invalid Request!');
                });
            });
        } else {
            util.sendError(res, 'Invalid Request!');
        }
    });

    app.post('/filelist/getDir', function(req, res) {
        if (req.body.dir !== undefined) {
            var dir = unescape(req.body.dir);
            dir = dir.length === 1 ? '' : dir.substring(1, dir.length - 1);

            var user = req.session.user;
            var words = req.body.searchWords || [];
            var range = [];
            var include = false;
            var exclude = false;

            if (req.body.range === 'own') {
                range = includeOwnServerIds(user);
            } else if (req.body.range === 'other') {
                range = excludeOwnServerIds(user);
            }

            var options = {
                searchWords: words
            };

            when(range, function(opts) {
                if (opts.hasOwnProperty('include') && opts.include.length === 0) {
                    return util.sendError(res, 'You don\'t have any servers.');
                }

                options = _.merge(options, opts);
                deps.pathMapper.getDirectoryContent(dir, options).then(function(fse) {
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
            });
        } else {
            res.end();
        }
    });

    app.post('/filelist/download-confirm', function(req, res) {
        if (req.body.hasOwnProperty('path') && req.body.hasOwnProperty('categoryId')) {
            var categoryId = parseInt(req.body.categoryId, 10);
            deps.database.get(function(err, models) {
                if (err) {
                    return util.sendError(res, err);
                }
                models.Category.find(categoryId).success(function(cat) {
                    models.Download.create({
                        path: req.body.path,
                        CategoryId: categoryId,
                        UserId: req.session.user.id,
                        progress: 0
                    }).success(function(download) {
                        deps.downloadManager.addDownload(download);
                        util.sendSuccess(res);
                    }).error(function(err) {
                        util.sendError(res, err);
                    });
                }).error(function(err) {
                    util.sendError(res, err);
                });
            });
        } else {
            util.sendError(res, 'Invalid Request!');
        }
    });
};
