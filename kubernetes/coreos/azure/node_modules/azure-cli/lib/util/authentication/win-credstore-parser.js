/**
* Copyright (c) Microsoft.  All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

//
// Parser for the output of the creds.exe helper program.
//

var _ = require('underscore');
var es = require('event-stream');
var stream = require('readable-stream');
var util = require('util');

var Transform = stream.Transform;

//
// Regular expression to match the various fields in the input.
//

var fieldRe = /^([^:]+):\s(.*)$/;

//
// Convert space separated pascal caps ("Target Type")
// to camel case no spaces ("targetType"). Used to Convert
// field names to property names.
//
function fieldNameToPropertyName(fieldName) {
  var parts = fieldName.split(' ');
  parts[0] = parts[0].toLowerCase();
  return parts.join('');
}

//
// Simple streaming parser. It's in one of two states:
// 0 - Waiting for an entry
// 1 - in an entry
//
// At the ending blank line (each entry has one) we output
// the accumulated object.
//

function WinCredStoreParsingStream() {
  Transform.call(this, {
    objectMode: true
  });

  this.currentEntry = null;
}

util.inherits(WinCredStoreParsingStream, Transform);

_.extend(WinCredStoreParsingStream.prototype, {
  _transform: function (chunk, encoding, callback) {
    var match;
    var line = chunk.toString();
    var count = 0;

    while (line !== null) {
      ++count;
      if (count > 2) {
        return callback(new Error(util.format('Multiple passes attempting to parse line [%s]. Possible bug in parser and infinite loop', line)));
      }

      if (this.currentEntry === null) {
        if (line !== '') {
          this.currentEntry = {};
          // Loop back around to process this line.
          continue;
        }
        // Skip blank lines between items.
        line = null;
      }

      if (this.currentEntry) {
        if (line !== '') {
          match = fieldRe.exec(line);
          var key = fieldNameToPropertyName(match[1]);
          var value = match[2];
          this.currentEntry[key] = value;
          line = null;
        } else {
          // Blank line ends an entry
          this.push(this.currentEntry);
          this.currentEntry = null;
          line = null;
        }
      }
    }

    callback();
  },

  _flush: function (callback) {
    if (this.currentEntry) {
      this.push(this.currentEntry);
      this.currentEntry = null;
    }
    callback();
  }
});

function createParsingStream() {
  return es.pipeline(es.split(), new WinCredStoreParsingStream());
}

createParsingStream.ParsingStream = WinCredStoreParsingStream;

module.exports = createParsingStream;
