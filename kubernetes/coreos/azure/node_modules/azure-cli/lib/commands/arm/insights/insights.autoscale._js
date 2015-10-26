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
  var insightsAutoscaleCommand = cli.category('insights').category('autoscale')
    .description($('Retrieve autoscale logs'))
    .command('list')
      .description($('List autoscale logs for a resource.'))
      .usage('[options]')
      .option('-i --resourceId <resourceId>', $('The resource Id.'))
      .option('-b --startTime <startTime>', $('The start time of the query.'))
      .option('-e --endTime <endTime>', $('The end time of the query.'))
      .option('--status <status>', $('The status.'))
      .option('--caller <caller>', $('Caller to look for when querying.'))
      .option('-d --detailedOutput', $('Shows the details of the events in the log.'))
      .option('-s --subscription <subscription>', $('The subscription identifier.'))
      .execute(function (options, _) {
        insightsAutoscaleCommand._prepareAndExecute(options, _);
      });

  insightsAutoscaleCommand._filterByResourceId = function(resourceId) {
    if (__.isString(resourceId)) {
      var resourceIdLowerCase = resourceId.toLowerCase();
      log.silly('resourceIdLowerCase: ' + resourceIdLowerCase);
      return function(record) {
        log.silly('record: ' + record);
        return __.isString(record.resourceUri) && record.resourceUri.toLowerCase() === resourceIdLowerCase;
      };
    } else {
      return insightsUtils.passAllFilter;
    }
  };

  insightsAutoscaleCommand._processGeneralParameters = function (startTime, endTime, status, caller) {
    var queryFilter = insightsUtils.validateDateTimeRangeAndAddDefaultsEvents(startTime, endTime);
    queryFilter = insightsUtils.addConditionIfPresent(queryFilter, 'status', status);
    queryFilter = insightsUtils.addConditionIfPresent(queryFilter, 'caller', caller);

    return queryFilter;
  };

  insightsAutoscaleCommand._prepareAndExecute = function (options, _) {
    var client = insightsUtils.createInsightsClient(log, options);

    var queryFilter = this._processGeneralParameters(options.startTime, options.endTime, options.status, options.caller);
    queryFilter = insightsUtils.addConditionIfPresent(queryFilter, 'eventSource', insightsUtils.autoscaleEventSourceName);
    this._executeEventsCmd(client, queryFilter, !options.detailedOutput ? insightsUtils.selectedFields : null, this._filterByResourceId(options.resourceId), options, _);
  };

  insightsAutoscaleCommand._executeEventsCmd = function (client, queryFilter, selectedFields, keepTheRecord, options, _) {
    var progress = cli.interaction.progress(util.format($('Querying \"%s\"'), queryFilter));
    var result = [];
    try {
      var response = client.eventOperations.listEvents(queryFilter, selectedFields, _);

      log.silly(!response ? util.inspect(response) : 'nothing in response');
      log.silly(!response && response.eventDataCollection ? util.inspect(response.eventDataCollection) : 'nothing in eventDataCollection');

      var keepRecordFilter = function (element) { if (keepTheRecord(element)) { result.push(element); }};
      __.each(response.eventDataCollection.value, keepRecordFilter);

      var nextLink = response.eventDataCollection.nextLink;
      while (nextLink) {
        log.silly('Following nextLink');
        response = client.eventOperations.listEventsNext(nextLink, _);
        __.each(response.eventDataCollection.value, keepRecordFilter);
        nextLink = response.eventDataCollection.nextLink;
      }
    } finally {
      progress.end();
    }

    insightsUtils.formatOutputList(cli, log, options, result);
  };
};
