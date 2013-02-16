var config = require('./config.js');
var sequelize = new (require('sequelize'))(config.db.name, config.db.user, config.db.password, {
    host: config.db.host
});

var Server = sequelize.import(__dirname + '/activeRecord/Server');
var User = sequelize.import(__dirname + '/activeRecord/User');
var Transfer = sequelize.import(__dirname + '/activeRecord/Transfer');
var FSEntry = sequelize.import(__dirname + '/activeRecord/FSEntry');

User.hasMany(Server, { as: 'Servers' });
User.hasMany(Transfer, { as: 'Transfers' });
Server.hasMany(Transfer, { as: 'Transfers' });
Server.hasMany(FSEntry, { as: 'FSEntries' });
FSEntry.belongsTo(Server);
Transfer.belongsTo(User);
Transfer.belongsTo(Server);

var synced = false;
var syncing = false;
var models = {
    Server: Server,
    User: User,
    FSEntry: FSEntry,
    Transfer: Transfer
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
                    cb(null, models);
                });
            }).error(function(err) {
                throw err;
            });
        }
    } else {
        cb(null, models);
    }
};

module.exports.chain = require('sequelize').Utils.QueryChainer;
