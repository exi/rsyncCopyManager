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

vows.describe('serverQueue Token').addBatch({
    'A queue': {
        topic: new Queue(getDeps()),
        'when adding a Token': {
            topic: function(queue) {
                var this_ = this;
                var token = new Token(function() {
                    this_.callback(true);
                }, 1);
                queue.queue(1, token);
            },
            'should start it': function(done) {
                assert.isTrue(done);
            }
        }
    }
}).addBatch({
    'A queue': {
        topic: new Queue(getDeps()),
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
                            this_.callback(true);
                        }
                    };
                }

                var token = new Token(cb(1), 1);
                var token2 = new Token(cb(2), 1);
                queue.queue(1, token);
                queue.queue(1, token2);
            },
            'should start them': function(done) {
                assert.isTrue(done);
            }
        }
    }
}).addBatch({
    'A queue': {
        topic: new Queue(getDeps()),
        'when adding a weaker and a higher token': {
            topic: function(queue) {
                var firstRejected = false;
                var positionCorrect = false;
                var this_ = this;

                function cb(tid) {
                    return function() {
                        if (tid === 1) {
                            token.on('reject', function() {
                                firstRejected = true;
                            });
                        } else if (tid === 2) {
                            process.nextTick(function() {
                                this_.callback(firstRejected === true && positionCorrect === true);
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
            },
            'should start and reject the weaker and start the higher and notify position changes': function(done) {
                assert.isTrue(done);
            }
        }
    }
}).addBatch({
    'With deps': {
        topic: getDeps(),
        'a queue': {
            topic: function(deps) {
                return new Queue(deps);
            },
            'when removing a server': {
                topic: function(queue, deps) {
                    var this_ = this;
                    var reject1 = false;
                    var reject2 = false;

                    function check() {
                        if (reject1 === true && reject2 === true) {
                            this_.callback(true);
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
                },
                'should reject all tokens for that server': function(done) {
                    assert.isTrue(done);
                }
            }
        }
    }
}).export(module);
