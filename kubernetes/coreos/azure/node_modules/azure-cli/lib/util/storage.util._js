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

var azureCommon = require('azure-common');
var storage = require('azure-storage');
var http = require('http');
var url = require('url');
var BlobUtilities = storage.BlobUtilities;
var FileUtilities = storage.FileUtilities;
var connectionStringParser = azureCommon.ConnectionStringParser;
var flows = require('streamline/lib/util/flows');
var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var getStorageSettings = storage.StorageServiceClient.getStorageSettings;
var util = require('util');
var utils = require('./utils');
var splitDestinationUri = require('./blobUtils').splitDestinationUri;
var utilsCore = require('./utilsCore');
var profile = require('./profile');
var validation = require('./validation');
var ExponentialRetryPolicyFilter = storage.ExponentialRetryPolicyFilter;

var __ = require('underscore');
var $ = utils.getLocaleString;

/**
* Module variables
*/
var cli = null;
var logger = null;
var progress = null;
var userAgent = null;

/**
* Limit the concurrent REST calls
*/
var restFunnel = null;

/**
* Storage rest operation time out
*/
var operationTimeout = null;

/**
* In xplat command module, single space is not accept as a parameter, use double spaces instead  
*/
var SPACE_PARAMETER = '  ';

/**
* Storage Utilities for storage blob/queue/table command
*/
var StorageUtil = {};

/**
* Storge connection string environment variable name and it's also used azure storage powershell.
*/
StorageUtil.ENV_CONNECTIONSTRING_NAME = 'AZURE_STORAGE_CONNECTION_STRING';
StorageUtil.ENV_SDK_ACCOUNT_NAME = 'AZURE_STORAGE_ACCOUNT';
StorageUtil.ENV_SDK_ACCOUNT_KEY = 'AZURE_STORAGE_ACCESS_KEY';
StorageUtil.CONCURRENTCY_CONFIG_KEY_NAME = 'azure_storage_concurrency';
StorageUtil.OPERATION_TIMEOUT_CONFIG_KEY_NAME = 'azure_storage_timeout'; //Milliseconds

/**
* Storage account types that can be created
*/
StorageUtil.AccountTypeForCreating = {
  LRS: 'Standard_LRS',
  ZRS: 'Standard_ZRS',
  GRS: 'Standard_GRS',
  RAGRS: 'Standard_RAGRS',
  PLRS: 'Premium_LRS',
};

/**
* Storage account types that can be changed to
*/
StorageUtil.AccountTypeForChanging = {
  LRS: 'Standard_LRS',
  GRS: 'Standard_GRS',
  RAGRS: 'Standard_RAGRS',
};

/**
* Storage operation type
*/
StorageUtil.OperationType = {
  Blob: 'blob',
  Queue: 'queue',
  Table: 'table',
  File: 'file',
};

/**
* Storage access type
*/
StorageUtil.AccessType = {
  Container: 'container',
  Blob: 'blob',
  Queue: 'queue',
  Table: 'table',
  Share: 'share'
};

/**
* Storage container permission
*/
StorageUtil.ContainerPermission = {
  Read: 'r',
  Write: 'w',
  Delete: 'd',
  List: 'l',
};

/**
* Storage blob permission
*/
StorageUtil.BlobPermission = {
  Read: 'r',
  Write: 'w',
  Delete: 'd',
};

/**
* Storage table permission
*/
StorageUtil.TablePermission = {
  Query: 'r',
  Add: 'a',
  Update: 'u',
  Delete: 'd',
};

/**
* Storage queue permission
*/
StorageUtil.QueuePermission = {
  Read: 'r',
  Add: 'a',
  Update: 'u',
  Process: 'p',
};

/**
* Storage share permission
*/
StorageUtil.SharePermission = {
  Read: 'r',
  Write: 'w',
  Delete: 'd',
  List: 'l',
};

/**
* ContinuationToken arg index in different listing functions
*/
StorageUtil.ListContinuationTokenArgIndex = {
  Container: 1,
  Blob: 2,
  Share: 1,
  File: 2,
  Queue: 1,
  Table: 1,
};

/**
* Storage policy operations
*/
StorageUtil.PolicyOperation = {
  Create: 1,
  Set: 2,
  Delete: 3,
};

/**
* Storage async copy types
*/
StorageUtil.CopyTypes = {
  CopyToBlob: 1,
  CopyToFile: 2,
};

StorageUtil.MaxPolicyCount = 5;

// 4 MB X 50000 blocks
StorageUtil.MaxBlockBlobSize = 50000 * 4 * 1024 * 1024; 
StorageUtil.MaxAppendBlobSize = 50000 * 4 * 1024 * 1024;

// 1 TB
StorageUtil.MaxPageBlobSize = 1024 * 1024 * 1024 * 1024;
StorageUtil.MaxFileSize = 1024 * 1024 * 1024 * 1024;

/**
* Init cli module
*/
StorageUtil.init = function(azureCli) {
  cli = azureCli;
  logger = cli.output;
  var cfg = utilsCore.readConfig();
  var restConcurrency = getRestConcurrency(cfg);
  http.globalAgent.maxSockets = restConcurrency;
  restFunnel = flows.funnel(restConcurrency);
  operationTimeout = getRestOperationTimeout(cfg);

  var packagePath = path.join(__dirname, '../../package.json');
  var packageInfo = JSON.parse(fs.readFileSync(packagePath));
  userAgent = util.format('%s/%s (Mode %s) ', packageInfo.name, packageInfo.version, cfg.mode);
};

/**
* Create an Storage operation
* @constructor
* @param {OperationType} [type] Storage operation type
* @param {string} [operation] Operation name
*/
StorageUtil.StorageOperation = function(type, operation) {
  this.type = type;
  this.operation = operation;
};

/**
* Get an Storage operation
* @constructor
* @param {object} [serviceClient] Storage service client
* @param {OperationType} [operationType] Storage operation type
* @param {string} [operationName] Operation name
*/
 StorageUtil.getStorageOperation = function(serviceClient, operationType, operationName) {
    var operation = new StorageUtil.StorageOperation();
    operation.type = operationType;
    operation.operation = operationName;
    operation.service = serviceClient;
    return operation;
  };

/**
* Get blob service with the specified or default connection string
* @param {string|object} [connection] Storage connection string or options with access information
* @return {BlobService} BlobService object from node sdk
*/
StorageUtil.getBlobService = function(connection) {
  var serviceSettings = getStorageServiceSettings(connection);
  var service = null;
  if (serviceSettings === null) {
    //Use the default blob service, nodesdk will use the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables
    service = storage.createBlobService();
  } else if (serviceSettings._usePathStyleUri) {
    service = storage.createBlobService(connection);
  } else if (serviceSettings._sasToken) {
    service = storage.createBlobServiceWithSas(serviceSettings._blobEndpoint.primaryHost, serviceSettings._sasToken);
  } else {
    service = storage.createBlobService(serviceSettings._name, serviceSettings._key, serviceSettings._blobEndpoint.primaryHost);
  }
  return service.withFilter(new ExponentialRetryPolicyFilter());
};

/**
* Get table service with the specified or default connection string
* @param {string|object} [connection] Storage connection string or options with access information
* @return {TableService} TableService object from node sdk
*/
StorageUtil.getTableService = function(connection) {
  var serviceSettings = getStorageServiceSettings(connection);
  var service = null;
  if (serviceSettings === null) {
    //Use the default table service, nodesdk will use the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables
    service = storage.createTableService();
  } else if (serviceSettings._usePathStyleUri) {
    service = storage.createTableService(connection);
  } else if (serviceSettings._sasToken) {
    service = storage.createTableServiceWithSas(serviceSettings._tableEndpoint.primaryHost, serviceSettings._sasToken);
  } else {
    service = storage.createTableService(serviceSettings._name, serviceSettings._key, serviceSettings._tableEndpoint.primaryHost);
  }
  return service.withFilter(new ExponentialRetryPolicyFilter());
};

