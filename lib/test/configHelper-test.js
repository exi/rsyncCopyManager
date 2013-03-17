var vows = require('vows'),
    assert = require('assert'),
    configHelper = require('../configHelper.js');

vows.describe('configHelper').addBatch({
    'If a field is missing': {
        topic: new configHelper({ config: { } }),
        'it should throw if it is required': function(helper) {
            assert.throws(function() {
                helper.define({ key: 'r' });
            }, configHelper.KeyMissingError);
        },
        'it should not throw if it is required and has a default value': function(helper) {
            assert.doesNotThrow(function() {
                helper.define({ key: 'r', defaultValue: 4 });
            }, configHelper.KeyMissingError);
        },
        'it should not throw if it is not required': function(helper) {
            assert.doesNotThrow(function() {
                helper.define({ key: 'r', required: false });
            }, configHelper.KeyMissingError);
        },
        'it should not throw if it is not required and has multiple levels': function(helper) {
            assert.doesNotThrow(function() {
                helper.define({ key: 'r.fancykey', required: false });
            }, configHelper.KeyMissingError);
        }
    },
    'If a required file is missing': {
        topic: new configHelper({ config: { missingFile: 'myfile' } }),
        'it should throw': function(helper) {
            assert.throws(function() {
                helper.define({ key: 'missingFile', fileMustExist: true });
            }, configHelper.FileNotFoundError);
        }
    },
    'If a required file is present': {
        topic: new configHelper({ config: { presentFile: __filename } }),
        'it should not throw': function(helper) {
            assert.doesNotThrow(function() {
                helper.define({ key: 'presentFile', fileMustExist: true });
            }, configHelper.FileNotFoundError);
        }
    },
    'If a required directory is missing': {
        topic: new configHelper({ config: { missingDir: 'mydir' } }),
        'it should throw': function(helper) {
            assert.throws(function() {
                helper.define({ key: 'missingDir', dirMustExist: true });
            }, configHelper.DirectoryNotFoundError);
        }
    },
    'If a required directory is present': {
        topic: new configHelper({ config: { presentDir: __dirname } }),
        'it should throw': function(helper) {
            assert.doesNotThrow(function() {
                helper.define({ key: 'presentDir', dirMustExist: true });
            }, configHelper.DirectoryNotFoundError);
        }
    },
    'If it has a default value': {
        topic: function() {
            var config = {};
            var ch = new configHelper({ config: config });
            ch.define({ key: 'r.fancykey', defaultValue: 4 });
            return config;
        },
        'it should create multi level config structures': function(config) {
            assert.isObject(config.r);
            assert.strictEqual(config.r.fancykey, 4);
        }
    }
}).export(module);
