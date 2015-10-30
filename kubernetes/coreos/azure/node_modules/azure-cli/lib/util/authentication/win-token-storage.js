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

var _ = require('underscore');
var async = require('async');
var es = require('event-stream');
var stream = require('readable-stream');
var util = require('util');

var Transform = stream.Transform;

var credStore = require('./win-credstore');
var deserializer = require('./token-entry-deserializer.js');
var encoding = require('./token-cache-encoding');

// Credential store has size limits, and tokens can
// go beyond them. 640k should be enough for everyone,
// right?
//
// As such, we have to be prepared to split a single
// credential across multiple credstore entries. This
// value controls the size of each chunk.

var MAX_CREDENTIAL_BYTES = 2048;

//
// Takes a single entry and credential, returns an array of
// entry/credential pairs ready to go to the credential store.
// @param{string} targetName target name that will be stored
// @param{string} tokens     string that will be stored as the
//                           actual credential.
//
// @returns {array} The possibly split set of entries for the
//                  credential store.
//
function splitEntry(targetName, tokens) {
  
  // Tokens are ascii, so # of bytes = # of characters.
  var numBytes = tokens.length;
  
  if (numBytes <= MAX_CREDENTIAL_BYTES) {
    return [ [targetName, tokens] ];
  }
  
  var numBlocks = Math.floor(numBytes / MAX_CREDENTIAL_BYTES);
  if (numBlocks % MAX_CREDENTIAL_BYTES !== 0) {
    ++numBlocks;
  }
  
  var blocks = [];
  
  for (var i = 0; i < numBlocks; ++i) {
    blocks.push([util.format('%s--%d-%d', targetName, i, numBlocks),
      tokens.substr(i * MAX_CREDENTIAL_BYTES, MAX_CREDENTIAL_BYTES)]);
  }
  
  return blocks;
}

//
// entry joiner. This is written as a transform stream since
// the logic for reading the cred store is also stream based.
//

function JoinerStream() {
  this.entries = {};
  this.splitRe = /^(.*)--(\d+)-(\d+)$/;
  Transform.call(this, { objectMode: true });
}

util.inherits(JoinerStream, Transform);

_.extend(JoinerStream.prototype, {
  _transform: function (chunk, encoding, callback) {
    // object mode, chunk is actually an object of the form
    // { targetName: n, credential: c }
    var targetName = chunk.targetName;
    var credential = chunk.credential;
    
    var match = targetName.match(this.splitRe);
    if (match !== null) {
      var mainTarget = match[1];
      var blockNum = +match[2];
      var numBlocks = +match[3];
      
      if (!_.has(this.entries, mainTarget)) {
        this.entries[mainTarget] = [];
      }
      
      this.entries[mainTarget][blockNum] = credential;
      
      if (_.compact(this.entries[mainTarget]).length === numBlocks) {
        this.push({
          targetName: mainTarget,
          credential: this.entries[mainTarget].join('')
        });
        delete this.entries[mainTarget];
      }
    } else {
      this.push(chunk);
    }
    callback();
  }
});

/**
 * Constructs a new token storage that stores credentials
 * in the Windows credential store.
 * @constructor
 */
function CredTokenStorage() {}

_.extend(CredTokenStorage.prototype, {
  
  loadEntries: function (callback) {
    var joiner = new JoinerStream();
    var entries = [];
    credStore.list()
      .pipe(joiner)
      .pipe(es.mapSync(function (entry) {
      // Most fields are stored in targetName,
      // access token and refresh token are stored in
      // credentials.
      var authResult = encoding.decodeObject(entry.targetName);
      var credential = encoding.decodeObject(new Buffer(entry.credential, 'hex').toString('utf8'));
      authResult.accessToken = credential.a;
      authResult.refreshToken = credential.r;
      
      return deserializer.deserializeEntry(authResult);
    }))
    .on('data', function (entry) {
      entries.push(entry);
    })
    .on('end', function (err) {
      callback(err, entries);
    });
  },
  
  isSecureCache: true,
  
  removeEntries: function (entriesToRemove, entriesToKeep, callback) {
    function removeEntry(entry, removeCb) {
      var targetName = encoding.encodeObject(_.omit(entry, ['accessToken', 'refreshToken']));
      async.series([
        function (done) {
          credStore.remove(targetName, function () { done(); });
        },
        function (done) {
          credStore.remove(targetName + '--*', function () { done(); });
        }
      ], removeCb);
    }
    
    async.eachSeries(entriesToRemove, removeEntry, callback);
  },
  
  addEntries: function add(newEntries, existingEntries, callback) {
    function addToCredStore(entry, callback) {
      var targetName = encoding.encodeObject(_.omit(entry, ['accessToken', 'refreshToken']));
      var credential = encoding.encodeObject({ a: entry.accessToken, r: entry.refreshToken });
      var entryParts = splitEntry(targetName, credential);
      
      async.eachSeries(entryParts,
        function (entry, entrycb) {
          credStore.set(entry[0], entry[1], entrycb);
        },
        callback);
    }
    
    async.eachSeries(newEntries, addToCredStore, callback);
  },

  clear: function (callback) {
    var self = this;
    self.loadEntries(function(err, entries) {
      self.removeEntries(entries, [], callback);
    });
  },
});

module.exports = CredTokenStorage;
