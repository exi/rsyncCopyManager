var Promise = require('node-promise').Promise;

module.exports = function(deps) {
    var Model = function() {
        var api = {
            addServer: function(serverInstance, options) {
                var p = new Promise();
                function efun(msg) {
                    p.reject(new Error(msg));
                }

                var valid = true;

                if (!options) {
                    return efun('No options given!');
                }

                if (!options.username) {
                    return efun('No username given!');
                }

                if (!options.hostname) {
                    return efun('No hostname given!');
                }

                if (!options.path) {
                    return efun('No path given!');
                }

                var path = options.path.trim();
                if (path.slice(0, -1) !== '/') {
                    path += '/';
                }

                deps.database.get(function(err, models) {
                    if (err) {
                        return efun(err);
                    }

                    models.Rsync.create({
                        hostname: options.hostname,
                        username: options.username,
                        path: path,
                        ServerId: serverInstance.id,
                        type: serverInstance.type
                    }).success(function() {
                        p.resolve();
                    }).error(efun);
                });

                return p;
            },
            getInfo: function(serverId) {
                var p = new Promise();

                function efun(err) {
                    p.reject(err);
                    return p;
                }

                deps.database.get(function(err, models) {
                    if (err) {
                        return efun(err);
                    }
                    models.Rsync.find({ where: { ServerId: serverId } }).success(function(rsync) {
                        if (!rsync) {
                            return efun('Rsync record not found!');
                        }
                        p.resolve({
                            username: rsync.username,
                            hostname: rsync.hostname,
                            path: rsync.path
                        });
                    }).error(efun);
                });
                return p;
            }
        };

        return api;
    };

    return new Model(deps);
};
