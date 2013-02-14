var config = require('./config.js'),
    sequelize = new (require('sequelize'))(config.db.name, config.db.user, config.db.password, {
        host: config.db.host
    });
