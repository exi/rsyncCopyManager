var vows = require('vows'),
    assert = require('assert'),
    eventEmitter = require('events').EventEmitter,
    database = require('../database.js'),
    configHelper = require('../configHelper.js');

function getDb() {
    var deps =  {
        config: require('../../testconfig.js'),
        eventBus: new eventEmitter()
    };

    deps.configHelper = new configHelper(deps);
    deps.database = new database(deps);
    return deps.database;
}

vows.describe('Database').addBatch({
    'Dependencies should contain a database': {
        topic: getDb(),
        'which returns': {
            topic: function(db) {
                var this_ = this;
                db.get(function() {
                    this_.callback.apply(this, arguments);
                });
            },
            'no error': function(err, models) {
                assert.isNull(err);
            },
            'models': function(err, models) {
                assert.isObject(models);
            }
        },
        'which has a query function': function(db) {
            assert.isFunction(db.query);
        },
        'which has working custom queries': {
            topic: function(db) {
                var this_ = this;
                db.get(function(err, models) {
                    db.query('SELECT * FROM Servers LIMIT 1').done(this_.callback);
                });
            },
            'that do not return errors': function(err, data) {
                assert.isNull(err);
            },
            'that return data': function(err, data) {
                assert.isArray(data);
            }
        }
    }
}).export(module);
