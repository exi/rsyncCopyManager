var fs = require('fs');
var fsHelper = require('./fsHelper.js');

function getActiveRecordProviders() {
    var providerDirs = [__dirname];
    var providerBase = __dirname + '/provider/';
    providerDirs = providerDirs.concat(fs.readdirSync(providerBase).map(function(dir) {
        return providerBase + dir;
    }));
    var providers = [];
    providerDirs.forEach(function(dir) {
        var path = dir + '/activeRecord';
        var wireScript = dir + '/dbWire.js';
        var item = {};
        if (fsHelper.isDirAndExist(path)) {
            item.path = path;
            item.wireScript = fsHelper.isFileAndExist(wireScript) ? wireScript : null;
            providers.push(item);
        }
    });

    return providers;
}

module.exports = function(deps) {
    deps.configHelper.defineMultiple(
        [
            { key: 'db.name' },
            { key: 'db.user' },
            { key: 'db.password' },
            { key: 'db.host' },
            { key: 'db.logging', defaultValue: false }
        ]
    );

    var config = deps.config;

    var sequelize = new (require('sequelize'))(config.db.name, config.db.user, config.db.password, {
        host: config.db.host,
        logging: config.db.logging,
        omitNull: true
    });

    var models = {};
    var activeRecordProviders = getActiveRecordProviders();
    activeRecordProviders.forEach(function(prov) {
        var modelFiles = fs.readdirSync(prov.path);
        modelFiles.forEach(function(file) {
            if (/\.js$/.test(file)) {
                var stripped = file.slice(0, -3);
                var file = prov.path + '/' + stripped;
                console.log('load model file ' + file);
                models[stripped] = sequelize.import(file);
            }
        });
    });
    activeRecordProviders.forEach(function(prov) {
        if (prov.wireScript) {
            console.log('load model wire script ' + prov.wireScript);
            require(prov.wireScript)(models);
        }
    });

    var synced = false;
    var syncing = false;
    var cbs = [];

    return {
        get: function(cb) {
            if (!synced) {
                cbs.push(cb);
                if (!syncing) {
                    syncing = true;
                    sequelize.sync().success(function() {
                        synced = true;
                        cbs.forEach(function(cb) {
                            cb(null, models, sequelize);
                        });
                    }).error(function(err) {
                        cb(err);
                    });
                }
            } else {
                cb(null, models, sequelize);
            }
        },
        chain: require('sequelize').Utils.QueryChainer,
        format: require('sequelize').Utils.format,
        query: function() {
            return sequelize.query.apply(sequelize, arguments);
        }
    };
};
