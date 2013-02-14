define(['jquery'], function($) {
    return {
        apply: function() {
            $('.add-server-form').livequery('submit', function(event) {
                event.preventDefault();
                var data = $(this).serializeArray();
                return false;
            });
        }
    };
});
