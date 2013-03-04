var database = require('../../database.js');
var util = require('../util.js');
var Promise = require('node-promise').Promise;
var all = require('node-promise').all;

function getCategories() {
    var p = new Promise();
    function reject(err) {
        p.reject(err);
    }

    database(function(err, models) {
        if (err) {
            return reject(err);
        }
        models.Category.all().success(function(categories) {
            p.resolve(categories);
        }).error(reject);
    });

    return p;
}

function getDownloads(user) {
    var p = new Promise();

    function reject(err) {
        p.reject(err);
    }

    database(function(err, models) {
        if (err) {
            return reject(err);
        }
        models.Download.all().success(function(downloads) {
            p.resolve(downloads);
        }).error(reject);
    });

    return p;
}

function getDownloadsAndCategories(user) {
    var p = new Promise();
    var promises = [new Promise(), new Promise()];

    function resolve(data) {
        p.resolve({
            downloads: data[0],
            categories: data[1]
        });
    }

    function reject(err) {
        p.reject(err);
    }

    getDownloads(user).then(function(downloads) {
        promises[0].resolve(downloads);
    }, reject);

    getCategories().then(function(cats) {
        promises[1].resolve(cats);
    }, reject);

    all(promises).then(resolve, reject);

    return p;
}

function convertDownloadsForView(downloads, user) {
    var ret = [];

    downloads.sort(function sort(a, b) {
        if (a.UserId ===  b.UserId) {
            return a.id - b.id;
        }
        return a.UserId === user.id ? -1 : 1;
    });

    downloads.forEach(function(download) {
        ret.push({
            id: download.id,
            path: download.path,
            categoryId: download.CategoryId,
            owns: user.isAdmin || download.UserId === user.id ? true : false
        });
    });

    return ret;
}

function getDownloadWithId(req, id, permissive) {
    var p = new Promise();

    function resolve(downloads) {
        if (downloads.length > 0) {
            p.resolve(downloads[0]);
        } else {
            p.reject();
        }
    }

    function reject(err) {
        p.reject(err);
    }

    if (req.session.user.isAdmin || permissive) {
        database(function(err, models) {
            if (err) {
                return reject(err);
            }
            models.Download.findAll({
                where: {
                    id: id
                }
            }).success(resolve).error(reject);
        });
    } else {
        req.session.user.getDownloads({
            where: {
                id: id
            }
        }).success(resolve).error(reject);
    }

    return p;
}

function sendDownloadList(res, user) {
    var efun = util.wrapErrorFunction(res);
    getDownloadsAndCategories(user).then(function(data) {
        res.render(
            'downloads-list',
            {
                downloads: convertDownloadsForView(data.downloads, user),
                categories: data.categories
            },
            function(err, content) {
                if (err) {
                    return efun(err);
                }
                res.json({ type: 'success', content: content });
            }
        );
    }, efun);
}

