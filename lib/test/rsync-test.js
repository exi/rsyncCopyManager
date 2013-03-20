var vows = require('vows'),
    assert = require('assert'),
    rsync = require('../rsync.js'),
    eventEmitter = require('events').EventEmitter,
    wrench = require('wrench'),
    path = require('path'),
    configHelper = require('../configHelper.js');

function getDeps(limited) {
    var configpath = path.normalize(__dirname + '/../../testconfig.js');

    if (require.cache.hasOwnProperty(configpath)) {
        delete require.cache[configpath];
    }

    var config = require(configpath);

    var deps = {
        config: config
    };

    if (limited) {
        deps.config.rsync = {
            maxDepth: 3
        };
    }

    deps.configHelper = new configHelper(deps);
    return deps;
}

function cleanDownloadFiles() {
    try {
        wrench.rmdirSyncRecursive(__dirname + '/testDir2/testDir');
    } catch (err) {
        //ignore
    }
}

var demoDirContent = [
    {
        isDir: true,
        size: -1,
        path: 'testDir'
    },
    {
        isDir: false,
        size: 0,
        path: 'testDir/.keep'
    },
    {
        isDir: false,
        size: 6,
        path: 'testDir/test1'
    },
    {
        isDir: false,
        size: 100000,
        path: 'testDir/test2'
    },
    {
        isDir: true,
        size: -1,
        path: 'testDir/1'
    },
    {
        isDir: true,
        size: -1,
        path: 'testDir/1/2'
    },
    {
        isDir: true,
        size: -1,
        path: 'testDir/1/2/3'
    }
];

var demoDirContentDepth = [
    {
        isDir: true,
        size: -1,
        path: 'testDir'
    },
    {
        isDir: false,
        size: 0,
        path: 'testDir/.keep'
    },
    {
        isDir: false,
        size: 6,
        path: 'testDir/test1'
    },
    {
        isDir: false,
        size: 100000,
        path: 'testDir/test2'
    },
    {
        isDir: true,
        size: -1,
        path: 'testDir/1'
    },
    {
        isDir: true,
        size: -1,
        path: 'testDir/1/2'
    }
];

