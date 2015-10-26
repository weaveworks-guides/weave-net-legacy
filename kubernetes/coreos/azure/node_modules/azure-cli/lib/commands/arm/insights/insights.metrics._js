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
  var insightsCommand = cli.category('insights');

  var insightsMetricsCommand = insightsCommand.category('metrics')
    .description($('Retrieve metrics values resource'))
    .command('list <resourceId> <timeGrain>')
      .description($('List metric values for a resource.'))
      .usage('[options] <resourceId> <timeGrain>')
      .option('-i --resourceId <resourceId>', $('The resource Id.'))
      .option('-t --timeGrain <timeGrain>', $('The time grain. Expected format hh:mm:ss.'))
      .option('-b --startTime <startTime>', $('The start time of the query.'))
      .option('-e --endTime <endTime>', $('The end time of the query.'))
      .option('-n --metricNames <metricNames>', $('The list of metric names.'))
      .option('-s --subscription <subscription>', $('The subscription identifier.'))
      .execute(function (resourceId, timeGrain, options, _) {
        insightsMetricsCommand._prepareAndExecute(resourceId, timeGrain, options, _);
      });

  insightsMetricsCommand._processGeneralParameters = function (startTime, endTime, timeGrain, metricNames) {
    var clauses = [];
    var nameClauses = insightsUtils.addMetricNamesFilter(metricNames);

    if (__.isString(nameClauses) && nameClauses !== '') {
      clauses.push(nameClauses);
    }

    log.silly(timeGrain);
    if (__.isString(timeGrain)) {
      clauses.push(util.format('timeGrain eq duration\'%s\'', insightsUtils.validateTimeSpan(timeGrain).toIsoString()));
    }

    clauses.push(insightsUtils.validateDateTimeRangeAndAddDefaultsMetrics(startTime, endTime));

    return clauses.join(' and ');
  };

  insightsMetricsCommand._prepareAndExecute = function (resourceId, timeGrain, options, _) {
    log.silly(util.format('Parameters: resourceId=%s, timeGrain=%s, startTime=%s, endTime=%s, metricNames=%s', resourceId, timeGrain, options.startTime, options.endTime, options.metricNames));
    if (!__.isString(resourceId)) {
      return cli.missingArgument('resourceId');
    }

    if (!__.isString(timeGrain)) {
      return cli.missingArgument('timeGrain');
    }

    var client = insightsUtils.createInsightsClient(log, options);
    var queryFilter = this._processGeneralParameters(options.startTime, options.endTime, timeGrain, options.metricNames);

    return this._executeCmd(client, resourceId, queryFilter, insightsUtils.passAllFilter, options, _);
  };

  insightsMetricsCommand._executeCmd = function (client, resourceId, queryFilter, keepTheRecord, options, _) {
    var progress = cli.interaction.progress(util.format($('Querying \"%s\"'), queryFilter));
    var result = [];
    try {
      var response = client.metricOperations.getMetrics(resourceId, queryFilter, _);

      log.silly(!response ? util.inspect(response) : 'nothing in response');
      log.silly(!response && response.metricCollection ? util.inspect(response.metricCollection) : 'nothing in metricCollection');

      __.each(response.metricCollection.value, function (element) { if (keepTheRecord(element)) { result.push(element); }});
    } finally {
      progress.end();
    }

    insightsUtils.formatOutputList(cli, log, options, result);
  };
};