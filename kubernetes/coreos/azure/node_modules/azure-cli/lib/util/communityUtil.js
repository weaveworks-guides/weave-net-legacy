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

// Module dependencies.
var url = require('url');
var util = require('util');

var azureCommon = require('azure-common');
var ServiceClient = azureCommon.ServiceClient;
var WebResource = azureCommon.WebResource;
var Constants = azureCommon.Constants;
var HeaderConstants = Constants.HeaderConstants;

// Expose 'CommunityUtil'.
exports = module.exports = CommunityUtil;

/**
* Creates a new CommunityUtil object.
*
* @constructor
*/
function CommunityUtil(managementEndPoint) {
  CommunityUtil['super_'].call(this);
  var serviceHost = 'vmdepot.msopentech.com';
  var managementEndPointAsUrl = url.parse(managementEndPoint);
  if (managementEndPointAsUrl.host == 'management.core.chinacloudapi.cn') {
    serviceHost = 'vmdepot.msopentech.cn';
  }

  this.Constants = {
    SERVICEHOST : serviceHost,
    SERVICE: '/OData.svc'
  };

  this._initDefaultFilter();

  var self = this;
  self.authenticationProvider = {
    signRequest: function (request, cb) {
      request.key = self.keyvalue;
      request.cert = self.certvalue;

      cb(null);
    }
  };
}

util.inherits(CommunityUtil, ServiceClient);

/**
* Resolve uid
*
* @param {function} callback  The callback function called on completion. Required.
*/
CommunityUtil.prototype.resolveUid = function (uid, callback) {
  var path = this.Constants.SERVICE + '/ResolveUid';
  var webResource = WebResource.get(path)
    .withQueryOption('uid', '\''+ uid + '\'');

  this.performRequest(webResource, null, null, function (responseObject, next) {
    var finalCallback = function (returnObject) {
      callback(returnObject.error, returnObject.response);
    };

    next(responseObject, finalCallback);
  });
};

/**
* Builds the request options to be passed to the http.request method.
*
* @param {WebResource} webResource The webresource where to build the options from.
* @param {object}      options     The body of the request.
* @param {object}      options     The request options.
* @param {function(error, requestOptions)}  callback  The callback function.
* @return {undefined}
*/
CommunityUtil.prototype._buildRequestOptions = function(webResource, body, options, callback) {
  var self = this;

  self.host = self._getHostname();

  webResource.withHeader(HeaderConstants.CONTENT_TYPE, self._getContentType());
  webResource.withHeader(HeaderConstants.ACCEPT_HEADER, self._getAcceptType());
  webResource.withHeader(HeaderConstants.ACCEPT_CHARSET_HEADER, 'UTF-8');
  webResource.withHeader(HeaderConstants.HOST_HEADER, self.host);

  CommunityUtil['super_'].prototype._buildRequestOptions.call(this, webResource, body, options, callback);
};

/**
* Get the content-type string based on serializeType
*
* @return {string}
*/
CommunityUtil.prototype._getContentType = function() {
  return 'application/xml';
};

/**
* Get the accept header string based on serializeType
*
* @return {string}
*/
CommunityUtil.prototype._getAcceptType = function() {
  return 'application/json';
};

/**
* Get service host name
*/
CommunityUtil.prototype._getHostname = function () {
  return this.Constants.SERVICEHOST;
};
