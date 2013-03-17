module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Download', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrument: true },
        path: { type: DataTypes.TEXT, allowNull: false },
        currentPath: { type: DataTypes.TEXT, allowNull: false },
        progress: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        complete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    }, {
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
};
