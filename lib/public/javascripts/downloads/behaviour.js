define(['jquery', 'helper'], function($, helper) {
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
                                var row = $(this_).find('.download-status[data-id="' + status.id + '"]');
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

                                if (status.eta !== undefined) {
                                    $(row).find('.download-status-eta').html(status.eta);
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


            helper.addClickListener('.download-delete', '/downloads/del', {
                replaceQuery: '#downloadsModal',
                onSuccess: function() {
                    $('#downloadsModal').modal('show');
                }
            });

            $('.download-delete-confirm').livequery(function() {
                var id = $(this).attr('data-id');
                var this_ = this;
                var deleteData = $(this).find('.download-delete-data').is(':checked');

                $(this).find('.download-delete-data').bind('click', function() {
                    deleteData = $(this).is(':checked');
                });

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
                                $('.download-status[data-id="' + id + '"]').remove();
                            }
                        }
                    });
                });
            }, function() {
                $(this).find('.download-delete-confirm-button').unbind('click');
                $(this).find('.download-delete-data').unbind('click');
            });

            $('.download-category').livequery('change', function(evt) {
                var id = $(this).attr('data-id');
                var val = $(this).val();
                $.ajax({
                    url: '/downloads/changeCategory',
                    data: { id: id, categoryId: val },
                    type: 'POST'
                });
            });
        }
    };
});