/**
* Get queue service with the specified or default connection string
* @param {string|object} [connection] Storage connection string or options with access information
* @return {QueueService} QueueService object from node sdk
*/
StorageUtil.getQueueService = function(connection) {
  var serviceSettings = getStorageServiceSettings(connection);
  var service = null;
  if (serviceSettings === null) {
    //Use the default queue service, nodesdk will use the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables
    service = storage.createQueueService();
  } else if (serviceSettings._usePathStyleUri) {
    service = storage.createQueueService(connection);
  } else if (serviceSettings._sasToken) {
    service = storage.createQueueServiceWithSas(serviceSettings._queueEndpoint.primaryHost, serviceSettings._sasToken);
  } else {
    service = storage.createQueueService(serviceSettings._name, serviceSettings._key, serviceSettings._queueEndpoint.primaryHost);
  }
  return service.withFilter(new ExponentialRetryPolicyFilter());
};

/**
* Get file service with the specified or default connection string
* @param {string|object} [connection] Storage connection string or options with access information
* @return {FileService} FileService object from node sdk
*/
StorageUtil.getFileService = function(connection) {
  var serviceSettings = getStorageServiceSettings(connection);
  var service = null;
  if (serviceSettings === null) {
    //Use the default queue service, nodesdk will use the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY environment variables
    service = storage.createFileService();
  } else if (serviceSettings._usePathStyleUri) {
    service = storage.createFileService(connection);
  } else if (serviceSettings._sasToken) {
    service = storage.createFileServiceWithSas(serviceSettings._fileEndpoint.primaryHost, serviceSettings._sasToken);
  } else {
    service = storage.createFileService(serviceSettings._name, serviceSettings._key, serviceSettings._fileEndpoint.primaryHost);
  }
  return service.withFilter(new ExponentialRetryPolicyFilter());
};

/**
* Normalize the SAS token 
*/
StorageUtil.normalizeSasToken = function(sasToken) {
  if (typeof sasToken === 'string' && sasToken.charAt(0) === '?') {
    sasToken = sasToken.slice(1);
  }
  return sasToken;
};

/**
* Perform Storage REST operation, this function accepts dynamic parameters
* All parameters except the first one will be treated as the parameters of the specified operation
* @param {StorageOperation} storageOperation Storage operation
* @param {Callback} _ call back function
*/
StorageUtil.performStorageOperation = function(storageOperation, _) {
  if (!storageOperation) return;
  var service = storageOperation.service;
  if (!service) {
    throw new Error('Service client can\'t be null');
  }

  var operation = storageOperation.operation || '';

  if (!service[operation] || !isFunction(service[operation])) {
    throw 'Invalid operation ' + operation;
  }

  //The number of the explicitly defined parameters for this method
  var definedParameterCount = 2;
  var operationArgs = Array.prototype.slice.call(arguments).slice(definedParameterCount, arguments.length);

  var result = null;
  try {
    restFunnel(_, function(_) {
      /*jshint camelcase:false*/
      result = service[operation].apply_(_, service, operationArgs);
      /*jshint camelcase:true*/
    });
  } catch (e) {
    StorageUtil.endProgress();
    throw e;
  }
  return result;
};

/**
* Start cli operation progress
*/
StorageUtil.startProgress = function(tips) {
  if (progress !== null) {
    StorageUtil.endProgress();
  }
  progress = cli.interaction.progress(tips);
};

/**
* End cli operation progress
*/
StorageUtil.endProgress = function() {
  if (progress !== null) {
    progress.end();
  }
  progress = null;
};

/**
* Set REST operation time out
*/
StorageUtil.setOperationTimeout = function(options) {
  if (options.timeoutintervalInMs === undefined &&
  operationTimeout !== null && !isNaN(operationTimeout) && operationTimeout > 0) {
    options.timeoutIntervalInMs = operationTimeout;
  }
};

/**
* Convert string to container access level
*/
StorageUtil.stringToContainerAccessLevel = function(str) {
  var accessType = BlobUtilities.BlobContainerPublicAccessType;
  var accessLevel = accessType.OFF;
  if (str) {
    str = str.toLowerCase();
    switch (str) {
      case 'blob':
        accessLevel = accessType.BLOB;
        break;
      case 'container':
        accessLevel = accessType.CONTAINER;
        break;
      case 'off':
        accessLevel = accessType.OFF;
        break;
      default:
        if (str) {
          throw new Error(util.format('Invalid container public access level %s', str));
        }
        break;
    }
  }
  return accessLevel;
};

/**
* Convert file to blob name
*/
StorageUtil.convertFileNameToBlobName = function(name) {
  return name.replace(/\\/img, '/');
};

/**
* Convert container access level to string
*/
StorageUtil.containerAccessLevelToString = function(accessType) {
  var publicAccessType = BlobUtilities.BlobContainerPublicAccessType;
  var str = 'Off';
  switch (accessType) {
    case publicAccessType.BLOB:
      str = 'Blob';
      break;
    case publicAccessType.CONTAINER:
      str = 'Container';
      break;
    case publicAccessType.OFF:
      str = 'Off';
      break;
    default:
      if (accessType) {
        throw new Error(util.format('Invalid Container public access type %s', accessType));
      }
      break;
  }
  return str;
};

/**
* Parse json parameter to object
*/
StorageUtil.parseKvParameter = function(str) {
  if (str) {
    return connectionStringParser.parse(str);
  }
};

/**
* Is not found exception
*/
StorageUtil.isNotFoundException = function(e) {
  var notFoundErrors = ['NotFound', 'ResourceNotFound', 'ContainerNotFound', 'BlobNotFound', 'QueueNotFound', 'TableNotFound', 'ShareNotFound'];
  return notFoundErrors.some(function (error) { return e.code === error; });
};

/**
* Is blob exists exception
*/
StorageUtil.isBlobExistsException = function(e) {
  return e.code === 'BlobAlreadyExists';
};

/**
* Is file exists exception
*/
StorageUtil.isFileExistsException = function(e) {
  return e.code === 'FileAlreadyExists';
};

/**
* Is file not found exception
*/
StorageUtil.isFileNotFoundException = function(e) {
  return e.code === 'ENOENT';
};

