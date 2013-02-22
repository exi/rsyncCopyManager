module.exports = function(sequelize, DataTypes) {
    return sequelize.define('FSEntry', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrument: true },
        path: { type: DataTypes.TEXT, allowNull: false },
        size: { type: DataTypes.BIGINT, allowNull: false },
        isDir: { type: DataTypes.BOOLEAN, allowNull: false }
    }, {
        timestamps: false,
        paranoid: false,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
};
