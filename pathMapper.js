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

    api.getDirectoryContent = function(path) {
        var p = new Promise();

        startupPromise.then(function(models) {
            var parts = path.split('/');
            var basemap = pathmap;
            if (path !== '') {
                for (var idx = 0; idx < parts.length; idx++) {
                    var part = parts[idx];
                    if (!basemap.contents.hasOwnProperty(part)) {
                        return p.reject('Path not found');
                    } else {
                        basemap = basemap.contents[part];
                    }
                }
            }
            return p.resolve(basemap);
        });

        return p;
    };

    api.addEntry = function(fse) {
        var parts = fse.path.split('/');
        var basemap = pathmap;
        parts.forEach(function(part, idx) {
            if (!basemap.contents.hasOwnProperty(part)) {
                basemap.contents[part] = createFSEntry(idx === parts.length - 1 ? fse : undefined);
            }
            basemap = basemap.contents[part];
        });
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
        startupPromise.then(function(models) {
            models.FSEntry.findAll().success(function(fsentries) {
                pathmap = createFSEntry();
                fsentries.forEach(api.addEntry);
            });
        });
    };

    dependencies.eventBus.on('fs-add', api.addEntry);
    dependencies.eventBus.on('fs-del', api.delEntry);
    dependencies.eventBus.on('server-removed', api.reloadAllEntries);

    database(function(err, models) {
        models.FSEntry.findAll().success(function(fsentries) {
            fsentries.forEach(api.addEntry);
            startupPromise.resolve(models);
        });
    });

    return api;
};
