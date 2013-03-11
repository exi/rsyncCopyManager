var database = require('./database.js');
var Promise = require('node-promise').Promise;
var configHelper = require('./configHelper.js');
var config = require('./config.js');
var _ = require('lodash');

configHelper.define({ key: 'pathmapperCacheSize', defaultValue: 1000 });

var pathmapper = module.exports = function(dependencies) {
    var api = {};
    var cache = [];
    var cacheSize = 30;

    function createFSEntry(stats) {
        return {
            contents: {},
            stats: stats
        };
    }

    function findCache(query) {
        var ret = null;
        cache.some(function(item) {
            if (item.query === query) {
                ret = item.result;
                return true;
            }
            return false;
        });
        return ret;
    }

    function addToCache(query, result) {
        if (cache.length >= config.pathmapperCacheSize) {
            cache.shift();
        }

        cache.push({
            query: query,
            result: result
        });
    }

    function clearCache() {
        cache = [];
    }

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

    api.getDirectoryContent = function(path, options) {
        var p = new Promise();

        options = _.merge({ searchWords: [], exclude: [], include: []}, options);

        database(function(err, models, sequelize) {
            var depth = path === '' ? 0 : path.split('/').length;

            var wheres = [database.format(['path LIKE ?', '' + path + '%'])];
            options.searchWords.forEach(function(word) {
                wheres.push(database.format(['path LIKE ?', '%' + word + '%']));
            });

            options.exclude.forEach(function(serverId) {
                wheres.push(database.format(['ServerId != ?', serverId]));
            });

            var incWheres = [];
            options.include.forEach(function(serverId) {
                incWheres.push(database.format(['ServerId = ?', serverId]));
            });
            wheres.push('(' + incWheres.join(' OR ') + ')');

            wheres.sort();

            var where = wheres.length > 0 ? 'WHERE ' + wheres.join(' AND ') : '';

            var query = 'SELECT SUBSTRING_INDEX(path, \'/\', ' + (depth + 1) + ') AS subpath, ' +
                '(LENGTH(path) - LENGTH(REPLACE(path, \'/\', \'\'))) as depth, ' +
                'id FROM `FSEntries` ' +
                where + ' GROUP BY subpath;';
            var fromCache = findCache(query);

            if (fromCache !== null) {
                p.resolve(fromCache);
            } else {
                sequelize.query(query, null, { raw: true }).done(
                    function(err, data) {
                        if (err) {
                            return p.reject(err);
                        }
                        var ids = [];
                        var fses = [];
                        data.forEach(function(row) {
                            if (row.depth < (depth + 1)) {
                                ids.push(row.id);
                            } else {
                                fses.push({
                                    path: row.subpath,
                                    isDir: true,
                                    size: 0
                                });
                            }
                        });
                        models.FSEntry.findAll({
                            where: {
                                id: ids
                            }
                        }).done(function(err, entries) {
                            if (err) {
                                return p.reject(err);
                            }
                            var result = getContent(buildTree(fses.concat(entries)), path);
                            addToCache(query, result);
                            p.resolve(result);
                        });
                    }
                );
            }
        });

        return p;
    };

    dependencies.eventBus.on('fs-change', clearCache);
    dependencies.eventBus.on('server-removed', clearCache);

    return api;
};
