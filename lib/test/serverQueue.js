var vows = require('vows'),
    assert = require('assert'),
    eventEmitter = require('events').EventEmitter,
    Queue = require('../serverQueue.js').Queue,
    Token = require('../serverQueue.js').Token;

var deps = {
    eventBus: new eventEmitter()
};

vows.describe('serverQueue Token').addBatch({
    'A queue': {
        topic: new Queue(deps),
        'when adding a Token': {
            topic: function(queue) {
                var token = new Token(this.callback, 1);
                queue.queue(1, token);
            },
            'should start it': function() {

            }
        }
    }
}).addBatch({
    'A queue': {
        topic: new Queue(deps),
        'when adding two equal Tokens': {
            topic: function(queue) {
                var starts = 0;
                var this_ = this;

                function cb(tid) {
                    return function() {
                        starts++;
                        if (tid === 1) {
                            token.emit('finished');
                        }
                        if (tid === 2) {
                            token2.emit('finished');
                        }
                        if (starts === 2) {
                            this_.callback();
                        }
                    };
                }

                var token = new Token(cb(1), 1);
                var token2 = new Token(cb(2), 1);
                queue.queue(1, token);
                queue.queue(1, token2);
            },
            'should start them': function() {

            }
        }
    }
}).export(module);
