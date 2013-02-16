define(['jquery'], function($) {
    function fileClickHandler(file) {
        return false;
    }

    return {
        apply: function() {
            $('.filelist-tree').livequery(function() {
                $(this).fileTree({ root: '/', script: '/filelist/getDir' }, fileClickHandler);
            });

            $('.filelist-download-link').livequery('click', function() {
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
        }
    };
});
