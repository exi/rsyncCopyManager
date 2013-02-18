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
                $(this).addClass('loading');
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

            $('.server-status').livequery(function() {
                var id = $(this).attr('data-server-id');
                var this_ = this;
                var updatefunc = function () {
                    $.ajax({
                        url: '/servers/status',
                        data: { id: id },
                        type: 'POST'
                    }).always(function(data) {
                        if (data && data.content) {
                            $(this_).html(data.content);
                        }
                        this_.refreshTimer = setTimeout(updatefunc, 2000);
                    });
                };
                updatefunc();
            }, function() {
                clearTimeout(this.refreshTimer);
            });
        }
    };
});
