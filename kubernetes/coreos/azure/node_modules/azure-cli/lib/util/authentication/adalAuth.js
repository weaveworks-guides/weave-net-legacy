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

var os = require('os');
var path = require('path');

var async = require('async');
var _ = require('underscore');
var adal = require('adal-node');

var utils = require('../utils');
var defaultTokenCacheFile = path.join(utils.azureDir(), 'accessTokens.json');

var TokenStorage;
if (os.platform() === 'darwin') {
  TokenStorage = require('./osx-token-storage');
} else if (os.platform() === 'win32') {
  TokenStorage = require('./win-token-storage');
} else {
  TokenStorage = require('./file-token-storage');
}
var TokenCache = require('./token-cache');

var logging = require('../logging');

function turnOnLogging() {
  var log = adal.Logging;
  log.setLoggingOptions(
    {
      level : log.LOGGING_LEVEL.VERBOSE,
      log : function (level, message, error) {
        logging.info(message);
        if (error) {
          logging.error(error);
        }
      }
    });
}

if (process.env['AZURE_ADAL_LOGGING_ENABLED']) {
  turnOnLogging();
}

//
// A list of known azure test endpoints for active directory.
// Turn off authority verification if authority is one of these.
//
var knownTestEndpoints = [
  'https://login.windows-ppe.net',
  'https://sts.login.windows-int.net'
];

function isKnownTestEndpoint(authorityUrl) {
  return _.some(knownTestEndpoints, function (endpoint) {
    return utils.ignoreCaseEquals(endpoint, authorityUrl);
  });
}


// Add the '.onmicrosoft.com' suffix to the user name if no present
function normalizeUserName(username) {
  var match = username.match(/^([^@]+@)([^.]+)$/);
  if (match !== null) {
    username = match[1] + match[2] + '.onmicrosoft.com';
  }
  return username;
}

function createAuthenticationContext(authConfig) {
  var authorityUrl = authConfig.authorityUrl + '/' + authConfig.tenantId;
  var validateAuthority = !isKnownTestEndpoint(authConfig.authorityUrl);
  
  return new adal.AuthenticationContext(authorityUrl, validateAuthority, exports.tokenCache);
}


function removeCachedToken(username, tenantId, cache, done) {
  if (typeof cache === 'function') {
    done = cache;
    cache = exports.tokenCache;
  }
  var entriesToRemove = [];
  //To simplify the code, do clean up regardless of the user type.
  //Because cached token only loads once, the perf hit is minimum.
  async.each(
    [{ userId: username }, { _clientId: username }, { servicePrincipalId: username }],
    function (query, cb) {
      if (tenantId) {
        query.tenantId = tenantId;
      }
      cache.find(query, function (err, found) {
        if (err) return cb(err);
        entriesToRemove = entriesToRemove.concat(found);
        cb(null);
      });
    },
    function (err) {
      if (err) return done(err);
      cache.remove(entriesToRemove, done);
    });
}

_.extend(exports, {
  defaultTokenCacheFile: defaultTokenCacheFile,
  tokenCache: new TokenCache(new TokenStorage(defaultTokenCacheFile)),
  createAuthenticationContext: createAuthenticationContext,
  normalizeUserName: normalizeUserName,
  removeCachedToken: removeCachedToken
});
