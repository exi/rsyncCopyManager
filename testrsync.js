var rsync = require('./rsync');

var r = new rsync({
    compareMode: 'checksum',
    keyfile: '/home/exi/.ssh/id_rsa',
    username: 'exi',
    host: 'localhost',
    filename: '/home/exi/testfile',
    dest: '/tmp/'
});

r.on('progress', function(data) {
    console.log('progress: ' + data.transferred);
});

r.on('error', function(err) {
    throw err;
});

r.on('finish', function() {
    console.log('finish');
});
