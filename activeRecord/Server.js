module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Server', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrument: true },
        username: { type: DataTypes.TEXT, allowNull: false },
        hostname: { type: DataTypes.TEXT, allowNull: false },
        path: { type: DataTypes.TEXT, allowNull: false },
        last_filelist_update: { type: DataTypes.DATE, allowNull: true },
        last_seen: { type: DataTypes.DATE, allowNull: true }
    });
};
