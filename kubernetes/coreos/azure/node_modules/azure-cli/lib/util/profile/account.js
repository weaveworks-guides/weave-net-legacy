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

var util = require('util');
var async = require('async');
var __ = require('underscore');

var constants = require('../constants.js');
var Subscription = require('./subscription.js');
var utils = require('../utils');

function Account(env, adalAuth, resourceClient, log) {
  this._env = env;
  this._adalAuth = adalAuth;
  this._resourceClient = resourceClient;
  this._log = log;
  this.WarnToUserInteractiveFieldName = 'warnToUserInteractive';
}

Account.prototype.load = function (username, password, tenant, loginType, callback) {
  var self = this;
  if (!tenant) {
    tenant = constants.AAD_COMMON_TENANT;
  }
  if (username) {
    username = self._adalAuth.normalizeUserName(username);
  }
  self._username = username;
  var userType = 'user';
  
  if (loginType.servicePrincipal) {
    userType = 'servicePrincipal';
  }
  
  function processAndReturnSubscriptions(err, result) {
    if (err) return callback(err);
    var subscriptions = result.subscriptions;
    var subs = __.map(subscriptions, function (s) {
      return new Subscription({
        id: s.subscriptionId,
        name: s.displayName || s.subscriptionName,
        user: {
          name: self._username,
          type: userType
        },
        state: s.state,
        tenantId: s.tenantId ? s.tenantId : tenant
      }, self._env);
    });
    
    callback(null, { subscriptions: subs, tenantIds: result.tenantIds });
  }
  
  if (loginType.servicePrincipal) {
    this._adalAuth.createServicePrincipalTokenCredentials(self._env.getAuthConfig(tenant), username, password, function (err, credential) {
      if (err) { return callback(err); }
      self._getSubscriptionsFromTenants(username, [tenant], credential, function (err, subscriptions) {
        if (err) return callback(err);
        return processAndReturnSubscriptions(null, { subscriptions: subscriptions });
      });
    });
  } else if (loginType.interactive) {
    self._getSubscriptionsInteractive(tenant, processAndReturnSubscriptions);
  } else {
    self._getSubscriptionsNonInteractive(username, password, tenant, processAndReturnSubscriptions);
  }
};

Account.prototype._getSubscriptionsInteractive = function (tenant, callback) {
  var self = this;
  var authConfig = self._env.getAuthConfig(tenant);
  async.waterfall([
    function (callback) {
      self._adalAuth.acquireUserCode(authConfig, function (err, userCodeResponse) {
        if (err) return callback(err);
        return callback(null, userCodeResponse);
      });
    },
    function (userCodeResponse, callback) {
      self._log.info(userCodeResponse.message);
      self._log.verbose('code response from AAD is :' + JSON.stringify(userCodeResponse));
      self._adalAuth.authenticateWithDeviceCode(authConfig, userCodeResponse, function (err, credential) {
        if (err) return callback(err);
        self._username = credential.userId;
        
        async.waterfall([
          function (callback) {
            self._buildTenantList(self._username, tenant, credential, callback);
          },
          function (tenantList, callback) {
            self._getSubscriptionsFromTenants(self._username, tenantList, null, callback);
          },
        ], function (err, subscriptions) {
          callback(err, { subscriptions : subscriptions });
        });
      });
    }
  ], function (err, subscriptions) {
    callback(err, subscriptions);
  });
};

Account.prototype._getSubscriptionsNonInteractive = function (username, password, tenant, callback) {
  var self = this;
  self._adalAuth.authenticateWithUsernamePassword(self._env.getAuthConfig(tenant), username, password, function (err, credential) {
    if (err && err.message && self._errorSuggestsInteractiveFlow(err.message)) {
      err[self.WarnToUserInteractiveFieldName] = true;
    }
    if (err) return callback(err);
    username = _crossCheckUserNameWithToken(username, credential.userId);
    
    async.waterfall([
      function (callback) {
        self._buildTenantList(username, tenant, credential, callback);
      },
      function (tenantList, callback) {
        self._getSubscriptionsFromTenants(username, tenantList, null, callback);
      },
    ], function (err, subscriptions) {
      callback(err, { subscriptions : subscriptions });
    });
  });
};

Account.prototype._errorSuggestsInteractiveFlow = function (errMessage) {
  var codes = ['50072', '50074', '50076', '50077', '50078', '50079'];
  var contains2FAErrCode =  __.any(codes, function (code) {
    return (errMessage.indexOf('AADSTS' + code) !== -1);
  });
  var containsErrCausedByUsingMsa = utils.ignoreCaseEquals(errMessage, 'Server returned an unknown AccountType: undefined') ||
      utils.ignoreCaseEquals(errMessage, 'Server returned error in RSTR - ErrorCode: NONE : FaultMessage: NONE');
  return contains2FAErrCode || containsErrCausedByUsingMsa;
};

Account.prototype._polishError = function (errMessage) {
  if (utils.ignoreCaseEquals(errMessage, 'Server returned an unknown AccountType: undefined') ||
      utils.ignoreCaseEquals(errMessage, 'Server returned error in RSTR - ErrorCode: NONE : FaultMessage: NONE')) {
    errMessage = 'Your account type requires to login using interactive flow. Please rerun "login" command without -u/--username parameter';
  }
  return errMessage;
};

Account.prototype._getSubscriptionsFromTenants = function (username, tenantList, preBuiltCredential, callback) {
  var self = this; 
  var subscriptions = [];
  async.eachSeries(tenantList, function (tenant, cb) {
    var credential = preBuiltCredential;
    if (!credential) {
      credential = new self._adalAuth.UserTokenCredentials(self._env.getAuthConfig(tenant), username);
    }
    var armClient = self._getArmClient(credential);
    armClient.subscriptions.list(function (err, result) {
      if (!err) {
        subscriptions = subscriptions.concat(result.subscriptions.map(function (s) {
          s.tenantId = tenant;
          s.username = username;
          return s;
        }));
      }
      cb(err);
    });
  }, function (err) {
    callback(err, subscriptions);
  });
};

Account.prototype._buildTenantList = function (username, tenant, credential, callback) {
  var self = this;
  var tenants = [];
  if (tenant && tenant !== constants.AAD_COMMON_TENANT) {
    return callback(null, [tenant]);
  }
  self._getAllTenants(credential, function (err, result) {
    if (err) return callback(err);
    async.eachSeries(result.tenantIds/*'tenantInfos' could be a better name*/, function (tenantInfo, cb) {
      tenants.push(tenantInfo.tenantId);
      cb(err);
    }, function (err) {
      callback(err, tenants);
    });
  });
};

Account.prototype._getAllTenants = function (credential, callback) {
  var armClient = this._getArmClient(credential);
  armClient.tenants.list(callback);
};

Account.prototype._getArmClient = function (credentials) {
  return this._resourceClient.createResourceSubscriptionClient(credentials, this._env.resourceManagerEndpointUrl);
};

module.exports = Account;

function _crossCheckUserNameWithToken(usernameFromCommandline, userIdFromToken) {
  //to maintain the casing consistency between 'azureprofile.json' and token cache. (RD 1996587)
  //use the 'userId' here, which should be the same with "username" except the casing.
  if (utils.ignoreCaseEquals(usernameFromCommandline, userIdFromToken)) {
    return userIdFromToken;
  } else {
    throw new Error(util.format('The userId of \'%s\' in access token doesn\'t match the  command line username of \'%s\'', 
      userIdFromToken, usernameFromCommandline));
  }
}

