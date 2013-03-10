define(['jquery', 'helper'], function($, helper) {
    return {
        apply: function() {
            helper.addFormHandler('.add-server-form', '/servers/add', { replaceQuery: '.servers-list' });

            helper.addClickListener('.server-delete', '/servers/del', { replaceQuery: '.servers-list' });
            helper.addClickListener('.server-rescan', '/servers/rescan');

            helper.addTextFieldListener('.server-limit', '/servers/setLimit', 'limit', function(data) {
                data.limit = data.limit === '' ? 0 : data.limit;
                return data;
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
                                var parent = $('.server-status[data-id="' + status.id + '"]');
                                if (status.msg) {
                                    $(parent).find('.server-status-text').html(status.msg);
                                }
                                if (status.filecount) {
                                    $(parent).find('.server-status-filecount').html(status.filecount);
                                }
                                if (status.errorOutput) {
                                    $(parent).find('.server-status-error-container').css('display', '');
                                    $(parent).find('.server-status-error-output').html(status.errorOutput);
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
        }
    };
});
