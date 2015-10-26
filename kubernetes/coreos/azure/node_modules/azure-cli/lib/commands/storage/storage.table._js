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
* Init storage table command
*/
exports.init = function(cli) {

  //Init StorageUtil
  StorageUtil.init(cli);

  /**
  * Define storage table command usage
  */
  var storage = cli.category('storage')
    .description($('Commands to manage your Storage objects'));

  var logger = cli.output;

  var interaction = cli.interaction;

  var table = storage.category('table')
    .description($('Commands to manage your Storage tables'));

  table.command('create [table]')
    .description($('Create a storage table'))
    .option('--table <table>', $('the storage table name'))
    .addStorageAccountOption()
    .execute(createTable);

  table.command('list [prefix]')
  .description($('List storage tables with wildcard'))
  .option('-p, --prefix <prefix>', $('the storage table name prefix'))
  .addStorageAccountOption()
  .execute(listTable);

  table.command('show [table]')
    .description($('Show details of the storage able'))
    .option('--table <table>', $('the storage table name'))
    .addStorageAccountOption()
    .execute(showTable);

  table.command('delete [table]')
    .description($('Delete the specified storage table'))
    .option('--table <table>', $('the storage table name'))
    .option('-q, --quiet', $('remove the specified storage table without confirmation'))
    .addStorageAccountOption()
    .execute(deleteTable);

  var tableSas = table.category('sas')
    .description($('Commands to manage shared access signatures of your Storage table'));

  tableSas.command('create [table] [permissions] [expiry]')
    .description($('Generate a shared access signature of storage table'))
    .option('--table <table>', $('the storage table name'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Query)/a(Add)/u(Update)/d(Delete)'))
    .option('--start <start>', $('the UTC time at which the SAS becomes valid'))
    .option('--expiry <expiry>', $('the UTC time at which the SAS expires'))
    .option('--policy <policy>', $('the stored access policy identifier'))
    .option('--start-pk <startPk>', $('the inclusive starting partition key'))
    .option('--end-pk <endPk>', $('the inclusive ending partition key'))
    .option('--start-rk <startRk>', $('the inclusive starting row key'))
    .option('--end-rk <endRk>', $('the inclusive ending row key'))
    .addStorageAccountOption()
    .execute(createTableSAS);

  var policy = table.category('policy')
    .description($('Commands to manage stored access policies of your Storage table'));

  policy.command('create [table] [name]')
    .usage('[options] [table] [name]')
    .description($('Create a stored access policy on the table'))
    .option('--table <table>', $('the storage table name'))
    .option('--name <name>', $('the policy name'))
    .option('--start <start>', $('the UTC time at which the policy becomes valid'))
    .option('--expiry <expiry>', $('the UTC time at which the policy expires'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Query)/a(Add)/u(Update)/d(Delete)'))
    .addStorageAccountOption()
    .execute(createTablePolicy);

  policy.command('show [table] [name]')
    .usage('[options] [table] [name]')
    .description($('Show a stored access policy on the table'))
    .option('--table <table>', $('the storage table name'))
    .option('--name <name>', $('the policy name'))
    .addStorageAccountOption()
    .execute(showTablePolicy);

  policy.command('list [table]')
    .usage('[options] [table]')
    .description($('List stored access policies on the table'))
    .option('--table <table>', $('the storage table name'))
    .addStorageAccountOption()
    .execute(listTablePolicy);

  policy.command('set [table] [name]')
    .usage('[options] [table] [name]')
    .description($('Set a stored access policy on the table'))
    .option('--table <table>', $('the storage table name'))
    .option('--name <name>', $('the policy name'))
    .option('--start <start>', $('the UTC time at which the policy becomes valid and passing two spaces means to remove the existing setting'))
    .option('--expiry <expiry>', $('the UTC time at which the policy expires and passing two spaces means to remove the existing setting'))
    .option('--permissions <permissions>', $('the operation permissions combining symbols of r(Query)/a(Add)/u(Update)/d(Delete) and passing two spaces means to remove the existing setting'))
    .addStorageAccountOption()
    .execute(setTablePolicy);

  policy.command('delete [table] [name]')
    .usage('[options] [table] [name]')
    .description($('Delete a stored access policy on the table'))
    .option('--table <table>', $('the storage table name'))
    .option('--name <name>', $('the policy name'))
    .addStorageAccountOption()
    .execute(deleteTablePolicy);

  /**
  * Implement storage table cli
  */

  /**
  * Get table account from user specified credential or env variables
  * @param {object} options command line options
  */
  function getTableServiceClient(options) {
    var serviceClient = StorageUtil.getServiceClient(StorageUtil.getTableService, options);
    applyTableServicePatch(serviceClient);
    return serviceClient;
  }

  /**
  * Get Storage table operation object
  * @param {string} [operationName] operation name
  * @return {StorageOperation} storage table operation
  */
  function getStorageTableOperation(serviceClient, operationName) {
    return StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.Table, operationName);
  }

  /**
  * Get Storage table operation options
  */
  function getStorageTableOperationDefaultOption() {
    var option = StorageUtil.getStorageOperationDefaultOption();

    // Add table specific options here

    return option;
  }

  /**
  * Create a policy setting
  */
  function createTablePolicySetting(options) {
    var policySettings = {};
    policySettings.accessType = StorageUtil.AccessType.Table;
    policySettings.serviceClient = getTableServiceClient(options);
    policySettings.getAclOperation = getStorageTableOperation(policySettings.serviceClient, 'getTableAcl');
    policySettings.setAclOperation = getStorageTableOperation(policySettings.serviceClient, 'setTableAcl');
    policySettings.storageOptions = getStorageTableOperationDefaultOption();
    policySettings.policyOptions = options;
    return policySettings;
  }

  /**
  * Create a storage table
  * @param {string} [table] table name
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function createTable(table, options, _) {
    var tableService = getTableServiceClient(options);
    table = interaction.promptIfNotGiven($('Table name: '), table, _);
    var operation = getStorageTableOperation(tableService, 'createTable');
    var tips = util.format($('Creating storage table %s'), table);
    var storageOptions = getStorageTableOperationDefaultOption();
    startProgress(tips);
    try {
      var created = performStorageOperation(operation, _, table, storageOptions);
      if (created === false) {
        throw new Error(util.format($('Table \'%s\' already exists'), table));
      }
    }
    finally {
      endProgress();
    }

    logger.verbose(util.format($('Table %s has been created successfully'), table));
    showTable(table, StorageUtil.getStorageAccountOptions(options), _);
  }

  /**
  * Delete the specified storage table
  * @param {string} [table] table name
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function deleteTable(table, options, _) {
    var tableService = getTableServiceClient(options);
    table = interaction.promptIfNotGiven($('Table name: '), table, _);
    var operation = getStorageTableOperation(tableService, 'deleteTable');
    var tips = util.format($('Deleting storagetable %s'), table);
    var storageOptions = getStorageTableOperationDefaultOption();

    if (!options.quiet) {
      if (!interaction.confirm(util.format($('Do you want to delete table %s? '), table), _)) {
        return;
      }
    }

    startProgress(tips);

    try {
      performStorageOperation(operation, _, table, storageOptions);
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Can not find table \'%s\''), table));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    logger.info(util.format($('Table %s has been deleted successfully'), table));
  }

  /**
  * Show the details of the specified Storage table
  * @param {string} [table] table name
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function showTable(table, options, _) {
    var tableService = getTableServiceClient(options);
    table = interaction.promptIfNotGiven($('Table name: '), table, _);
    var operation = getStorageTableOperation(tableService, 'doesTableExist');
    var tips = $('Getting Storage table information');
    var storageOptions = getStorageTableOperationDefaultOption();
    var output = [];

    startProgress(tips);
    try {
      var exist = performStorageOperation(operation, _, table, storageOptions);
      if (!exist) {
        throw new Error(util.format($('Table %s doesn\'t exist'), table));
      } else {
        operation = getStorageTableOperation(tableService, 'getTableAcl');
        var info = { name: table };
        if (!options.sas) {
          var acl = performStorageOperation(operation, _, table, storageOptions);
          info.policies = acl.signedIdentifiers;
        } else {
          info.policies = [];
        }
        output.push(info);
      }
    } catch (e) {
      if (StorageUtil.isNotFoundException(e)) {
        throw new Error(util.format($('Table %s doesn\'t exist'), table));
      } else {
        throw e;
      }
    } finally {
      endProgress();
    }

    cli.interaction.formatOutput(output[0], function(outputData) {
      if (outputData.policies.length === 0) {
        logger.info(util.format($('No information is found for table %s'), table));
      } else {
        logger.table(outputData.policies, function(row, item) {
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
  * List storage tables
  * @param {object} options command line options
  * @param {callback} _ callback function
  */
  function listTable(prefix, options, _) {
    var tableService = getTableServiceClient(options);
    var listOperation = getStorageTableOperation(tableService, 'listAllTables');
    var tips = $('Getting storage tables');
    var tableOptions = getStorageTableOperationDefaultOption();
    var useWildcard = false;

    if (Wildcard.containWildcards(prefix)) {
      tableOptions.prefix = Wildcard.getNonWildcardPrefix(prefix);
      useWildcard = true;
    } else {
      tableOptions.prefix = prefix;
    }

    var tables = [];
    startProgress(tips);

    try {
      performStorageOperation(listOperation, _, tableOptions).forEach_(_, StorageUtil.opConcurrency, function(_, table) {
        if (useWildcard && !Wildcard.isMatch(table, prefix)) {
          return;
        }
        var info = { name: table };
        tables.push(info);
      });
    } finally {
      endProgress();
    }

    cli.interaction.formatOutput(tables, function(outputData) {
      if (outputData.length === 0) {
        logger.info($('No table found'));
      } else {
        logger.table(outputData, function(row, item) {
          row.cell($('Name'), item.name);
        });
      }
    });
  }

  /**
  * Create shared access signature to the table
  */
  function createTableSAS(table, permissions, expiry, options, _) {
    var tableService = getTableServiceClient(options);
    table = interaction.promptIfNotGiven($('Table name: '), table, _);

    if (!options.policy) {
      permissions = interaction.promptIfNotGiven($('Permissions: '), permissions, _);
      StorageUtil.validatePermissions(StorageUtil.AccessType.Table, permissions);

      expiry = interaction.promptIfNotGiven($('Expiry: '), expiry, _);
      expiry = validation.parseDateTime(expiry);
    }

    var start;
    if (options.start) {
      start = validation.parseDateTime(options.start);
    }

    var tableField = {
      startPk: options.startPk,
      endPk: options.endPk,
      startRk: options.startRk,
      endRk: options.endRk
    };

    var output = { sas: '' };
    var sharedAccessPolicy = StorageUtil.getSharedAccessPolicy(permissions, start, expiry, tableField, options.policy);
    var tips = util.format($('Creating shared access signature for table %s'), table);
    startProgress(tips);
    try {
      output.sas = tableService.generateSharedAccessSignature(table, sharedAccessPolicy);
    }
    finally {
      endProgress();
    }

    cli.interaction.formatOutput(output, function(outputData) {
      logger.data($('Shared Access Signature'), outputData.sas);
    });
  }

  /**
  * Patch for azure node sdk
  */
  function applyTableServicePatch(tableService) {
    /*
    * List all tables
    * NOTICE: All the caller should use the options parameter since it's just a internal implementation
    */
    tableService.listAllTables = function(options, callback) {
      StorageUtil.listWithContinuation(tableService.listTablesSegmentedWithPrefix, tableService, StorageUtil.ListContinuationTokenArgIndex.Table, options.prefix, null, options, callback);
    };
  }

  /**
  * Create a stored access policy on the table
  */
  function createTablePolicy(table, name, options, _) {
    var createPolicySettings = createTablePolicySetting(options);
    createPolicySettings.resourceName = interaction.promptIfNotGiven($('Table name: '), table, _);
    createPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    createPolicySettings.tips = util.format($('Creating the stored access policy %s on the table %s'), createPolicySettings.policyName, createPolicySettings.resourceName);

    if (options.permissions) {
      StorageUtil.validatePermissions(StorageUtil.AccessType.Table, options.permissions);
    }

    var policies = StorageUtil.createPolicy(createPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      logger.info(util.format($('The stored access policies on table %s are: '), createPolicySettings.resourceName));
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * List the stored access policies on the table
  */
  function listTablePolicy(table, options, _) {
    var listPolicySettings = createTablePolicySetting(options);
    listPolicySettings.resourceName = interaction.promptIfNotGiven($('Table name: '), table, _);
    listPolicySettings.tips = util.format($('Listing the stored access policies on the table %s'), listPolicySettings.resourceName);

    var policies = StorageUtil.selectPolicy(listPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      if (outputData) {
        StorageUtil.showPolicyResults(outputData);
      } else {
        logger.info(util.format($('There is no stored access policy on the table %s.'), listPolicySettings.resourceName));
      }
    });
  }

  /**
  * Show the stored access policy on the table
  */
  function showTablePolicy(table, name, options, _) {
    var showPolicySettings = createTablePolicySetting(options);
    showPolicySettings.resourceName = interaction.promptIfNotGiven($('Table name: '), table, _);
    showPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    showPolicySettings.tips = util.format($('Showing the stored access policy %s on the table %s'), showPolicySettings.policyName, showPolicySettings.resourceName);

    var policy = StorageUtil.selectPolicy(showPolicySettings, _);
    cli.interaction.formatOutput(policy, function(outputData) {
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * Set a stored access policy on the table
  */
  function setTablePolicy(table, name, options, _) {
    var setPolicySettings = createTablePolicySetting(options);
    setPolicySettings.resourceName = interaction.promptIfNotGiven($('Table name: '), table, _);
    setPolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    setPolicySettings.tips = util.format($('Setting the stored access policy %s on the table %s'), setPolicySettings.policyName, setPolicySettings.resourceName);

    if (options.permissions) {
      StorageUtil.validatePermissions(StorageUtil.AccessType.Table, options.permissions);
    }

    var policies = StorageUtil.setPolicy(setPolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      logger.info(util.format($('The stored access policies on table %s are: '), setPolicySettings.resourceName));
      StorageUtil.showPolicyResults(outputData);
    });
  }

  /**
  * Delete a stored access policy on the table
  */
  function deleteTablePolicy(table, name, options, _) {
    var deletePolicySettings = createTablePolicySetting(options);
    deletePolicySettings.resourceName = interaction.promptIfNotGiven($('Table name: '), table, _);
    deletePolicySettings.policyName = interaction.promptIfNotGiven($('Policy name: '), name, _);
    deletePolicySettings.tips = util.format($('Deleting the stored access policy %s on the table %s'), deletePolicySettings.policyName, deletePolicySettings.resourceName);

    var policies = StorageUtil.deletePolicy(deletePolicySettings, _);
    cli.interaction.formatOutput(policies, function(outputData) {
      if (outputData) {
        logger.info(util.format($('The stored access policies on table %s are: '), deletePolicySettings.resourceName));
        StorageUtil.showPolicyResults(outputData);
      } else {
        logger.info(util.format($('There is no stored access policy on the table %s'), deletePolicySettings.resourceName));
      }
    });
  }
};
