var fs = require('fs');

module.exports.isFileAndExist = function(file) {
    var stat;
    try {
        stat = fs.statSync(file);
    } catch (err) {
        return false;
    }

    return stat.isFile();
};

module.exports.isDirAndExist = function(dir) {
    var stat;
    try {
        stat = fs.statSync(dir);
    } catch (err) {
        return false;
    }

    return stat.isDirectory();
};
