//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

var util = require('util');
var winston = require('winston');
var common = require('winston/lib/winston/common');
var fs = require('fs');

//
// ### function Console (options)
// #### @options {Object} Options for this instance.
// Constructor function for the Console transport object responsible
// for persisting log messages and metadata to a terminal or TTY.
//
var Silly = exports.Silly = function (options) {
  winston.Transport.call(this, options);
  options = options || {};

  this.name        = 'silly';
  this.output      = '';
  this.json        = options.json        || false;
  this.colorize    = options.colorize    || false;
  this.prettyPrint = options.prettyPrint || false;
  this.stripColors = options.stripColors || true;
  this.timestamp   = options.timestamp   || true;
  this.level       = options.level       || 'silly';
  this.silent      = options.silent      || false;

  if (this.json) {
    this.stringify = options.stringify || function (obj) {
      return JSON.stringify(obj, null, 2);
    };
  }
};

//
// Inherit from `winston.Transport`.
//
util.inherits(Silly, winston.Transport);

//
// Define a getter so that `winston.transports.Silly`
// is available and thus backwards compatible.
//
winston.transports.Silly = Silly;

//
// Expose the name of this Transport on the prototype
//
Silly.prototype.name = 'silly';

Silly.prototype._truncated = false;

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
Silly.prototype.log = function (level, msg, meta, callback) {
  if (this.silent || this._truncated) {
    return callback(null, true);
  }

  var incomingLog = common.log({
    colorize:    this.colorize,
    json:        (level === 'data') ?  true : this.json,
    level:       level,
    message:     msg,
    meta:        meta,
    stringify:   this.stringify,
    timestamp:   (level === 'data') ?  false : this.timestamp,
    prettyPrint: this.prettyPrint,
    raw:         this.raw
  });

  if (this._shouldTruncate(incomingLog)) {
    this.output += '\n...truncated...';
    this._truncated = true;
    return callback(null, true);
  }

  if (this.stripColors) {
    var code = /\u001b\[(\d+(;\d+)*)?m/g;
    this.output += incomingLog.replace(code, '');
  } else {
    this.output += incomingLog;
  }
  this.output += '\n';

  //
  // Emit the `logged` event immediately because the event loop
  // will not exit until `process.stdout` has drained anyway.
  //
  this.emit('logged');
  callback(null, true);
};

Silly.prototype.clear = function () {
  this.output = '';
  this._truncated = false;
};

Silly.prototype.writeToFile = function (filename, append) {
  var writeFileFunction = append ? fs.appendFileSync : fs.writeFileSync;
  writeFileFunction(filename, this.output);
  this.clear();
};

Silly.prototype._shouldTruncate = function (incomingLog) {
  var length = this.output.length;
  if (incomingLog) {
    length += incomingLog.length;
  }
  return length > 1024 * 1024;
};