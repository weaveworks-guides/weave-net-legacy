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
var logging = require('../logging');
var utils = require('../utils');
var $ = utils.getLocaleString;

function ServicePrincipalTokenCredentials(authConfig, appId) {
  this.authConfig = authConfig;
  this.appId = appId;
}

util.inherits(ServicePrincipalTokenCredentials, TokenCredentials);

//'retrieveTokenFromCache' is confusing, but for the sake of conforming to the interface.
//for service principal we don't really cache the token; rather, we cache the key.
ServicePrincipalTokenCredentials.prototype.retrieveTokenFromCache = function (callback) {
  var self = this;
  _loadServicePrincipalKey(self.appId, self.authConfig.tenantId, function (err, key) {
    if (err) {
      return callback(new Error(util.format($('No service key found for appid %s. Error %s'), self.appId, err.message)));
    }
    
    var context = adalAuth.createAuthenticationContext(self.authConfig);
    context.acquireTokenWithClientCredentials(self.authConfig.resourceId, self.appId, key,
        function (err, result) {
      if (err) {
        //because the invalid key is cached, let us clean it up; otherwise the next logon attempt 
        //will fail
        _removeInvalidServicePrincipalKey(self.appId, self.authConfig.tenantId, function (errorOnRemove) {
          if (errorOnRemove) {
            //this error would be rare, but warn still, just in case.
            logging.warn($('Failed to clean up invalid credentils for service principal'));
          }
          return callback(util.format($('Unable to acquire token due to error of: %s'), err.message));
        });
      } else {
        return callback(null, result.tokenType, result.accessToken);
      }
    });
  });
};

function _removeInvalidServicePrincipalKey(appId, tenantId, callback) {
  var query = {
    servicePrincipalId: appId,
    servicePrincipalTenant: tenantId
  };
  
  adalAuth.tokenCache.find(query, function (err, entries) {
    if (err) { return callback(err); }
    adalAuth.tokenCache.remove(entries, callback);
  });
}

function _loadServicePrincipalKey(appId, tenantId, callback) {
  var query = {
    servicePrincipalId: appId,
    servicePrincipalTenant: tenantId
  };
  
  adalAuth.tokenCache.find(query, function (err, entries) {
    if (err) { return callback(err); }
    
    if (entries.length === 0) {
      return callback(new Error('No service principal key found'));
    }
    
    callback(null, entries[0].accessToken);
  });
}

function _saveServicePrincipalKey(appId, tenantId, key, callback) {
  var entry = {
    servicePrincipalId: appId,
    servicePrincipalTenant: tenantId,
    accessToken: key,
    resource: 'Azure Cli Service Principal Key Cache'
  };
  
  adalAuth.tokenCache.add([entry], callback);
}


function createServicePrincipalTokenCredentials(authConfig, appId, serviceKey, callback) {
  _saveServicePrincipalKey(appId, authConfig.tenantId, serviceKey, function (err) {
    if (err) { return callback(err); }
    
    callback(null, new exports.ServicePrincipalTokenCredentials(authConfig, appId, authConfig.tenantId));
  });
}

_.extend(exports, {
  ServicePrincipalTokenCredentials: ServicePrincipalTokenCredentials,
  createServicePrincipalTokenCredentials: createServicePrincipalTokenCredentials,
  normalizeUserName: adalAuth.normalizeUserName
});
