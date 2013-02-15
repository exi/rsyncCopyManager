module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Transfer', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrument: true },
        path: { type: DataTypes.TEXT, allowNull: false },
        progress: { type: DataTypes.FLOAT, allowNull: false }
    });
};
