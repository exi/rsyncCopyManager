define(['jquery'], function($) {
    return {
        apply: function() {
            $('select').livequery(function(node) {
                $(this).selectpicker();
            });
        }
    };
});