vows.describe('Rsync').addBatch({
    'Missing options': {
        topic: new rsync(getDeps()),
        'should throw': function(rsync) {
            assert.throws(function() {
                var l = new rsync.filelist({});
            }, rsync.MissingOptionError);
        }
    },
    'Directory listings': {
        topic: function () {
            var this_ = this;
            var deps = getDeps();
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var l = new r.filelist({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                keyfile: deps.config.keyfile
            });

            var filelist = [];
            l.on('files', function(files) {
                filelist = filelist.concat(files);
            });

            l.on('finish', function() {
                emitter.emit('success', filelist);
            });

            return emitter;
        },
        'should be correct': function(filelist) {
            assert.deepEqual(
                filelist,
                demoDirContent
            );
        }
    },
    'Directory listings with different cipher': {
        topic: function () {
            var this_ = this;
            var deps = getDeps();
            var emitter = new eventEmitter();
            var r = new rsync(deps);

            deps.config.rsync.cipher = 'blowfish';
            var l = new r.filelist({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                keyfile: deps.config.keyfile
            });

            var filelist = [];
            l.on('files', function(files) {
                filelist = filelist.concat(files);
            });

            l.on('finish', function() {
                emitter.emit('success', filelist);
            });

            return emitter;
        },
        'should be correct': function(filelist) {
            assert.deepEqual(
                filelist,
                demoDirContent
            );
        }
    },
    'Directory listings with limited depth': {
        topic: function () {
            var this_ = this;
            var deps = getDeps(true);
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var l = new r.filelist({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                keyfile: deps.config.keyfile
            });

            var filelist = [];
            l.on('files', function(files) {
                filelist = filelist.concat(files);
            });

            l.on('finish', function() {
                emitter.emit('success', filelist);
            });

            return emitter;
        },
        'should be correct': function(filelist) {
            assert.deepEqual(
                filelist,
                demoDirContentDepth
            );
        }
    },
    'Directory listings with invalid directories': {
        topic: function () {
            var this_ = this;
            var deps = getDeps(true);
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var l = new r.filelist({
                username: deps.config.uid,
                host: 'localhost',
                src: '/invalidDir',
                keyfile: deps.config.keyfile
            });

            var filelist = [];
            l.on('error', function(code) {
                emitter.emit('success', code);
            });

            return emitter;
        },
        'should emit an error': function(code) {
            assert.strictEqual(code, 23);
        }
    },
    'Directory listings with suspend and resume': {
        topic: function () {
            var this_ = this;
            var deps = getDeps();
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var l = new r.filelist({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                keyfile: deps.config.keyfile
            });


            var start = Date.now();
            var filelist = [];

            l.on('files', function(files) {
                filelist = filelist.concat(files);
            });

            l.on('finish', function() {
                var downloadTime = Date.now() - start;
                emitter.emit('success', [filelist, downloadTime]);
            });

            process.nextTick(function() {
                l.suspend();
                setTimeout(function() {
                    l.resume();
                }, 2000);
            });

            return emitter;
        },
        'should work': function(result) {
            assert.deepEqual(
                result[0],
                demoDirContent
            );
            assert.isTrue(result[1] >= (2 * 1000));
        }
    },
    'Directory listings when killed': {
        topic: function () {
            var this_ = this;
            var deps = getDeps();
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var l = new r.filelist({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                keyfile: deps.config.keyfile
            });

            l.on('error', function(code) {
                emitter.emit('success', code);
            });

            setTimeout(function() {
                l.kill();
            }, 50);

            return emitter;
        },
        'should emit an error': function(code) {
            assert.strictEqual(code, 20);
        }
    },
    'Copying from an invalid directory': {
        topic: function() {
            var this_ = this;
            var deps = getDeps(true);
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var l = new r.download({
                username: deps.config.uid,
                host: 'localhost',
                src: '/invalidDir',
                dest: __dirname + '/testDir2/',
                keyfile: deps.config.keyfile
            });

            l.on('error', function(code) {
                emitter.emit('success', code);
            });

            return emitter;
        },
        'should emit an error': function(code) {
            assert.strictEqual(code, 23);
        }
    },
    'Copying to an invalid directory': {
        topic: function() {
            var this_ = this;
            var deps = getDeps(true);
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var l = new r.download({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                dest: '/invaliddir',
                keyfile: deps.config.keyfile
            });

            l.on('error', function(code) {
                emitter.emit('success', code);
            });

            return emitter;
        },
        'should emit an error': function(code) {
            assert.strictEqual(code, 11);
        }
    },
    'Copied files': {
        topic: function () {
            var this_ = this;
            cleanDownloadFiles();
            var deps = getDeps();
            var emitter = new eventEmitter();
            var r = new rsync(deps);
            var d = new r.download({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                dest: __dirname + '/testDir2/',
                keyfile: deps.config.keyfile
            });

            d.on('finish', function() {
                var l = new r.filelist({
                    username: deps.config.uid,
                    host: 'localhost',
                    src: __dirname + '/testDir2/testDir',
                    keyfile: deps.config.keyfile
                });

                var filelist = [];

                l.on('files', function(files) {
                    filelist = filelist.concat(files);
                });

                l.on('finish', function() {
                    emitter.emit('success', filelist);
                });
            });

            return emitter;
        },
        'should be correct': function(filelist) {
            assert.deepEqual(
                filelist,
                demoDirContent
            );
        }
    }
}).addBatch({
    'Copying with bwlimit': {
        topic: function () {
            var this_ = this;
            cleanDownloadFiles();
            var emitter = new eventEmitter();
            var deps = getDeps();
            var r = new rsync(deps);
            var d = new r.download({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                dest: __dirname + '/testDir2/',
                keyfile: deps.config.keyfile,
                bwlimit: 30
            });
            var start = Date.now();

            d.on('finish', function() {
                var downloadTime = Date.now() - start;

                var l = new r.filelist({
                    username: deps.config.uid,
                    host: 'localhost',
                    src: __dirname + '/testDir2/testDir',
                    keyfile: deps.config.keyfile
                });

                var filelist = [];

                l.on('files', function(files) {
                    filelist = filelist.concat(files);
                });

                l.on('finish', function() {
                    emitter.emit('success', [filelist, downloadTime]);
                });
            });

            return emitter;
        },
        'should be correct and take longer': function(result) {
            assert.deepEqual(
                result[0],
                demoDirContent
            );
            assert.isTrue(result[1] >= (2 * 1000));
        }
    }
}).addBatch({
    'Copying which gets killed': {
        topic: function () {
            var this_ = this;
            cleanDownloadFiles();
            var emitter = new eventEmitter();
            var deps = getDeps();
            var r = new rsync(deps);
            var d = new r.download({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                dest: __dirname + '/testDir2/',
                keyfile: deps.config.keyfile
            });

            d.on('error', function(code) {
                emitter.emit('success', code);
            });

            setTimeout(function() {
                d.kill();
            }, 50);

            return emitter;
        },
        'should emit an error': function(code) {
            assert.strictEqual(code, 20);
        }
    }
}).addBatch({
    'Copying with maxDepth': {
        topic: function () {
            var this_ = this;
            cleanDownloadFiles();
            var emitter = new eventEmitter();
            var deps = getDeps(true);
            var r = new rsync(deps);
            var d = new r.download({
                username: deps.config.uid,
                host: 'localhost',
                src: __dirname + '/testDir',
                dest: __dirname + '/testDir2/',
                keyfile: deps.config.keyfile
            });

            d.on('finish', function() {
                var l = new r.filelist({
                    username: deps.config.uid,
                    host: 'localhost',
                    src: __dirname + '/testDir2/testDir',
                    keyfile: deps.config.keyfile
                });

                var filelist = [];

                l.on('files', function(files) {
                    filelist = filelist.concat(files);
                });

                l.on('finish', function() {
                    emitter.emit('success', filelist);
                });
            });

            return emitter;
        },
        'should be correct': function(filelist) {
            assert.deepEqual(
                filelist,
                demoDirContentDepth
            );
        }
    }
}).export(module);
