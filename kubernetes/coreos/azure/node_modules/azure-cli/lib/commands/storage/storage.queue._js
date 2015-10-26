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

var util = require('util');
var commander = require('commander');
var StorageUtil = require('../../util/storage.util');
var utils = require('../../util/utils');
var validation = require('../../util/validation');
var Wildcard = utils.Wildcard;
var performStorageOperation = StorageUtil.performStorageOperation;
var startProgress = StorageUtil.startProgress;
var endProgress = StorageUtil.endProgress;

var $ = utils.getLocaleString;

/**
* Add storge account command line options
*/
commander.Command.prototype.addStorageAccountOption = function() {
  this.option('-a, --account-name <accountName>', $('the storage account name'));
  this.option('-k, --account-key <accountKey>', $('the storage account key'));
  this.option('-c, --connection-string <connectionString>', $('the storage connection string'));
  this.option('-vv', $('run storage command in debug mode'));
  return this;
};

/**
* Init storage queue command
*/
exports.init = function(cli) {

  //Init StorageUtil
  StorageUtil.init(cli);

  /**
  * Define storage queue command usage
  */
  var storage = cli.category('storage')
    .description($('Commands to manage your Storage objects'));

  var logger = cli.output;

  var interaction = cli.interaction;

  var queue = storage.category('queue')
    .description($('Commands to manage your Storage queues'));

  queue.command('create [queue]')
    .description($('Create a storage queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .addStorageAccountOption()
    .execute(createQueue);

  queue.command('list [prefix]')
  .description($('List storage queues with wildcard'))
  .option('-p, --prefix <prefix>', $('the storage queue name prefix'))
  .addStorageAccountOption()
  .execute(listQueue);

  queue.command('show [queue]')
    .description($('Show details of the storage able'))
    .option('--queue <queue>', $('the storage queue name'))
    .option('--sas <sas>', $('the shared access signature of the storage queue'))
    .addStorageAccountOption()
    .execute(showQueue);

  queue.command('delete [queue]')
    .description($('Delete the specified storage queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .option('-q, --quiet', $('remove the specified storage queue without confirmation'))
    .addStorageAccountOption()
    .execute(deleteQueue);

  var queueSas = queue.category('sas')
    .description($('Commands to manage shared access signatures of your Storage queue'));

  queueSas.command('create [queue] [permissions] [expiry]')
    .description($('Generate shared access signature of storage queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Read)/a(Add)/u(Update)/p(Process)'))
    .option('--start <start>', $('the UTC time at which the SAS becomes valid'))
    .option('--expiry <expiry>', $('the UTC time at which the SAS expires'))
    .option('--policy <policy>', $('the stored access policy identifier'))
    .addStorageAccountOption()
    .execute(createQueueSAS);

  var policy = queue.category('policy')
    .description($('Commands to manage stored access policies of your Storage queue'));

  policy.command('create [queue] [name]')
    .usage('[options] [queue] [name]')
    .description($('Create a stored access policy on the queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .option('--name <name>', $('the policy name'))
    .option('--start <start>', $('the UTC time at which the policy becomes valid'))
    .option('--expiry <expiry>', $('the UTC time at which the policy expires'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Read)/a(Add)/u(Update)/p(Process)'))
    .addStorageAccountOption()
    .execute(createQueuePolicy);

  policy.command('show [queue] [name]')
    .usage('[options] [queue] [name]')
    .description($('Show a stored access policy on the queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .option('--name <name>', $('the policy name'))
    .addStorageAccountOption()
    .execute(showQueuePolicy);

  policy.command('list [queue]')
    .usage('[options] [queue]')
    .description($('List stored access policies on the queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .addStorageAccountOption()
    .execute(listQueuePolicy);

  policy.command('set [queue] [name]')
    .usage('[options] [queue] [name]')
    .description($('Set a stored access policy on the queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .option('--name <name>', $('the policy name'))
    .option('--start <start>', $('the UTC time at which the policy becomes valid and passing two spaces means to remove the existing setting'))
    .option('--expiry <expiry>', $('the UTC time at which the policy expires and passing two spaces means to remove the existing setting'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Read)/a(Add)/u(Update)/p(Process) and passing two spaces means to remove the existing setting'))
    .addStorageAccountOption()
    .execute(setQueuePolicy);

  policy.command('delete [queue] [name]')
    .usage('[options] [queue] [name]')
    .description($('Delete a stored access policy on the queue'))
    .option('--queue <queue>', $('the storage queue name'))
    .option('--name <name>', $('the policy name'))
    .addStorageAccountOption()
    .execute(deleteQueuePolicy);

  /**
  * Implement storage queue cli
  */

  /**
  * Get queue account from user specified credential or env variables
  * @param {object} options command line options
  */
  function getQueueServiceClient(options) {
    var serviceClient = StorageUtil.getServiceClient(StorageUtil.getQueueService, options);
    applyQueueServicePatch(serviceClient);
    return serviceClient;
  }

  /**
  * Get Storage queue operation object
  * @param {string} [operationName] operation name
  * @return {StorageOperation} storage queue operation
  */
  function getStorageQueueOperation(serviceClient, operationName) {
    return StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.Queue, operationName);
  }

  /**
  * Get Storage queue operation options
  */
  function getStorageQueueOperationDefaultOption() {
    var option = StorageUtil.getStorageOperationDefaultOption();

    // Add queue specific options here

    return option;
  }

  /**
  * Create a policy setting
  */
  function createQueuePolicySetting(options) {
    var policySettings = {};
    policySettings.accessType = StorageUtil.AccessType.Queue;
    policySettings.serviceClient = getQueueServiceClient(options);
    policySettings.getAclOperation = getStorageQueueOperation(policySettings.serviceClient, 'getQueueAcl');
    policySettings.setAclOperation = getStorageQueueOperation(policySettings.serviceClient, 'setQueueAcl');
    policySettings.storageOptions = getStorageQueueOperationDefaultOption();
    policySettings.policyOptions = options;
    return policySettings;
  }

  /**
  * Create a storage queue
  * @param {string} [queue] queue name
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function createQueue(queue, options, _) {
    var queueService = getQueueServiceClient(options);
    queue = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    var operation = getStorageQueueOperation(queueService, 'createQueue');
    var tips = util.format($('Creating storage queue %s'), queue);
    var storageOptions = getStorageQueueOperationDefaultOption();
    startProgress(tips);
    try {
      var created = performStorageOperation(operation, _, queue, storageOptions);
      if (created === false) {
        throw new Error(util.format($('Queue \'%s\' already exists'), queue));
      }
    } finally {
      endProgress();
    }

    logger.verbose(util.format($('Queue %s has been created successfully'), queue));
    showQueue(queue, StorageUtil.getStorageAccountOptions(options), _);
  }

  /**
  * Delete the specified storage queue
  * @param {string} [queue] queue name
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function deleteQueue(queue, options, _) {
    var queueService = getQueueServiceClient(options);
    queue = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    var operation = getStorageQueueOperation(queueService, 'deleteQueue');
    var tips = util.format($('Deleting storagequeue %s'), queue);
    var storageOptions = getStorageQueueOperationDefaultOption();

    if (!options.quiet) {
      if (!interaction.confirm(util.format($('Do you want to delete queue %s? '), queue), _)) {
        return;
      }
    }

    startProgress(tips);

    try {
      performStorageOperation(operation, _, queue, storageOptions);
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Can not find queue \'%s\''), queue));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    logger.info(util.format($('Queue %s has been deleted successfully'), queue));
  }

  /**
  * Show the details of the specified Storage queue
  * @param {string} [queue] queue name
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function showQueue(queue, options, _) {
    var queueService = getQueueServiceClient(options);
    queue = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    var operation = getStorageQueueOperation(queueService, 'doesQueueExist');
    var tips = $('Getting Storage queue information');
    var storageOptions = getStorageQueueOperationDefaultOption();
    var output = [];

    startProgress(tips);
    try {
      var exist = performStorageOperation(operation, _, queue, storageOptions);
      if (!exist) {
        throw new Error(util.format($('Queue %s doesn\'t exist'), queue));
      } else {
        var info = { name: queue };
        operation = getStorageQueueOperation(queueService, 'getQueueMetadata');
        info.metadata = performStorageOperation(operation, _, queue, storageOptions);

        if (!options.sas) {
          operation = getStorageQueueOperation(queueService, 'getQueueAcl');
          info.policies = performStorageOperation(operation, _, queue, storageOptions);
        } else {
          info.policies = { signedIdentifiers: [] };
        }

        output.push(info);
      }
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Queue %s doesn\'t exist'), queue));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    cli.interaction.formatOutput(output[0], function(outputData) {
      logger.info(util.format($('Approximate message count in the queue %s is %s'), queue, outputData.metadata.approximatemessagecount));
      if (Object.keys(outputData.metadata.metadata).length > 0) {
        logger.info('');
        logger.table(outputData.metadata.metadata, function(row, item) {
          row.cell($('Metadata'), item);
          row.cell($('Value'), outputData.metadata.metadata[item]);
        });
      }
      if (outputData.policies.signedIdentifiers.length > 0) {
        logger.info('');
        logger.table(outputData.policies.signedIdentifiers, function(row, item) {
          var UTCFormat = 'YYYY-MM-DDTHH:MM:SSZ';
          row.cell($('Policy'), item.Id);
          row.cell($('Permission'), item.AccessPolicy.Permission ? item.AccessPolicy.Permission : '');
          row.cell($('Start'), item.AccessPolicy.Start ? item.AccessPolicy.Start.toUTCFormat(UTCFormat) : '');
          row.cell($('Expiry'), item.AccessPolicy.Expiry ? item.AccessPolicy.Expiry.toUTCFormat(UTCFormat) : '');
        });
      }
    });
  }

  /**
  * List storage queues
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function listQueue(prefix, options, _) {
    var queueService = getQueueServiceClient(options);
    var listOperation = getStorageQueueOperation(queueService, 'listAllQueues');
    var tips = $('Getting storage queues');
    var queueOptions = getStorageQueueOperationDefaultOption();
    var useWildcard = false;

    if (Wildcard.containWildcards(prefix)) {
      queueOptions.prefix = Wildcard.getNonWildcardPrefix(prefix);
      useWildcard = true;
    } else {
      queueOptions.prefix = prefix;
    }

    var queues = [];
    startProgress(tips);

    try {
      performStorageOperation(listOperation, _, queueOptions).forEach_(_, StorageUtil.opConcurrency, function(_, queue) {
        if (useWildcard && !Wildcard.isMatch(queue.name, prefix)) {
          return;
        }
        var info = { name: queue.name };
        queues.push(info);
      });
    } finally {
      endProgress();
    }

    cli.interaction.formatOutput(queues, function(outputData) {
      if (outputData.length === 0) {
        logger.info($('No queue found'));
      } else {
        logger.table(outputData, function(row, item) {
          row.cell($('Name'), item.name);
        });
      }
    });
  }

  /**
  * Create shared access signature to the queue
  */
  function createQueueSAS(queue, permissions, expiry, options, _) {
    var queueService = getQueueServiceClient(options);
    queue = interaction.promptIfNotGiven($('Queue name: '), queue, _);

    if (!options.policy) {
      permissions = interaction.promptIfNotGiven($('Permissions: '), permissions, _);
      StorageUtil.validatePermissions(StorageUtil.AccessType.Queue, permissions);

      expiry = interaction.promptIfNotGiven($('Expiry: '), expiry, _);
      expiry = validation.parseDateTime(expiry);
    }

    var start;
    if (options.start) {
      start = validation.parseDateTime(options.start);
    }

    var output = { sas: '' };
    var sharedAccessPolicy = StorageUtil.getSharedAccessPolicy(permissions, start, expiry, null, options.policy);
    var tips = util.format($('Creating shared access signature for queue %s'), queue);
    startProgress(tips);
    try {
      output.sas = queueService.generateSharedAccessSignature(queue, sharedAccessPolicy);
    } finally {
      endProgress();
    }

    cli.interaction.formatOutput(output, function(outputData) {
      logger.data($('Shared Access Signature'), outputData.sas);
    });
  }

  /**
  * Patch for azure node sdk
  */
  function applyQueueServicePatch(queueService) {
    /*
    * List all queues
    * NOTICE: All the caller should use the options parameter since it's just a internal implementation
    */
    queueService.listAllQueues = function(options, callback) {
      StorageUtil.listWithContinuation(queueService.listQueuesSegmentedWithPrefix, queueService, StorageUtil.ListContinuationTokenArgIndex.Queue, options.prefix, null, options, callback);
    };
  }

  /**
  * Create a stored access policy on the queue
  */
  function createQueuePolicy(queue, name, options, _) {
    var createPolicySettings = createQueuePolicySetting(options);
    createPolicySettings.resourceName = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    createPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    createPolicySettings.tips = util.format($('Creating the stored access policy %s on the queue %s'), createPolicySettings.policyName, createPolicySettings.resourceName);

    if (options.permissions) {
      StorageUtil.validatePermissions(StorageUtil.AccessType.Queue, options.permissions);
    }

    var policies = StorageUtil.createPolicy(createPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      logger.info(util.format($('The stored access policies on queue %s are: '), createPolicySettings.resourceName));
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * List the stored access policies on the queue
  */
  function listQueuePolicy(queue, options, _) {
    var listPolicySettings = createQueuePolicySetting(options);
    listPolicySettings.resourceName = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    listPolicySettings.tips = util.format($('Listing the stored access policies on the queue %s'), listPolicySettings.resourceName);

    var policies = StorageUtil.selectPolicy(listPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      if (outputData) {
        StorageUtil.showPolicyResults(outputData);
      } else {
        logger.info(util.format($('There is no stored access policy on the queue %s.'), listPolicySettings.resourceName));
      }
    });
  }

  /**
  * Show the stored access policy on the queue
  */
  function showQueuePolicy(queue, name, options, _) {
    var showPolicySettings = createQueuePolicySetting(options);
    showPolicySettings.resourceName = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    showPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    showPolicySettings.tips = util.format($('Showing the stored access policy %s on the queue %s'), showPolicySettings.policyName, showPolicySettings.resourceName);

    var policy = StorageUtil.selectPolicy(showPolicySettings, _);
    cli.interaction.formatOutput(policy, function(outputData) {
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * Set a stored access policy on the queue
  */
  function setQueuePolicy(queue, name, options, _) {
    var setPolicySettings = createQueuePolicySetting(options);
    setPolicySettings.resourceName = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    setPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    setPolicySettings.tips = util.format($('Setting the stored access policy %s on the queue %s'), setPolicySettings.policyName, setPolicySettings.resourceName);

    if (options.permissions) {
      StorageUtil.validatePermissions(StorageUtil.AccessType.Queue, options.permissions);
    }

    var policies = StorageUtil.setPolicy(setPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      logger.info(util.format($('The stored access policies on queue %s are: '), setPolicySettings.resourceName));
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * Delete a stored access policy on the queue
  */
  function deleteQueuePolicy(queue, name, options, _) {
    var deletePolicySettings = createQueuePolicySetting(options);
    deletePolicySettings.resourceName = interaction.promptIfNotGiven($('Queue name: '), queue, _);
    deletePolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    deletePolicySettings.tips = util.format($('Deleting the stored access policy %s on the queue %s'), deletePolicySettings.policyName, deletePolicySettings.resourceName);

    var policies = StorageUtil.deletePolicy(deletePolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      if (outputData) {
        logger.info(util.format($('The stored access policies on queue %s are: '), deletePolicySettings.resourceName));
        StorageUtil.showPolicyResults(outputData);
      } else {
        logger.info(util.format($('There is no stored access policy on the queue %s.'), deletePolicySettings.resourceName));
      }
    });
  }
};
