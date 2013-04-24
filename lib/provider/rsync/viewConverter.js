var Promise = require('node-promise').Promise;
var Model = require('./model.js');

module.exports = function(deps) {
    var model = Model(deps);
    var viewConverter = function(server) {
        var p = new Promise();

        function efun(err) {
            p.reject(err);
        }

        model.getInfo(server.id).then(function(infos) {
            p.resolve(infos);
        }, efun);

        return p;
    };

    return viewConverter;
};
