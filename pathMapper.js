var database = require('./database.js');
var Promise = require('node-promise').Promise;

var pathmapper = module.exports = function(dependencies) {

    var api = {};
    var startupPromise = new Promise();

    function createFSEntry(stats) {
        return {
            contents: {},
            stats: stats
        };
    }

    var pathmap = createFSEntry();

    function buildTree(fsentries) {
        var root = createFSEntry();
        fsentries.forEach(function(fse) {
            addEntry(root, fse);
        });
        return root;
    }

    function addEntry(root, fse) {
        var parts = fse.path.split('/');
        var basemap = root;
        parts.forEach(function(part, idx) {
            if (!basemap.contents.hasOwnProperty(part)) {
                var stats;
                if (idx === parts.length - 1) {
                    stats = fse;
                } else {
                    stats = {
                        isDir: true,
                        size: 0,
                        path: parts.slice(0, idx + 1).join('/')
                    };
                }

                basemap.contents[part] = createFSEntry(stats);
            }
            basemap = basemap.contents[part];
        });
        return root;
    }

    function getContent(root, path) {
        var parts = path.split('/');
        var basemap = root;
        if (path !== '') {
            for (var idx = 0; idx < parts.length; idx++) {
                var part = parts[idx];
                if (!basemap.contents.hasOwnProperty(part)) {
                    return null;
                } else {
                    basemap = basemap.contents[part];
                }
            }
        }
        return basemap;
    }

    api.getDirectoryContent = function(path, searchWords) {
        var p = new Promise();
        searchWords = searchWords || [];

        startupPromise.then(function(models) {
            if (searchWords.length === 0) {
                var ret = getContent(pathmap, path);
                if (ret === null) {
                    return p.reject('Path not found');
                }
                return p.resolve(ret);
            } else {
                var where = [];
                var clauses = [];
                var replacements = [];
                searchWords.forEach(function(word) {
                    clauses.push('path LIKE ?');
                    replacements.push('%' + word + '%');
                });

                where = [clauses.join(' AND ')].concat(replacements);

                models.FSEntry.findAll({
                    where: where
                }).done(function(err, fsentries) {
                    if (err) {
                        return p.reject(err);
                    }

                    var ret = getContent(buildTree(fsentries), path);
                    if (ret === null) {
                        return p.reject('Path not found');
                    }
                    p.resolve(ret);
                });
            }
        });

        return p;
    };

    api.addEntry = function(fse) {
        pathmap = addEntry(pathmap, fse);
    };

    api.delEntry = function(path) {
        var parts = path.split('/');
        var basemap = pathmap;
        if (path !== '') {
            for (var idx = 0; idx < parts.length; idx++) {
                var part = parts[idx];
                if (!basemap.contents.hasOwnProperty(part)) {
                    return;
                } else if (idx === parts.length - 1) {
                    delete basemap.contents[part];
                } else {
                    basemap = basemap.contents[part];
                }
            }
        }
    };

    api.reloadAllEntries = function() {
        console.log('pm reload');
        startupPromise.then(function(models) {
            models.FSEntry.findAll().success(function(fsentries) {
                pathmap = createFSEntry();
                fsentries.forEach(api.addEntry);
            });
        });
    };

    dependencies.eventBus.on('fs-change', api.reloadAllEntries);
    dependencies.eventBus.on('server-removed', api.reloadAllEntries);

    database(function(err, models) {
        models.FSEntry.findAll().success(function(fsentries) {
            pathmap = buildTree(fsentries);
            startupPromise.resolve(models);
        });
    });

    return api;
};
