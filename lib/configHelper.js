var fsHelper = require('./fsHelper.js');

module.exports = function(deps) {
    return {
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
