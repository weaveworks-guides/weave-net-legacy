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

var deserializer = require('./token-entry-deserializer.js');
var encoding = require('./token-cache-encoding');
var keychain = require('./osx-keychain');

var description = 'azure access token';

/**
 * Constructs a new token storage that stores credentials
 * in the OSX default keychain.
 * @constructor
 */
function KeychainTokenStorage() {}

_.extend(KeychainTokenStorage.prototype, {
  
  loadEntries: function (callback) {
    var entries = [];
    keychain.list()
      .pipe(es.map(function (entry, cb) {
        if (entry.desc !== description) {
          // Not ours, drop it.
          return cb();
        }

        // Get the password, that's the actual entry
        keychain.get(entry.acct, entry.svce, function (err, password) {
          if (err) {
            return cb(err);
          }
          cb(null, deserializer.deserializeEntry(encoding.decodeObject(password)));
        });
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
    function removeEntry(entry, callback) {
      var key = encoding.encodeObject(_.omit(entry, ['accessToken', 'refreshToken']));
      keychain.remove(key, entry.resource, null, callback);
    }
    
    async.eachSeries(entriesToRemove, removeEntry, callback);
  },

  addEntries: function (newEntries, existingEntries, callback) {
    function addEntry(entry, callback) {
      var key = encoding.encodeObject(_.omit(entry, ['accessToken', 'refreshToken']));
      var password = encoding.encodeObject(entry);
      keychain.set(key, entry.resource, description, password, callback);
    }
    
    async.eachSeries(newEntries, addEntry, callback);
  },

  clear: function (callback) {
    var self = this;
    self.loadEntries(function(err, entries) {
      if (err) return callback(err);
      function clearEntry(entry, callback) {
        keychain.remove(null, null, description, callback);
      }
      async.eachSeries(entries, clearEntry, callback);
    });
  },
});

module.exports = KeychainTokenStorage;
