define(['jquery'], function($) {
    return {
        apply: function() {
            $('.add-server-form').livequery('submit', function(evt) {
                if (evt && evt.preventDefault) {
                    evt.preventDefault();
                }

                $(this).find('.form-status').empty();

                var d = {};
                var data = $(this).serializeArray().forEach(function(item) {
                    d[item.name] = item.value;
                });
                var this_ = this;

                $.ajax({
                    url: '/servers/add',
                    data: d,
                    type: 'POST'
                }).done(function(data) {
                    if (data && data.type && data.content) {
                        if (data.type == 'error') {
                            $(this_).find('.form-status').html(data.content);
                        } else if (data.type == 'success') {
                            $('.servers-list').html(data.content);
                        }
                    }
                });
                return false;
            });

            $('.server-delete').livequery('click', function(event) {
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

            $('.server-rescan').livequery('click', function(event) {
                var id = $(this).attr('data-server-id');
                $(this).addClass('loading');
                $.ajax({
                    url: '/servers/rescan',
                    data: { id: id },
                    type: 'POST'
                });
            });

            $('.server-status-list').livequery(function() {
                var this_ = this;
                var updatefunc = function () {
                    $.ajax({
                        url: '/servers/status',
                        type: 'POST'
                    }).always(function(data) {
                        if (data && data.type === 'success' && data.content && data.content.length) {
                            data.content.forEach(function(status) {
                                var parent = $('.server-status[data-server-id="' + status.id + '"]');
                                if (status.msg) {
                                    $(parent).find('.server-status-text').html(status.msg);
                                }
                                if (status.errorOutput) {
                                    $(parent).find('.server-status-error-container').css('display', '');
                                    var content = status.errorOutput.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                    $(parent).find('.server-status-error-output').html(content);
                                } else {
                                    $(parent).find('.server-status-error-container').css('display', 'none');
                                }
                            });
                        }
                        this_.refreshTimer = setTimeout(updatefunc, 2000);
                    });
                };
                updatefunc();
            }, function() {
                clearTimeout(this.refreshTimer);
            });

            $('.server-limit').livequery('change', function(event) {
                var id = $(this).attr('data-server-id');
                var this_ = this;
                var limit = $(this).val();
                limit = limit === '' ? 0 : limit;
                $.ajax({
                    url: '/servers/setLimit',
                    data: { id: id, limit: limit },
                    type: 'POST'
                }).always(function(data) {
                    if (data && (data.type === 'error' || data.type === 'success')) {
                        $(this_).removeClass('error success');
                        $(this_).addClass(data.type);
                    }
                });
            });
        }
    };
});
