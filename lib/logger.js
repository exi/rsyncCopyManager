var express = require('express');

module.exports = function(deps) {
    deps.configHelper.define({ key: 'logging', defaultValue: 'default' });


    var logger = express.logger(deps.config.logging);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    express.logger.token('date', function() {
        function pad(input) {
            input = '' + input;
            return input.length === 1 ? '0' + input : input;
        }


        var date = new Date();
        var dd = pad(date.getDate());
        var mon = months[date.getMonth()];
        var yyyy = date.getFullYear();
        var hh = pad(date.getHours());
        var mm = pad(date.getMinutes());
        var ss = pad(date.getSeconds());

        return [[dd, mon, yyyy].join('/'), hh, mm, ss].join(':');
    });

    return logger;
};
