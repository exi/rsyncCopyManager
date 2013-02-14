
module.exports.apply = function(app) {
    app.post('/servers', function(req, res) {
        res.render(
            'servers',
            { servers: [ ] },
            function(error, content) {
                res.json({content: content});
            }
        );
    });
};
