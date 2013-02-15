var config = require('./config.js');
var sequelize = new (require('sequelize'))(config.db.name, config.db.user, config.db.password, {
    host: config.db.host
});

var Server = sequelize.import(__dirname + '/activeRecord/Server');
var User = sequelize.import(__dirname + '/activeRecord/User');

User.hasMany(Server, { as: 'Servers' });

var synced = false;
var models = {
    Server: Server,
    User: User
};

module.exports = function(cb) {
    if (!synced) {
        sequelize.sync().success(function() {
            synced = true;
            cb(null, models);
        }).error(function(err) {
            throw err;
        });
    } else {
        cb(null, models);
    }
};
