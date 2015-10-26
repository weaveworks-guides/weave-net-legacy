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

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var insightsAutoscaleProfileCommand = cli.category('insights').category('autoscale').category('profile')
    .description($('Manages autoscale profiles'));

  insightsAutoscaleProfileCommand.command('set <profileType> <profileName> <defaultCapacity> <maximumCapacity> <minimumCapacity> <rules>')
    .description($('Create or set an autoscale profile.'))
    .usage('[options] <profileType> <profileName> <defaultCapacity> <maximumCapacity> <minimumCapacity> <rules>')

	  // Required
    .option('-y --profileType <profileType>', $('The type of the profile: NoSchedule, FixedDate, Recurrent (the value case insensitive)'))
	  .option('-n --profileName <profileName>', $('The name of the profile.'))
    .option('-d --defaultCapacity <defaultCapacity>', $('The default capacity of the profile.'))
    .option('-a --maximumCapacity <maximumCapacity>', $('The maximum capacity of the profile.'))
    .option('-m --minimumCapacity <minimumCapacity>', $('The minimum capacity of the profile.'))
    .option('-l --rules <rules>', $('The rules of the profile. A json string containing a listing of scale rules.'))

    // Optional fixed date schedule
    .option('-b --startTimeWindow <startTimeWindow>', $('The start time window of a fixed date schedule.'))
    .option('-e --endTimeWindow <endTimeWindow>', $('The end time window of a fixed date schedule.'))
    .option('-z --timeWindowTimeZone <timeWindowTimeZone>', $('The time window timezone of a fixed date schedule.'))

    // Optional recurrent schedule
    .option('-f --recurrenceFrequency <recurrenceFrequency>', $('The recurrence frequency of a recurrent schedule: None, Second, Minute, Hour, Day, Week, Month, Year (the value is case insensitive)'))
    .option('-g --scheduleDays <scheduleDays>', $('The list of schedule days a recurrent schedule. Values are comma-separated.'))
    .option('-o --scheduleHours <scheduleHours>', $('The list of schedule hours a recurrent schedule. Values are comma-separated.'))
    .option('-u --scheduleMinutes <scheduleMinutes>', $('The list of schedule minutes a recurrent schedule. Values are comma-separated.'))
    .option('-x --scheduleTimeZone <scheduleTimeZone>', $('The list of schedule timezone a recurrent schedule.'))

    .execute(function (profileType, profileName, defaultCapacity, maximumCapacity, minimumCapacity, rules, options, _) {
      log.silly('Unused callback: ' + _);
      insightsAutoscaleProfileCommand._executeEventsSetCmd(profileType, profileName, defaultCapacity, maximumCapacity, minimumCapacity, rules, options);
    });

  insightsAutoscaleProfileCommand._checkParameters = function (profileType, profileName, defaultCapacity, maximumCapacity, minimumCapacity, rules, options) {
    var profileTypeInternal = profileType.toLowerCase();
    if (profileTypeInternal === 'fixeddate') {
      if (!__.isString(options.startTimeWindow)) {
        cli.missingArgument('startTimeWindow');
      }

      if (!__.isString(options.endTimeWindow)) {
        cli.missingArgument('endTimeWindow');
      }

      if (!__.isString(options.timeWindowTimeZone)) {
        cli.missingArgument('timeWindowTimeZone');
      }
    } else if (profileTypeInternal === 'recurrent') {
      if (!__.isString(options.recurrenceFrequency)) {
        cli.missingArgument('recurrenceFrequency');
      }

      // Checking the value of options.recurrenceFrequency
      var recurrenceFrequency = '|' + options.recurrenceFrequency.toLowerCase().replace('|', '') + '|';
      if ('|none|second|minute|hour|day|week|month|year|'.search(recurrenceFrequency) === -1) {
        throw new Error(util.format($('Invalid recurrence frequency: %s'), options.recurrenceFrequency));
      }

      if (!__.isString(options.scheduleDays)) {
        cli.missingArgument('scheduleDays');
      }

      if (!__.isString(options.scheduleHours)) {
        cli.missingArgument('scheduleHours');
      }

      if (!__.isString(options.scheduleMinutes)) {
        cli.missingArgument('scheduleMinutes');
      }

      if (!__.isString(options.scheduleTimeZone)) {
        cli.missingArgument('scheduleTimeZone');
      }
    } else if (profileTypeInternal !== 'noschedule') {
      throw new Error(util.format($('Invalid profile type: %s'), profileType));
    }

    return profileTypeInternal;
  };

  insightsAutoscaleProfileCommand._processRules = function(rules) {
    var internalRules = JSON.parse(rules);

    // TODO: check that timeGrain, actionCooldown, and windowSize are durations in the right format.
    return internalRules;
  };

  insightsAutoscaleProfileCommand._executeEventsSetCmd = function (profileType, profileName, defaultCapacity, maximumCapacity, minimumCapacity, rules, options) {
    var profileTypeInternal = this._checkParameters(profileType, profileName, defaultCapacity, maximumCapacity, minimumCapacity, rules, options);
    
    log.silly(profileType);
    log.silly(profileTypeInternal);
    log.silly(profileName);
    log.silly(defaultCapacity);
    log.silly(maximumCapacity);
    log.silly(minimumCapacity);
    log.silly(rules);
    log.silly(util.inspect(options));

    var fixedDate = null;
    var recurrence = null;

    if (profileTypeInternal === 'recurrent') {
      recurrence = {
        frequency: options.recurrenceFrequency,
        schedule: {
          days: options.scheduleDays,
          hours: options.scheduleHours,
          minutes: options.scheduleMinutes,
          timeZone: options.scheduleTimeZone
        }
      };
    } else {
    // Object in fixedDate is TimeWindow 
      fixedDate = (profileTypeInternal === 'fixeddate') ? 
        {
          start: new Date(options.startTimeWindow),
          end: new Date(options.endTimeWindow),
          timeZone: options.timeWindowTimeZone
        } : 
        null;
    }

    var response = {
      name: profileName,
      capacity: {
        default: defaultCapacity,
        minimum: minimumCapacity,
        maximum: maximumCapacity
      },
      fixedDate: fixedDate,
      recurrence: recurrence,
      rules: this._processRules(rules)
    };

    if (options.json) {
      cli.output.json(response);
    } else {
      log.data(JSON.stringify(response));
    }
  };
};
