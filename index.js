
'use strict';

var ftp = require('ftp');
var fs = require('fs');
var path = require('path');


var ftpQueue;
var remoteDirCache = {};
var remoteFileCache = {};


module.exports = function(ret, conf, settings, opt){
    //console.log(conf);
    //console.log(settings);
    //console.log(opt);

    var queue = [],
        root = fis.project.getProjectPath(),
        mapRes = ret['map']['res'];
    settings.dir = '/';
    //console.log(ret);
    // 区分页面与资源文件
    fis.util.map(ret.src, function(subpath, file, index){

        var item = {filepath: file._content || file.cache.cacheFile}, remotepath, hash;

        hash = fis.util.md5(file._content, 7);

        var res = mapRes[file.id];
        remotepath = res && res.uri || file.release || '';

        //item[''] = ;
        item['remotepath'] = remotepath;
        item['hash'] = hash;

        if (remoteFileCache[remotepath] && remoteFileCache[remotepath].hash == hash) {
            return ;
        }

        if (file.isHtmlLike) {
            queue.splice(0, 0, item);
        }else {
            queue.push(item);
        }

    });

    if (!ftpQueue) {
        ftpQueue = createFtpQueue(settings);
    }

    var filter = settings.filter;

    function uploadFile(file, done) {
        var filepath = file.filepath,
            remotepath = file.remotepath,
            remotedir = path.dirname(remotepath);

        if (remoteDirCache[remotedir]) {
            _uploadFile();
        }else {
            ftpQueue.listFiles(remotedir, function(err, list){
                if (!list || list.length == 0) {
                    ftpQueue.addDir(remotedir, function(){
                        _uploadFile();
                    });
                }else {
                    remoteDirCache[remotedir] = list;
                    _uploadFile();
                }
            });
        }
        function _uploadFile(){
            var pathsfiles = remoteDirCache[remotedir] || [],
                filename = path.basename(remotepath),
                isExist = false;
            for (var i = 0; i < pathsfiles.length; i++ ) {
                if (pathsfiles[i].name == filename) {
                    isExist = true;
                    break;
                }
                //console.log(filename + ' ' + pathsfiles[i].name);
            }
            if (isExist) {
                console.log('skip :' + remotepath);
                done && done();
            }else {
                console.log('Ready :' + remotepath);
                ftpQueue.addFile(filepath, remotepath, function(err, val){
                    console.log('upload file: ' + remotepath);
                    remoteFileCache[remotepath] = file;
                    done && done();
                });
            }
        }
    }

    function execute(){
        var file = queue.pop();
        if (!file) {
            ftpQueue.end();
            return ;
        }

        uploadFile(file, function(){
            execute();
        });
    }


    var remotedir = '/';
    ftpQueue.listFiles(remotedir, function(err, list){
        if (!list || list.length == 0) {

        }else {
            remoteDirCache[remotedir] = list;
            execute();
        }
    });

    //execute();

};

module.exports.defaultOptions = {
    remoteDir : '/',
    filter : null,
    console : false,
    connect : {
        host : '127.0.0.1',
        port : '21',
        secure : false,
        user : 'name',
        password : '****',
        secureOptions : undefined,
        connTimeout : 5000,
        pasvTimeout : 10000,
        keepalive : 10000
    }
};

