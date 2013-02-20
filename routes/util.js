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
