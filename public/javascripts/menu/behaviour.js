define(['jquery'], function($) {
    return {
        apply: function() {
            function removeActives() {
                $('.nav > li.active').removeClass('active');
            }

            function switchMainContent(query, url) {
                $(query).livequery('click', function(event) {
                    var _this = this;
                    $.ajax({
                        url: url,
                        context: $('#mainContainer'),
                        type: 'POST'
                    }).done(function(data) {
                        removeActives();
                        $(_this.parentNode).addClass('active');
                        $(this).html(data.content);
                    });
                });
            }

            switchMainContent('.menu-downloads-link', '/downloads');
            switchMainContent('.menu-servers-link', '/servers');
            switchMainContent('.menu-filelist-link', '/filelist');
            switchMainContent('.menu-settings-link', '/settings');
        }
    };
});