/**
* Recursive mkdir
*/
StorageUtil.recursiveMkdir = function(root, specifiedPath) {
  if (utils.isWindows()) {
    //'\' will be converted to '//' both in client and azure storage
    specifiedPath = specifiedPath.replace(/\//g, '\\');
  }
  var dirs = specifiedPath.split(path.sep);
  var dirPath = root || '';
  var dirName = '';
  for (var i = 0; i < dirs.length; i++) {
    dirName = utils.escapeFilePath(dirs[i]);
    dirPath = path.join(dirPath, dirName);
    if (!StorageUtil.doesPathExist(dirPath)) {
      fs.mkdirSync(dirPath);
    }
  }
  return dirPath;
};

StorageUtil.doesPathExist = function(dirPath) {
  var existFunc = fs.existsSync || path.existsSync; //For node 0.10 and 0.6
  if (path) {
    return existFunc(dirPath);
  }
  return true;
};

/**
* Get file system structure from blob name
*/
StorageUtil.getStructureFromBlobName = function(blobName) {
  var structure = { fileName: undefined, dirName: undefined };
  if (blobName[blobName.length - 1] === '/') {
    var lastIndex = blobName.lastIndexOf('/', blobName.length - 2);
    structure.fileName = blobName.substr(lastIndex + 1);
    structure.dirName = blobName.substr(0, lastIndex);
  } else {
    structure.fileName = path.basename(blobName);
    structure.dirName = path.dirname(blobName);
  }
  return structure;
};

/**
* Calculate the md5hash for the specified file
*/
StorageUtil.calculateFileMd5 = function(filePath, cb) {
  var stream = fs.createReadStream(filePath);
  var digest = crypto.createHash('md5');
  stream.on('data', function(d) { digest.update(d); });
  stream.on('end', function() {
    var md5 = digest.digest('base64');
    cb(null, md5);
  });
};

/**
* Format blob properties
*/
StorageUtil.formatBlobProperties = function(properties, target) {
  if (!properties) return;
  var propertyNames = ['contentType', 'contentEncoding', 'contentLanguage', 'cacheControl'];
  var getPropertyIndex = function(key) {
    for (var i = 0; i < propertyNames.length; i++) {
      if (propertyNames[i].toLowerCase() == key.toLowerCase()) {
        return i;
      }
    }
    return -1;
  };

  var index = -1;
  for (var item in properties) {
    index = getPropertyIndex(item);
    if (index == -1) {
      throw new Error(util.format($('Invalid value: %s. Options are: %s'), item, propertyNames));
    }
    target[propertyNames[index]] = properties[item];
    if (item.toLowerCase() === 'contenttype') {
      target['contentType'] = properties[item];
    }
  }
};

/**
* List azure storage objects with continuation
*/
StorageUtil.listWithContinuation = function(listFunc, storageServiceObject, continuationTokenIndexInArg) {
  var allItems = {};
  function listCallback(error, result) {
    if (error) throw error;

    if (result.entries instanceof Array) {
      if (!(allItems instanceof Array)) {
        allItems = [];
      }

      allItems = allItems.concat(result.entries);
    }
    else {
      for (var property in result.entries) {
        if (result.entries.hasOwnProperty(property)) {
          if (!allItems[property]) {
            allItems[property] = [];
          }

          allItems[property] = allItems[property].concat(result.entries[property]);
        }
      }
    }

    if (result.continuationToken) {
      callArguments[continuationTokenIndexInArg] = result.continuationToken;
      listFunc.apply(storageServiceObject, callArguments);
    } else {
      callback(error, allItems);
      allItems = null;
    }
  }
  var callback = arguments[arguments.length - 1];
  var callArguments = Array.prototype.slice.call(arguments).slice(3, arguments.length - 1);
  callArguments.push(listCallback);
  listFunc.apply(storageServiceObject, callArguments);
};

/**
* Get file service account from user specified credential or env variables
*/
StorageUtil.getServiceClient = function(getServiceClientFunc, options) {
  var isNameDefined = options.accountName !== undefined;
  var isKeyDefined = options.accountKey !== undefined;
  var isSasDefined = options.sas !== undefined;
  var isConnectionStringDefined = options.connectionString !== undefined;
  var isAccountDefined = isNameDefined || isKeyDefined;
  var isUserDefined = isAccountDefined || isSasDefined;    

  if (isConnectionStringDefined && isUserDefined) {
    throw new Error($('Please only define one of them:\n 1. --connection-string\n 2. --account-name and --account-key\n 3. --account-name and --sas'));
  } else {
    var serviceClient = null;
    if (isConnectionStringDefined) {
      serviceClient = getServiceClientFunc(options.connectionString);
    } else if (isUserDefined) {
      if (isNameDefined) {
        if (isKeyDefined && isSasDefined) {
          throw new Error($('Please only define --account-key or --sas when --account-name is defined'));
        } else if (isKeyDefined) {
          var connString = util.format('DefaultEndpointsProtocol=https;AccountName=%s;AccountKey=%s', options.accountName, options.accountKey);
          serviceClient = getServiceClientFunc(connString);
        } else {
          serviceClient = getServiceClientFunc(options);
        }
      } else {
        throw new Error($('Please set --account-name and --account-key or --account-name and --sas'));
      }
    } else {
      //Use environment variable
      serviceClient = getServiceClientFunc();
    }
    if (options.verbose === true) {
      serviceClient.logger.level = azureCommon.Logger.LogLevels.DEBUG;
    }
    serviceClient.on('sendingRequestEvent', sendingRequestHandler);
    return serviceClient;
  }
};

/**
* Get a printer for speed summary
*/
StorageUtil.getSpeedPrinter = function(summary) {
  var clearBuffer = new Buffer(79, 'utf8');
  clearBuffer.fill(' ');
  clearBuffer = clearBuffer.toString();
  var done = false;
  return function(newline) {
    if (logger.format().json || done) return;
    var tips = util.format($('Percentage: %s%% (%s/%s) Average Speed: %s Elapsed Time: %s '), summary.getCompletePercent(),
      summary.getCompleteSize(), summary.getTotalSize(), summary.getAverageSpeed(), summary.getElapsedSeconds());
    fs.writeSync(1, '\r' + clearBuffer + '\r');
    process.stdout.write(tips);
    if (newline) {
      process.stdout.write('\n');
      done = true;
    }
  };
};

/**
* Embed the transfer summary
*/
StorageUtil.embedTransferSummary = function(properties, speedSummary) {
  var extendProperties = properties || {};
  if (speedSummary) {
    var transferSummary = {
      totalSize: speedSummary.getTotalSize(),
      totalTime: speedSummary.getElapsedSeconds(),
      averageSpeed: speedSummary.getAverageSpeed()
    };
    extendProperties = __.extend(properties, {transferSummary: transferSummary});
  }
  return extendProperties;
 };

/**
* Get storage settings
*/
StorageUtil.getStorageServiceSettings = getStorageServiceSettings;

/**
* Get Storage default operation options
*/
StorageUtil.getStorageOperationDefaultOption = function() {
  var option = {};
  StorageUtil.setOperationTimeout(option);
  return option;
};

StorageUtil.validatePermissions = function(accessType, permissions) {
  switch (accessType) {
    case StorageUtil.AccessType.Container:
      validatePermisionsAndOrder(permissions, StorageUtil.ContainerPermission);
      break;
    case StorageUtil.AccessType.Blob:
      validatePermisionsAndOrder(permissions, StorageUtil.BlobPermission);
      break;
    case StorageUtil.AccessType.Table:
      validatePermisionsAndOrder(permissions, StorageUtil.TablePermission);
      break;
    case StorageUtil.AccessType.Queue:
      validatePermisionsAndOrder(permissions, StorageUtil.QueuePermission);
      break;
    case StorageUtil.AccessType.Share:
      validatePermisionsAndOrder(permissions, StorageUtil.SharePermission);
      break;
  }
};

StorageUtil.getSharedAccessPolicy = function(permissions, start, expiry, tableField, policyId) {
  var sharedAccessPolicy = {};
  if (policyId) {
    if (permissions || expiry || start) {
      throw new Error($('Permissions, start and expiry cannot be specified with a stored policy'));
    }
    sharedAccessPolicy.Id = policyId;
  } else {
    if (utils.stringIsNullOrEmpty(permissions)) {
      throw new Error($('Permissions or policy ID is required'));
    }
    if (!expiry) {
      throw new Error($('Expiry or policy ID is required'));
    }
    if (start && !__.isDate(start)) {
      throw new Error($('Start is not a valid date'));
    }
    if (!__.isDate(expiry)) {
      throw new Error($('Expiry is not a valid date'));
    }

    sharedAccessPolicy = {
      AccessPolicy: {
        Expiry: expiry
      }
    };

    // Get the permission symbols
    var sharedAccessPermissions = removeRedundantPermission(permissions);
    sharedAccessPolicy.AccessPolicy.Permissions = sharedAccessPermissions;

    // Get the start time
    if (start) {
      if (start.getTime() >= expiry.getTime()) {
        throw new Error($('The expiry time of the specified access policy should be greater than start time'));
      }
      sharedAccessPolicy.AccessPolicy.Start = start;
    }
  }

  // Get the table fields
  if (tableField) {
    if (tableField.startRk && !tableField.startPk) {
      throw new Error($('Starting partition key must accompany starting row key'));
    }
    if (tableField.endRk && !tableField.endPk) {
      throw new Error($('Ending partition key must accompany ending row key'));
    }

    if (tableField.startPk) {
      sharedAccessPolicy.AccessPolicy.StartPk = tableField.startPk;
    }
    if (tableField.startRk) {
      sharedAccessPolicy.AccessPolicy.StartRk = tableField.startRk;
    }
    if (tableField.endPk) {
      sharedAccessPolicy.AccessPolicy.EndPk = tableField.endPk;
    }
    if (tableField.endRk) {
      sharedAccessPolicy.AccessPolicy.EndRk = tableField.endRk;
    }
  }

  return sharedAccessPolicy;
};

/**
* Operation concurrency.
*   -1 means operations are fully parallelized.
*   However the concurrent REST calls are limited by performStorageOperation
*/
StorageUtil.opConcurrency = -1;

/**
* Threads count in an operation.
*   The value indicates the max socket count of the http/https agent
*/
StorageUtil.threadsInOperation = 5;

/**
* Extract the storage account options from the specified options
* @param {object} options command line options
*/
StorageUtil.getStorageAccountOptions = function(options) {
  return {
    accountName: options.accountName,
    accountKey: options.accountKey,
    connectionString: options.connectionString,
    sas: options.sas
  };
};

/**
* Check if the given value is a valid retention value.
*
* @param {object} value The value to validate.
*/
StorageUtil.isValidRetention = function(value) {
  return validation.isInt(value) && parseInt(value, 10) >= 0;
};

/**
* Create a shared access policy
*
* @param {object} policySettings The policy settings.
*/
StorageUtil.createPolicy = function(policySettings, _) {
  return operateOnPolicy(policySettings, StorageUtil.PolicyOperation.Create, _);
};

/**
* Set a shared access policy
*
* @param {object} policySettings The policy settings.
*/
StorageUtil.setPolicy = function(policySettings, _) {
  return operateOnPolicy(policySettings, StorageUtil.PolicyOperation.Set, _);
};

/**
* Delete a shared access policy
*
* @param {object} policySettings The policy settings.
*/
StorageUtil.deletePolicy = function(policySettings, _) {
  return operateOnPolicy(policySettings, StorageUtil.PolicyOperation.Delete, _);
};


/**
* Select shared access policies
*
* @param {object} policySettings The policy settings.
*/
StorageUtil.selectPolicy = function(policySettings, _) {
  var policies = [];
  var index = -1;
  StorageUtil.startProgress(policySettings.tips);
  try {
    policies = StorageUtil.performStorageOperation(policySettings.getAclOperation, _, policySettings.resourceName, policySettings.storageOptions).signedIdentifiers;

    for (var i = 0; i < policies.length; i++) {
      normalizePolicy(policies[i], policySettings.accessType);
      if (policySettings.policyName && policies[i].Id === policySettings.policyName) {
        index = i;
        break;
      }
    }    
  } catch (e) {
    throw new Error((util.format($('%s\rReason: %s'), e.message, e.reason)));
  } finally {
    StorageUtil.endProgress();
  }

  if (policySettings.policyName && index < 0) {
    throw new Error(util.format($('The policy %s doesn\'t exist'), policySettings.policyName));
  }

  // If policySettings.policyName is set, it is showing the specific policy, otherwise it is listing all policies.
  return policySettings.policyName ? policies.slice(index, index+1) : policies;
};

/**
* Show the policy operation result
*/
StorageUtil.showPolicyResults = function(policies) {
  logger.table(policies, function(row, item) {
    row.cell($('Policy Name'), item.Id);
    row.cell($('Start'), (item.AccessPolicy && item.AccessPolicy.Start) ? item.AccessPolicy.Start : '');
    row.cell($('Expiry'), (item.AccessPolicy && item.AccessPolicy.Expiry) ? item.AccessPolicy.Expiry : '');
    row.cell($('Permissions'), (item.AccessPolicy && item.AccessPolicy.Permissions) ? item.AccessPolicy.Permissions : '');
  });
};

/**
* Fetch the directory and file from the path
*/
StorageUtil.fetchBasenameAndDirname = function (filePath) {
  var result = {};
  result.basename = path.basename(filePath);
  result.dirname = path.dirname(filePath);
  if (!result.dirname || result.dirname === '.') {
    result.dirname = '';
  }

  if (!result.basename) {
    result.basename = '';
  }

  return result;
};

/**
* Normalize the file path
*/
StorageUtil.normalizePath = function (filePath) {
  var result = path.join('', __.without(filePath.replace('\\', '/').split('/'), '').join('/'));
  if (result === '.') {
    result = '';
  }

  return result;
};

/**
* Set a shared access policy
*
* @param {object} policySettings The policy settings.
* @param {int} operation The operation type.
*/
function operateOnPolicy(policySettings, operation, _) {
  var policies = [];
  StorageUtil.startProgress(policySettings.tips);
  try {
    policies = StorageUtil.performStorageOperation(policySettings.getAclOperation, _, policySettings.resourceName, policySettings.storageOptions).signedIdentifiers;

    var newPolicy = generatePolicy(policySettings.policyName, policySettings.policyOptions.start, policySettings.policyOptions.expiry, policySettings.policyOptions.permissions);
    modifyPolicySet(newPolicy, policies, policySettings.accessType, operation);
    StorageUtil.performStorageOperation(policySettings.setAclOperation, _, policySettings.resourceName, policies, policySettings.storageOptions);
  } catch (e) {
    throw new Error((util.format($('%s\rReason: %s'), e.message, e.reason)));
  } finally {
    StorageUtil.endProgress();
  }

  return policies;
}

/**
* Generate a stored access policy
*/
function generatePolicy(policyName, start, expiry, permissions) {
  var policy = { Id: policyName, AccessPolicy: {} };

  // Generate time options
  policy.AccessPolicy.Start = start ? (start === SPACE_PARAMETER ? SPACE_PARAMETER : validation.parseDateTime(start)) : '';
  policy.AccessPolicy.Expiry = expiry ? (expiry === SPACE_PARAMETER ? SPACE_PARAMETER : validation.parseDateTime(expiry)) : '';

  if (start && expiry && __.isDate(policy.AccessPolicy.Start) && __.isDate(policy.AccessPolicy.Expiry) && policy.AccessPolicy.Start.getTime() >= policy.AccessPolicy.Expiry.getTime()) {
    throw new Error($('The expiry time of the specified access policy should be greater than start time'));
  }

  // Get the permission symbols
  if (permissions === SPACE_PARAMETER) {
    policy.AccessPolicy.Permissions = SPACE_PARAMETER;
  } else {
    var sharedAccessPermissions = removeRedundantPermission(permissions);
    if (!utils.stringIsNullOrEmpty(sharedAccessPermissions)) {
      policy.AccessPolicy.Permissions = sharedAccessPermissions;
    } else {
      policy.AccessPolicy.Permissions = ' ';
    }
  }

  return policy;
}

/**
* Trim the sotrage policies
*/
function normalizePolicy(policy, accessType) {
  if (!policy.AccessPolicy) {
    policy.AccessPolicy = {};
  }
  if (!policy.AccessPolicy.Start) {
    policy.AccessPolicy.Start = '';
  }
  if (!policy.AccessPolicy.Expiry) {
    policy.AccessPolicy.Expiry = '';
  }
  if (!policy.AccessPolicy.Permissions) {
    policy.AccessPolicy.Permissions = ' ';
  } else {
    policy.AccessPolicy.Permissions = pickupValidPermission(policy.AccessPolicy.Permissions, accessType);
  }
}

/**
* Modify the sotrage policies set that would be sent
*/
function modifyPolicySet(newPolicy, existingPolicies, accessType, operation) {
  var index = -1;
  for (var i = 0; i < existingPolicies.length; i++) {
    normalizePolicy(existingPolicies[i], accessType);
    if (existingPolicies[i].Id === newPolicy.Id) {
      index = i;
    }
  }

  if (operation === StorageUtil.PolicyOperation.Create) {
    if (index >= 0) {
      throw new Error(util.format($('The policy %s already exists'), newPolicy.Id));
    } else if (existingPolicies.length >= StorageUtil.MaxPolicyCount) {
      throw new Error(util.format($('A maximum of %s access policies may be set'), StorageUtil.MaxPolicyCount));
    } else {
      existingPolicies.push(newPolicy);
    }
  } else if (operation === StorageUtil.PolicyOperation.Set){
    if (index >= 0) {
      if (__.isDate(newPolicy.AccessPolicy.Start)) {
        existingPolicies[index].AccessPolicy.Start = newPolicy.AccessPolicy.Start;
      } else if (newPolicy.AccessPolicy.Start === SPACE_PARAMETER) {
        existingPolicies[index].AccessPolicy.Start = '';
      }
      if (__.isDate(newPolicy.AccessPolicy.Expiry)) {
        existingPolicies[index].AccessPolicy.Expiry = newPolicy.AccessPolicy.Expiry;
      } else if (newPolicy.AccessPolicy.Expiry === SPACE_PARAMETER) {
        existingPolicies[index].AccessPolicy.Expiry = '';
      }
      if (newPolicy.AccessPolicy.Permissions === SPACE_PARAMETER) {
        existingPolicies[index].AccessPolicy.Permissions = ' ';
        existingPolicies[index].AccessPolicy.Permission = ' ';
      } else if (newPolicy.AccessPolicy.Permissions != ' ') {
        existingPolicies[index].AccessPolicy.Permissions = newPolicy.AccessPolicy.Permissions;
        // Mitigate the issue in node SDK that setting/getting uses different name
        existingPolicies[index].AccessPolicy.Permission = newPolicy.AccessPolicy.Permissions;
      }
    } else {
      throw new Error(util.format($('The policy %s doesn\'t exist'), newPolicy.Id));
    }
  } else if (operation === StorageUtil.PolicyOperation.Delete) {    
    if (index >= 0) {
      existingPolicies.splice(index, 1);
    } else {
      throw new Error(util.format($('The policy %s doesn\'t exist'), newPolicy.Id));
    }
  }
}

function getEnumValues(enumObj) {
  var values = [];
  for (var prop in enumObj) {
    values.push(enumObj[prop]);
  }
  return values;
}

/**
* Pick up the valid permission symbols from a permission symbols string 
* to mitigate the issue when the permissions symbols getting from response are not in the right order.
*/
function pickupValidPermission(permissions, accessType) {
  var output = '';
  var input = permissions.toLowerCase();
  
  var permissionValues = function (type) {
    switch (type) {
      case StorageUtil.AccessType.Container:
        return getEnumValues(StorageUtil.ContainerPermission);
      case StorageUtil.AccessType.Blob:
        return getEnumValues(StorageUtil.BlobPermission);
      case StorageUtil.AccessType.Table:
        return getEnumValues(StorageUtil.TablePermission);
      case StorageUtil.AccessType.Queue:
        return getEnumValues(StorageUtil.QueuePermission);
      case StorageUtil.AccessType.Share:
        return getEnumValues(StorageUtil.SharePermission);
    }
  };
  
  var values = permissionValues(accessType);
  
  for (var index = 0; index < values.length; index++) {
    if (input.indexOf(values[index]) != -1) {
      output += values[index];
    }
  }
  return output;
}

/**
* Remove redundant permissions
*/
function removeRedundantPermission(permissions) {
  var sharedAccessPermissions = '';
  var length = permissions ? permissions.length : 0;
  for (var index = 0; index < length; index++) {
    var symbol = permissions[index].toLowerCase();
    if (-1 == sharedAccessPermissions.indexOf(symbol)) {
      sharedAccessPermissions += symbol;
    }
  }
  return sharedAccessPermissions;
}

/**
* Check if the permissions string matchs the allow operations with the correct order
* @param {permissions} permission symbols
* @param {allowOps} allowed operations
*/
function validatePermisionsAndOrder(permissions, allowOps) {
  var getPermissionOrder = function(symbol, values) {
    for (var index = 0; index < values.length; index++) {
      if (symbol.toLowerCase() === values[index]) {
        return index;
      }
    }
    return -1;
  };

  if (permissions === SPACE_PARAMETER) {
    return;
  }

  var current = -1;
  var values = getEnumValues(allowOps);
  for (var index = 0; index < permissions.length; index++) {
    var symbol = permissions[index];
    validation.isValidEnumValue(symbol, values);

    var order = getPermissionOrder(symbol, values);
    if (order >= current) {
      current = order;
    } else {
      throw new Error(util.format($('Permission designations must be in the fixed order of: %s'), values));
    }
  }
}

/**
* Check whether the specified parameter is a function
* @param {object} func An arbitrary javascript object
* @return {bool} true if the specified object is function, otherwise false
*/
function isFunction(func) {
  return typeof func === 'function';
}

/**
* Get storage service settings with the specified or default connection string
* @param {string|object} [connection] Storage connection string
* @return {StorageServiceSettings} return the storage service settings if the connection string is applied, otherwise return null.
*/
function getStorageServiceSettings(connection) {
  var connectionString;

  if (typeof connection === 'string') {
    connectionString = adjustConnectionStringWithEnvironment(connection);
  } else if (connection) {
    var options = connection;
    if (options.connectionString) {
      connectionString = adjustConnectionStringWithEnvironment(options.connectionString);
    } else {
      if (options.accountName && options.accountKey) {
        connectionString = getFullConnectionString(options.accountName, options.accountKey);
      } else {
        var sas = options.sas || options.sourceSas;
        sas = StorageUtil.normalizeSasToken(sas);
        if (options.accountName && sas) {
          return getStorageServiceSettingWithSAS(options.accountName, sas);
        }
      }
    }
  }

  if (!connectionString) {
    connectionString = adjustConnectionStringWithEnvironment(process.env[StorageUtil.ENV_CONNECTIONSTRING_NAME]);
  }
  if (!connectionString) {
    if (!process.env[StorageUtil.ENV_SDK_ACCOUNT_NAME] || !process.env[StorageUtil.ENV_SDK_ACCOUNT_KEY]) {
      throw new Error($('Please set the storage account parameters or one of the following two environment variables to use the storage command.\n  1. AZURE_STORAGE_CONNECTION_STRING\n  2. AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY'));
    } else {
      connectionString = getFullConnectionString(process.env[StorageUtil.ENV_SDK_ACCOUNT_NAME], process.env[StorageUtil.ENV_SDK_ACCOUNT_KEY]);
    }
  }
  return getStorageSettings(connectionString);
}

/**
* Get storage service endpoint suffix
*/
function getStorageServiceEndpointSuffix() {
  var uri;
  
  // Check whether it is logged in, otherwise read from the default environment.
  if (__.keys(profile.current.subscriptions).length > 0) {
    uri = utils.createStorageClient(profile.current.getSubscription()).baseUri;
  } else {
    uri = profile.current.environments.AzureCloud.storageEndpointSuffix;
    return uri.substring(uri.indexOf('.') + 1, uri.length);
  }

  var urlObj = url.parse(uri);
  if (urlObj.host && validation.isIP(urlObj.host)) {
    return urlObj.host;
  } else {
    return uri.substring(uri.indexOf('.') + 1, uri.length);
  }
}

/**
* Get connection string for the storage account
*/
function getFullConnectionString(accountName, accountKey, protocol) {  
  var endpointSuffix = getStorageServiceEndpointSuffix();
  var getPrimaryEndpoint = function (type) {
    return getEndpoint(protocol, accountName, type, endpointSuffix).primaryHost;
  };
  var template = 'DefaultEndpointsProtocol=%s;AccountName=%s;AccountKey=%s;BlobEndpoint=%s;TableEndpoint=%s;QueueEndpoint=%s;FileEndpoint=%s';
  var blobEndpoint = getPrimaryEndpoint(StorageUtil.OperationType.Blob);
  var tableEndpoint = getPrimaryEndpoint(StorageUtil.OperationType.Table);
  var queueEndpoint = getPrimaryEndpoint(StorageUtil.OperationType.Queue);
  var fileEndpoint = getPrimaryEndpoint(StorageUtil.OperationType.File);

  protocol = protocol || 'https';
  return util.format(template, protocol, accountName, accountKey, blobEndpoint, tableEndpoint, queueEndpoint, fileEndpoint);
}

/**
* Adjust the connection string with the current environment when the service endpoint is not specified explicitly
*/
function adjustConnectionStringWithEnvironment(connectionString) {
  if (typeof connectionString !== 'string') {
    return connectionString;
  }

  if (connectionString.indexOf('Endpoint=') !== -1) {
    return connectionString;
  }

  var accountName;
  var accountKey;
  var protocol;
  var pairs = connectionString.split(';');
  for (var index = 0; index < pairs.length; index++) {
    var pair = pairs[index];
    if (pair.length === 0) {
        continue;
    }

    if (pair.indexOf('AccountName=') !== -1) {
      accountName = pair.substring(pair.indexOf('=') + 1);
    } else if (pair.indexOf('AccountKey=') !== -1) {
      accountKey = pair.substring(pair.indexOf('=') + 1);
    } else if (pair.indexOf('DefaultEndpointsProtocol=') !== -1) {
      protocol = pair.substring(pair.indexOf('=') + 1);
    }

    if (accountName && accountKey && protocol) {
      break;
    }
  }

  return getFullConnectionString(accountName, accountKey, protocol);
}

/**
* Get storage service settings with the account name and shared access signature
* @param {string} [accountName] Storage account name
* @param {string} [sasToken] Storage shared access signature
* @return {StorageServiceSettings} return the storage service settings if the shared access signature is applied, otherwise return null.
*/
function getStorageServiceSettingWithSAS(accountName, sasToken) {
  var endpointSuffix = getStorageServiceEndpointSuffix();
  var getEndpointLite = function (type) {
    return getEndpoint(null, accountName, type, endpointSuffix);
  };

  var serviceSettings = {};
  serviceSettings._name = accountName;
  serviceSettings._sasToken = sasToken;
  serviceSettings._blobEndpoint = getEndpointLite(StorageUtil.OperationType.Blob);
  serviceSettings._tableEndpoint = getEndpointLite(StorageUtil.OperationType.Table);
  serviceSettings._queueEndpoint = getEndpointLite(StorageUtil.OperationType.Queue);
  serviceSettings._fileEndpoint = getEndpointLite(StorageUtil.OperationType.File);

  return serviceSettings;
}

/**
* Get storage service settings with the account name and shared access signature
* @param {string} [protocol] Storage account name
* @param {string} [accountName] Storage account name
* @param {string} [type] Storage service type (StorageUtil.OperationType)
* @param {string} [endpointSuffix] Storage account name
* @return {host} return the storage endpoint host object
*/
function getEndpoint(protocol, accountName, type, endpointSuffix) {
  protocol = protocol || 'https:';
  if (protocol.lastIndexOf(':') !== protocol.length - 1) {
    protocol += ':';
  }

  var  host = {};
  if (validation.isIP(endpointSuffix)) {
    host.primaryHost = protocol + '//' + endpointSuffix + '/' + accountName;
  } else {
    host.primaryHost = protocol + '//' + accountName + '.' + type + '.' + endpointSuffix;
  }    
  
  return host;
}

/**
* Start async copy
*/
StorageUtil.startAsyncCopy = function (startCopyParams, sourceUri, destContainerOrShare, options, _) {
  var isCopyToBlob = isCopyDestinationBlob(startCopyParams.type);
  
  // Make up the source blob or file Uri
  var source = getSourceUri(startCopyParams.copyType, options, _);
  var sourceContainerOrShare = options.isSourceBlobDefined ? options.sourceContainer : 
    (options.isSourceFileDefined ? options.sourceShare : undefined);
  var sourceBlobOrFile = options.isSourceBlobDefined ? options.sourceBlob : 
    (options.isSourceFileDefined ? options.sourcePath : undefined);

  // Get parameters for the ACL checking
  var embeddedSas = false;
  var sourceResource = splitDestinationUri(source);
  sourceResource.containerOrShare = sourceResource.container;
  sourceResource.blobOrFilePath = sourceResource.blobName;
  
  if (!sourceContainerOrShare) {
    sourceContainerOrShare = sourceResource.containerOrShare;
  }  
  
  if (!sourceBlobOrFile) {
    if (!sourceResource.blobOrFilePath) {
      if (options.isSourceBlobDefined) {
        throw new Error($('The source blob is invalid'));
      } else if (options.isSourceFileDefined) {
        throw new Error($('The source file is invalid'));
      }
    } else {
      // Parse the blob name or file path from URI when sourceUri is specified with SAS token.
      var index = sourceResource.blobOrFilePath.lastIndexOf('?');
      if (index !== -1) {
        embeddedSas = sourceResource.blobOrFilePath.lastIndexOf('sv=') > index;
        sourceResource.blobOrFilePath = sourceResource.blobOrFilePath.substring(0, index);
      }
      sourceBlobOrFile = decodeURIComponent(sourceResource.blobOrFilePath);
    }
  }

  // Make sure the read access to the source blob or file
  var sasToken = getSourceSASToken(startCopyParams, sourceContainerOrShare, sourceBlobOrFile, embeddedSas, options, _);
  source += (sasToken === undefined ? '' : ('?' + sasToken));

  // Check destination information
  var destBlobOrFile;
  if (isCopyToBlob) {
    destBlobOrFile = options.destBlob ? options.destBlob : sourceBlobOrFile;
  } else {
    if (options.destPath) {
      destBlobOrFile = options.destPath;
    } else {
      throw new Error($('--dest-path is required when copying to a file'));
    }
  }
  destContainerOrShare = cli.interaction.promptIfNotGiven(isCopyToBlob ? $('Destination container name: ') : $('Destination share name: '), destContainerOrShare, _);
  if (!destContainerOrShare) {
    if (isCopyToBlob) {
      throw new Error($('The destination container name is required'));
    } else {
      throw new Error($('The destination share name is required'));
    }
  }

  // Start copy operation
  var destOption = getDestAccountOptions(options);
  var destServiceClient = StorageUtil.getServiceClient(isCopyToBlob ? StorageUtil.getBlobService : StorageUtil.getFileService, options);
  var startOperation = startCopyParams.getStartOperation(destServiceClient);
  var tips = util.format(isCopyToBlob ? $('Start copying blob %s') : $('Start copying file %s'), source);

  var copyOp;
  var retry;
  StorageUtil.startProgress(tips);
  while (retry === true || retry === undefined) {
    try {
      // File copy doesn't support access condition header now.
      if (retry === undefined && !options.quiet && isCopyToBlob) {
        startOperation.options.accessConditions = { 'if-none-match': '*' };
      } else {
        startOperation.options.accessConditions = {};
      }
      
      if (isCopyToBlob) {
        retry = false;
        copyOp = StorageUtil.performStorageOperation(startOperation.operation, _, source, destContainerOrShare, destBlobOrFile, startOperation.options);
      } else {
        if (retry === undefined && !options.quiet && startCopyParams.checkExistenceOperation(destContainerOrShare, destBlobOrFile, destOption, _)) {
          var error =  new Error();
          error.code = 'FileAlreadyExists';
          throw error;
        }

        retry = false;  
        var filePath = StorageUtil.normalizePath(destBlobOrFile);
        var result = StorageUtil.fetchBasenameAndDirname(filePath);
        copyOp = StorageUtil.performStorageOperation(startOperation.operation, _, source, destContainerOrShare, result.dirname, result.basename, startOperation.options);
      }
    } catch (e) {
      if (isCopyToBlob) {
        if (StorageUtil.isBlobExistsException(e)) {
          retry = cli.interaction.confirm(util.format($('Do you want to overwrite the existing blob %s in the container %s? (Y/N) '), destBlobOrFile, destContainerOrShare), _);
          e.message = util.format($('The blob %s in the container %s already exists '), destBlobOrFile, destContainerOrShare);
        }
      } else {
        if (StorageUtil.isFileExistsException(e)) {
          retry = cli.interaction.confirm(util.format($('Do you want to overwrite the existing file %s in the share %s? (Y/N) '), destBlobOrFile, destContainerOrShare), _);
          e.message = util.format($('The file %s in the share %s already exists '), destBlobOrFile, destContainerOrShare);
        }
      }
      if (!retry) {
        throw e;
      }
    } finally {
      if (!retry) {
        StorageUtil.endProgress();
      }
    }
  }

  cli.interaction.formatOutput(copyOp, function(outputData) {
    var output = [outputData];
    logger.table(output, function(row, item) {
      row.cell($('Copy ID'), item.copyId);
      row.cell($('Status'), item.copyStatus);
    });
  });
};

/**
* Show async copy status
*/
StorageUtil.showAsyncCopy = function (showCopyParams, containerOrShare, blobOrFilePath, options, _) {
  var isCopyToBlob = isCopyDestinationBlob(showCopyParams.type);

  containerOrShare = cli.interaction.promptIfNotGiven(isCopyToBlob ? $('Destination container: ') : $('Destination share: '), containerOrShare, _);
  blobOrFilePath = cli.interaction.promptIfNotGiven(isCopyToBlob ? $('Destination blob: ') : $('Destination file path: '), blobOrFilePath, _);

  var destOption = getDestAccountOptions(options);
  var blobOrFileProps = showCopyParams.getProperties(containerOrShare, blobOrFilePath, destOption, _);

  if (blobOrFileProps.copyId === undefined) {
    throw new Error(isCopyToBlob ? $('Can not find copy task on the specified blob') : $('Can not find copy task on the specified file'));
  } else {
    cli.interaction.formatOutput(blobOrFileProps, function(outputData) {
      var output = [outputData];
      logger.table(output, function(row, item) {
        row.cell($('Copy ID'), item.copyId);
        row.cell($('Progress'), item.copyProgress);
        row.cell($('Status'), item.copyStatus);
        if (item.copyStatusDescription) {
          row.cell($('Description'), item.copyStatusDescription);
        }
      });
    });
  }
};

/**
* Stop blob copy
*/
StorageUtil.stopAsyncCopy = function (stopCopyParam, containerOrShare, blobOrFilePath, copyid, options, _) {
  var isCopyToBlob = isCopyDestinationBlob(stopCopyParam.type);

  containerOrShare = cli.interaction.promptIfNotGiven(isCopyToBlob ? $('Destination container: ') : $('Destination share: '), containerOrShare, _);
  blobOrFilePath = cli.interaction.promptIfNotGiven(isCopyToBlob ? $('Destination blob: ') : $('Destination file path: '), blobOrFilePath, _);
  copyid = cli.interaction.promptIfNotGiven($('Copy ID: '), copyid, _);

   // stop copy operation
  var serviceClient = StorageUtil.getServiceClient(isCopyToBlob ? StorageUtil.getBlobService : StorageUtil.getFileService, options);
  var stopOperation = stopCopyParam.getStopOperation(serviceClient);
  var tips;
  if (isCopyToBlob) {
    tips = util.format($('Stop copying blob %s in container %s of copy id %s'), blobOrFilePath, containerOrShare, copyid);
  } else {
    tips = util.format($('Stop copying file %s in share %s of copy id %s'), blobOrFilePath, containerOrShare, copyid);
  }

  var stopOp;
  StorageUtil.startProgress(tips);
  try {
    if (isCopyToBlob) {
      stopOp = StorageUtil.performStorageOperation(stopOperation.operation, _, containerOrShare, blobOrFilePath, copyid, stopOperation.options);
    } else {
      var filePath = StorageUtil.normalizePath(blobOrFilePath);
      var result = StorageUtil.fetchBasenameAndDirname(filePath);
      stopOp = StorageUtil.performStorageOperation(stopOperation.operation, _, containerOrShare, result.dirname, result.basename, copyid, stopOperation.options);
    }
  } finally {
    StorageUtil.endProgress();
  }

  if (isCopyToBlob) {
    logger.info(util.format($('Copying blob %s to container %s has been stopped successfully'), blobOrFilePath, containerOrShare));
  } else {
    logger.info(util.format($('Copying file %s to share %s has been stopped successfully'), blobOrFilePath, containerOrShare));
  }
};

/**
* Get start async copy parameters
*/
StorageUtil.getStartCopyParameters = function (copyType, sourceUri, options) {
  options.type = copyType;

  checkCopyOptions(sourceUri, options);

  var getStartOperation = function (serviceClient) {
    var operationInfo = {};
    if (copyType == StorageUtil.CopyTypes.CopyToBlob) {
      operationInfo.operation = StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.Blob, 'startCopyBlob');
    } else {
      operationInfo.operation = StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.File, 'startCopyFile');
    }
    operationInfo.options = StorageUtil.getStorageOperationDefaultOption();
    return operationInfo;
  };

  var getAclOperation = function (serviceClient) {
    var operationInfo = {};
    if (options.isSourceBlobDefined) {
      operationInfo.operation = StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.Blob, 'getContainerAcl');
    } else {
      operationInfo.operation = StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.File, 'getShareAcl');
    }
    operationInfo.options = StorageUtil.getStorageOperationDefaultOption();
    return operationInfo;
  };

  var startCopyParameters = {
    type: copyType,
    getStartOperation: getStartOperation,
    getAclOperation: getAclOperation,
    checkExistenceOperation: null
  };

  return startCopyParameters;
};

