var rsync = require('./rsync');
var database = require('./database.js');
var config = require('./config.js');

var Server = module.exports = function(modelInstance) {
    console.log('create server instance');
    console.log(require('util').inspect(modelInstance));
};
