module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Session', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrument: true },
        token: { type: DataTypes.TEXT, allowNull: false },
        lastUpdate: { type: DataTypes.DATE, allowNull: false }
    }, {
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
};
