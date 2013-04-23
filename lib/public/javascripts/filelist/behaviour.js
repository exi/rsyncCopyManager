define(['jquery', 'helper'], function($, helper) {
    function fileClickHandler(file) {
        return false;
    }

    return {
        apply: function() {
            var placeholder = null;

            $('.filelist-tree').livequery(function() {
                $(this).fileTree({ }, fileClickHandler);
            });

            helper.addClickListener('.filelist-download', '/filelist/download', {
                dataProcessor: function(data, el) {
                    data.path = $(el).attr('data-filelist-path');
                    return data;
                },
                replaceQuery: '#filelistModal',
                onSuccess: function() {
                    $('#filelistModal').modal('show');
                    $('#filelistModal').find('.filelist-download-confirm').focus();
                }
            });

            helper.addClickListener('.filelist-download-confirm', '/filelist/download-confirm', {
                dataProcessor: function(data, el) {
                    data.path = $(el).attr('data-filelist-path');
                    data.categoryId = $('#filelistModal').find('.filelist-download-category').val();
                    return data;
                }
            });

            $('.filelist-form-search').livequery(function() {
                var lastval = '';
                var lastrange = 'all';
                var submitTimer = null;
                var this_ = this;

                function onChange() {
                    clearTimeout(submitTimer);
                    submitTimer = setTimeout(function() {
                        var val = $(this_).find('.filelist-search').val();
                        var range = $(this_).find('.filelist-search-range').val();
                        if (lastval === val && lastrange === range) {
                            return;
                        }

                        lastval = val;
                        lastrange = range;
                        var words = val.split(' ');
                        var t = $('<div>');
                        $('.filelist-tree').empty().append(t);
                        $(t).fileTree({ searchWords: words, range: range }, fileClickHandler);
                    }, 300);
                }

                $(this).find('.filelist-search').bind('keyup', onChange);
                $(this).find('.filelist-search-range').bind('change', onChange);
            }, function() {
                $(this).find('.filelist-search').unbind('keyup');
                $(this).find('.filelist-search-range').unbind('change');
            });
        }
    };
});