/**
* Check the async copy options
*/
function checkCopyOptions(sourceUri, options) {
  options.sourceUri = sourceUri;
  options.isSourceUriDefined = sourceUri;
  options.isSourceBlobDefined = options.sourceContainer || options.sourceBlob;
  options.isSourceFileDefined = options.sourceShare || options.sourcePath;
  
  var wrongOption = (options.isSourceUriDefined && (options.isSourceBlobDefined || options.isSourceFileDefined)) || (options.isSourceBlobDefined && options.isSourceFileDefined);
  if (wrongOption) {
    throw new Error($('Please only define one of them: 1. --source-uri. 2. --source-container and --source-blob. 3. --source-share and --source--path'));
  }
}

/**
* Get destination account options
*/
function getDestAccountOptions(options) {
  var isNameDefined = options.destAccountName !== undefined;
  var isKeyDefined = options.destAccountKey !== undefined;
  var isSasDefined = options.destSas !== undefined;
  var isConnectionStringDefined = options.destConnectionString !== undefined;
  var isAccountDefined = isNameDefined || isKeyDefined;
  var isUserDefined = isAccountDefined || isSasDefined;
  var destOptions = options; // Inherit account info from source

  if (isConnectionStringDefined && isUserDefined) {
    throw new Error($('Please only define one of them: 1. --dest-connection-string. 2. --dest-account-name and --dest-account-key. 3. --dest-account-name and --dest-sas'));
  } else {
    if (isConnectionStringDefined) {
      destOptions.connectionString = options.destConnectionString;
    } else if (isUserDefined) {
      if (isNameDefined) {
        if (isSasDefined && isKeyDefined) {
          throw new Error($('Please only define --dest-account-key or --dest-sas when --dest-account-name is defined'));
        } else if (isKeyDefined) {
          destOptions.connectionString = util.format('DefaultEndpointsProtocol=https;AccountName=%s;AccountKey=%s', options.destAccountName, options.destAccountKey);
        } else {
          destOptions.accountName = options.destAccountName;
          destOptions.sas = options.destSas;
          delete destOptions.accountKey;
          delete destOptions.connectionString;
        }
      } else {
        throw new Error($('Please set --dest-account-name and --dest-account-key or --dest-account-name and --dest-sas'));
      }
    }

    // Erase the source account information when the destination connection string is available.
    if (destOptions.connectionString) {
      delete destOptions.accountName;
      delete destOptions.accountKey;
    }
  }

  return destOptions;
}

