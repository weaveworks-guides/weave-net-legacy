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
  var insightsMetricDefinitionCommand = cli.category('insights').category('metrics').category('definition')
    .description($('Retrieve metric definitions for a resource'));

  insightsMetricDefinitionCommand.command('list <resourceId>')
      .description($('List metric definitions for a resource.'))
      .usage('[options] <resourceId>')
      .option('-i --resourceId <resourceId>', $('The resource Id.'))
      .option('-n --metricNames <metricNames>', $('The list of metric names.'))
      .option('-s --subscription <subscription>', $('The subscription identifier.'))
      .execute(function (resourceId, options, _) {
        insightsMetricDefinitionCommand._prepareAndExecute(resourceId, options, _);
      });

  insightsMetricDefinitionCommand._prepareAndExecute = function (resourceId, options, _) {
    log.silly(util.format('Parameters: resourceId=%s, metricNames=%s', resourceId, options.metricNames));
    if (!__.isString(resourceId)) {
      return cli.missingArgument('resourceId');
    }

    var client = insightsUtils.createInsightsClient(log, options);
    var queryFilter = insightsUtils.addMetricNamesFilter(options.metricNames);

    return this._executeCmd(client, resourceId, queryFilter, insightsUtils.passAllFilter, options, _);
  };

  insightsMetricDefinitionCommand._executeCmd = function (client, resourceId, queryFilter, keepTheRecord, options, _) {
    var progress = cli.interaction.progress(util.format($('Querying \"%s\"'), queryFilter));
    var result = [];
    try {
      var response = client.metricDefinitionOperations.getMetricDefinitions(resourceId, queryFilter, _);

      log.silly(!response ? util.inspect(response) : 'nothing in response');
      log.silly(!response && response.metricDefinitionCollection ? util.inspect(response.metricDefinitionCollection) : 'nothing in metricDefinitionCollection');

      __.each(response.metricDefinitionCollection.value, function (element) { if (keepTheRecord(element)) { result.push(element); }});
    } finally {
      progress.end();
    }

    insightsUtils.formatOutputList(cli, log, options, result);
  };
};