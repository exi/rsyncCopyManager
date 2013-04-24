var Promise = require('node-promise').Promise;
var fs = require('fs');

module.exports = function(deps) {
    var Loader = function() {
        var p = new Promise();
        p.resolve({
            pubkey: fs.readFileSync(deps.config.pubkeyfile)
        });
        return p;
    };

    return new Loader();
};
