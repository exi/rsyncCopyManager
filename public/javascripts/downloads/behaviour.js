define(['jquery'], function($) {
    return {
        apply: function() {
            $('.download-status-list').livequery(function() {
                var this_ = this;
                var updatefunc = function () {
                    $.ajax({
                        url: '/downloads/status',
                        type: 'POST'
                    }).always(function(data) {
                        if (data && data.type === 'success' && data.content && data.content.length) {
                            data.content.forEach(function(status) {
                                var row = $(this_).find('.download-status[data-download-id="' + status.id + '"]');
                                if (status.status !== undefined) {
                                    $(row).find('.download-status-text').html(status.status);
                                }

                                if (status.transferred !== undefined) {
                                    $(row).find('.download-status-transferred').html(status.transferred);
                                }

                                if (status.progress !== undefined) {
                                    $(row).find('.download-status-progress-bar').css('width', status.progress + '%');
                                }

                                if (status.active === true) {
                                    $(row).find('.download-status-progress').addClass('active');
                                }

                                if (status.active === false) {
                                    $(row).find('.download-status-progress').removeClass('active');
                                }

                                if (status.rate !== undefined) {
                                    $(row).find('.download-status-rate').html(status.rate);
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


