var bcrypt = require('bcrypt');
var path = require('path');
var crypto = require('crypto');

module.exports.getAbsolutePathForDownload = function(downloadDir, remotePath) {
    var parts = remotePath.split('/');
    return path.normalize(downloadDir + '/' + parts.pop());
};

module.exports.sendError = function(res, msg) {
    msg = msg || 'An unexpected error occurred.';
    console.error('send error: ' + msg);
    res.render(
        'error-box',
        { message: msg },
        function(err, content) {
            res.json({ type: 'error', content: content});
        }
    );
};
module.exports.wrapErrorFunction = function(res) {
    return function(err) {
        module.exports.sendError(res, err);
    };
};

module.exports.sendSuccessBox = function(res, msg) {
    msg = msg || 'Success.';
    res.render(
        'success-box',
        { message: msg },
        function(err, content) {
            module.exports.sendSuccess(res, content);
        }
    );
};

module.exports.sendSuccess = function(res, content) {
    var data = {
        type: 'success'
    };

    if (content !== undefined && content !== null) {
        data.content = content;
    }

    res.json(data);
};

module.exports.hash = function(input) {
    return bcrypt.hashSync(input, 10);
};

module.exports.checkPassword = function(input, hash) {
    return bcrypt.compareSync(input, hash);
};

module.exports.convertToHumanReadableSize = function(bytes) {
    var factors = [[1, 'B'], [1024, 'KB'], [1048576, 'MB'], [1073741824, 'GB'], [1099511627776, 'TB']];
    var ret = '';
    for (var i = 0; i < factors.length; i++) {
        if (i + 1 >= factors.length || (bytes > factors[i][0] && bytes < factors[i + 1][0]) || bytes === 0) {
            var rounded = Math.floor((bytes / (factors[i][0])) * 100);
            ret = rounded / 100 + factors[i][1];
            break;
        }
    }
    return ret;
};

module.exports.escapeHtml = function(input) {
    return input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

module.exports.generateToken = function() {
    var c = crypto.createHash('sha256');
    c.update('' + (Date.now() * Math.random()));
    return c.digest('hex');
};
