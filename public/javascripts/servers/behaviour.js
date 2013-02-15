define(['jquery'], function($) {
    return {
        apply: function() {
            $('.add-server-form').livequery('submit', function(event) {
                event.preventDefault();
                $('.add-server-form-status').empty();

                var d = {};
                var data = $(this).serializeArray().forEach(function(item) {
                    d[item.name] = item.value;
                });

                $.ajax({
                    url: '/servers/add',
                    data: d,
                    type: 'POST'
                }).done(function(data) {
                    if (data && data.type && data.content) {
                        if (data.type == 'error') {
                            $('.add-server-form-status').html(data.content);
                        } else if (data.type == 'success') {
                            $('.servers-list').html(data.content);
                        }
                    }
                });
                return false;
            });

            $('.server-delete-button').livequery('click', function(event) {
                var id = $(this).attr('data-server-id');
                $.ajax({
                    url: '/servers/del',
                    data: { id: id },
                    type: 'POST'
                }).done(function(data) {
                    if (data && data.content) {
                        $('.servers-list').html(data.content);
                    }
                });
            });
        }
    };
});
