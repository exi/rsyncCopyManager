var vows = require('vows'),
    assert = require('assert'),
    eventEmitter = require('events').EventEmitter,
    Queue = require('../serverQueue.js').Queue,
    Token = require('../serverQueue.js').Token;

function getDeps() {
    return {
        eventBus: new eventEmitter()
    };
}

vows.describe('serverQueue').addBatch({
    'When adding a Token': {
        topic: function() {
            var this_ = this;
            var emitter = new eventEmitter();
            var queue = new Queue(getDeps());
            var token = new Token(function() {
                emitter.emit('success', true);
            }, 1);

            queue.queue(1, token);

            return emitter;
        },
        'should start it': function(done) {
            assert.isTrue(done);
        }
    },
    'When adding two equal Tokens': {
        topic: function() {
            var this_ = this;
            var starts = 0;
            var running = false;
            var doublerun = false;
            var emitter = new eventEmitter();
            var queue = new Queue(getDeps());

            function cb(tid) {
                return function() {
                    starts++;
                    doublerun = doublerun || running === true;
                    running = true;

                    process.nextTick(function() {
                        if (tid === 1) {
                            running = false;
                            token.emit('finished');
                        }

                        if (tid === 2) {
                            running = false;
                            token2.emit('finished');
                        }

                        if (starts === 2) {
                            return emitter.emit('success', doublerun === false);
                        }
                    });
                };
            }

            var token = new Token(cb(1), 1);
            var token2 = new Token(cb(2), 1);

            queue.queue(1, token);
            queue.queue(1, token2);

            return emitter;
        },
        'should start them in order': function(done) {
            assert.isTrue(done);
        }
    },
    'When adding a weaker and a higher token': {
        topic: function() {
            var this_ = this;
            var firstRejected = false;
            var positionCorrect = false;
            var emitter = new eventEmitter();
            var queue = new Queue(getDeps());

            function cb(tid) {
                return function() {
                    if (tid === 1) {
                        token.on('reject', function() {
                            firstRejected = true;
                        });
                    } else if (tid === 2) {
                        process.nextTick(function() {
                            emitter.emit('success', firstRejected === true && positionCorrect === true);
                        });
                    }
                };
            }

            var token = new Token(cb(1), 2);
            var token2 = new Token(cb(2), 1);
            var token3 = new Token(cb(3), 3);

            token3.on('position-change', function(pos) {
                positionCorrect = pos === 1;
            });

            queue.queue(1, token);
            queue.queue(1, token2);
            queue.queue(1, token3);

            return emitter;
        },
        'should start and reject the weaker and start the higher and notify position changes': function(done) {
            assert.isTrue(done);
        }
    },
    'When removing a server': {
        topic: function() {
            var this_ = this;
            var reject1 = false;
            var reject2 = false;
            var deps = getDeps();
            var emitter = new eventEmitter();
            var queue = new Queue(deps);

            function check() {
                if (reject1 === true && reject2 === true) {
                    emitter.emit('success', true);
                }
            }

            var dummy = function() { };
            var token = new Token(dummy, 1);
            var token2 = new Token(dummy, 2);

            token.on('reject', function() {
                reject1 = true;
                check();
            });

            token2.on('reject', function() {
                reject2 = true;
                check();
            });

            queue.queue(1, token);
            queue.queue(1, token2);

            process.nextTick(function() {
                deps.eventBus.emit('server-removed', 1);
            });

            return emitter;
        },
        'should reject all tokens for that server': function(done) {
            assert.isTrue(done);
        }
    }
}).export(module);
