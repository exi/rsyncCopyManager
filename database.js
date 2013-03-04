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

var Download = sequelize.import(__dirname + '/activeRecord/Download');
var FSEntry = sequelize.import(__dirname + '/activeRecord/FSEntry');
var Server = sequelize.import(__dirname + '/activeRecord/Server');
var Category = sequelize.import(__dirname + '/activeRecord/Category');
var User = sequelize.import(__dirname + '/activeRecord/User');

Download.belongsTo(User);
Download.belongsTo(Category);
FSEntry.belongsTo(Server);
Server.hasMany(FSEntry, { as: 'FSEntries' });
Server.belongsTo(User);
User.hasMany(Server, { as: 'Servers' });
User.hasMany(Download, { as: 'Downloads' });

var synced = false;
var syncing = false;
var models = {
    Download: Download,
    FSEntry: FSEntry,
    Server: Server,
    Category: Category,
    User: User
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
module.exports.query = function() {
    return sequelize.query.apply(sequelize, arguments);
};
