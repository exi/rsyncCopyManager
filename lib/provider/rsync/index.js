var downloader = require('./downloader.js');
var scanner = require('./scanner.js');
var viewConverter = require('./viewConverter.js');
var model = require('./model.js');
var formDataLoader = require('./formDataLoader.js');

module.exports = {
    downloader: downloader,
    formDataLoader: formDataLoader,
    model: model,
    scanner: scanner,
    viewConverter: viewConverter
};
