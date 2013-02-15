module.exports = function(sequelize, DataTypes) {
    return sequelize.define('User', {
        name: { type: DataTypes.TEXT, allowNull: false },
        password: { type: DataTypes.TEXT, allowNull: false }
    });
};
