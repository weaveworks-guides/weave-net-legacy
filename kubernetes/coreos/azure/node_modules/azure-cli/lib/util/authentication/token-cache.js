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

/**
 * Constructs a new token cache that works with adal-node
 * @constructor
 */
function TokenCache(tokenStorage) {
  this._entries = null;
  this._tokenStorage = tokenStorage;
}

_.extend(TokenCache.prototype, {
  /**
  * Load the cache entries. Does a lazy load,
  * loads from OS on first request, otherwise
  * returns in-memory copy.
  *
  * @param {function(err, Array)} callback callback
  *                               receiving cache entries.
  */
  _loadEntries: function (callback) {
    var self = this;
    if (self._entries !== null) {
      return callback(null, self._entries);
    }
    
    self._tokenStorage.loadEntries(function (err, entries) {
      if (!err) {
        self._entries = entries;
      }
      self._normalizeUserId(entries);
      callback(err, entries);
    });
  },
  
  _normalizeUserId: function (entries) {
    entries.forEach(function (entry) {
      if (entry.userId) {
        entry.userId = entry.userId.toLowerCase();
      }
    });
  },
  
  isSecureCache: function () {
    return this._tokenStorage.isSecureCache;
  },
  
  /**
   * Removes a collection of entries from the cache in a single batch operation.
   * @param  {Array}   entries  An array of cache entries to remove.
   * @param  {Function} callback This function is called when the operation is complete.  Any error is provided as the
   *                             first parameter.
   */
  remove: function remove(entries, callback) {
    var self = this;
    
    self._normalizeUserId(entries);
    
    function shouldKeep(entry) {
      //Note, '_findWhere' doesn't do deep comparision, so exlcude fields with object type 
      if (_.findWhere(entries, _.omit(entry, 'expiresOn'))) {
        return false;
      }
      return true;
    }
    
    self._loadEntries(function (err, _entries) {
      if (err) { return callback(err); }
      
      var grouped = _.groupBy(_entries, shouldKeep);
      var entriesToRemove = grouped[false] || [];
      var entriesToKeep = grouped[true] || [];
      
      self._tokenStorage.removeEntries(entriesToRemove, entriesToKeep, function (err) {
        if (!err) {
          self._entries = entriesToKeep;
        }
        callback(err);
      });
    });
  },
  
  /**
   * Clears a collection of entries from the cache in a single batch operation.
   * @param  {Function} callback This function is called when the operation is complete.  Any error is provided as the
   *                             first parameter.
   */
  clear: function clear(callback) {
    this._tokenStorage.clear(callback);
  },
  
  /**
   * Adds a collection of entries to the cache in a single batch operation.
   * @param {Array}   entries  An array of entries to add to the cache.
   * @param  {Function} callback This function is called when the operation is complete.  Any error is provided as the
   *                             first parameter.
   */
  add: function add(newEntries, callback) {
    var self = this;
    self._normalizeUserId(newEntries);
    async.waterfall([
      //load existing entries
      function (cb) {
        self._loadEntries(cb);
      },

      //clean up entries with same fields.
      function (existingEntries, cb) {
        //'self._entries' should be the same with existingEntries
        async.eachSeries(newEntries, 
          function (e, cb2) {
            var query = {
              _clientId: e._clientId,
              userId: e.userId,
              _authority: e._authority
            };
            self.find(query, function (err, result) {
              if (result && result.length !== 0) {
                return self.remove(result, cb2);
              }
              return cb2(err);
            });
          },
          function (err) { return cb(err); }
        );
      },

      //add all newEntries
      function (cb) {
        self._tokenStorage.addEntries(newEntries, self._entries, function (err) {
          if (err) return cb(err);
          newEntries.forEach(function (entry) {
            self._entries.push(entry);
          });
          return cb(null);
        });
      }
    ],
    function (err) {
      return callback(err);
    });
  },
  
  /**
   * Finds all entries in the cache that match all of the passed in values.
   * @param  {object}   query    This object will be compared to each entry in the cache.  Any entries that
   *                             match all of the values in this object will be returned.  All the values
   *                             in the passed in object must match values in a potentialy returned object
   *                             exactly.  The returned object may have more values than the passed in query
   *                             object.
   * @param  {TokenCacheFindCallback} callback
   */
  find: function find(query, callback) {
    var self = this;
    
    self._normalizeUserId([query]);
    self._loadEntries(function (err, _entries) {
      if (err) { return callback(err); }
      var results = _.where(_entries, query);
      callback(null, results);
    });
  }
});

module.exports = TokenCache;
