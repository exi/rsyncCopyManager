define(['jquery', 'helper'], function($, helper) {
    function fileClickHandler(file) {
        return false;
    }

    return {
        apply: function() {
            var placeholder = null;

            $('.filelist-tree').livequery(function() {
                $(this).fileTree({ root: '/', script: '/filelist/getDir' }, fileClickHandler);
            });

            helper.addClickListener('.filelist-download', '/filelist/download', {
                dataProcessor: function(data, el) {
                    data.path = $(el).attr('data-filelist-path');
                    return data;
                },
                replaceQuery: '#filelistModal',
                onSuccess: function() {
                    $('#filelistModal').modal('show');
                }
            });

            helper.addClickListener('.filelist-download-confirm', '/filelist/download-confirm', {
                dataProcessor: function(data, el) {
                    data.path = $(el).attr('data-filelist-path');
                    data.categoryId = $('#filelistModal').find('.filelist-download-category').val();
                    return data;
                }
            });

            $('.filelist-search').livequery(function() {
                this.lastval = '';
                $(this).bind('keyup', function() {
                    var val = $(this).val();
                    if (this.lastval === val) {
                        return;
                    }

                    clearTimeout(this.submitTimer);
                    var this_ = this;
                    this.submitTimer = setTimeout(function() {
                        this_.lastval = val;
                        var words = val.split(' ');
                        $('.filelist-tree').empty();
                        $('.filelist-tree').fileTree({ root: '/', script: '/filelist/getDir', searchWords: words }, fileClickHandler);
                    }, 300);
                });
            }, function() {
                $(this).unbind('keypress');
            });
        }
    };
});
