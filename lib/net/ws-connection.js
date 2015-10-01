//     telegram-mt-node - WebSocket transport layer
//
//     Copyright 2015 Jesús Leganés Combarro 'piranna@gmail.com'
//     Released under the MIT License
//     https://github.com/enricostara/telegram-mt-node

//     WsConnection class
//
// This class provides a WebSocket to communicate with `Telegram` using `MTProto` protocol

// Import dependencies
var util = require('util');

var logger    = require('get-log')('net.WsConnection');
var WebSocket = require('ws');


function noop(){}


// The constructor accepts optionally an object to specify the connection address as following:
//
//     new WsConnection({host: "173.240.5.253", port: "443"});
//
// `localhost:80` address is used as default otherwise
function WsConnection(url) {
  Object.defineProperty(this, 'url', {value: url, enumerable: true})

  logger.debug('Created with %s', this.url);
}

// This method opens the connection and calls back when done
WsConnection.prototype.connect = function (callback) {
  callback = callback || noop

  var self = this;

  logger.debug('Connecting to %s', self.url);
  if (this._socket) return callback();

  function onError(e) {
    logger.error('Error %s connecting to %s', e.code, self.url);
    self._socket = undefined;

    callback(e);
  };

  var socket = new WebSocket(this.url);

  socket.addEventListener('error', onError);
  socket.addEventListener('open', function(event)
  {
    socket.removeListener('error', onError);

    logger.debug('Connected to ' + self.url);

    var abridgedFlag = new Buffer(1);
    abridgedFlag.writeUInt8(0xef, 0);

    logger.debug('Sending abridgedFlag to ' + self.url);

    try
    {
      socket.send(abridgedFlag)

      logger.debug('AbridgedFlag sent to ' + self.url);
      callback();
    }
    catch(e)
    {
      logger.debug('Error sending AbridgedFlag to ' + self.url);
      callback(e);
    }
  })

  this._socket = socket;
};

WsConnection.prototype.isConnected = function () {
  return this._socket;
};

// This method writes the given data and calls back when done
WsConnection.prototype.write = function (data, callback) {
  callback = callback || noop

  var socket = this._socket;
  if (!socket) return callback(createError('Not yet connected', 'ENOTCONNECTED'));

  if ((data.length % 4) !== 0)
    return callback(createError('Data length must be multiple of 4', 'EMULTIPLE4'));

  if (!Buffer.isBuffer(data)) {
    logger.debug('Given data is not a Buffer');

    data = new Buffer(data);
  }

  var message = Message({message: data});
  var request = message.serialize();
  logger.debug('Writing %s to %s', request.toString('hex'), this.url);

  try
  {
    socket.send(request)

    logger.debug('Wrote %s bytes to %s', request.length, this.url);
    callback();
  }
  catch(e)
  {
    logger.error('Error %s writing %s bytes to %s', e.code, request.length, this.url);
    callback(e);
  }
};

// This method reads the data from the connection and calls back when done
WsConnection.prototype.read = function (callback) {
  callback = callback || noop

  var self = this;

  logger.debug('Reading from %s', this.url);

  var socket = this._socket;
  if (!socket) return callback(createError('Not yet connected', 'ENOTCONNECTED'));

  function onError(e) {
    socket.removeListener('error', onError);
    socket.removeListener('message', onMessage);

    logger.error('Error %s reading from %s', e.code, self.url);
    callback(e);
  };
  function onMessage(message) {
    socket.removeListener('error', onError);
    socket.removeListener('message', onMessage);

    var payload = Message({buffer: message.data}).deserialize().getMessage();

    logger.debug('Read %s bytes from %s', payload.toString('hex'), self.url);

    callback(null, payload);
  };

  socket.addEventListener('error', onError);
  socket.addEventListener('message', onMessage);
};

// This method close the connection and calls back when done
WsConnection.prototype.close = function (callback) {
  callback = callback || noop

  var socket = this._socket;
  if(!socket) return callback();

  this._socket = undefined;

  logger.debug('Disconnecting from ' + this.url);
  socket.close();
  logger.debug('Disconnected from ' + this.url);

  callback();
};

function createError(msg, code) {
  var error = new Error(msg);
  error.code = code;

  return error;
}


var TypeObject = require("telegram-tl-node").TypeObject;

// WsConnection inner class:
//
//     WsConnection.Message class
//
// To get an instance for `serialization`:
//
//     new WsConnection.Message({message: myMessageBuffer});
// Provide the payload as `Buffer`:
//
// To get an instance for `de-serialization`:
//
//     new WsConnection.Message({buffer: myBuffer});
// Provide a `buffer` containing the plain message from which extract the payload
//
// The `constructor`:
function Message(options)
{
  if(!(this instanceof Message)) return new Message(options)

  var opts = options || {};
  this._message = opts.message;

  WsConnection.super_.call(this, opts.buffer, opts.offset);

  if(this._message)
    this._message = Buffer.isBuffer(this._message)
                  ? this._message
                  : new Buffer(this._message, 'hex');
};
util.inherits(Message, TypeObject);

Message.logger = logger;


// This method serialize the Message
Message.prototype.serialize = function () {
  if (!this._message) return false;

  this.writeBytes(this._message, true);

  return this.retrieveBuffer();
};

// This method de-serialize the Message
Message.prototype.deserialize = function () {
  if (!this.isReadonly()) return false;

  this._message = this.readBytes(true);

  return this;
};

// This method returns the payload
Message.prototype.getMessage = function () {
  return this._message;
};


WsConnection.Message = Message


// Export the class
module.exports = WsConnection;
