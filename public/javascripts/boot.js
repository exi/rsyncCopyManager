requirejs.config({
    baseUrl: 'javascripts',
    paths: {
        'jquery' : 'http://code.jquery.com/jquery-1.9.1.min',
        'liveQuery' : '/javascripts/lib/jquery.livequery',
        'subscribe' : '/javascripts/lib/jquery.subscribe',
        'domReady' : '/javascripts/lib/domReady'
    }
});

require([
    'jquery',
    'menu/behaviour',
    'servers/behaviour',
    'domReady',
    'liveQuery',
    'subscribe'
], function(
    $,
    menuBehaviour,
    serverBehaviour,
    domReady
) {
    domReady(function() {
        menuBehaviour.apply();
        serverBehaviour.apply();
        $('.menu-downloads-link').trigger('click');
    });
});
