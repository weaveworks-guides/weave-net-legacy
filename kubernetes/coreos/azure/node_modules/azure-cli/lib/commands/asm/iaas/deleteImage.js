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
 * Common code to delete OS or Disk image, possibly with a blob
 */
var util = require('util');
var blobUtils = require('../../../util/blobUtils');
var uploadVMImage = require('./upload/uploadVMImage');
var utils = require('../../../util/utils');
var vmUtils = require('../vm/vmUtils');
var $ = utils.getLocaleString;

function noop() {}

function deleteImageInternal(apiName, logName, logger, computeManagementClient, diskName, progressEnd, deleteFromStorage, callback) {
  if (apiName === 'Disk') {
    // deleting Data Disk
    computeManagementClient.virtualMachineDisks.deleteDisk(diskName, deleteFromStorage, function(error) {
      deleteImageCallback(logName, diskName, progressEnd, logger, callback, error);
    });
  } else {
    // get image type
    vmUtils.getImageInfo(computeManagementClient, diskName, function(error, result) {
      if (error) {
        callback(error);
        return;
      }

      // if image type is both OS & VM it's an error
      if (result.vmImage && result.osImage) {
        callback(new Error(util.format($('Duplicate names \"%s\" found in both VM and OS images. Please delete one of them using the Portal and try again.'), diskName)));
        return;
      }

      if (result.vmImage) {
        // deleting VM Image
        computeManagementClient.virtualMachineVMImages.deleteMethod(diskName, deleteFromStorage, function(error) {
          deleteImageCallback(logName, diskName, progressEnd, logger, callback, error);
        });
      } else {
        // deleting OS Image
        computeManagementClient.virtualMachineOSImages.deleteMethod(diskName, deleteFromStorage, function(error) {
          deleteImageCallback(logName, diskName, progressEnd, logger, callback, error);
        });
      }
    });
  }
}

function deleteImageCallback(logName, diskName, progressEnd, logger, callback, error) {
  progressEnd();
  if (!error) {
    logger.info(logName + ' deleted: ' + diskName);
  } else {
    logger.error(logName + ' not deleted: ' + diskName);
  }
  callback(error);
}

exports.deleteImage = function deleteImage(apiName, logName, logger, computeManagementClient, storageClient, diskName, deleteOptions, cliProgress, callback) {
  var msg = util.format('Deleting %s', logName);
  var progressEnd = cliProgress ? cliProgress(msg, logger).end : noop;

  if (!deleteOptions.blobDelete) {
    deleteImageInternal(apiName, logName, logger, computeManagementClient, diskName, progressEnd, false, callback);
    return;
  }

  if (deleteOptions.blobDelete && deleteOptions.blobUrl) {
    // Don't query for it
    // delete image first!
    deleteImageInternal(apiName, logName, logger, computeManagementClient, diskName, progressEnd, false, deleteBlob);
    return;
  }

  if (apiName === 'Disk') {
    // let's get blob url for Data Disk
    computeManagementClient.virtualMachineDisks.getDisk(diskName, function(error, response) {
      if (!error) {
        deleteOptions.blobUrl = response.mediaLinkUri;
        // delete data disk
        deleteImageInternal(apiName, logName, logger, computeManagementClient, diskName, progressEnd, deleteOptions.blobDelete, callback);
      } else {
        progressEnd();
        callback(error);
      }
    });
  } else {
    deleteImageInternal(apiName, logName, logger, computeManagementClient, diskName, progressEnd, deleteOptions.blobDelete, callback);
  }

  function deleteBlob(error) {
    if (error) {
      callback(error);
      return;
    }

    deleteOptions.blobUrl = blobUtils.unescape(deleteOptions.blobUrl);
    // sometimes blob contains '//' - an RDFE issue. Workaround: remove - except in protocol
    var split = deleteOptions.blobUrl.split('://');
    var next = split[split.length - 1];
    var prev;
    do {
      prev = next;
      next = next.replace('//', '/');
    } while (next !== prev);
    split[split.length - 1] = next;
    deleteOptions.blobUrl = split.join('://');

    logger.silly('Deleting blob ' + deleteOptions.blobUrl);
    uploadVMImage.deleteBlobFromIaasClient(deleteOptions.blobUrl, storageClient, {
      logger: logger
    }, function(error) {
      progressEnd();
      if (error) {
        logger.warn('Warning: couldn\'t delete page blob ' + deleteOptions.blobUrl);
      } else {
        logger.info('Blob deleted: ' + deleteOptions.blobUrl);
      }
      callback(error);
    });
  }
};