/**
* Get source URI from input
*/
function getSourceUri(type, options, _) {
  if (options.isSourceUriDefined) {
    return options.sourceUri;
  }

  var isSourceDefined = options.isSourceBlobDefined || options.isSourceFileDefined;
  
  var source;
  if (!isSourceDefined) {
    source = cli.interaction.promptIfNotGiven($('Source URI: '), source, _);
  } else {
    var host;
    var settings = getStorageServiceSettings(options);
    
    if (options.isSourceBlobDefined) {
      host = settings._blobEndpoint.primaryHost;
      if (!host) {
        throw new Error($('The blob endpoint is invalid'));
      }
      
      if (!options.sourceContainer) {
        options.sourceContainer = cli.interaction.promptIfNotGiven($('Source container: '), options.sourceContainer, _);
      } else if (!options.sourceBlob) {
        options.sourceBlob = cli.interaction.promptIfNotGiven($('Source blob: '), options.sourceBlob, _);
      }
    } else if (options.isSourceFileDefined){
      host = settings._fileEndpoint.primaryHost;
      if (!host) {
        throw new Error($('The file endpoint is invalid'));
      }
      
      if (!options.sourceShare) {
        options.sourceShare = cli.interaction.promptIfNotGiven($('Source share: '), options.sourceShare, _);
      } else if (!options.sourceBlob) {
        options.sourcePath = cli.interaction.promptIfNotGiven($('Source file path: '), options.sourcePath, _);
      }
    }

    if (host.lastIndexOf('/') !== host.length - 1) {
      source = host + '/';
    } else {
      source = host;
    }

    var sourceContainerOrShare = options.isSourceBlobDefined ? options.sourceContainer : options.sourceShare;
    var sourceBlobOrFilePath = options.isSourceBlobDefined ? options.sourceBlob : options.sourcePath;
    if (sourceContainerOrShare !== '$root') {
      source += (sourceContainerOrShare + '/');
    }

    var encode = function(name) {
      var value = encodeURIComponent(name);
      value = value.replace(/%2F/g, '/');
      value = value.replace(/%5C/g, '/');
      value = value.replace(/\+/g, '%20');  
      return value;
    };

    if (sourceBlobOrFilePath[0] === '/') {
      sourceBlobOrFilePath = sourceBlobOrFilePath.slice(1);
    }
    source += encode(sourceBlobOrFilePath);
  }
  return source;
}

