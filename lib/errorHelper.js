var util = require('util');

module.exports.customError = function(name) {
    var E = function (msg) {
        Error.captureStackTrace(this, E);
        this.message = msg || 'Error';
    };
    util.inherits(E, Error);
    E.prototype.name = name;
    return E;
};
