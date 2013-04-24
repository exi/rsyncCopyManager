var Promise = require('node-promise').Promise;

module.exports = {
    getProvider: function(type) {
        try {
            var p = require('./provider/' + type);
            return p;
        } catch (e) {
            return null;
        }
    },
    getModel: function(type, deps) {
        var provider = this.getProvider(type);
        if (!provider || !provider.hasOwnProperty('model')) {
            return null;
        }
        return provider.model(deps);
    },
    getScanner: function(type, deps) {
        var provider = this.getProvider(type);
        if (!provider || !provider.hasOwnProperty('scanner')) {
            return null;
        }
        return provider.scanner(deps);
    },
    getDownloader: function(type, deps) {
        var provider = this.getProvider(type);
        if (!provider || !provider.hasOwnProperty('downloader')) {
            return null;
        }
        return provider.downloader(deps);
    },
    getFormData: function(type, deps) {
        var p = new Promise();
        var provider = this.getProvider(type);
        if (!provider || !provider.hasOwnProperty('formDataLoader')) {
            p.resolve({});
            return p;
        }
        return provider.formDataLoader(deps);
    },
    convertServerForView: function(type, deps, server) {
        var provider = this.getProvider(type);
        if (!provider || !provider.hasOwnProperty('viewConverter')) {
            return null;
        }
        var convert = provider.viewConverter(deps);
        return convert(server);
    }
};