/**
* Get source SAS token
*/
function getSourceSASToken(getSourceSASParams, sourceContainerOrShare, sourceBlobOrFilePath, embeddedSas, options, _) {
  var sasToken = embeddedSas ? undefined : (options.sourceSas || options.sasToken);
  if (sasToken) {
    var isNameDefined = options.accountName !== undefined;
    var isKeyDefined = options.accountKey !== undefined;
    var isConnectionStringDefined = options.connectionString !== undefined;
    if (isConnectionStringDefined || (isNameDefined && isKeyDefined)) {
      throw new Error($('Please only define one of them: 1. --connection-string. 2 --account-name and --account-key 3. --account-name and --source-sas'));
    }
    sasToken = StorageUtil.normalizeSasToken(sasToken);
  } else if (!embeddedSas && !options.isSourceUriDefined) {
    var sourcebServiceClient;
    try {
      sourcebServiceClient  = StorageUtil.getServiceClient(options.isSourceBlobDefined ? StorageUtil.getBlobService : StorageUtil.getFileService, options);
    } catch (e) {
      // Cannot get the source service client (No account info is provided because it is publicly accessible), no source SAS will be generated.
      return sasToken;
    }

    var aclOperation = getSourceSASParams.getAclOperation(sourcebServiceClient);
    var permission = StorageUtil.performStorageOperation(aclOperation.operation, _, sourceContainerOrShare, aclOperation.options);

    var criteria = options.isSourceBlobDefined ? BlobUtilities.BlobContainerPublicAccessType.OFF : FileUtilities.SharePublicAccessType.OFF;
    if (criteria == permission.publicAccessLevel) {
      // Grant temporary SAS token to the source
      var sharedAccessPolicy = {
        AccessPolicy: {
          Permissions: BlobUtilities.SharedAccessPermissions.READ,
          Expiry: azureCommon.date.daysFromNow(7)
        },
      };

      if (options.isSourceBlobDefined) {
        sasToken = sourcebServiceClient.generateSharedAccessSignature(sourceContainerOrShare, sourceBlobOrFilePath, sharedAccessPolicy);
      } else {
        var filePath = StorageUtil.normalizePath(sourceBlobOrFilePath);
        var result = StorageUtil.fetchBasenameAndDirname(filePath);
        sasToken = sourcebServiceClient.generateSharedAccessSignature(sourceContainerOrShare, result.dirname, result.basename, sharedAccessPolicy);
      }
      if (!sasToken) {
        throw new Error($('The source blob or file is not accessible'));
      }
    }
  }
  return sasToken;
}

