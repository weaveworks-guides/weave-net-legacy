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
  var insightsAutoscaleRulesCommand = cli.category('insights').category('autoscale').category('rule')
    .description($('Manages autoscale rules'));

  // ** Defining the commands for this category
  insightsAutoscaleRulesCommand.command('set <metricName> <metricResourceId> <conditionOperatorType> <metricStatisticType> <threshold> <timeGrain> <actionCooldown> <actionDirection> <actionType> <scaleValue>')
    .description($('Create or set an autoscale rule.'))
    .usage('[options] <metricName> <metricResourceId> <conditionOperatorType> <metricStatisticType> <threshold> <timeGrain> <actionCooldown> <actionDirection> <actionType> <scaleValue>')

    .option('-m --metricName <metricName>', $('The metric name.'))
    .option('-i --metricResourceId <metricResourceId>', $('The resource Id.'))
    .option('-o --conditionOperatorType <conditionOperatorType>', $('The condition operator: Equals, NotEquals, GreaterThan, GreaterThanOrEqual, LessThan, LessThanOrEqual. The value is case insensitive.'))
    .option('-r --metricStatisticType <metricStatisticType>', $('The metric statistic type: Average, Min, Max, Sum. The value is case insensitive.'))
    .option('-t --threshold <threshold>', $('The threshold.'))
    .option('-n --timeGrain <timeGrain>', $('The time grain. Expected format hh:mm:ss.'))
    .option('-c --actionCooldown <actionCooldown>', $('The scale action cooldown time. Expected format hh:mm:ss.'))
    .option('-d --actionDirection <actionDirection>', $('The scale action direction: None, Increase, Decrease. The value is case insensitive.'))
    .option('-y --actionType <actionType>', $('The scale action type name: ChangeSize, ChangeCount, PercentChangeCount, ExactCount. The value is case insensitive.'))
    .option('-l --scaleValue <scaleValue>', $('The scale action value.'))

    // Optional
    .option('-a --timeAggregationOperator <timeAggregationOperator>', $('The time aggregation operator: Average, Minimum, Maximum, Total. The value is case insensitive.'))
    .option('-w --windowSize <windowSize>', $('The time window size. Expected format hh:mm:ss.'))

    .execute(function (metricName, metricResourceId, conditionOperatorType, metricStatisticType, threshold, timeGrain, actionCooldown, actionDirection, actionType, scaleValue, options) {
      insightsAutoscaleRulesCommand._executeSetCmd(metricName, metricResourceId, conditionOperatorType, metricStatisticType, threshold, timeGrain, actionCooldown, actionDirection, actionType, scaleValue, options);
    });

  // *** The execute cmd functions
  insightsAutoscaleRulesCommand._executeSetCmd = function (metricName, metricResourceId, conditionOperatorType, metricStatisticType, threshold, timeGrain, actionCooldown, actionDirection, actionType, scaleValue, options) {
    log.silly(metricName);
    log.silly(metricResourceId);
    log.silly(conditionOperatorType);
    log.silly(metricStatisticType);
    log.silly(threshold);
    log.silly(timeGrain);
    log.silly(actionCooldown);
    log.silly(actionDirection);
    log.silly(actionType);
    log.silly(scaleValue);
    log.silly(util.inspect(options));
    
    // The framework checks the presence of mandatory parameters, and they are always strings 
    // Checking parameters values and setting default values for optionals
    insightsUtils.validateEnumerationParameter(conditionOperatorType, '|equals|notequals|greaterthan|greaterthanorequal|lessthan|lessthanorequal|', 'Invalid condition operator: %s');
    insightsUtils.validateEnumerationParameter(metricStatisticType, '|average|min|max|sum|', 'Invalid metric statistics type: %s');
    threshold = parseFloat(threshold);
    timeGrain = insightsUtils.validateTimeSpan(timeGrain);

    if (timeGrain < insightsUtils.minimumTimeGrain) {
      throw new Error(util.format($('TimeGrain %s is shorter than the minimum allowed %s'), timeGrain, insightsUtils.minimumTimeGrain.toIsoString()));
    }

    actionCooldown = insightsUtils.validateTimeSpan(actionCooldown);
    insightsUtils.validateEnumerationParameter(actionDirection, '|none|increase|decrease|', 'Invalid scale action direction: %s');
    insightsUtils.validateEnumerationParameter(actionType, '|changesize|changecount|percentchangecount|exactcount|', 'Invalid scale action type: %s');

    // Optional
    if (!__.isString(options.timeAggregationOperator)) {
      options.timeAggregationOperator = insightsUtils.defaultTimeAggregationOperator;
    } else {
      insightsUtils.validateEnumerationParameter(options.timeAggregationOperator, '|average|minimum|maximum|total|', 'Invalid time aggregation operator: %s');
    }

    if (!__.isString(options.timeWindow)) {
      options.timeWindow = insightsUtils.minimumTimeWindow;
    } else {
      options.timeWindow = insightsUtils.validateTimeSpan(options.timeWindow);
      if (options.TimeWindow < insightsUtils.minimumTimeWidow) {
        throw new Error(util.format($('TimeWindow %s is shorter than the minimum allowed %s'), options.timeWindow, insightsUtils.minimumTimeWindow.toIsoString()));
      }
    }

    // Object creation
    var trigger = {
      metricName: metricName,
      metricResourceUri: metricResourceId,
      operator: conditionOperatorType,
      statistic: metricStatisticType,
      threshold: threshold,
      timeAggregation: options.timeAggregationOperator,
      timeGrain: timeGrain.toIsoString(),
      timeWindow: options.timeWindow.toIsoString()
    };

    var action = {
      cooldown: actionCooldown.toIsoString(),
      direction: actionDirection,
      type: actionType,
      value: scaleValue
    };

    var response = {
      metricTrigger: trigger,
      scaleAction: action
    };

    // Output setting
    if (options.json) {
      cli.output.json(response);
    } else {
      log.data(JSON.stringify(response));
    }
  };
};
