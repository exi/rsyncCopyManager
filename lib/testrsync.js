var rsync = require('./rsync').filelist;

var r = new rsync({
    compareMode: 'checksum',
    keyfile: '/home/exi/.ssh/id_rsa',
    username: 'exi',
    host: 'localhost',
    src: '/home/exi/tmp/'
});

r.on('error', function(err) {
    throw err;
});

r.on('finish', function(filelist) {
    console.log(require('util').inspect(filelist));
});
