module.exports = {
    getProvider: function(type) {
        try {
            var p = require('./provider/' + type);
            return p;
        } catch (e) {
            return null;
        }
    }
};