function isCopyDestinationBlob(type) {
  return type === StorageUtil.CopyTypes.CopyToBlob;
}

/**
* Get REST operation time out
*/
function getRestOperationTimeout(cfg) {
  var radix = 10;
  var definedTimeout = parseInt(cfg[StorageUtil.OPERATION_TIMEOUT_CONFIG_KEY_NAME], radix);
  if (isNaN(definedTimeout) || definedTimeout <= 0) {
    return null;
  } else {
    return definedTimeout;
  }
}

/**
* Get the REST conccurency
*/
function getRestConcurrency(cfg) {
  var radix = 10;
  var definedConcurrency = parseInt(cfg[StorageUtil.CONCURRENTCY_CONFIG_KEY_NAME], radix);
  if (isNaN(definedConcurrency) || definedConcurrency === 0) {
    return getDefaultRestConcurrency();
  } else {
    return definedConcurrency;
  }
}

/**
* Get the default REST concurrency
*/
function getDefaultRestConcurrency() {
  var cpuCount = os.cpus().length;
  //Hard code number for default task amount per core
  var asyncTasksPerCoreMultiplier = 1;
  return cpuCount * asyncTasksPerCoreMultiplier;
}

/**
* Handle the http request
*/
function sendingRequestHandler(webresource) {
  var headerName = 'user-agent';
  var originalUserAgent = webresource.headers[headerName];

  // Check whether the user-agent contains the given string to avoid appending the string multiple times in retry
  if (originalUserAgent.indexOf(userAgent) === -1) {
    webresource.withHeader(headerName, userAgent + originalUserAgent);
  }
 }

module.exports = StorageUtil;
