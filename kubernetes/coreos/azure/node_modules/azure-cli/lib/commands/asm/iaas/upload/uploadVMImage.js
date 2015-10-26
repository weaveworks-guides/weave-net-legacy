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

/**
 * UploadVMImage 
 */

var util = require('util');
var pageBlob = require('./pageBlob');
var blobUtils = require('../../../../util/blobUtils');
var callbackAggregator = require('../../../../util/callbackAggregator');

// get account info: account key and blob endpoint
// callback: function(error, primaryKey, destUri)
function getAccountInfo(storageClient, destinationUri, logger, callback) {
  var splitDestination = blobUtils.splitDestinationUri(destinationUri);

  var caagg = callbackAggregator.callbackAndAggregator(function(results, key, args) {
    if (key) { // This means error somewhere - defined by key
      var error = args[0];
      var resp = args[2];
      if (error && typeof error === 'object') {
        error.whichFunction = key;
        if (!error.code && !error.statusCode && resp) {
          // Sometimes error object does not have useful information. Add it to make it more debuggable.
          error.statusCode = resp.statusCode;
          error.response = resp;
        }
      }
      callback(error);
      return;
    }
    var responseKeys = results.storageAccountKeys[1]; // function(error, response)
    if (results.storageAccountProperties) {
      var responseProps = results.storageAccountProperties[1]; // function(error, response)
      var blobEndpoint = '';
      if (responseProps && responseProps.storageAccount && responseProps.storageAccount.properties &&
          responseProps.storageAccount.properties.endpoints) {
        blobEndpoint = responseProps.storageAccount.properties.endpoints[0];
      }
      if (blobEndpoint) {
        var destOld = destinationUri;
        destinationUri = blobEndpoint + splitDestination.resourceName;
        if (destOld !== destinationUri && 'http://' + destOld !== destinationUri && splitDestination.host) {
          logger.warn('Incorrect blob destination: ' + destOld);
          logger.warn('Using instead             : ' + destinationUri);
        }
      } else {
        logger.warn('Couldn\'t get blob service endpoint'); // ignorable, will use default or specified endpoint
      }
    }
    callback(null, responseKeys.primaryKey, destinationUri);
  });

  // Run two calls in parallel 
  storageClient.storageAccounts.getKeys(splitDestination.accountName, caagg.getCallback('storageAccountKeys'));
  storageClient.storageAccounts.get(splitDestination.accountName, caagg.getCallback('storageAccountProperties'));
}

exports.uploadPageBlobFromIaasClient =
    function uploadPageBlobFromIaasClient(destinationUri, storageClient, fileName, options, callback) {
  var logger = (options || {}).logger || console;
  var errorFunc = logger.error || console.error;
  if (typeof callback !== 'function') {
    throw new Error('Callback is expected in uploadPageBlobFromIaasClient(). Found: ' + util.inspect(callback));
  }

  getAccountInfo(storageClient, destinationUri, logger, function(error, primaryKey, newDestUri) {
    if (!error) {
      pageBlob.uploadPageBlob(newDestUri, primaryKey, fileName, options, function(error, alreadyExisted) {
        callback(error, newDestUri, alreadyExisted);
      });
    } else {
      errorFunc('There was an error in getStorageAccountKeys() or getStorageAccountProperties() for ' + destinationUri);
      errorFunc(util.inspect(error));
      callback(error);
    }
  });
};

exports.deleteBlobFromIaasClient =
    function deleteBlobFromIaasClient(destinationUri, storageClient, options, callback) {
  var logger = (options || {}).logger || console;
  var errorFunc = logger.error || console.error;
  if (typeof callback !== 'function') {
    throw new Error('Callback is expected in deleteBlobFromIaasClient(). Found: ' + util.inspect(callback));
  }

  destinationUri = destinationUri.replace(/^https\:\/\//i, ''); // avoid https/http url mismatch warning for delete when we get https:// MediaLink
  getAccountInfo(storageClient, destinationUri, logger, function(error, primaryKey, newDestUri) {
    if (!error) {
      if (logger.verbose) logger.verbose('Uri : ' + newDestUri);
      pageBlob.deleteBlob(newDestUri, primaryKey, callback);
    } else {
      errorFunc('There was an error in getStorageAccountKeys() or getStorageAccountProperties() for ' + destinationUri);
      errorFunc(util.inspect(error));
      callback(error);
    }
  });
};

exports.copyBlobFromIaasClient =
    function copyBlobFromIaasClient(storageClient, sourceUri, sourceKey, destinationUri, options, callback) {
  var logger = (options || {}).logger || console;
  var errorFunc = logger.error || console.error;
  if (typeof callback !== 'function') {
    throw 'Callback is expected in copyBlobFromIaasClient(). Found: ' + util.inspect(callback);
  }

  getAccountInfo(storageClient, destinationUri, logger, function(error, destinationKey, newDestUri) {
    if (!error) {
      pageBlob.copyBlob(sourceUri, sourceKey, newDestUri, destinationKey, function(error, blob, response) {
        callback(error, blob, response, newDestUri);
      });
    } else {
      errorFunc('There was an error in getStorageAccountKeys() or getStorageAccountProperties() for ' + destinationUri);
      errorFunc(util.inspect(error));
      callback(error);
    }
  });
};
