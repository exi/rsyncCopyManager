module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Rsync', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrument: true },
        username: { type: DataTypes.TEXT, allowNull: false },
        hostname: { type: DataTypes.TEXT, allowNull: false },
        path: { type: DataTypes.TEXT, allowNull: false }
    }, {
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
};
