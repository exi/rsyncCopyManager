module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Category', {
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        destination: { type: DataTypes.STRING, allowNull: false }
    }, {
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
};
