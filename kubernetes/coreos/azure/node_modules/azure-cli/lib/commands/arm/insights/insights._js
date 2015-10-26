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
  var insightsCommand = cli.category('insights')
    .description($('Commands related to monitoring Insights (events, alert rules, autoscale settings, metrics)'));

  var insightsEventsCommand = insightsCommand.category('logs')
    .description($('Retrieve operation logs for a subscription, a correlationId, a resource group, resource, or resource provider.'));

  insightsEventsCommand.command('list')
      .description($('List operation logs for a subscription.'))
      .usage('[options]')
      .option('-c --correlationId <correlationId>', $('The correlation id of the query.'))
      .option('-g --resourceGroup <resourceGroup>', $('The resource group.'))
      .option('-i --resourceId <resourceId>', $('The resource Id.'))
      .option('-p --resourceProvider <resourceProvider>', $('The resource provider.'))
      .option('-b --startTime <startTime>', $('The start time of the query.'))
      .option('-e --endTime <endTime>', $('The end time of the query.'))
      .option('--status <status>', $('The status.'))
      .option('--caller <caller>', $('Caller to look for when querying.'))
      .option('-d --detailedOutput', $('Shows the details of the events in the log.'))
      .option('-s --subscription <subscription>', $('The subscription identifier.'))
      .execute(function (options, _) {
        var presentSwitches = 0;
        __.each(['correlationId', 'resourceGroup', 'resourceId', 'resourceProvider'], function (switchName) { if (options[switchName]) presentSwitches++; });
        if (presentSwitches > 1) {
          throw new Error($('The switches correlationId, resourceGroup, resourceId, and resourceProvider are optional and mutually exclusive.'));
        } else if (presentSwitches === 0) {
          insightsCommand._prepareAndExecuteSimple(options, _);
        } else if (options.correlationId) {
          insightsCommand._prepareAndExecute(options.correlationId, 'correlationId', 'correlationId', options, _);
        } else if (options.resourceGroup) {
          insightsCommand._prepareAndExecute(options.resourceGroup, 'resourceGroup', 'resourceGroupName', options, _);
        } else if (options.resourceId) {
          insightsCommand._prepareAndExecute(options.resourceId, 'resourceId', 'resourceUri', options, _);
        } else {
          insightsCommand._prepareAndExecute(options.resourceProvider, 'resourceProvider', 'resourceProvider', options, _);
        }
      });

  insightsCommand._processGeneralParameters = function (startTime, endTime, status, caller) {
    var queryFilter = insightsUtils.validateDateTimeRangeAndAddDefaultsEvents(startTime, endTime);
    queryFilter = insightsUtils.addConditionIfPresent(queryFilter, 'status', status);
    queryFilter = insightsUtils.addConditionIfPresent(queryFilter, 'caller', caller);

    return queryFilter;
  };

  insightsCommand._prepareAndExecuteSimple = function (options, _) {
    var client = insightsUtils.createInsightsClient(log, options);
    var queryFilter = this._processGeneralParameters(options.startTime, options.endTime, options.status, options.caller);

    this._executeEventsCmd(client, queryFilter, !options.detailedOutput ? insightsUtils.selectedFields : null, insightsUtils.passAllFilter, options, _);
  };

  insightsCommand._prepareAndExecute = function (fieldValue, fieldName, fieldLabel, options, _) {
    if (!__.isString(fieldValue)) {
      cli.missingArgument(fieldName);
    }

    var client = insightsUtils.createInsightsClient(log, options);

    var queryFilter = this._processGeneralParameters(options.startTime, options.endTime, options.status, options.caller);
    queryFilter = insightsUtils.addConditionIfPresent(queryFilter, fieldLabel, fieldValue);

    this._executeEventsCmd(client, queryFilter, !options.detailedOutput ? insightsUtils.selectedFields : null, insightsUtils.passAllFilter, options, _);
  };

  insightsCommand._executeEventsCmd = function (client, queryFilter, selectedFields, keepTheRecord, options, _) {
    var progress = cli.interaction.progress(util.format($('Querying \"%s\"'), queryFilter));
    var result = [];
    try {
      var response = client.eventOperations.listEvents(queryFilter, selectedFields, _);

      log.silly(__.isObject(response) ? util.inspect(response) : 'nothing in response');
      log.silly(__.isObject(response) && response.eventDataCollection ? util.inspect(response.eventDataCollection) : 'nothing in eventDataCollection');

      var recordFilter = function (element) { if (keepTheRecord(element)) { result.push(element); }};
      __.each(response.eventDataCollection.value, recordFilter);

      var nextLink = response.eventDataCollection.nextLink;
      while (nextLink) {
        log.silly('Following nextLink');
        response = client.eventOperations.listEventsNext(nextLink, _);
        __.each(response.eventDataCollection.value, recordFilter);
        nextLink = response.eventDataCollection.nextLink;
      }
    } finally {
      progress.end();
    }

    insightsUtils.formatOutputList(cli, log, options, result);
  };
};