module.exports.apply = function(dependencies, app) {

    app.post('/downloads', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        getDownloadsAndCategories(req.session.user).then(function(data) {
            res.render(
                'downloads',
                {
                    downloads: convertDownloadsForView(data.downloads, req.session.user),
                    categories: data.categories
                },
                function(err, content) {
                    if (err) {
                        return efun(err);
                    }
                    res.json({content: content});
                }
                );
        }, efun);
    });

    app.post('/downloads/status', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        getDownloads(req.session.user).then(function(downloads) {
            var promises = [];
            var statuses = [];
            downloads.forEach(function(download) {
                promises.push(dependencies.downloadManager.getDownloadStatus(download.id).then(function(status) {
                    var content = {
                        id: download.id,
                        transferred: 0,
                        rate: 0,
                        active: false,
                        progress: 0,
                        eta: '',
                        status: 'Idle'
                    };
                    var msgs = [];

                    if (status.active) {
                        content.active = true;
                        msgs.push('Downloading');
                    }

                    if (status.downloadStatus) {
                        var dls = status.downloadStatus;
                        if (dls.percent) {
                            content.progress = dls.percent;
                        }

                        if (dls.bytes) {
                            content.transferred = util.convertToHumanReadableSize(dls.bytes);
                        }

                        if (dls.rate) {
                            content.rate = dls.rate || '';
                        }

                        if (dls.eta) {
                            content.eta = dls.eta || '';
                        }
                    }

                    if (status.movingFiles === true) {
                        msgs.push('Moving files to destination.');
                    }

                    if (status.fileStatus) {
                        msgs.push('' + status.fileStatus.left + ' left (' + status.fileStatus.total + ' total)');
                    }

                    if (status.complete) {
                        msgs.push('Complete');
                        content.progress = 100;
                        content.rate = '';
                    }

                    if (status.serverOffline) {
                        if (status.lastActivity) {
                            var offset = (Date.now() - status.lastActivity.getTime()) / 1000;
                            var hours = offset / (60 * 60);
                            var minutes = '' + Math.floor((hours - Math.floor(hours)) * 60);
                            minutes = minutes.length == 1 ? '0' + minutes : minutes;
                            hours = Math.floor(hours);

                            msgs.push('Offline for ' + hours + ':' + minutes);
                        } else {
                            msgs.push('Server offline');
                        }
                    }

                    if (status.noMatchingServer) {
                        msgs.push('No matching server found');
                    }

                    if (status.moveError) {
                        msgs.push('Error moving files!');
                    }

                    if (status.queued) {
                        var msg = 'Queued';
                        if (status.queuePosition !== undefined) {
                            msg += ' (' + status.queuePosition + ')';
                        }
                        msgs.push(msg);
                    }

                    content.status = msgs.length > 0 ? msgs.join(',') : content.status;
                    statuses.push(content);
                }, function(err) {
                    if (err && err.message) {
                        statuses.push({
                            id: download.id,
                            status: err.message
                        });
                    } else {
                        statuses.push({
                            id: download.id,
                            status: 'Unknown error appeared'
                        });
                    }
                }));
            });

            all(promises).then(function() {
                util.sendSuccess(res, statuses);
            });

        }, efun);
    });

    app.post('/downloads/del', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || req.body.id === undefined) {
            return efun('Invalid Request!');
        }

        var id = parseInt(req.body.id, 10);
        getDownloadWithId(req, id).then(function(download) {
            res.render(
                'downloads-delete',
                { 
                    path: download.path,
                    id: download.id
                },
                function(err, content) {
                    res.json({ type: 'success', content: content });
                }
            );
        }, function() {
            efun('Download not found!');
        });
    });

    app.post('/downloads/del-confirm', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || req.body.id === undefined || req.body.deleteData === undefined) {
            return efun('Invalid Request!');
        }

        var id = parseInt(req.body.id, 10);
        getDownloadWithId(req, id).then(function(download) {
            dependencies.downloadManager.delDownload(download.id, req.body.deleteData === 'true').then(function() {
                database(function(err, models) {
                    if (err) {
                        return efun(err);
                    }

                    models.Download.count().success(function(c) {
                        if (c > 0) {
                            util.sendSuccess(res);
                        } else {
                            sendDownloadList(res, req.session.user);
                        }
                    }).error(efun);
                });
            }, efun);
        }, function() {
            efun('Download not found!');
        });
    });

    app.post('/downloads/changeCategory', function(req, res) {
        var efun = util.wrapErrorFunction(res);
        if (!req.body || !req.body.id || !req.body.categoryId) {
            return efun('Invalid request.');
        }

        var categoryId = parseInt(req.body.categoryId, 10);
        var id = parseInt(req.body.id, 10);

        database(function(err, models) {
            if (err) {
                return efun(err);
            }
            models.Category.find(categoryId).success(function(cat) {
                if (cat === null) {
                    return efun('Category not found!');
                }
                getDownloadWithId(req, id).then(function(download) {
                    download.CategoryId = categoryId;
                    download.save(['CategoryId']).success(function() {
                        util.sendSuccess(res);
                    }).error(efun);
                }, function() {
                    efun('Download not found!');
                });
            }).error(efun);
        });
    });
};
