define(['jquery'], function($) {
    return {
        apply: function() {
            function removeActives() {
                $('.nav > li.active').removeClass('active');
            }

            $('.menu-downloads-link').livequery('click', function(event) {
                var _this = this;
                removeActives();
                $.ajax({
                    url: '/downloads',
                    context: $('#mainContainer'),
                    type: 'POST'
                }).done(function(data) {
                    $(_this.parentNode).addClass('active');
                    $(this).html(data.content);
                });
            });

            $('.menu-servers-link').livequery('click', function(event) {
                var _this = this;
                removeActives();
                $.ajax({
                    url: '/servers',
                    context: $('#mainContainer'),
                    type: 'POST'
                }).done(function(data) {
                    $(_this.parentNode).addClass('active');
                    $(this).html(data.content);
                });
            });
        }
    };
});
