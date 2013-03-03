var configHelper = require('./configHelper.js');
var config = require('./config.js');
configHelper.defineMultiple(
    [
        { key: 'db.name' },
        { key: 'db.user' },
        { key: 'db.password' },
        { key: 'db.host' }
    ]
);

var sequelize = new (require('sequelize'))(config.db.name, config.db.user, config.db.password, {
    host: config.db.host
});

var Server = sequelize.import(__dirname + '/activeRecord/Server');
var User = sequelize.import(__dirname + '/activeRecord/User');
var Download = sequelize.import(__dirname + '/activeRecord/Download');
var FSEntry = sequelize.import(__dirname + '/activeRecord/FSEntry');

User.hasMany(Server, { as: 'Servers' });
User.hasMany(Download, { as: 'Downloads' });
Server.hasMany(FSEntry, { as: 'FSEntries' });
Server.belongsTo(User);
FSEntry.belongsTo(Server);
Download.belongsTo(User);

var synced = false;
var syncing = false;
var models = {
    Server: Server,
    User: User,
    FSEntry: FSEntry,
    Download: Download
};
var cbs = [];

module.exports = function(cb) {
    if (!synced) {
        cbs.push(cb);
        if (!syncing) {
            syncing = true;
            sequelize.sync().success(function() {
                synced = true;
                cbs.forEach(function(cb) {
                    cb(null, models, sequelize);
                });
            }).error(function(err) {
                cb(err);
            });
        }
    } else {
        cb(null, models, sequelize);
    }
};

module.exports.chain = require('sequelize').Utils.QueryChainer;
module.exports.format = require('sequelize').Utils.format;
