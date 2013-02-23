var bcrypt = require('bcrypt');

module.exports.sendError = function(res, msg) {
    msg = msg || 'An unexpected error occurred.';
    res.render(
        'error-box',
        { message: msg },
        function(err, content) {
            res.json({ type: 'error', content: content});
        }
    );
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
    var factors = [[1, 'B'], [1024, 'KB'], [1048576, 'MB'], [1073741824, 'GB']];
    var ret = "";
    for (var i = 0; i < factors.length; i++) {
        if (i + 1 >= factors.length || (bytes > factors[i][0] && bytes < factors[i + 1][0]) || bytes === 0) {
            ret = Math.floor(bytes / (factors[i][0])) + factors[i][1];
            break;
        }
    }
    return ret;
};
