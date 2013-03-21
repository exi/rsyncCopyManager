requirejs.config({
    baseUrl: 'javascripts',
    paths: {
        'jquery' : '/lib/jquery-1.9.1.min',
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
    'downloads/behaviour',
    'settings/behaviour',
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
    downloadsBehaviour,
    settingsBehaviour,
    domReady
) {
    domReady(function() {
        menuBehaviour.apply();
        serverBehaviour.apply();
        filelistBehaviour.apply();
        downloadsBehaviour.apply();
        settingsBehaviour.apply();

        $('.login-username').focus();
    });
});
