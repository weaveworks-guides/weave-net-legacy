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

var __ = require('underscore');
var util = require('util');

var profile = require('../../util/profile');
var utils = require('../../util/utils');
var validation = require('../../util/validation');
var storageUtil = require('../../util/storage.util');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var isResourceMode = cli.getMode() === 'arm';
  var storage = cli.category('storage');

  var storageAccount = storage.category('account')
    .description($('Commands to manage your Storage accounts'));

  var keys = storageAccount.category('keys')
    .description($('Commands to manage your Storage account keys'));

  var connectionString = storageAccount.category('connectionstring')
    .description($('Commands to show your Storage connection string'));

  var serviceType = { blob: 0, queue: 1, table: 2, file: 3 };

  function wrapEndpoint(uri, type) {
    if (!uri) {
      return '';
    }

    if (uri.indexOf('//') != -1 && !utils.stringStartsWith(uri, 'http://') && !utils.stringStartsWith(uri, 'https://')) {
      throw new Error($('The provided URI "' + uri + '" is not supported.'));
    }

    if (validation.isValidUri(uri)) {
      var tag;
      switch (type) {
        case serviceType.blob: tag = 'BlobEndpoint='; break;
        case serviceType.queue: tag = 'QueueEndpoint='; break;
        case serviceType.table: tag = 'TableEndpoint='; break;
        case serviceType.file: tag = 'FileEndpoint='; break;
      }
      return tag + uri + ';';
    }

    return '';
  }

  function showProgress(message) {
    return cli.interaction.progress(message);
  }

  function endProgress(progress)
  {
    if (progress) {
      progress.end();
    }
  }

  function createStorageManagementClient(subscriptionOrName) {
    var client;
    if(__.isString(subscriptionOrName) || !subscriptionOrName) {
      subscriptionOrName = profile.current.getSubscription(subscriptionOrName);
    }
    if (isResourceMode) {
      client = utils.createStorageResourceProviderClient(subscriptionOrName);
    } else {
      client = utils.createStorageClient(subscriptionOrName);
    }
    return client;
  }

  function validateResourceGroupName(options, _) {
    options.resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), options.resourceGroup, _);
  }

  function listAccounts(serviceClient, options, _) {
    var progress = showProgress($('Getting storage accounts'));
    var storageAccounts;
    try {    
      if (isResourceMode && options.resourceGroup) {
        storageAccounts = serviceClient.storageAccounts.listByResourceGroup(options.resourceGroup, _).storageAccounts;
      } else {
        storageAccounts = serviceClient.storageAccounts.list(_).storageAccounts;
      }
    } finally {
      endProgress(progress);
    }

    return storageAccounts;
  }

  function showAccount(serviceClient, accountName, options, _) {
    var progress;
    var message = $('Getting storage account');
    var storageAccount;
    try {
      if (isResourceMode) {
        validateResourceGroupName(options, _);
        progress = showProgress(message);
        storageAccount = serviceClient.storageAccounts.getProperties(options.resourceGroup, accountName, _).storageAccount;
      } else {
        progress = showProgress(message);
        storageAccount = serviceClient.storageAccounts.get(accountName, _).storageAccount;
      }
    } finally {
      endProgress(progress);
    }

    return storageAccount;
  }

  function createAccount(serviceClient, parameters, options, _) {
    var progress;
    var message = $('Creating storage account');
    var storageAccount;
    
    try {
      if (isResourceMode) {
        validateResourceGroupName(options, _);
        progress = showProgress(message);
        storageAccount = serviceClient.storageAccounts.create(options.resourceGroup, parameters.name, parameters, _);
      } else {
        progress = showProgress(message);
        storageAccount = serviceClient.storageAccounts.create(parameters, _);
      }
    } finally {
      endProgress(progress);
    }

    return storageAccount;
  }

  function updateAccount(serviceClient, accountName, parameters, options, _) {
    var progress;
    var message = $('Updating storage account');
    var storageAccount;

    try {
      if (isResourceMode) {
        validateResourceGroupName(options, _);
        progress = showProgress(message);
        return serviceClient.storageAccounts.update(options.resourceGroup, accountName, parameters, _);
      } else {
        progress = showProgress(message);
        return serviceClient.storageAccounts.update(accountName, parameters, _);
      }
    } finally {
      endProgress(progress);
    }

    return storageAccount;
  }

  function deleteAccount(serviceClient, accountName, options, _) {
    var progress;
    var message = $('Deleting storage account');
    var storageAccount;

    try {
      if (isResourceMode) {
        validateResourceGroupName(options, _);
        progress = showProgress(message);
        storageAccount = serviceClient.storageAccounts.deleteMethod(options.resourceGroup, accountName, _);
      } else {
        progress = showProgress(message);
        storageAccount = serviceClient.storageAccounts.deleteMethod(accountName, _);
      }
    } finally {
      endProgress(progress);
    }

    return storageAccount;
  }

  function getAccountKeys(serviceClient, accountName, options, _) {
    var progress;
    var message = $('Getting storage account keys');
    var keys;
    
    try {
      if (isResourceMode) {
        validateResourceGroupName(options, _);
        progress = showProgress(message);
        keys = serviceClient.storageAccounts.listKeys(options.resourceGroup, accountName, _);
      } else {
        progress = showProgress(message);
        keys = serviceClient.storageAccounts.getKeys(accountName, _);
      }
    } finally {
      endProgress(progress);
    }

    return keys;
  }

  function regenerateAccountKeys(serviceClient, accountName, options, _) {
    var progress;
    var message = $('Renewing storage account key');
    var keys;

    try {
      var keyType;
      if (isResourceMode) {
        validateResourceGroupName(options, _);
        progress = showProgress(message);
        keyType = options.primary ? 'key1' : 'key2';
        keys = serviceClient.storageAccounts.regenerateKey(options.resourceGroup, accountName, keyType, _);
      } else {
        keyType = options.primary ? 'primary' : 'secondary';
        var parameters = { name: accountName, keyType: keyType };
        progress = showProgress(message);
        keys = serviceClient.storageAccounts.regenerateKeys(parameters, _);
      }
    } finally {
      endProgress(progress);
    }

    return keys;
  }

  function parseResourceGroupNameFromId(id) {
    if (!id) { return ''; }
    var keyword = '/resourceGroups/';
    var startIndex = id.indexOf(keyword) + keyword.length;
    var endIndex = id.indexOf('/', startIndex);
    return id.substring(startIndex, endIndex); 
  }

  storageAccount.listCommand = function (options, _) {
    var service = createStorageManagementClient(options.subscription);

    var storageAccounts = listAccounts(service, options, _);

    storageAccounts.forEach(function(storageAccount) {
     storageAccount.resourceGroup = parseResourceGroupNameFromId(storageAccount.id);
    });

    cli.interaction.formatOutput(storageAccounts, function (outputData) {
      if(outputData.length === 0) {
        log.info($('No storage accounts defined'));
      } else {
        log.table(outputData, function (row, item) {
          row.cell($('Name'), item.name);
          if (isResourceMode) {
            row.cell($('Type'), item.accountType);
            row.cell($('Location'), item.location);
            row.cell($('Resource Group'), item.resourceGroup);
          } else {
            row.cell($('Type'), item.properties.accountType);
            row.cell($('Label'), item.label ? item.properties.label : '');
            row.cell($('Location'), item.properties.location ||
              (item.properties.affinityGroup || '') +
              (item.properties.geoPrimaryRegion ? ' (' + item.properties.geoPrimaryRegion + ')' : ''));
            row.cell($('Resource Group'), item.extendedProperties.ResourceGroup);
          }
        });
      }
    });
  };

  storageAccount.showCommand = function (name, options, _) {
    var service = createStorageManagementClient(options.subscription);

    var storageAccount = showAccount(service, name, options, _);

    if (storageAccount) {
      storageAccount.resourceGroup = parseResourceGroupNameFromId(storageAccount.id);
      cli.interaction.formatOutput(storageAccount, function(outputData) {
        log.data($('Name:'), outputData.name);
        if (isResourceMode) {
          log.data($('Url:'), outputData.id);
          log.data($('Type:'), outputData.accountType);
          log.data($('Resource Group:'), outputData.resourceGroup);
          log.data($('Location:'), outputData.location);
          log.data($('Provisioning State:'), outputData.provisioningState);
          log.data($('Primary Location:'), outputData.primaryLocation);
          log.data($('Primary Status:'), outputData.statusOfPrimary);
          log.data($('Secondary Location:'), outputData.secondaryLocation);
          log.data($('Creation Time:'), outputData.creationTime);
          cli.interaction.logEachData($('Primary Endpoints:'), outputData.primaryEndpoints);
        } else {
          log.data($('Url:'), outputData.uri);

          cli.interaction.logEachData($('Account Properties:'), outputData.properties);
          cli.interaction.logEachData($('Extended Properties:'), outputData.extendedProperties);
          cli.interaction.logEachData($('Capabilities:'), outputData.capabilities);
        }
      });
    } else {
      log.info($('No storage account found'));
    }
  };

  storageAccount.createCommand = function (name, options, _) {
    var service = createStorageManagementClient(options.subscription);
    var managementService = utils.createManagementClient(profile.current.getSubscription(options.subscription), log);

    var storageOptions = {
      name: name,
      label: options.label ? options.label : name
    };

    if (options.type){      
      validation.isValidEnumValue(options.type, Object.keys(storageUtil.AccountTypeForCreating));
    } else {
      options.type = cli.interaction.chooseIfNotGiven($('Account Type: '), $('Getting type'), options.type,
        function (cb) {
          cb(null, Object.keys(storageUtil.AccountTypeForCreating));
        }, _);
    }
    storageOptions.accountType = storageUtil.AccountTypeForCreating[options.type.toUpperCase()];

    if (__.isString(options.description)) {
      storageOptions.description = options.description;
    }

    if (options.affinityGroup) {
      storageOptions.affinityGroup = options.affinityGroup;
    } else {
      storageOptions.location = cli.interaction.chooseIfNotGiven($('Location: '), $('Getting locations'), options.location,
        function (cb) {
          managementService.locations.list(function (err, result) {
            if (err) { return cb(err); }

            cb(null, result.locations.map(function (location) { return location.name; }));
          });
        }, _);
    }

    createAccount(service, storageOptions, options, _);
  };

  storageAccount.updateCommand = function (name, options, _) {
    var service = createStorageManagementClient(options.subscription);

    var storageOptions = { };
    if (__.isString(options.description)) {
      storageOptions.description = options.description;
    }

    if (options.label) {
      storageOptions.label = options.label;
    }

    if (options.type){      
      validation.isValidEnumValue(options.type, Object.keys(storageUtil.AccountTypeForChanging));
      storageOptions.accountType = storageUtil.AccountTypeForChanging[options.type.toUpperCase()];
    }

    updateAccount(service, name, storageOptions, options, _);
  };

  storageAccount.deleteCommand = function (name, options, _) {
    var service = createStorageManagementClient(options.subscription);

    if (!options.quiet && !cli.interaction.confirm(util.format($('Delete storage account %s? [y/n] '), name), _)) {
      return;
    }

    deleteAccount(service, name, options, _);
  };

  keys.listCommand = function (name, options, _) {
    var service = createStorageManagementClient(options.subscription);

    var keys = getAccountKeys(service, name, options, _);

    if (keys) {
      if (isResourceMode) {
        cli.interaction.formatOutput(keys, function(outputData) {
          log.data($('Primary:'), outputData.storageAccountKeys.key1);
          log.data($('Secondary:'), outputData.storageAccountKeys.key2);
        });
      } else{
        cli.interaction.formatOutput(keys, function(outputData) {
          log.data($('Primary:'), outputData.primaryKey);
          log.data($('Secondary:'), outputData.secondaryKey);
        });
      }
    } else {
      log.info($('No storage account keys found'));
    }
  };

  keys.renewCommand = function (name, options, _) {
    var service = createStorageManagementClient(options.subscription);

    if (!options.primary && !options.secondary) {
      throw new Error($('Need to specify either --primary or --secondary'));
    } else if (options.primary && options.secondary) {
      throw new Error($('Only one of primary or secondary keys can be renewed at a time'));
    }

    var keys = regenerateAccountKeys(service, name, options, _);

    if (keys) {
      if (isResourceMode) {
        cli.interaction.formatOutput(keys, function(outputData) {
          log.data($('Primary:'), outputData.storageAccountKeys.key1);
          log.data($('Secondary:'), outputData.storageAccountKeys.key2);
        });
      } else{
        cli.interaction.formatOutput(keys, function(outputData) {
          log.data($('Primary:'), outputData.primaryKey);
          log.data($('Secondary:'), outputData.secondaryKey);
        });
      }
    } else {
      log.info($('No storage account keys found'));
    }
  };

  connectionString.showCommand = function (name, options, _) {
    var service = createStorageManagementClient(options.subscription);
    var keys = getAccountKeys(service, name, options, _);
    var connection = { string: '' };
    connection.string = 'DefaultEndpointsProtocol=' + (options.useHttp ? 'http;' : 'https;');
    connection.string += wrapEndpoint(options.blobEndpoint, serviceType.blob);
    connection.string += wrapEndpoint(options.queueEndpoint, serviceType.queue);
    connection.string += wrapEndpoint(options.tableEndpoint, serviceType.table);
    connection.string += wrapEndpoint(options.fileEndpoint, serviceType.file);
    connection.string += 'AccountName=' + name + ';';
    connection.string += 'AccountKey=' + (keys.primaryKey || keys.storageAccountKeys.key1);
    cli.interaction.formatOutput(connection, function (outputData) {
      log.data($('connectionstring:'), outputData.string);
    });
  };
  
  Object.getPrototypeOf(storage).appendSubscriptionAndResourceGroupOption = function () {
    if (isResourceMode) {
      this.option('-g, --resource-group <resourceGroup>', $('the resource group name'));
    }
    this.option('-s, --subscription <id>', $('the subscription id'));
    return this;
  };

  // Command: azure storage account list
  storageAccount.command('list')
    .description($('List storage accounts'))
    .appendSubscriptionAndResourceGroupOption()
    .execute(storageAccount.listCommand);

  // Command: azure storage account show
  storageAccount.command('show <name>')
    .description($('Show a storage account'))
    .appendSubscriptionAndResourceGroupOption()
    .execute(storageAccount.showCommand);

  // Command: azure storage account create
  var accountCreateCommand = storageAccount.command('create <name>').description($('Create a storage account'));
  if (!isResourceMode) {
    accountCreateCommand.option('-e, --label <label>', $('the storage account label'))
      .option('-d, --description <description>', $('the storage account description'))
      .option('-a, --affinity-group <name>', $('the affinity group'));
  }
  accountCreateCommand.option('-l, --location <name>', $('the location'))
    .option('--type <type>', $('the account type(LRS/ZRS/GRS/RAGRS/PLRS)'))
    .appendSubscriptionAndResourceGroupOption()
    .execute(storageAccount.createCommand);

  // Command: azure storage account set
  var accountSetCommand = storageAccount.command('set <name>').description($('Update a storage account'));
  if (!isResourceMode) {
    accountSetCommand.option('-e, --label <label>', $('the storage account label'))
      .option('-d, --description <description>', $('the storage account description'));
  }
  accountSetCommand.option('--type <type>', $('the account type(LRS/GRS/RAGRS)'))
    .appendSubscriptionAndResourceGroupOption()
    .execute(storageAccount.updateCommand);

  // Command: azure storage account delete
 storageAccount.command('delete <name>')
  .description($('Delete a storage account'))
  .appendSubscriptionAndResourceGroupOption()
  .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
  .execute(storageAccount.deleteCommand);

  // Command: azure storage account keys list
  keys.command('list <name>')
    .description($('List the keys for a storage account'))
    .appendSubscriptionAndResourceGroupOption()
    .execute(keys.listCommand);

  // Command: azure storage account keys renew
  keys.command('renew <name>')
    .description($('Renew a key for a storage account from your account'))
    .option('--primary', $('Update the primary key'))
    .option('--secondary', $('Update the secondary key'))
    .appendSubscriptionAndResourceGroupOption()
    .execute(keys.renewCommand);

  // Command: azure storage account connectionstring show
  connectionString.command('show <name>')
    .description($('Show the connection string for your account'))
    .appendSubscriptionAndResourceGroupOption()
    .option('--use-http', $('Use http as default endpoints protocol'))
    .option('--blob-endpoint <blobEndpoint>', $('the blob endpoint'))
    .option('--queue-endpoint <queueEndpoint>', $('the queue endpoint'))
    .option('--table-endpoint <tableEndpoint>', $('the table endpoint'))
    .option('--file-endpoint <fileEndpoint>', $('the file endpoint'))
    .execute(connectionString.showCommand);
};