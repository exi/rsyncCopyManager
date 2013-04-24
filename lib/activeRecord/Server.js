module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Server', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrument: true },
        bwlimit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
        type: { type: DataTypes.TEXT, allowNull: false },
        fse_revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        last_filelist_update: { type: DataTypes.DATE, allowNull: true },
        last_seen: { type: DataTypes.DATE, allowNull: true }
    }, {
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
};
