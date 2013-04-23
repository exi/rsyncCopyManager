module.exports = function(models) {
    models.Download.belongsTo(models.User);
    models.Download.belongsTo(models.Category);
    models.FSEntry.belongsTo(models.Server);
    models.Server.hasMany(models.FSEntry, { as: 'FSEntries' });
    models.Server.belongsTo(models.User);
    models.User.hasMany(models.Server, { as: 'Servers' });
    models.User.hasMany(models.Download, { as: 'Downloads' });
    models.User.hasMany(models.Session, { as: 'Sessions' });
    models.Session.belongsTo(models.User);
};
