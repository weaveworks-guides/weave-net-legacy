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
  var insightsUsageCommand = cli.category('insights').category('usage')
    .description($('Retrieve usage metrics for a resource.'));

  insightsUsageCommand.command('list <resourceId>')
      .description($('List usage metrics for a resource.'))
      .usage('[options] <resourceId>')
      .option('-p --ApiVersion <apiVersion>', $('The underlying resource provider API version.'))
      .option('-n --metricNames <metricNames>', $('The list of metric names.'))
      .option('-b --startTime <startTime>', $('The start time of the query.'))
      .option('-e --endTime <endTime>', $('The end time of the query.'))
      .option('-s --subscription <subscription>', $('The subscription identifier.'))
      .execute(function (resourceId, options, _) {
        insightsUsageCommand._prepareAndExecute(resourceId, options, _);
      });

  insightsUsageCommand._processGeneralParameters = function (metricNames, startTime, endTime) {
    var clauses = [];
    var nameClauses = insightsUtils.addMetricNamesFilter(metricNames);

    if (__.isString(nameClauses) && nameClauses !== '') {
      clauses.push(nameClauses);
    }

    clauses.push(insightsUtils.validateDateTimeRangeAndAddDefaultsMetrics(startTime, endTime));

    return clauses.join(' and ');
  };

  insightsUsageCommand._prepareAndExecute = function (resourceId, options, _) {
    if (!__.isString(resourceId)) {
      cli.missingArgument(resourceId);
    }

    var client = insightsUtils.createInsightsClient(log, options);
    var queryFilter = this._processGeneralParameters(options.metricNames, options.startTime, options.endTime);
    var apiVersion = options.apiVersion ? options.apiVersion : insightsUtils.defaultApiVersion;

    this._executeEventsCmd(client, resourceId, queryFilter, apiVersion, options, _);
  };

  insightsUsageCommand._executeEventsCmd = function (client, resourceId, queryFilter, apiVersion, options, _) {
    var progress = cli.interaction.progress(util.format($('Querying \"%s\"'), queryFilter));
    var result = [];
    try {
      var response = client.usageMetricOperations.list(resourceId, queryFilter, apiVersion, _);

      log.silly(__.isObject(response) ? util.inspect(response) : 'nothing in response');
      log.silly(__.isObject(response) && response.usageMetricCollection ? util.inspect(response.usageMetricCollection) : 'nothing in usageMetricCollection');

      var recordFilter = function (element) { if (insightsUtils.passAllFilter(element)) { result.push(element); } };
      __.each(response.usageMetricCollection.value, recordFilter);
    } finally {
      progress.end();
    }

    insightsUtils.formatOutputList(cli, log, options, result);
  };
};
