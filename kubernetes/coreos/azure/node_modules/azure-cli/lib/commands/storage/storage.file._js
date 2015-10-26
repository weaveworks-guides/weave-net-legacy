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

var storage = require('azure-storage');
var StorageUtil = require('../../util/storage.util');
var util = require('util');
var pathUtil = require('path');
var fs = require('fs');
var utils = require('../../util/utils');
var validation = require('../../util/validation');
var commander = require('commander');
var performStorageOperation = StorageUtil.performStorageOperation;
var startProgress = StorageUtil.startProgress;
var endProgress = StorageUtil.endProgress;
var SpeedSummary = storage.BlobService.SpeedSummary;

var __ = require('underscore');
var $ = utils.getLocaleString;

/**
* Add storage account command line options
*/
commander.Command.prototype.addStorageAccountOption = function() {
  this.option('-a, --account-name <accountName>', $('the storage account name'));
  this.option('-k, --account-key <accountKey>', $('the storage account key'));
  this.option('-c, --connection-string <connectionString>', $('the storage connection string'));
  this.option('-vv', $('run storage command in debug mode'));
  return this;
};

/**
* Init storage file share command
*/
exports.init = function(cli) {

  //Init StorageUtil
  StorageUtil.init(cli);

  /**
  * Define storage file share command usage
  */
  var storage = cli.category('storage')
    .description($('Commands to manage your Storage objects'));

  var logger = cli.output;

  var interaction = cli.interaction;

  var share = storage.category('share')
    .description($('Commands to manage your Storage file shares'));

  share.command('create [share]')
    .description($('Create a storage file share'))
    .option('--share <share>', $('the storage file share name'))
    .option('--quota <quota>', $('the storage file share quota (in GB)'))
    .addStorageAccountOption()
    .execute(createShare);

  share.command('show [share]')
    .description($('Show details of the storage file share'))
    .option('--share <share>', $('the storage file share name'))
    .addStorageAccountOption()
    .execute(showShare);

  share.command('set [share]')
    .description($('Set properties of the storage file share'))
    .option('--share <share>', $('the storage file share name'))
    .option('--quota <quota>', $('the storage file share quota (in GB)'))
    .addStorageAccountOption()
    .execute(setShare);

  share.command('delete [share]')
    .description($('Delete the specified storage file share'))
    .option('--share <share>', $('the storage file share name'))
    .option('-q, --quiet', $('remove the specified storage file share without confirmation'))
    .addStorageAccountOption()
    .execute(deleteShare);

  share.command('list [prefix]')
    .description($('List storage shares with prefix'))
    .option('-p, --prefix <prefix>', $('the storage share name prefix'))
    .addStorageAccountOption()
    .execute(listShares);
    
  var shareSas = share.category('sas')
    .description($('Commands to manage shared access signatures of your Storage file shares'));

  shareSas.command('create [share] [permissions] [expiry]')
    .description($('Generate shared access signature of storage share'))
    .option('--share <share>', $('the storage share name'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Read)/w(Write)/d(Delete)/l(List)'))
    .option('--start <start>', $('the UTC time at which the SAS becomes valid'))
    .option('--expiry <expiry>', $('the UTC time at which the SAS expires'))
    .option('--policy <policy>', $('the stored access policy identifier'))
    .addStorageAccountOption()
    .execute(createShareSas);

  var policy = share.category('policy')
    .description($('Commands to manage stored access policies of your Storage file share'));

  policy.command('create [share] [name]')
    .usage('[options] [share] [name]')
    .description($('Create a stored access policy on the share'))
    .option('--share <share>', $('the storage share name'))
    .option('--name <name>', $('the policy name'))
    .option('--start <start>', $('the UTC time at which the policy becomes valid'))
    .option('--expiry <expiry>', $('the UTC time at which the policy expires'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Read)/w(Write)/d(Delete)/l(List)'))
    .addStorageAccountOption()
    .execute(createSharePolicy);

  policy.command('show [share] [name]')
    .usage('[options] [share] [name]')
    .description($('Show a stored access policy on the share'))
    .option('--share <share>', $('the storage share name'))
    .option('--name <name>', $('the policy name'))
    .addStorageAccountOption()
    .execute(showSharePolicy);

  policy.command('list [share]')
    .usage('[options] [share]')
    .description($('List stored access policies on the share'))
    .option('--share <share>', $('the storage share name'))
    .addStorageAccountOption()
    .execute(listSharePolicy);

  policy.command('set [share] [name]')
    .usage('[options] [share] [name]')
    .description($('Set a stored access policy on the share'))
    .option('--share <share>', $('the storage share name'))
    .option('--name <name>', $('the policy name'))
    .option('--start <start>', $('the UTC time at which the policy becomes valid and passing two spaces means to remove the existing setting'))
    .option('--expiry <expiry>', $('the UTC time at which the policy expires and passing two spaces means to remove the existing setting'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Read)/w(Write)/d(Delete)/l(List) and passing two spaces means to remove the existing setting'))
    .addStorageAccountOption()
    .execute(setSharePolicy);

  policy.command('delete [share] [name]')
    .usage('[options] [share] [name]')
    .description($('Delete a stored access policy on the share'))
    .option('--share <share>', $('the storage share name'))
    .option('--name <name>', $('the policy name'))
    .addStorageAccountOption()
    .execute(deleteSharePolicy);

  var file = storage.category('file')
    .description($('Commands to manage your Storage files'));

  file.command('list [share] [path]')
    .usage('[options] [share] [path]')
    .description($('List storage files in the specified share under specific path'))
    .option('--share <share>', $('the storage share name'))
    .option('-p, --path <path>', $('the path to be listed'))
    .option('--sas <sas>', $('the shared access signature of the storage file share'))
    .addStorageAccountOption()
    .execute(listFiles);

  file.command('delete [share] [path]')
    .usage('[options] [share] [path]')
    .description($('Delete the specified storage file'))
    .option('--share <share>', $('the storage share name'))
    .option('-p, --path <path>', $('the path to the storage file'))
    .option('-q, --quiet', $('remove the specified storage file without confirmation'))
    .option('--sas <sas>', $('the shared access signature of the storage file share'))
    .addStorageAccountOption()
    .execute(deleteFile);

  file.command('upload [source] [share] [path]')
    .usage('[options] [source] [share] [path]')
    .description($('Upload the specified local file to storage'))
    .option('-s, --source <source>', $('the local file path'))
    .option('--share <share>', $('the storage share name'))
    .option('-p, --path <path>', $('the path to the storage file'))
    .option('--concurrenttaskcount <concurrenttaskcount>', $('the maximum number of concurrent upload requests'))
    .option('-q, --quiet', $('overwrite the specified storage file without confirmation'))
    .option('--sas <sas>', $('the shared access signature of the storage file share'))
    .addStorageAccountOption()
    .execute(uploadFile);

  file.command('download [share] [path] [destination]')
    .usage('[options] [share] [path] [destination]')
    .description($('Download the specified storage file'))
    .option('--share <share>', $('the storage share name'))
    .option('-p, --path <path>', $('the path to the storage file'))
    .option('-d, --destination <destination>', $('path to the destination file or directory'))
    .option('-m, --checkmd5', $('check md5sum for the downloaded file'))
    .option('-q, --quiet', $('overwrite the destination file without confirmation'))
    .option('--sas <sas>', $('the shared access signature of the storage file share'))
    .addStorageAccountOption()
    .execute(downloadFile);
    
 var copy = file.category('copy')
    .description($('Commands to manage your file copy operations'));

  copy.command('start [sourceUri] [destShare]')
    .usage('[options] [sourceUri] [destShare]')
    .description($('Start to copy the resource to the specified storage file which completes asynchronously'))
    .option('--source-sas <sourceSas>', $('the shared access signature of the source storage'))
    .option('--source-uri <sourceUri>', $('the source storage blob or file absolute uri'))
    .option('--source-share <sourceShare>', $('the source storage share name when copies a file to a blob'))
    .option('--source-path <sourcePath>', $('the source storage file path when copies a file to a blob'))
    .option('--source-container <sourceContainer>', $('the source storage container name when copies a blob to a blob'))
    .option('--source-blob <sourceBlob>', $('the source storage blob name when copies a blob to a blob'))
    .option('--dest-account-name <destAccountName>', $('the destination storage account name'))
    .option('--dest-account-key <destAccountKey>', $('the destination storage account key'))
    .option('--dest-connection-string <destConnectionString>', $('the destination storage connection string'))
    .option('--dest-sas <destSas>', $('the shared access signature of the destination storage share or file'))
    .option('--dest-share <destShare>', $('the destination storage share name'))
    .option('--dest-path <destPath>', $('the destination storage file path'))
    .option('-q, --quiet', $('overwrite the destination file without confirmation'))
    .addStorageAccountOption()
    .execute(startFileCopy);

  copy.command('show [share] [path]')
    .usage('[options] [share] [path]')
    .description($('Show the copy status'))
    .option('--share <share>', $('the destination share in the file copy start operation'))
    .option('--path <path>', $('the destination file path in the file copy start operation'))
    .option('--sas <sas>', $('the shared access signature of the destination storage share or file'))
    .addStorageAccountOption()
    .execute(showFileCopy);

  copy.command('stop [share] [path] [copyid]')
    .usage('[options] [share] [path] [copyid]')
    .description($('Stop the copy operation'))
    .option('--share <share>', $('the destination share in the file copy start operation'))
    .option('--path <path>', $('the destination file path in the file copy start operation'))
    .option('--copyid <copyid>', $('the copy ID which is returned from file copy start operation'))
    .addStorageAccountOption()
    .execute(stopFileCopy);
    
  var fileSas = file.category('sas')
    .description($('Commands to manage shared access signatures of your Storage file'));

  fileSas.command('create [share] [path] [permissions] [expiry]')
    .description($('Generate shared access signature of storage file'))
    .option('--share <share>', $('the storage share name'))
    .option('-p, --path <path>', $('the path to the storage file'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Read)/w(Write)/d(Delete)'))
    .option('--start <start>', $('the UTC time at which the SAS becomes valid'))
    .option('--expiry <expiry>', $('the UTC time at which the SAS expires'))
    .option('--policy <policy>', $('the stored access policy identifier'))
    .addStorageAccountOption()
    .execute(createFileSas);

  var directory = storage.category('directory')
    .description($('Commands to manage your Storage file directory'));

  directory.command('create [share] [path]')
    .description($('Create a storage file directory'))
    .option('--share <share>', $('the storage file share name'))
    .option('-p, --path <path>', $('the path to the storage file directory to be created'))
    .option('--sas <sas>', $('the shared access signature of the storage file share'))
    .addStorageAccountOption()
    .execute(createDirectory);

  directory.command('delete [share] [path]')
    .description($('Delete the specified storage file directory'))
    .option('--share <share>', $('the storage share name'))
    .option('-p, --path <path>', $('the path to the storage file directory to be deleted'))
    .option('-q, --quiet', $('remove the specified storage file directory without confirmation'))
    .option('--sas <sas>', $('the shared access signature of the storage file share'))
    .addStorageAccountOption()
    .execute(deleteDirectory);

  /**
  * Implement storage file share cli
  */

  /**
  * Get file service account from user specified credential or env variables
  */
  function getFileServiceClient(options) {
    var serviceClient = StorageUtil.getServiceClient(StorageUtil.getFileService, options);
    applyFileServicePatch(serviceClient);
    return serviceClient;
  }

  /**
  * Get Storage file operation object
  * @param {string} [operationName] operation name
  * @return {StorageOperation} storage file operation
  */
  function getStorageFileOperation(serviceClient, operationName) {
    return StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.File, operationName);
  }

  /**
  * Get Storage file operation options
  */
  function getStorageFileOperationDefaultOption() {
    var option = StorageUtil.getStorageOperationDefaultOption();

    // Add file specific options here
    option.parallelOperationThreadCount = StorageUtil.threadsInOperation;

    return option;
  }
  
  /**
  * Create a policy setting
  */
  function createSharePolicySetting(options) {
    var policySettings = {};
    policySettings.accessType = StorageUtil.AccessType.Share;
    policySettings.serviceClient = getFileServiceClient(options);
    policySettings.getAclOperation = getStorageFileOperation(policySettings.serviceClient, 'getShareAcl');
    policySettings.setAclOperation = getStorageFileOperation(policySettings.serviceClient, 'setShareAcl');
    policySettings.storageOptions = getStorageFileOperationDefaultOption();
    policySettings.policyOptions = options;
    return policySettings;
  }

  /**
  * Create a storage file share
  */
  function createShare(share, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    var operation = getStorageFileOperation(fileService, 'createShare');
    var tips = util.format($('Creating storage file share %s'), share);
    var storageOptions = getStorageFileOperationDefaultOption();
    if (options.quota) {
      storageOptions.quota = options.quota;
    }

    startProgress(tips);
    try {
      var created = performStorageOperation(operation, _, share, storageOptions);
      if (created === false) {
        throw new Error(util.format($('Share \'%s\' already exists'), share));
      }
    } finally {
      endProgress();
    }

    logger.verbose(util.format($('Share %s has been created successfully'), share));
    showShare(share, StorageUtil.getStorageAccountOptions(options), _);
  }

  /**
  * Delete the specified storage file share
  */
  function deleteShare(share, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    var operation = getStorageFileOperation(fileService, 'deleteShare');
    var tips = util.format($('Deleting storage file share %s'), share);
    var storageOptions = getStorageFileOperationDefaultOption();
    var force = !!options.quiet;

    if (force !== true) {
      force = interaction.confirm(util.format($('Do you want to delete share %s? '), share), _);
      if (force !== true) {
        return;
      }
    }

    startProgress(tips);

    try {
      performStorageOperation(operation, _, share, storageOptions);
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Can not find share \'%s\''), share));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    logger.info(util.format($('Share %s has been deleted successfully'), share));
  }

  /**
  * Show the details of the specified Storage file share
  */
  function showShare(share, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    var operation = getStorageFileOperation(fileService, 'getShareProperties');
    var tips = $('Getting Storage share information');
    var storageOptions = getStorageFileOperationDefaultOption();
    var properties = [];

    startProgress(tips);
    try {
      properties = performStorageOperation(operation, _, share, storageOptions);

      var getStatsOperation = getStorageFileOperation(fileService, 'getShareStats');
      var stats = performStorageOperation(getStatsOperation, _, share, storageOptions);
      properties.shareUsage = stats.sharestats.shareusage;
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Share %s doesn\'t exist'), share));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    logger.json(properties);
  }

  /**
  * Set the share (properties/metadata)
  */
  function setShare(share, options, _) {
    var fileService = getFileServiceClient(options);
    
    if (options.quota && !validation.isInt(options.quota)) {
      throw new Error(util.format($('The share quota must be an integer in GB')));
    }

    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    var tips = $('Setting share');
    
    var properties;
    startProgress(tips);
    try {
      var getPropertiesOperation = getStorageFileOperation(fileService, 'getShareProperties');
      var storageOptions = getStorageFileOperationDefaultOption();
      properties = performStorageOperation(getPropertiesOperation, _, share, storageOptions);

      var setPropertiesOperation = getStorageFileOperation(fileService, 'setShareProperties');
      if (options.quota) {
        properties.quota = options.quota;
      }
      performStorageOperation(setPropertiesOperation, _, share, properties, storageOptions);
    } finally {
      endProgress();
    }

    showShare(share, StorageUtil.getStorageAccountOptions(options), _);
  }

  /**
  * List storage shares
  * @param {string} prefix share prefix
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function listShares(prefix, options, _) {
    var fileService = getFileServiceClient(options);
    var listOperation = getStorageFileOperation(fileService, 'listAllShares');
    var tips = $('Getting storage shares');
    var storageOptions = getStorageFileOperationDefaultOption();

    validateSharePrefix(prefix);
    var shares;
    storageOptions.prefix = prefix;
    startProgress(tips);

    try {
      shares = performStorageOperation(listOperation, _, storageOptions);
    } finally {
      endProgress();
    }

    cli.interaction.formatOutput(shares, function(outputData) {
      if (outputData.length === 0) {
        logger.info($('No share found'));
      } else {
        logger.table(outputData, function(row, item) {
          row.cell($('Name'), item.name);
          row.cell($('Last-Modified'), item.properties['last-modified']);
        });
      }
    });
  }
  
  /**
  * Create shared access signature to the file share
  */
  function createShareSas(share, permissions, expiry, options, _) {
    createSas(share, null, permissions, expiry, options, true, _);
  }

  /**
  * Create shared access signature to the file
  */
  function createFileSas(share, path, permissions, expiry, options, _) {
    createSas(share, path, permissions, expiry, options, false, _);
  }

  /**
  * Create shared access signature
  */
  function createSas(share, path, permissions, expiry, options, isShare, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    
    if (!isShare) {
      path = interaction.promptIfNotGiven($('File path: '), path, _);
    }

    if (!options.policy) {
      permissions = interaction.promptIfNotGiven($('Permissions: '), permissions, _);
      if (isShare) {
        StorageUtil.validatePermissions(StorageUtil.AccessType.Share, permissions);
      } else {
        StorageUtil.validatePermissions(StorageUtil.AccessType.File, permissions);
      }

      expiry = interaction.promptIfNotGiven($('Expiry: '), expiry, _);
      expiry = validation.parseDateTime(expiry);
    }

    var start;
    if (options.start) {
      start = validation.parseDateTime(options.start);
    }

    var output = { sas: '' };
    var sharedAccessPolicy = StorageUtil.getSharedAccessPolicy(permissions, start, expiry, null, options.policy);
    var tips;
    if (isShare) { 
      tips = util.format($('Creating shared access signature for share %s'), share);
    } else {
      tips = util.format($('Creating shared access signature for file %s'), share + '/' + path);
    }
    startProgress(tips);
    
    var result = { dirname: null, basename: null};
    if (!isShare) {
      path = StorageUtil.normalizePath(path);
      result = StorageUtil.fetchBasenameAndDirname(path);
    }
    
    var directory = result.dirname ? result.dirname : '';
    var file = result.basename;
    
    try {
      output.sas = fileService.generateSharedAccessSignature(share, directory, file, sharedAccessPolicy);
      output.url = fileService.getUrl(share, directory, file, output.sas);
    } finally {
      endProgress();
    }

    cli.interaction.formatOutput(output, function(outputData) {
      logger.data($('Shared Access Signature'), outputData.sas);
      logger.data($('Shared Access URL'), outputData.url);
    });
  }

  /**
  * Create a stored access policy on the share
  */
  function createSharePolicy(share, name, options, _) {
    var createPolicySettings = createSharePolicySetting(options);
    createPolicySettings.resourceName = interaction.promptIfNotGiven($('Share name: '), share, _);
    createPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    createPolicySettings.tips = util.format($('Creating the stored access policy %s on the share %s'), createPolicySettings.policyName, createPolicySettings.resourceName);

    if (options.permissions) {
      StorageUtil.validatePermissions(StorageUtil.AccessType.Share, options.permissions);
    }

    var policies = StorageUtil.createPolicy(createPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      logger.info(util.format($('The stored access policies on share %s are: '), createPolicySettings.resourceName));
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * List the stored access policies on the share
  */
  function listSharePolicy(share, options, _) {
    var listPolicySettings = createSharePolicySetting(options);
    listPolicySettings.resourceName = interaction.promptIfNotGiven($('Share name: '), share, _);
    listPolicySettings.tips = util.format($('Listing the stored access policies on the share %s'), listPolicySettings.resourceName);

    var policies = StorageUtil.selectPolicy(listPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      if (outputData) {
        StorageUtil.showPolicyResults(outputData);
      } else {
        logger.info(util.format($('There is no stored access policy on the share %s.'), listPolicySettings.resourceName));
      }
    });
  }

  /**
  * Show the stored access policy on the share
  */
  function showSharePolicy(share, name, options, _) {
    var showPolicySettings = createSharePolicySetting(options);
    showPolicySettings.resourceName = interaction.promptIfNotGiven($('Share name: '), share, _);
    showPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    showPolicySettings.tips = util.format($('Showing the stored access policy %s on the share %s'), showPolicySettings.policyName, showPolicySettings.resourceName);

    var policy = StorageUtil.selectPolicy(showPolicySettings, _);
    cli.interaction.formatOutput(policy, function(outputData) {
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * Set a stored access policy on the share
  */
  function setSharePolicy(share, name, options, _) {
    var setPolicySettings = createSharePolicySetting(options);
    setPolicySettings.resourceName = interaction.promptIfNotGiven($('Share name: '), share, _);
    setPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    setPolicySettings.tips = util.format($('Setting the stored access policy %s on the share %s'), setPolicySettings.policyName, setPolicySettings.resourceName);

    if (options.permissions) {
      StorageUtil.validatePermissions(StorageUtil.AccessType.Share, options.permissions);
    }

    var policies = StorageUtil.setPolicy(setPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      logger.info(util.format($('The stored access policies on share %s are: '), setPolicySettings.resourceName));
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * Delete a stored access policy on the share
  */
  function deleteSharePolicy(share, name, options, _) {
    var deletePolicySettings = createSharePolicySetting(options);
    deletePolicySettings.resourceName = interaction.promptIfNotGiven($('Share name: '), share, _);
    deletePolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    deletePolicySettings.tips = util.format($('Deleting the stored access policy %s on the share %s'), deletePolicySettings.policyName, deletePolicySettings.resourceName);

    var policies = StorageUtil.deletePolicy(deletePolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      if (outputData) {
        logger.info(util.format($('The stored access policies on share %s are: '), deletePolicySettings.resourceName));
        StorageUtil.showPolicyResults(outputData);
      } else {
        logger.info(util.format($('There is no stored access policy on the share %s.'), deletePolicySettings.resourceName));
      }
    });
  }

  /**
  * List storage files
  * @param {string} share share name
  * @param {string} path path to be listed
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function listFiles(share, path, options, _) {
    var fileService = getFileServiceClient(options);
    var listOperation = getStorageFileOperation(fileService, 'listFilesAndDirectories');
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    if (__.isUndefined(path)) {
      path = '';
    }

    path = StorageUtil.normalizePath(path);
    var tips = util.format($('Getting storage files under \'%s\' of share %s'), path, share);
    var storageOptions = getStorageFileOperationDefaultOption();

    var listResults;
    startProgress(tips);

    try {
      listResults = performStorageOperation(listOperation, _, share, path, storageOptions);
    } finally {
      endProgress();
    }

    if (cli.output.format().json) {
      var setUriFunc = function(item) {
        item.uri = fileService.getUrl(share, path, item.name);
      };

      listResults.directories.forEach(setUriFunc);
      listResults.files.forEach(setUriFunc);
    }

    cli.interaction.formatOutput(listResults, function(outputData) {
      if (outputData.directories.length + outputData.files.length > 0) {
        logger.table(outputData.directories.concat(outputData.files), function(row, item) {
          row.cell($('Name'), item.name);
          if (item.properties) {
            row.cell($('Length'), item.properties['content-length']);
            row.cell($('Type'), '');
          } else {
            row.cell($('Length'), '');
            row.cell($('Type'), '<DIR>');
          }
        });
      }
    });
  }

  /**
  * Delete the specified storage file
  */
  function deleteFile(share, path, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    path = interaction.promptIfNotGiven($('Path to the file: '), path, _);
    var operation = getStorageFileOperation(fileService, 'deleteFile');
    var tips = util.format($('Deleting storage file \'%s\' in share %s'), path, share);
    var storageOptions = getStorageFileOperationDefaultOption();
    var force = !!options.quiet;

    if (force !== true) {
      force = interaction.confirm(util.format($('Do you want to delete file %s? '), path), _);
      if (force !== true) {
        return;
      }
    }

    startProgress(tips);

    path = StorageUtil.normalizePath(path);
    var result = StorageUtil.fetchBasenameAndDirname(path);
    var directory = result.dirname;
    var file = result.basename;

    try {
      performStorageOperation(operation, _, share, directory, file, storageOptions);
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Can not find file \'%s\' in share %s'), path, share));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    logger.info(util.format($('File \'%s\' in share %s has been deleted successfully'), path, share));
  }

  /**
  * upload local file to xSMB
  */
  function uploadFile(source, share, path, options, _) {
    var fileService = getFileServiceClient(options);
    source = interaction.promptIfNotGiven($('File to be uploaded: '), source, _);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    var storageOptions = getStorageFileOperationDefaultOption();
    storageOptions.storeFileContentMD5 = true;
    var force = !!options.quiet;

    if (!utils.fileExists(source, _)) {
      throw new Error(util.format($('Local file %s doesn\'t exist'), source));
    }

    var fsStatus = fs.stat(source, _);
    if (!fsStatus.isFile()) {
      throw new Error(util.format($('%s is not a file'), source));
    }
    if (fsStatus.size > StorageUtil.MaxFileSize) {
      throw new Error(util.format($('The local file size %d exceeds the Azure file size limit %d'), fsStatus.size, StorageUtil.MaxFileSize));
    }

    var pathIsDirectory = path && path.length > 0 && (path[path.length - 1] === '/' || path[path.length - 1] === '\\');

    var remoteFileExists = false;
    var directory, file;

    startProgress(util.format($('Checking file or directory \'%s\' in share %s'), path ? path : '', share));
    try {
      if (path) {

        path = StorageUtil.normalizePath(path);
        var result = StorageUtil.fetchBasenameAndDirname(path);
        directory = result.dirname;
        file = result.basename;

        // When provided a path, we need to verify if the path is to a directory
        // or an existing file. In first case, we will upload the file onto the
        // directory using its original basename. In second case, we will
        // overwrite the file after prompted.

        /* jshint -W035 */
        // 1. Check if the file exists
        if (!utils.stringIsNullOrEmpty(file) && !pathIsDirectory && 
          performStorageOperation(
            getStorageFileOperation(fileService, 'doesFileExist'),
            _,
            share,
            directory,
            file,
            storageOptions)
          ) {
          remoteFileExists = true;
        }

        // 2. Check if directory exists
        else if (pathIsDirectory || performStorageOperation(
            getStorageFileOperation(fileService, 'doesDirectoryExist'),
            _,
            share,
            path)) {

          directory = path;
          file = pathUtil.basename(source);
        }

        // 3. Check if the path is under an existing directory
        else if (performStorageOperation(
            getStorageFileOperation(fileService, 'doesDirectoryExist'),
            _,
            share,
            directory)) {
          // If the directory exists, we will be able to upload a file into it.
        }
        
        else {
          throw new Error(util.format($('Path \'%s\' is neither an existing file nor under an existing directory'), path));
        }
      } else {

        // If use didn't specify the path, we assume he wanted the file to be
        // uploaded to root directory and using the source's basename.

        directory = '';
        file = pathUtil.basename(source);
      }

      /* jshint +W035 */

      if (remoteFileExists || performStorageOperation(
          getStorageFileOperation(fileService, 'doesFileExist'),
          _,
          share,
          directory,
          file,
          storageOptions)) {
        remoteFileExists = true;
      }
    } finally {
      endProgress();
    }

    if (remoteFileExists === true) {
      if (force !== true) {
        force = interaction.confirm(util.format($('Do you want to overwrite remote file %s? '), pathUtil.join(directory, file)), _);
        if (force !== true) {
          return;
        }
      }
    }

    startProgress(util.format($('Uploading file \'%s\' to \'%s\' under share %s'), source, directory, share));
    endProgress();

    var summary = new SpeedSummary(file);
    storageOptions.speedSummary = summary;
    storageOptions.parallelOperationThreadCount = options.concurrenttaskcount || storageOptions.parallelOperationThreadCount;
    var printer = StorageUtil.getSpeedPrinter(summary);
    var intervalId = -1;
    if (!logger.format().json) {
      intervalId = setInterval(printer, 1000);
    }

    var succeeded = false;
    var uploadFileResult;
    try {
      uploadFileResult = performStorageOperation(
        getStorageFileOperation(fileService, 'createFileFromLocalFile'),
        _,
        share,
        directory,
        file,
        source,
        storageOptions);

      succeeded = true;
    } finally {
      printer(true);
      clearInterval(intervalId);
    }

    if (succeeded === true) {
      uploadFileResult = StorageUtil.embedTransferSummary(uploadFileResult, summary);
      cli.interaction.formatOutput(uploadFileResult, function() {
        logger.info(util.format($('Successfully uploaded file \'%s\' to share %s'), source, share));
      });
    }
  }

  function downloadFile(share, path, destination, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    path = interaction.promptIfNotGiven($('Path of the file to be downloaded: '), path, _);
    var storageOptions = getStorageFileOperationDefaultOption();
    var force = !!options.quiet;

    path = StorageUtil.normalizePath(path);
    var result = StorageUtil.fetchBasenameAndDirname(path);
    var directory = result.dirname;
    var file = result.basename;
    logger.verbose(directory);
    logger.verbose(file);

    if (destination) {
      var stat;
      try {
        stat = fs.stat(destination, _);
        if (stat.isDirectory()) {

          // If destination is an existing directory, join the remote file
          // name to build up the destination file.
          destination = pathUtil.join(destination, file);
        }
      } catch (err) {
        if (!StorageUtil.isFileNotFoundException(err)) {
          throw err;
        }
      }
    } else {
      destination = pathUtil.join('.', file);
    }

    // If destination exists as a file, prompt for overwrite if not in
    // quite mode.

    if (utils.fileExists(destination, _)) {
      if (force !== true) {
        force = interaction.confirm(util.format($('Do you want to overwrite file %s? '), destination), _);
        if (force !== true) {
          return;
        }
      }
    }

    var operation = getStorageFileOperation(fileService, 'getFileToLocalFile');
    var summary = new SpeedSummary(file);
    storageOptions.speedSummary = summary;
    storageOptions.disableContentMD5Validation = !options.checkmd5;

    startProgress(util.format($('Download remote file \'%s\' from share %s to local path \'%s\''), path, share, destination));
    endProgress();

    var printer = StorageUtil.getSpeedPrinter(summary);
    var intervalId = -1;
    if (!logger.format().json) {
      intervalId = setInterval(printer, 1000);
    }

    var downloadedFile;
    try {
      downloadedFile = performStorageOperation(operation, _, share, directory, file, destination, storageOptions);
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('File \'%s\' in share %s does not exist'), path, share));
      } else {
        throw e;
      }
    } finally {
      printer(true);
      clearInterval(printer);
    }

    downloadedFile = StorageUtil.embedTransferSummary(downloadedFile, summary);
    cli.interaction.formatOutput(downloadedFile, function() {
      logger.info(util.format($('File saved as %s'), destination));
    });
  }

  /**
  * Get azure file properties
  */
  function getStorageFileProperties(share, path, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    path = interaction.promptIfNotGiven($('File path: '), path, _);
    var storageOptions = getStorageFileOperationDefaultOption();
    var file = {};
    path = StorageUtil.normalizePath(path);
    var result = StorageUtil.fetchBasenameAndDirname(path);
    var propertiesOperation = getStorageFileOperation(fileService, 'getFileProperties');
    var tips = $('Getting Storage file information');

    startProgress(tips);

    try {
      file = performStorageOperation(propertiesOperation, _, share, result.dirname, result.basename, storageOptions);
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('File %s in share %s doesn\'t exist'), path, share));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }
    return file;
  }

  function doesStorageFileExist(share, path, options, _) {
    var fileService = getFileServiceClient(options);
    var storageOptions = getStorageFileOperationDefaultOption();
    var propertiesOperation = getStorageFileOperation(fileService, 'doesFileExist');

    path = StorageUtil.normalizePath(path);
    var result = StorageUtil.fetchBasenameAndDirname(path);

    return performStorageOperation(propertiesOperation, _, share, result.dirname, result.basename, storageOptions);
  }

  function createDirectory(share, path, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    path = interaction.promptIfNotGiven($('Path to the directory to be created: '), path, _);
    path = StorageUtil.normalizePath(path);

    var operation = getStorageFileOperation(fileService, 'createDirectory');
    var tips = util.format($('Creating storage file directory \'%s\' in share %s'), path, share);
    var storageOptions = getStorageFileOperationDefaultOption();
    startProgress(tips);

    var directoryResult;
    try {
      directoryResult = performStorageOperation(operation, _, share, path, storageOptions);
    } finally {
      endProgress();
    }

    logger.info(util.format($('Directory %s has been created successfully'), path));
    logger.json(directoryResult);
  }

  function deleteDirectory(share, path, options, _) {
    var fileService = getFileServiceClient(options);
    share = interaction.promptIfNotGiven($('Share name: '), share, _);
    path = interaction.promptIfNotGiven($('Path to the directory to be created: '), path, _);
    var operation = getStorageFileOperation(fileService, 'deleteDirectory');
    var tips = util.format($('Deleting storage file directory %s'), share);
    var storageOptions = getStorageFileOperationDefaultOption();
    path = StorageUtil.normalizePath(path);
    if (utils.stringIsNullOrEmpty(path)) {
      throw new Error($('Cannot delete root directory. A path to a subdirectory is mandatory'));
    }

    var force = !!options.quiet;

    if (force !== true) {
      force = interaction.confirm(util.format($('Do you want to delete directory %s in share %s? '), path, share), _);
      if (force !== true) {
        return;
      }
    }

    startProgress(tips);

    try {
      performStorageOperation(operation, _, share, path, storageOptions);
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Can not find directory \'%s\' in share %s'), path, share));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    logger.info(util.format($('Directory %s has been deleted successfully'), path));
  }
  
  /**
  * Start file copy
  */
  function startFileCopy(sourceUri, destShare, options, _) {
    var startCopyParams = StorageUtil.getStartCopyParameters(StorageUtil.CopyTypes.CopyToFile, sourceUri, options);  
    startCopyParams.checkExistenceOperation = doesStorageFileExist;

    StorageUtil.startAsyncCopy(startCopyParams, sourceUri, destShare, options, _);
  }
  
  /**
  * Show file copy status
  */
  function showFileCopy(share, path, options, _) {
    var showCopyParams = {
      type: StorageUtil.CopyTypes.CopyToFile,
      getProperties: getStorageFileProperties
    };

    StorageUtil.showAsyncCopy(showCopyParams, share, path, options, _);
  }
  
  /**
  * Stop file copy
  */
  function stopFileCopy(share, path, copyid, options, _) {
    var getStopOperation = function (serviceClient) {
      var operationInfo = {};
      operationInfo.operation = getStorageFileOperation(serviceClient, 'abortCopyFile');
      operationInfo.options = getStorageFileOperationDefaultOption();
      return operationInfo;
    };
    
    var stopCopyParams = {
      type: StorageUtil.CopyTypes.CopyToFile,
      getStopOperation: getStopOperation
    };

    StorageUtil.stopAsyncCopy(stopCopyParams, share, path, copyid, options, _);
  }

  function validateSharePrefix(prefix) {
    if (utils.stringIsNullOrEmpty(prefix)) {
      return;
    }

    if (!prefix.match(/^[a-z0-9][a-z0-9\-]{0,62}$/) ||
      prefix.indexOf('--') >= 0) {
      throw new Error(util.format($('The given prefix \'%s\' is not a valid prefix of a share name'), prefix));
    }
  }

  /**
  * Patch for azure node sdk
  */
  function applyFileServicePatch(fileService) {

    /*
    * List all shares
    * NOTICE: All the caller should use the options parameter since it's just a internal implementation
    */
    fileService.listAllShares = function(options, callback) {
      StorageUtil.listWithContinuation(fileService.listSharesSegmentedWithPrefix, fileService, StorageUtil.ListContinuationTokenArgIndex.Share, options.prefix, null, options, callback);
    };

    /*
    * List files and directories in the given folder
    * NOTICE: All the caller should use the options parameter since it's just a internal implementation
    */
    fileService.listFilesAndDirectories = function(share, directory, options, callback) {
      StorageUtil.listWithContinuation(fileService.listFilesAndDirectoriesSegmented, fileService, StorageUtil.ListContinuationTokenArgIndex.File, share, directory, null, options, callback);
    };
  }
};
