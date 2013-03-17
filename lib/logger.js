var express = require('express');

module.exports = function(deps) {
    deps.configHelper.define({ key: 'logging', defaultValue: 'default' });


    var logger = express.logger(deps.config.logging);
    express.logger.token('date', function() {
        function pad(input) {
            input = '' + input;
            return input.length === 1 ? '0' + input : input;
        }

        var date = new Date();
        var dd = pad(date.getDate());
        var mon = pad(date.getMonth() + 1);
        var yyyy = date.getFullYear();
        var hh = pad(date.getHours());
        var mm = pad(date.getMinutes());
        var ss = pad(date.getSeconds());

        return [yyyy, mon, dd].join('-') + ' ' + [hh, mm, ss].join(':');
    });

    return logger;
};
