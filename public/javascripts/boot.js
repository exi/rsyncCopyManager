requirejs.config({
    baseUrl: 'javascripts',
    paths: {
        'jquery' : 'http://code.jquery.com/jquery-1.9.1.min',
        'bootstrap' : '/lib/bootstrap/js/bootstrap.min',
        'liveQuery' : '/lib/jquery.livequery',
        'fileTree' : '/lib/jqueryFileTree/jqueryFileTree',
        'subscribe' : '/lib/jquery.subscribe',
        'domReady' : '/lib/domReady'
    }
});

require([
    'jquery',
    'menu/behaviour',
    'servers/behaviour',
    'filelist/behaviour',
    'domReady',
    'bootstrap',
    'liveQuery',
    'subscribe',
    'fileTree'
], function(
    $,
    menuBehaviour,
    serverBehaviour,
    filelistBehaviour,
    domReady
) {
    domReady(function() {
        menuBehaviour.apply();
        serverBehaviour.apply();
        filelistBehaviour.apply();
        $('.menu-downloads-link').trigger('click');
    });
});
