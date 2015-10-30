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

var __ = require('underscore');
var util = require('util');
var utils = require('../../../util/utils');
var insightsUtils = require('./insights.utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var insightsAlertsRulesCommand = cli.category('insights').category('alerts').category('rule')
    .description($('Manages alerts rules'));

  // ** Defining the commands for this category
  insightsAlertsRulesCommand.command('list <resourceGroup>')
    .description($('List alert rules for a resource.'))
    .usage('[options] <resourceGroup>')
    .option('-g --resourceGroup <resourceGroup>', $('The resource group.'))
    .option('-n --ruleName <ruleName>', $('The name of the rule to query.'))
    .option('-i --targetResourceId <targetResourceId>', $('The target resource of the query.'))
    .option('-s --subscription <subscription>', $('The subscription identifier.'))
    .execute(function (resourceGroup, options, _) {
      insightsAlertsRulesCommand._prepareAndExecute(resourceGroup, options, _);
    });

  insightsAlertsRulesCommand.command('delete <resourceGroup> <ruleName>')
    .description($('Deletes an alert rule.'))
    .usage('[options] <resourceGroup> <ruleName>')
    .option('-g --resourceGroup <resourceGroup>', $('The resource group.'))
    .option('-n --ruleName <ruleName>', $('The name of the rule to query.'))
    .option('-s --subscription <subscription>', $('The subscription identifier.'))
    .execute(function (resourceGroup, ruleName, options, _) {
      insightsAlertsRulesCommand._prepareAndExecuteDelete(resourceGroup, ruleName, options, _);
    });

  insightsAlertsRulesCommand.command('set <ruleType> <ruleName> <location> <resourceGroup>')
    .description($('Create or set a metric alert rule.'))
    .usage('[options] <ruleType> <ruleName> <location> <resourceGroup>')

    // Generic options
    .option('-y --ruleType <ruleType>', $('The type of the rule (Event, Metric, Webtest).'))
    .option('-x --disable', $('Flag to disable the rule.'))
    .option('-s --subscription <subscription>', $('The subscription identifier.'))

    // Common required
    .option('-n --ruleName <ruleName>', $('The name of the rule.'))
    .option('-d --description <description>', $('The description of the rule.'))
    .option('-l --location <location>', $('The location.'))
    .option('-g --resourceGroup <resourceGroup>', $('The resource group.'))

    // Common optional
    .option('--windowSize <windowSize>', $('The time window size. Expected format hh:mm:ss.'))
    .option('--sendToServiceOwners', $('Flag to send e-mail to service owners.'))
    .option('--customEmails <customEmails>', $('The list of custom e-mail addresses.'))

    // Event and Metric options required
    .option('-o --conditionOperator <conditionOperator>', $('The condition operator: GreaterThan, GreaterThanOrEqual, LessThan, LessThanOrEqual. Value is case insensitive.'))
    .option('-a --threshold <threshold>', $('The threshold.'))
    .option('-i --resourceId <resourceId>', $('The resource Id.'))

    // Metric only required
    .option('-m --metricName <metricName>', $('The metric name.'))

    // Metric only optional
    .option('--timeAggregationOperator <timeAggregationOperator>', $('The time aggregation operator: Average, Minimum, Maximum, Total. Value is case insensitve.'))

    // Event only required
    .option('-e --eventName <eventName>', $('The event name.'))
    .option('-z --eventSource <eventSource>', $('The event source.'))
    .option('-f --level <level>', $('The level for the rule.'))
    .option('-p --operationName <operationName>', $('The operation name.'))
    .option('-k --resourceProvider <resourceProvider>', $('The resource provider.'))
    .option('-u --status <status>', $('The status.'))
    .option('-b --subStatus <subStatus>', $('The substatus.'))

    // Event only optional
    .option('--eMailAddress <eMailAddress>', $('The e-mail address.'))

    // Webtest only required
    .option('-f --failedLocationCount <failedLocationCount>', $('The failed location count.'))

    .execute(function (ruleType, ruleName, location, resourceGroup, options, _) {
      insightsAlertsRulesCommand._prepareAndExecuteSet(ruleType, ruleName, location, resourceGroup, options, _);
    });

  // ** The Prepare and Execute functions
  insightsAlertsRulesCommand._prepareAndExecute = function (resourceGroup, options, _) {
    if (!__.isString(resourceGroup)) {
      cli.missingArgument('resourceGroup');
    }

    var client = insightsUtils.createInsightsManagementClient(log, options);

    this._executeCmd(client, resourceGroup, options.ruleName, options.targetResourceId, options, _);
  };

  insightsAlertsRulesCommand._prepareAndExecuteDelete = function (resourceGroup, ruleName, options, _) {
    if (!__.isString(resourceGroup)) {
      cli.missingArgument('resourceGroup');
    }

    if (!__.isString(ruleName)) {
      cli.missingArgument('ruleName');
    }

    var client = insightsUtils.createInsightsManagementClient(log, options);

    this._executeDeleteCmd(client, resourceGroup, ruleName, options, _);
  };

  insightsAlertsRulesCommand._prepareAndExecuteSet = function (ruleType, ruleName, location, resourceGroup, options, _) {
    log.silly(ruleType);
    log.silly(ruleName);
    log.silly(location);
    log.silly(resourceGroup);
    log.silly(util.inspect(options));
    if (!__.isString(ruleType)) {
      cli.missingArgument('ruleType');
    }

    if (!__.isString(ruleName)) {
      cli.missingArgument('ruleName');
    }

    if (!__.isString(location)) {
      cli.missingArgument('location');
    }

    if (!__.isString(resourceGroup)) {
      cli.missingArgument('resourceGroup');
    }

    var client = insightsUtils.createInsightsManagementClient(log, options);
    var parameters = this._createSdkCallParameters(ruleType, ruleName, location, resourceGroup, options);

    this._executeSetCmd(client, ruleName, resourceGroup, parameters, options, _);
  };

  insightsAlertsRulesCommand._createRuleCondition = function (ruleType, ruleName, location, resourceGroup, options) {
    var windowSize;
    if (options.windowSize) {
      windowSize = insightsUtils.validateTimeSpan(options.windowSize);
    } else {
      windowSize = insightsUtils.defaultWindowSize;
    }

    var condition;
    if (ruleType === 'Event') {
      condition = this._createEventRuleCondition(resourceGroup, windowSize, options);
    } else if (ruleType === 'Metric') {
      condition = this._createThresholdRuleCondition(windowSize, options);
    } else if (ruleType === 'Webtest') {
      condition = this._createLocationThresholdRuleCondition(windowSize, options);
    } else {
      throw new Error(util.format($('Rule type %s not supported.'), ruleType));
    }

    return condition;
  };

  insightsAlertsRulesCommand._validateCommonParameters = function(options) {
    if (!__.isString(options.resourceId)) {
      cli.missingArgument('resourceId');
    }

    if (!__.isString(options.threshold)) {
      cli.missingArgument('threshold');
    } else {
      options.threshold = parseFloat(options.threshold);
    }

    if (!__.isString(options.conditionOperator)) {
      cli.missingArgument('conditionOperator');
    } else {
      var operatorTemp = options.conditionOperator.toLowerCase();
      if (operatorTemp != 'greaterthan' && operatorTemp != 'greaterthanorequal' && operatorTemp != 'lessthan' && operatorTemp != 'lessthanorequal') {
        throw new Error(util.format($('Invalid condition operator: %s'), options.conditionOperator));
      }
    }
  };

  insightsAlertsRulesCommand._createThresholdRuleCondition = function (windowSize, options) {
    this._validateCommonParameters(options);

    if (!__.isString(options.metricName)) {
      cli.missingArgument('metricName');
    }

    if (!__.isString(options.timeAggregationOperator)) {
      options.timeAggregationOperator = insightsUtils.defaultTimeAggregationOperator;
    } else {
      var tempOperator = options.timeAggregationOperator.toLowerCase();
      if (tempOperator != 'average' && tempOperator != 'minimum' && tempOperator != 'maximum' && tempOperator != 'total') {
        throw new Error(util.format($('Invalid time aggregation operator: %s'), options.timeAggregationOperator));
      }
    }

    return {
      dataSource: {
        metricName: options.metricName,
        resourceUri: options.resourceId,
        type: 'Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource'
      },
      operator: options.conditionOperator,
      threshold: options.threshold,
      timeAggregation: options.timeAggregationOperator,
      windowSize: windowSize,
      type: 'Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition'
    };
  };

  insightsAlertsRulesCommand._createEventRuleCondition = function (resourceGroup, windowSize, options) {
    this._validateCommonParameters(options);

    if (!__.isString(options.eventName)) {
      cli.missingArgument('eventName');
    }

    if (!__.isString(options.eventSource)) {
      cli.missingArgument('eventSource');
    }

    if (!__.isString(options.level)) {
      cli.missingArgument('eventSource');
    }

    if (!__.isString(options.operationName)) {
      cli.missingArgument('operationName');
    }

    if (!__.isString(options.resourceProvider)) {
      cli.missingArgument('resourceProvider');
    }

    if (!__.isString(options.status)) {
      cli.missingArgument('status');
    }

    if (!__.isString(options.subStatus)) {
      cli.missingArgument('subStatus');
    }

    return {
      aggregation: {
        operator: options.conditionOperator,
        threshold: options.threshold,
        windowSize: windowSize
      },
      dataSource: {
        eventName: options.eventName,
        eventSource: options.evenSource,
        level: options.level,
        operationName: options.operationName,
        resourceGroupName: resourceGroup,
        resourceProviderName: options.resourceProviderName,
        resourceUri: options.resourceId,
        status: options.status,
        subStatus: options.subStatus,
        claims: {
          eMailAddress: options.eMailAddress
        },
        type: 'Microsoft.Azure.Management.Insights.Models.RuleManagementEventDataSource'
      },
      type: 'Microsoft.Azure.Management.Insights.Models.ManagementEventRuleCondition'
    };
  };

  insightsAlertsRulesCommand._createLocationThresholdRuleCondition = function (windowSize, options) {
    return {
      dataSource: {
        type: 'Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource'
      },
      failedLocationCount: options.failedLocationCount,
      windowSize: windowSize,
      type: 'Microsoft.Azure.Management.Insights.Models.LocationThresholdRuleCondition'
    };
  };

  insightsAlertsRulesCommand._createSdkCallParameters = function (ruleType, ruleName, location, resourceGroup, options) {
    var condition = this._createRuleCondition(ruleType, ruleName, location, resourceGroup, options);
    var parameters = {
      location: location,
      properties: {
        name: ruleName,
        isEnabled: !options.disabled,
        description: options.description,
        lastUpdatedTime: new Date(),
        condition: condition,
        action: {
          customEmails: __.isUndefined(options.customEmails) ? null : options.customEmails,
          sendToServiceOwners: !__.isUndefined(options.sendToServiceOwners),
          type: 'Microsoft.Azure.Management.Insights.Models.RuleEmailAction'
        }
      },
      tags: {}
    };

    parameters.tags['$type'] = 'Microsoft.WindowsAzure.Management.Common.Storage.CasePreservedDictionary,Microsoft.WindowsAzure.Management.Common.Storage';
    parameters.tags['hidden-link:' + options.resourceId] = 'Resource';

    return parameters;
  };

  // *** The execute cmd functions
  insightsAlertsRulesCommand._executeCmd = function (client, resourceGroup, name, targetResourceId, options, _) {
    var progress = cli.interaction.progress($('Querying for alert rules'));
    var result = [];
    var response;
    try {
      if (!__.isString(name) || name === '') {
        log.silly('Query by resourceGroup or targetResourceId');
        response = client.alertOperations.listRules(resourceGroup, targetResourceId, _);

        log.silly(!response ? util.inspect(response) : 'nothing in response');
        log.silly(!response && response.ruleResourceCollection ? util.inspect(response.ruleResourceCollection) : 'nothing in ruleResourceCollection');

        __.each(response.ruleResourceCollection.value, function (element) { result.push(element); });
      } else {
        log.silly('Query by name');
        response = client.alertOperations.getRule(resourceGroup, name, _);

        log.silly(!response ? util.inspect(response) : 'nothing in response');

        result.push({
          id: response.id,
          location: response.location,
          name: response.name,
          properties: response.properties,
          tags: response.Tags
        });
      }
    } finally {
      progress.end();
    }

    insightsUtils.formatOutputList(cli, log, options, result);
  };

  insightsAlertsRulesCommand._executeDeleteCmd = function (client, resourceGroup, ruleName, options, _) {
    var progress = cli.interaction.progress(util.format($('Deleting alert rule \"%s\"'), ruleName));
    var response = null;
    try {
      response = client.alertOperations.deleteRule(resourceGroup, ruleName, _);

      // These are debugging messages
      log.silly(!response ? util.inspect(response) : 'nothing in response');
    } finally {
      progress.end();
    }

    insightsUtils.formatOutput(cli, log, options, response);
  };

  insightsAlertsRulesCommand._executeSetCmd = function (client, ruleName, resourceGroup, parameters, options, _) {
    var progress = cli.interaction.progress(util.format($('Setting or creating alert rule \"%s\"'), ruleName));
    var response = null;
    try {
      response = client.alertOperations.createOrUpdateRule(resourceGroup, parameters, _);

      // These are debugging messages
      log.silly(!response ? util.inspect(response) : 'nothing in response');
    } finally {
      progress.end();
    }

    insightsUtils.formatOutput(cli, log, options, response);
  };
};
