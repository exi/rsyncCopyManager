requirejs.config({
    baseUrl: 'javascripts',
    paths: {
        'jquery' : 'http://code.jquery.com/jquery-1.9.1.min',
        'liveQuery' : '/javascripts/lib/jquery.livequery',
        'subscribe' : '/javascripts/lib/jquery.subscribe',
        'domReady' : '/javascripts/lib/domReady'
    }
});

require(['jquery', 'menu/behaviour', 'domReady', 'liveQuery', 'subscribe'], function($, menuBehaviour, domReady) {
    domReady(function() {
        menuBehaviour.apply();
        $('.menu-downloads-link').trigger('click');
    });
});
