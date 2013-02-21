module.exports = function(sequelize, DataTypes) {
    return sequelize.define('User', {
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        password: { type: DataTypes.STRING, allowNull: false },
        isAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    });
};
