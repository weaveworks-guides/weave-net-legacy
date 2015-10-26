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

var util = require('util');
var _ = require('underscore');

var TokenCredentials = require('./tokenCredentials');
var adalAuth = require('./adalAuth');
var utils = require('../utils');
var $ = utils.getLocaleString;

function UserTokenCredentials(authConfig, userId) {
  this.authConfig = authConfig;
  this.userId = userId;
}

util.inherits(UserTokenCredentials, TokenCredentials);

UserTokenCredentials.prototype.retrieveTokenFromCache = function (callback) {
  var context = adalAuth.createAuthenticationContext(this.authConfig);
  context.acquireToken(this.authConfig.resourceId, this.userId, this.authConfig.clientId, function (err, result) {
    if (err && err.message && err.message.indexOf('The specified item could not be found in the keychain') !== -1) {
      //retry, beucase it could happen when 2 cli commands running at the same time.
      context.acquireToken(this.authConfig.resourceId, this.userId, this.authConfig.clientId, function (err, result) {
        if (err) return callback(_polishError(err));
        return callback(null, result.tokenType, result.accessToken);
      });
    } else if (err) {
      return callback(_polishError(err));
    } else {
      return callback(null, result.tokenType, result.accessToken);
    }
  });
};

function _polishError(err) {
  return new Error($('Credentials have expired, please reauthenticate.\n         ' +
                               'Detailed error message from ADAL is as follows: ' + err));
}

function authenticateWithUsernamePassword(authConfig, username, password, callback) {
  var context = adalAuth.createAuthenticationContext(authConfig);
  context.acquireTokenWithUsernamePassword(authConfig.resourceId, username, password, authConfig.clientId, function (err, response) {
    if (err) { return callback(err); }
    callback(null, new exports.UserTokenCredentials(authConfig, response.userId));
  });
}

function acquireUserCode(authConfig, callback) {
  var context = adalAuth.createAuthenticationContext(authConfig);
  return context.acquireUserCode(authConfig.resourceId, authConfig.clientId, null, callback);
}

function authenticateWithDeviceCode(authConfig, userCodeResponse, callback) {
  var context = adalAuth.createAuthenticationContext(authConfig);
  return context.acquireTokenWithDeviceCode(authConfig.resourceId, authConfig.clientId, userCodeResponse, function (err, tokenResponse) {
    if (err) { return callback(err); }
    return callback(null, new exports.UserTokenCredentials(authConfig, tokenResponse.userId));
  });
}

_.extend(exports, {
  UserTokenCredentials: UserTokenCredentials,
  authenticateWithUsernamePassword: authenticateWithUsernamePassword,
  acquireUserCode: acquireUserCode,
  authenticateWithDeviceCode: authenticateWithDeviceCode,
  normalizeUserName: adalAuth.normalizeUserName
});
