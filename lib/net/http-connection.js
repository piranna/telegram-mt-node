//     telegram-mt-node
//     Copyright 2014 Enrico Stara 'enrico.stara@gmail.com'
//     Released under the MIT License
//     https://github.com/enricostara/telegram-mt-node

//     HttpConnection class
//
// This class provides a HTTP transport to communicate with `Telegram` using `MTProto` protocol

// Import dependencies
var http = require('http');
var util = require('util');

var logger = require('get-log')('net.HttpConnection');

var httpPath = '/apiw1';

// The constructor accepts optionally an object to specify the connection address as following:
//
//     new HttpConnection({host: "173.240.5.253", port: "443"});
//
// `localhost:80` address is used as default otherwise
function HttpConnection(options) {
    options = options ?
        ({
            protocol: (options.protocol || 'http:'),
            host: (options.host || 'localhost'),
            port: (options.port || '80'),
            path: httpPath,
            withCredentials: false
        }) :
        ({
            path: 'http://localhost:80' + httpPath
        });
    this.options = util._extend({
        localAddress: process.env.LOCAL_ADDRESS
    }, options);
    this._config = JSON.stringify(this.options);
    if (logger.isDebugEnabled()) {
        logger.debug('created with %s', this._config);
    }
}

HttpConnection.prototype.connect = function (callback) {
    if (logger.isDebugEnabled()) {
        logger.debug('connected to %s', this._config);
    }
    this._writeBuffers = [];
    this._writeOffset = 0;
    this._connected = true;
    if (callback) {
        setTimeout(callback, 0);
    }
};

HttpConnection.prototype.isConnected = function () {
    return this._connected;
};

HttpConnection.prototype.write = function (data, callback) {
    this._writeBuffers.push(data);
    this._writeOffset += data.length;
    if (logger.isDebugEnabled()) {
        logger.debug('add buffer(%s) to the write buffer queue, total length %s',
            data.length, this._writeOffset);
    }
    if (callback) {
        setTimeout(callback, 0);
    }
};

HttpConnection.prototype.read = function (callback) {
    var options = util._extend(this.options, {
        method: (this._writeOffset === 0 ? 'GET' : 'POST'),
        responseType: 'arraybuffer'
    });
    this._request = this._createRequest(options, callback);

    this._request.removeHeader('Accept');
    this._request.removeHeader('Connection');
    this._request.removeHeader('Content-Length');
    this._request.removeHeader('Content-Type');

    var request = Buffer.concat(this._writeBuffers);
    this._writeBuffers = [];
    this._writeOffset = 0;

    logger.debug('accept = %s\nconnection = %s\ncontent-length = %s\ncontent-type = %s\nhost = %s\n',
        this._request.getHeader('Accept'),
        this._request.getHeader('Connection'),
        this._request.getHeader('Content-Length'),
        this._request.getHeader('Content-Type'),
        this._request.getHeader('Host'));
    logger.debug('writing request(%s) to %s', request.length, this._config);

    this._request.end(request);
};

HttpConnection.prototype._createRequest = function (options, callback) {
  callback = callback || function(){}

  var request = http.request(options, function (res)
  {
    logger.debug('reading from %s\nstatus: %s\nheaders: %s',
        this._config, res.statusCode, JSON.stringify(res.headers));

    var buffers = [];
    var onData = buffers.push.bind(buffers)

    res.on('data', onData);
    res.once('end', function()
    {
      request.removeListener('error', onError);
      res.removeListener('data', onData);

      var data = Buffer.concat(buffers);
      if (res.statusCode === 200)
        callback(null, data);
      else
        callback(data);
    });
  }.bind(this));

  var onError = function (e) {
    logger.error('Error %s', e.code);
    callback(e);
  };
  request.once('error', onError);
  return request;
};

// Call back, nothing else..
HttpConnection.prototype.close = function(callback)
{
  if(callback)
    setTimeout(callback, 0);

  this._connected = false;
};

// Export the class
module.exports = HttpConnection;
