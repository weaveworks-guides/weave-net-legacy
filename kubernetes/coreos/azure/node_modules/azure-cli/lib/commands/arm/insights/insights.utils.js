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
var profile = require('../../../util/profile');
var moment = require('moment');
var $ = utils.getLocaleString;

// 1 hour in milliseconds
var _defaultQueryTimeRange = 3600000;

// 15 days in milliseconds
var _maximumDateDifferenceAllowed = 15 * 24 * 3600000;

exports.selectedFields = 'Authorization,Caller,CorrelationId,EventSource,EventTimestamp,OperationName,ResourceGroupName,ResourceUri,Status,SubscriptionId,SubStatus';
exports.alertsEventSourceName = 'microsoft.insights/alertrules';
exports.autoscaleEventSourceName = 'microsoft.insights/autoscalesettings';

exports.defaultWindowSize = moment.duration('01:00:00');
exports.defaultTimeAggregationOperator = 'Average';

exports.minimumTimeGrain = moment.duration('00:01:00');
exports.minimumTimeWindow = moment.duration('00:05:00');

exports.defaultApiVersion = '2014-04-01';

exports.createInsightsManagementClient = function(log, options) {
  var subscription = profile.current.getSubscription(options.subscription);
  return utils.createInsightsManagementClient(subscription);
};

exports.createInsightsClient = function (log, options) {
  var subscription = profile.current.getSubscription(options.subscription);
  return utils.createInsightsClient(subscription);
};

// Pass-all filter
exports.passAllFilter = function () { return true; };

exports.addConditionIfPresent = function (currentQueryFilter, name, value) {
  if (value) {
    return util.format('%s and %s eq \'%s\'', currentQueryFilter, name, value);
  } else {
    return currentQueryFilter;
  }
};

exports.addMetricNamesFilter = function(metricNames) {
  var output = '';
  if (__.isString(metricNames)) {
    var clauses = [];
    var names = metricNames.split(',');
    __.each(names, function(name) { clauses.push('name.value eq \'' + name + '\''); });
    output = clauses.join(' or ');
  }

  return output;
};

exports.validateDateTimeRangeAndAddDefaultsEvents = function(startTime, endTime) {
  return _validateDateTimeRangeAndAddDefaults(startTime, endTime, 'eventTimestamp ge \'%s\' and eventTimestamp le \'%s\'');
};

exports.validateDateTimeRangeAndAddDefaultsMetrics = function(startTime, endTime) {
  return _validateDateTimeRangeAndAddDefaults(startTime, endTime, 'startTime eq %s and endTime eq %s');
};

function _validateDateTimeRangeAndAddDefaults(startTime, endTime, formatStr) {
  var endDateUtc = _validateEndDate(endTime);
  var startDateUtc = _validateStartDate(startTime, endDateUtc);

  _validateDateRange(startDateUtc, endDateUtc);

  return util.format(formatStr, startDateUtc.toISOString(), endDateUtc.toISOString());
}

// Validates the endTime parameter
function _validateEndDate(endTime) {
  var endDate = new Date();
  if (__.isString(endTime)) {
    var parsedEndDate = Date.parse(endTime);
    if (__.isNaN(parsedEndDate)) {
      throw new Error(util.format($('%s parameter is not a valid Date \"%s\"'), 'endTime', endTime));
    }

    endDate = new Date(parsedEndDate);
  }

  return endDate;
}

// Validates the startTime parameter
function _validateStartDate(startTime, endDate) {
  if (!__.isDate(endDate)) {
    throw new Error(util.format($('%s parameter is not a valid Date \"%s\"'), 'endDate', endDate));
  }

  var startDate = new Date(endDate.getTime() - _defaultQueryTimeRange);
  if (__.isString(startTime)) {
    var parsedStartDate = Date.parse(startTime);
    if (__.isNaN(parsedStartDate)) {
      throw new Error(util.format($('%s parameter is not a valid Date \"%s\"'), 'startDate', startTime));
    }

    startDate = new Date(parsedStartDate);
  }

  if (startDate > new Date()) {
    throw new Error($('Start date is later than Now'));
  }

  return startDate;
}

// Validates the date range
function _validateDateRange(startDate, endDate) {
  if (!__.isDate(endDate)) {
    throw new Error(util.format($('%s parameter is not a valid Date \"%s\"'), 'endDate', endDate));
  }

  if (!__.isDate(startDate)) {
    throw new Error(util.format($('%s parameter is not a valid Date \"%s\"'), 'startDate', startDate));
  }

  if (endDate < startDate) {
    throw new Error($('End date is earlier than start date'));
  }

  var difference = endDate - startDate;
  if (difference > _maximumDateDifferenceAllowed) {
    throw new Error(util.format($('Time range exceeds maximum allowed of %s days. Start date: %s, end date: %s'), _maximumDateDifferenceAllowed / (24 * 3600000),  startDate.toISOString(), endDate.toISOString()));
  }
}

// Validation of input TimeSpans in format hh:mm:ss
exports.validateTimeSpan = function(timeSpan) {
  return moment.duration(timeSpan);
};

exports.validateEnumerationParameter = function (inputValue, setOfValues, errorMessage) {
  var operatorTemp = '|' + inputValue.toLowerCase().replace('|', '') + '|';
  if (setOfValues.toLowerCase().search(operatorTemp) == -1) {
    throw new Error(util.format($(errorMessage), inputValue));
  }
};

function _padSpaces(tabs) {
  if (tabs > 0) {
    return '  ' + _padSpaces(tabs - 1);
  }

  return '';
}

// Shows the objects as lists of fieldName: fieldValue
// TODO: add details and better formatting to the deeper levels
exports.showObject = function(log, object, indentationTabs) {
  var tabs = __.isNumber(indentationTabs) ? indentationTabs : 0;
  var spaces = _padSpaces(tabs);
  var recursiveCaller = function (element) { exports.showObject(log, element, tabs + 1); };
  for (var propertyName in object) {
    if (__.isNull(object[propertyName]) || __.isUndefined(object[propertyName])) {
      log.data(spaces + propertyName + ':');
    } else if (__.isArray(object[propertyName])) {
      log.data(spaces + propertyName + ':');
      __.each(object[propertyName], recursiveCaller);
    } else if (!__.isFunction(object[propertyName])) { // Do not recurse if the object[propertyName] is a function
      if (object[propertyName].toIsoString !== undefined) { // Special case for TimeGrain objects returned by server
        log.data(spaces + propertyName + ': ' + object[propertyName].toIsoString());
      } else if (__.isObject(object[propertyName])) {
        log.data(spaces + propertyName + ':');
        exports.showObject(log, object[propertyName], tabs + 1);
      } else {
        log.data(spaces + propertyName + ': ' + object[propertyName]);
      }
    }
  }
};

exports.formatOutputList = function (cli, log, options, values) {
  log.silly(values !== undefined ? 'values is NOT undefined' : 'values is undefined');
  if (options.json) {
    cli.output.json(values);
  } else {
    var elementDisplayer = function(element) {
      exports.showObject(log, element);
      log.data('------------------------------------------------------------------------------------');
    };
    __.each(values, elementDisplayer);
  }
};

exports.formatOutput = function (cli, log, options, value) {
  log.silly(value !== undefined ? 'value is NOT undefined' : 'value is undefined');
  if (options.json) {
    cli.output.json(value);
  } else {
    exports.showObject(log, value);
  }
};
