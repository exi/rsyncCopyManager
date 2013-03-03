define(['jquery'], function($) {
    function fileClickHandler(file) {
        return false;
    }

    return {
        apply: function() {
            var placeholder = null;

            $('.filelist-tree').livequery(function() {
                $(this).fileTree({ root: '/', script: '/filelist/getDir' }, fileClickHandler);
            });

            $('.filelist-download').livequery('click', function() {
                var path = $(this).attr('data-filelist-path');
                var this_ = this;
                $.ajax({
                    url: '/filelist/download',
                    data: { path: path },
                    type: 'POST'
                }).always(function(data) {
                    if (data && data.content) {
                        $('#filelistModal').html(data.content);
                        $('#filelistModal').modal('show');
                    }
                });

                return false;
            });

            $('.filelist-download-confirm').livequery('click', function() {
                var path = $(this).attr('data-filelist-path');
                var this_ = this;
                $.ajax({
                    url: '/filelist/download-confirm',
                    data: { path: path },
                    type: 'POST'
                });
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
