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
// Parser for the output of the security(1) command line.
//

var _ = require('underscore');
var es = require('event-stream');
var stream = require('readable-stream');
var util = require('util');

//
// Regular expressions that match the various fields in the input
//

// Fields at the root - not attributes
var rootFieldRe = /^([^:]+):(?: (?:"([^"]+)")|(.*))?$/;

// Attribute values, this gets a little more complicated
var attrRe = /^    (?:(0x[0-9a-fA-F]+) |"([a-z]{4})")<[^>]+>=(?:(<NULL>)|"([^"]+)"|(0x[0-9a-fA-F]+)(?:  "([^"]+)")?)/;

//
// Stream based parser for the OSX security(1) program output.
// Implements a simple state machine. States are:
//
//   0 - Waiting for the initial "keychain" string.
//   1 - Waiting for the "attributes" string. adds any properties to the
//       current entry object being parsed while waiting.
//   2 - reading attributes. Continues adding the attributes to the
//       current entry object until we hit either a non-indented line
//       or end. At which point we emit.
//

var Transform = stream.Transform;

function OsxSecurityParsingStream() {
  Transform.call(this, {
    objectMode: true
  });

  this.currentEntry = null;
  this.state = 0;
}

util.inherits(OsxSecurityParsingStream, Transform);

_.extend(OsxSecurityParsingStream.prototype, {
  _transform: function (chunk, encoding, callback) {
    var match;
    var value;
    var line = chunk.toString();
    var count = 0;

    while (line !== null && line !== '') {
      ++count;
      if (count > 2) {
        return callback(new Error('Multiple passes attempting to parse line [' + line + ']. Possible bug in parser and infinite loop'));
      }

      switch(this.state) {
        case 0:
          match = rootFieldRe.exec(line);
          if (match !== null) {
            if (match[1] === 'keychain') {
              this.currentEntry = {
                keychain: match[2]
              };
              this.state = 1;
              line = null;
            } else {
              this.currentEntry[match[1]] = match[2] || match[3];
            }
          }

          break;

        case 1:
          match = rootFieldRe.exec(line);
          if (match !== null) {
            if (match[1] !== 'attributes') {
              this.currentEntry[match[1]] = match[2];
              line = null;
            } else {
              this.state = 2;
              line = null;
            }
          }
          break;

        case 2:
          match = attrRe.exec(line);
          if (match !== null) {
            // Did we match a four-char named field? We don't care about hex fields
            if (match[2]) {
              // We skip nulls, and grab text rather than hex encoded versions of value
              value = match[6] || match[4];
              if (value) {
                this.currentEntry[match[2]] = value;
              }
            }
            this.state = 2;
            line = null;
          } else {
            // Didn't match, so emit current entry, then
            // reset to state zero and start processing for the
            // next entry.
            this.push(this.currentEntry);
            this.currentEntry = null;
            this.state = 0;
          }
          break;
      }
    }
    callback();
  },

  _flush: function (callback) {
    if (this.currentEntry) {
      this.push(this.currentEntry);
    }
    callback();
  }
});

function createParsingStream() {
  return es.pipeline(es.split(), new OsxSecurityParsingStream());
}

createParsingStream.ParsingStream = OsxSecurityParsingStream;

module.exports = createParsingStream;
