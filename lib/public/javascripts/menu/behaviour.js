define(['jquery'], function($) {
    var pages = {
        Downloads: {
            query: '.menu-downloads-link',
            url: '/downloads',
            title: 'Downloads'
        },
        Servers: {
            query: '.menu-servers-link',
            url: '/servers',
            title: 'Servers'
        },
        Filelist: {
            query: '.menu-filelist-link',
            url: '/filelist',
            title: 'Filelist'
        },
        Settings: {
            query: '.menu-settings-link',
            url: '/settings',
            title: 'Settings'
        }
    };

    var currentHash;

    return {
        apply: function() {
            function removeActives() {
                $('.nav > li.active').removeClass('active');
            }

            var loader = null;
            var placeholder = null;

            $('<img />').attr('src', '/images/pacman.gif').load(function() {
                placeholder = this;
            });

            function switchMainContent(hash) {
                var descriptor = pages[hash];
                $(descriptor.query).livequery('click', function(event) {
                    if (loader !== null) {
                        loader.abort();
                    }
                    $('#mainContainer').empty();
                    if (placeholder !== null) {
                        $('.loading-screen').empty().append(placeholder).css('display', '');
                    }
                    removeActives();
                    $(this.parentNode).addClass('active');
                    loader = $.ajax({
                        url: descriptor.url,
                        context: $('#mainContainer'),
                        type: 'POST'
                    }).done(function(data) {
                        $('.loading-screen').css('display', 'none');
                        $(this).html(data.content);
                        currentHash = hash;
                        loader = null;
                    });
                });
            }

            for (var i in pages) {
                switchMainContent(i);
            }

            function goToHash(useDefault) {
                var hash = window.location.hash;

                if (hash && hash.length > 0) {
                    hash = hash.substring(1, hash.length);
                }

                if (pages.hasOwnProperty(hash) && currentHash !== hash) {
                    $(pages[hash].query).trigger('click');
                } else if (useDefault) {
                    $(pages.Downloads.query).trigger('click');
                }
            }

            goToHash(true);

            $(window).bind('hashchange', function(e) {
                goToHash();
            });

            $('.space-left').livequery(function() {
                var this_ = this;
                var updatefunc = function () {
                    $.ajax({
                        url: '/spaceLeft',
                        type: 'POST'
                    }).always(function(data) {
                        if (data && data.content) {
                            $(this_).html(data.content);
                        }
                        this_.refreshTimer = setTimeout(updatefunc, 1000 * 30);
                    });
                };
                updatefunc();
            }, function() {
                clearTimeout(this.refreshTimer);
            });
        }
    };
});
