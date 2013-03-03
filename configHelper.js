var fs = require('fs');
var config;
try {
    config = require('./config.js');
} catch (err) {
    console.error('config.js not found');
    process.exit(1);
}

module.exports.define = function(definition) {
    var key = definition.key;
    var required = definition.required !== false;
    var fileMustExist = definition.fileMustExist === true;
    var dirMustExist = definition.dirMustExist === true;
    var hasDefault = definition.hasOwnProperty('defaultValue');
    var parts = key.split('.');
    var value = config;

    var l = parts.length;
    for (var idx = 0; idx < l; idx++) {
        var part = parts[idx];
        if (!value.hasOwnProperty(part)) {
            if (hasDefault) {
                value[part] = idx === l - 1 ? definition.defaultValue : {};
                value = value[part];
                continue;
            }

            if (required) {
                console.error('config variable \'' + key + '\' required but missing.');
                process.exit(1);
            }

            value = null;
            break;
        } else {
            value = value[part];
        }
    }

    function fileStatFail() {
        console.error('file \'' + value + '\' specified in config variable \'' + key + '\' required but missing.');
        process.exit(1);
    }

    function dirStatFail() {
        console.error('directory \'' + value + '\' specified in config variable \'' + key + '\' required but missing.');
        process.exit(1);
    }

    if (fileMustExist || dirMustExist) {
        var stat;
        try {
            stat = fs.statSync(value);
        } catch (err) {
            if (fileMustExist) {
                fileStatFail();
            } else if (dirMustExist) {
                dirStatFail();
            } else {
                throw err;
            }
        }

        if (fileMustExist && !stat.isFile()) {
            fileStatFail();
        }

        if (dirMustExist && !stat.isDirectory()) {
            dirStatFail();
        }
    }
};

module.exports.defineMultiple = function(defs) {
    defs = defs || [];
    defs.forEach(module.exports.define);
};