// 参考：
// https://github.com/hitsthings/node-live-ftp-upload/blob/master/index.js
function createFtpQueue(opts) {

    var client;
    var queue = [];

    function initClient(cb) {
        client = new ftp();
        client.on('ready', cb);
        client.on('error', function (err, info){
            var message = err.message;
            if (message == 'connect ETIMEDOUT') {
                return;
            }
            console.log('deploy ftp: error ' + message);
            client.destroy();
        });
        client.connect(opts.connect);
    }
    function consoleinfo(info){
        if (opts.console) {
            console.info(info);
        }
    }

    function getRemoteName(filename) {
        return path.join(opts.remoteDir, path.relative(opts.dir, filename)).replace(/\\/g, '/'); 
    }

    function doSend(filename, remoteName) {
        if (!client) {
            initClient(doSend.bind(null, filename, remoteName));
            return;
        }
        remoteName = getRemoteName(remoteName) || getRemoteName(filename);
        consoleinfo("Uploading " + filename + " as " + remoteName + ".");
        client.put(filename, remoteName, function(err) {
            consoleinfo(err ? "Couldn't upload " + filename + ":\n" + err : filename + ' uploaded.');
            advanceQueue(err);
        });
    }

    function doDelete(filename) {
        if (!client) {
            initClient(doDelete.bind(null, filename));
            return;
        }
        var remoteName = getRemoteName(filename);
        consoleinfo("Deleting  " + remoteName + ".");
        client.delete(remoteName, function(err) {
            consoleinfo(err ? "Couldn't delete " + filename + ":\n" + err : filename + ' deleted.');
            advanceQueue(err);
        });
    }

    function doMkdir(filename) {
        if (!client) {
            initClient(doMkdir.bind(null, filename));
            return;
        }
        var remoteName = getRemoteName(filename);
        consoleinfo("Adding  " + remoteName + ".");
        client.mkdir(remoteName, true, function(err) {
            consoleinfo(err ? "Couldn't add " + filename + ":\n" + err : filename + ' added.');
            advanceQueue(err);
        });
    }

    function doRmdir(filename) {
        if (!client) {
            initClient(doMkdir.bind(null, filename));
            return;
        }
        var remoteName = getRemoteName(filename);
        consoleinfo("Deleting  " + remoteName + ".");
        client.rmdir(remoteName, function(err) {
            consoleinfo(err ? "Couldn't delete " + filename + ":\n" + err : filename + ' deleted.');
            advanceQueue(err);
        });
    }

    function doList(dirname) {
        if (!client) {
            initClient(doList.bind(null, dirname));
            return;
        }
        var remoteName = getRemoteName(dirname);
        consoleinfo("Listing  " + remoteName + ".");

        // some bs to deal with this callback possibly being called multiple times.
        // the result we want is not always the first or last one called.
        var result = [], resultTimer;
        client.list(remoteName, function(err, list) {
            if (err) {
                result = true;
                consoleinfo("Couldn't list " + dirname + ":\n" + err);
                advanceQueue(err, list);
            }
            if (result === true || result.length) return;
            
            if (list && list.length) {
                result = list;
            }
            if (resultTimer) return;
            resultTimer = setTimeout(function() {
                consoleinfo(dirname + ' listed.');
                advanceQueue(null, result);
            }, 100);
        });
    }

    function execute(entry) {
        var file = entry.file;
        var remoteName = entry.remoteName;
        var action = entry.action;
        switch(action) {
            case 'upsert' : doSend(file, remoteName); break;
            case 'delete' : doDelete(file); break;
            case 'mkdir' : doMkdir(file); break;
            case 'rmdir' : doRmdir(file); break;
            case 'list'   : doList(file); break;
            default       : throw new Error("Unexpected action " + action); break;
        }
    }

    function entryEquals(a, b) {
        return a.action === b.action &&
               a.file === b.file
               a.callback === b.callback;
    }

    function addToQueue(entry) {
        if (queue.slice(1).some(entryEquals.bind(null, entry))) {
            return;
        }
        queue.push(entry);
        if (queue.length === 1) {
            execute(entry);
        }
    }

    function advanceQueue(err, currentResult) {
        var finished = queue.shift();
        if (!finished) {
            return ;
        }
        if (finished.callback) {
            finished.callback(err, currentResult);
        }
        if (queue.length) {
            execute(queue[0]);
        }
    }

    function addFile(filename, remoteName, callback) {
        addToQueue({ file : filename, remoteName: remoteName, action : 'upsert', callback : callback });
    }

    function removeFile(filename, callback) {
        addToQueue({ file : filename, action : 'delete', callback : callback });
    }

    function addDir(filename, callback) {
        addToQueue({ file : filename, action : 'mkdir', callback : callback });
    }

    function removeDir(filename, callback) {
        addToQueue({ file : filename, action : 'rmdir', callback : callback });
    }

    function listFiles(dirname, callback) {
        addToQueue({ file : dirname, action : 'list', callback : callback });
    }

    function end(){
        client.end();
    }

    return {
        addFile : addFile,
        removeFile : removeFile,
        addDir : addDir,
        removeDir : removeDir,
        listFiles : listFiles,
        advanceQueue : advanceQueue,
        end : end
    };
}