var fsHelper = require('./fsHelper.js');
var errorHelper = require('./errorHelper.js');

var FileNotFoundError = errorHelper.customError('File not found Error');
var DirectoryNotFoundError = errorHelper.customError('Directory not found Error');
var KeyMissingError = errorHelper.customError('Key missing Error');

module.exports = function(deps) {
    return {
        FileNotFoundError: FileNotFoundError,
        DirectoryNotFoundError: DirectoryNotFoundError,
        KeyMissingError: KeyMissingError,
        define: function(definition) {
            var key = definition.key;
            var required = definition.required !== false;
            var fileMustExist = definition.fileMustExist === true;
            var dirMustExist = definition.dirMustExist === true;
            var hasDefault = definition.hasOwnProperty('defaultValue');
            var parts = key.split('.');
            var value = deps.config;

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
                        throw new KeyMissingError('config key \'' + key + '\' required but missing.');
                    }

                    value = null;
                    break;
                } else {
                    value = value[part];
                }
            }

            function fileStatFail() {
                throw new FileNotFoundError(
                    'file \'' + value + '\' specified in config variable \'' + key + '\' required but missing.'
                );
            }

            function dirStatFail() {
                throw new DirectoryNotFoundError(
                    'directory \'' + value + '\' specified in config variable \'' + key + '\' required but missing.'
                );
            }

            if (fileMustExist || dirMustExist) {
                if (fileMustExist && !fsHelper.isFileAndExist(value)) {
                    fileStatFail();
                }

                if (dirMustExist && !fsHelper.isDirAndExist(value)) {
                    dirStatFail();
                }
            }
        },

        defineMultiple: function(defs) {
            defs = defs || [];
            defs.forEach(this.define);
        }
    };
};
