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

var profile = require('../../../util/profile');
var utils = require('../../../util/utils');
var Wildcard = utils.Wildcard;
var __ = require('underscore');
var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var withProgress = cli.interaction.withProgress.bind(cli.interaction);
  
  var provider = cli.category('provider');
  var providerOperations = provider.category('operations')
    .description($('Commands to get the operations or actions allowed by an Azure resource provider.'));
  
  providerOperations.command('show [actionString]')
    .description($('Show operations for the requested provider action string. The command takes as input an action string (with possible wildcard (*) character(s)) which determines the action details to display.'))
    .usage('[options] <actionString>')
    .option('-a --actionString <actionString>', $('The provider action string (with possible wildcard (*) characters). Example: "*" to get all actions for all providers, "Microsoft.Insights/*" to get actions for a particular provider, "*/virtualMachines/*" to get all actions that can be performed on virtual machines.'))
    .option('-s --subscription <subscription>', $('Subscription to show provider operations for'))
    .execute(function (actionString, options, _) {
    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.createResourceClient(subscription);
    
    var flattenedProviderOperations = [];

    if (Wildcard.containWildcards(actionString)) {
      // ActionString has wildcard character
      flattenedProviderOperations = getProviderOperationsWithWildCard(client, actionString, _);
    }
    else {
      flattenedProviderOperations = getProviderOperationsWithoutWildCard(client, actionString, _);
    }
    
    cli.interaction.formatOutput(flattenedProviderOperations, function (data) {
      if (!data || data.length === 0) {
        log.info($('No operations available matching the input action string'));
      } else {
        data.forEach(function (operation) {
          displayAProviderOperation(operation);
        });
      }
    });
  });
  
  function getProviderOperationsWithWildCard(client, actionString, _) {
    var operationsToDisplay = [];
    var providersData = [];
    var unflattenedOperationsForAllProviders;

    var nonWildCardPrefix = Wildcard.getNonWildcardPrefix(actionString);

    if (!nonWildCardPrefix || nonWildCardPrefix.length === 0) {
      // Get operations for all providers
      unflattenedOperationsForAllProviders = listAllProviderOperationsMetadata(client, _);
      providersData = providersData.concat(unflattenedOperationsForAllProviders);
    }
    else {
      var providerFullName = getProviderFullName(nonWildCardPrefix);

      if (!providerFullName || providerFullName.length === 0) {

        // Get operations for all providers
        unflattenedOperationsForAllProviders = listAllProviderOperationsMetadata(client, _);
        providersData = providersData.concat(unflattenedOperationsForAllProviders);
      }
      else {
        var unflattenedOperationsForSpecificProvider = getProviderOperationsMetadata(client, providerFullName, _);
        providersData.push(unflattenedOperationsForSpecificProvider);
      }
    }

    providersData.forEach(function (unflattenedProviderData) {
      var operations = getFlattenedOperationsFromProviderOperationsMetadata(unflattenedProviderData);

      operations.forEach(function (operation) {
        if (Wildcard.isMatchCaseInsensitive(operation.operation, actionString)) {
          operationsToDisplay.push(operation);
        }
      });
    });

    return operationsToDisplay;
  }

  function getProviderOperationsWithoutWildCard(client, actionString, _) {
    var operationsToDisplay = [];

    var providerFullName = getProviderFullName(actionString);

    if (!__.isEmpty(providerFullName)) {
      var unflattenedProviderOperations = getProviderOperationsMetadata(client, providerFullName, _);
      var operations = getFlattenedOperationsFromProviderOperationsMetadata(unflattenedProviderOperations);

      operationsToDisplay = __.where(operations, { operation: actionString });
    }
    return operationsToDisplay;
  }

  function getProviderFullName(actionString) {
    var index = actionString.indexOf('/');
    var fullName = '';
    if (index > 0) {
      fullName = actionString.substring(0, index);
    }
    return fullName;
  }

  function displayAProviderOperation(resourceProviderOperation) {
    log.data($('Operation         : '), resourceProviderOperation.operation);
    log.data($('OperationName     : '), resourceProviderOperation.operationName);
    log.data($('ProviderNamespace : '), resourceProviderOperation.providerNamespace);
    log.data($('ResourceName      : '), resourceProviderOperation.resourceName);
    log.data($('Description       : '), resourceProviderOperation.description);
    log.data('');
  }

  function getProviderOperationsMetadata(client, providerFullName, _){
    return withProgress($('Getting providerOperations metadata'),
        function (log, _) {
      return client.providerOperationsMetadata.get(providerFullName, _).provider;
    }, _);
  }

  function listAllProviderOperationsMetadata(client, _) {
    return withProgress($('Getting providerOperations metadata'),
        function (log, _) {
      return client.providerOperationsMetadata.list(_).providers;
    }, _);
  }

  function getFlattenedOperationsFromProviderOperationsMetadata(provider) {
    var flattenedOperations = [];
    provider.operations.forEach(function (operation) {
      if (isUserOperation(operation)) {
        flattenedOperations.push(getFlattenedOperationObject(operation, provider.displayName));
      }
    });
    
    if (provider.resourceTypes) {
      provider.resourceTypes.forEach(function (rt) {
        rt.operations.forEach(function (operation) {
          if (isUserOperation(operation)) {
            flattenedOperations.push(getFlattenedOperationObject(operation, provider.displayName, rt.displayName));
          }
        });
      });
    }
    return flattenedOperations;
  }
  
  function isUserOperation(operation) {
    return (!operation.origin || operation.origin.indexOf('user') > -1);
  }
  
  function getFlattenedOperationObject(operation, providerDisplayName, resourceDisplayName) {

    var operationObject = {
      operation: operation.name,
      operationName: operation.displayName,
      description: operation.description,
      providerNamespace: providerDisplayName,
      resourceName: !resourceDisplayName ? '' : resourceDisplayName
    };

    return operationObject;
  }
};
