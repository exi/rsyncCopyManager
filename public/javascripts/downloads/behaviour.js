define(['jquery'], function($) {
    return {
        apply: function() {
            $('.download-status').livequery(function() {
                var id = $(this).attr('data-download-id');
                var this_ = this;
                var updatefunc = function () {
                    $.ajax({
                        url: '/downloads/status',
                        data: { id: id },
                        type: 'POST'
                    }).always(function(data) {
                        if (data && data.content) {
                            var content = data.content;
                            if (content.status) {
                                $(this_).find('.download-status-text').html(content.status);
                            }

                            if (content.transferred) {
                                $(this_).find('.download-status-transferred').html(content.transferred);
                            }

                            if (content.progress) {
                                $(this_).find('.download-status-progress-bar').css('width', content.progress + '%');
                            }

                            if (content.active === true) {
                                $(this_).find('.download-status-progress').addClass('active');
                            }

                            if (content.active === false) {
                                $(this_).find('.download-status-progress').removeClass('active');
                            }

                            if (content.rate !== undefined) {
                                $(this_).find('.download-status-rate').html(content.rate);
                            }
                        }
                        this_.refreshTimer = setTimeout(updatefunc, 2000);
                    });
                };
                updatefunc();
            }, function() {
                clearTimeout(this.refreshTimer);
            });

            $('.download-delete').livequery('click', function() {
                var id = $(this).attr('data-download-id');
                var this_ = this;
                $.ajax({
                    url: '/downloads/del',
                    data: { id: id },
                    type: 'POST'
                }).always(function(data) {
                    if (data && data.content) {
                        $('#downloadsModal').html(data.content);
                        $('#downloadsModal').modal('show');
                    }
                });
            });

            $('.download-delete-confirm').livequery(function() {
                var id = $(this).attr('data-download-id');
                var this_ = this;
                var deleteData = true;
                $(this).find('.download-delete-confirm-button').bind('click', function() {
                    $.ajax({
                        url: '/downloads/del-confirm',
                        data: { id: id, deleteData: deleteData },
                        type: 'POST'
                    }).always(function(data) {
                        if (data && data.type === 'success') {
                            if (data.content) {
                                $('.downloads-list').html(data.content);
                            } else {
                                $('.download-status[data-download-id="' + id + '"]').remove();
                            }
                        }
                    });
                });

                $(this).find('.download-delete-data').bind('click', function() {
                    deleteData = $(this).is(':checked');
                });
            }, function() {
                $(this).find('.download-delete-confirm-button').unbind('click');
                $(this).find('.download-delete-data').unbind('click');
            });
        }
    };
});


