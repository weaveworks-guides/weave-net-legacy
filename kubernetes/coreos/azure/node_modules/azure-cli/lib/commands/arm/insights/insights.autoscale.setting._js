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
  var insightsAutoscaleSettingCommand = cli.category('insights').category('autoscale').category('setting')
    .description($('Manages autoscale settings'));

  insightsAutoscaleSettingCommand.command('list <resourceGroup>')
    .description($('List autoscale settings for a resource.'))
    .usage('[options] <resourceGroup>')
    .option('-g --resourceGroup <resourceGroup>', $('The resource group.'))
    .option('-n --settingName <settingName>', $('The name of the setting.'))
    .execute(function (resourceGroup, options, _) {
      insightsAutoscaleSettingCommand._prepareAndExecute(resourceGroup, options, _);
    });

  insightsAutoscaleSettingCommand.command('delete <resourceGroup> <settingName>')
    .description($('Deletes an autoscale setting.'))
    .usage('[options] <resourceGroup> <settingName>')
    .option('-g --resourceGroup <resourceGroup>', $('The resource group.'))
    .option('-n --settingName <settingName>', $('The name of the setting.'))
    .execute(function (resourceGroup, settingName, options, _) {
      insightsAutoscaleSettingCommand._prepareAndExecuteDelete(resourceGroup, settingName, options, _);
    });

  insightsAutoscaleSettingCommand.command('set <resourceGroup>')
    .description($('Create or set an autoscale setting.'))
    .usage('[options] <resourceGroup>')

    // Common optional
    .option('-x --disable', $('Flag to disable the setting.'))
    .option('-a --autoProfiles <autoProfiles>', $('A list of autoscale profiles in JSON format.'))

    // Common required
    .option('-g --resourceGroup <resourceGroup>', $('The resource group.'))

    // Required for creation
    .option('-n --settingName <settingName>', $('The name of the setting.'))
    .option('-l --location <location>', $('The location.'))
    .option('-i --targetResourceId <targetResourceId>', $('The resource Id.'))

    // Required for update
    .option('-p --settingSpec <settingSpec>', $('The setting spec in JSON format.'))

    .execute(function (resourceGroup, options, _) {
      insightsAutoscaleSettingCommand._prepareAndExecuteSet(resourceGroup, options, _);
    });

  insightsAutoscaleSettingCommand._prepareAndExecute = function (resourceGroup, options, _) {
    if (!__.isString(resourceGroup)) {
      cli.missingArgument('resourceGroup');
    }

    var client = insightsUtils.createInsightsManagementClient(log, options);

    this._executeCmd(client, resourceGroup, options.settingName, options, _);
  };

  insightsAutoscaleSettingCommand._prepareAndExecuteDelete = function (resourceGroup, settingName, options, _) {
    if (!__.isString(resourceGroup)) {
      cli.missingArgument('resourceGroup');
    }

    if (!__.isString(settingName)) {
      cli.missingArgument('settingName');
    }

    var client = insightsUtils.createInsightsManagementClient(log, options);

    this._executeDeleteCmd(client, resourceGroup, settingName, options, _);
  };

  insightsAutoscaleSettingCommand._prepareAndExecuteSet = function (resourceGroup, options, _) {
    var client = insightsUtils.createInsightsManagementClient(log, options);
    var parameters = this._createSdkCallParameters(options.settingName, options.location, resourceGroup, options.targetResourceId, options);
    log.silly(util.inspect(parameters));

    this._executeSetCmd(client, resourceGroup, options.settingName, parameters, options, _);
  };

  function processRule(rule) {
    if (rule.metricTrigger) {
      var trigger = rule.metricTrigger;
      trigger.timeGrain = insightsUtils.validateTimeSpan(trigger.timeGrain);
      if (trigger.timeWindow) {
        trigger.timeWindow = insightsUtils.validateTimeSpan(trigger.timeWindow);
      }
    } else {
      throw new Error($('Rule missing metricTrigger.'));
    }

    if (rule.scaleAction) {
      var scaleAction = rule.scaleAction;
      scaleAction.cooldown = insightsUtils.validateTimeSpan(scaleAction.cooldown);
    } else {
      throw new Error($('Rule missing scaleAction.'));
    }
  }

  function processProfile(profile) {
    var rules = profile.rules;
    if (__.isArray(rules)) {
      __.each(rules, processRule);
    } else {
      throw new Error($('Invalid rules parameters, array expected.'));
    }
  }

  insightsAutoscaleSettingCommand._processProfiles = function (autoProfiles) {
    if (autoProfiles) {
      var internalProfiles = JSON.parse(autoProfiles);
      if (__.isArray(internalProfiles)) {
        __.each(internalProfiles, processProfile);
        return internalProfiles;
      } else {
        throw new Error($('Invalid profiles argument: array expected.'));
      }
    } else {
      return null;
    }
  };

  insightsAutoscaleSettingCommand._createSdkCallParameters = function(settingName, location, resourceGroup, targetResourceId, options) {
    if (!__.isString(resourceGroup)) {
      return cli.missingArgument('resourceGroup');
    }

    var enableSetting = !options.disable;
    var locationInternal = location;
    var nameInternal = settingName;
    var targetResourceIdInternal = targetResourceId;

    // Handle the input list of profiles.
    // The list must be in JSON format. Example: [{\"field1\":....}, {\"field2\": ...}] is an array of two objects
    var autoscaleProfilesInternal = this._processProfiles(options.autoProfiles);

    if (options.settingSpec) {
      // This is intended to be an update
      var settingSpec = JSON.parse(options.settingSpec);
      var property = settingSpec.properties;

      if (!property) {
        throw new Error($('Properties in settingSpec cannot be null.'));
      }

      locationInternal = settingSpec.location;
      nameInternal = settingSpec.name;

      // The semantics is if AutoscaleProfiles is given it will replace the existing Profiles
      autoscaleProfilesInternal = __.isArray(autoscaleProfilesInternal) ? autoscaleProfilesInternal : property.profiles;
      targetResourceIdInternal = property.targetResourceUri;

      enableSetting = !options.disable && property.enabled;
    } else {
      // This is a create
      if (!__.isString(settingName)) {
        return cli.missingArgument('settingName');
      }

      if (!__.isString(location)) {
        return cli.missingArgument('location');
      }

      if (!__.isString(targetResourceId)) {
        return cli.missingArgument('targetResourceId');
      }
    }

    return {
      location: locationInternal,
      properties: {
        name: nameInternal,
        enabled: enableSetting,
        profiles: autoscaleProfilesInternal,
        targetResourceUri: targetResourceIdInternal
      },
      tags: options.settingSpec ? options.settingSpec.tags : null
    };
  };

  insightsAutoscaleSettingCommand._executeCmd = function (client, resourceGroup, settingName, options, _) {
    var progress = cli.interaction.progress($('Querying for autoscale settings'));
    var result = [];
    var response;
    try {
      if (__.isNull(settingName) || __.isUndefined(settingName) || (__.isString(settingName) && settingName === '')) {
        log.silly('Query by resourceGroup only');
        response = client.autoscaleOperations.listSettings(resourceGroup, null, _);

        log.silly(!response ? util.inspect(response) : 'nothing in response');
        log.silly(!response && response.autoscaleSettingResourceCollection ? util.inspect(response.autoscaleSettingResourceCollection) : 'nothing in autoscaleSettingResourceCollection');

        // TODO add the detailed output functionality (null parameter for the moment)
        __.each(response.autoscaleSettingResourceCollection.value, function (element) { result.push(element); });
      } else {
        log.silly('Query by setting name');
        response = client.autoscaleOperations.getSetting(resourceGroup, settingName, _);

        log.silly(!response ? util.inspect(response) : 'nothing in response');

        // TODO add the detailed output functionality (null parameter for the moment)
        result.push(response);
      }
    } finally {
      progress.end();
    }  

    insightsUtils.formatOutputList(cli, log, options, result);
  };

  insightsAutoscaleSettingCommand._executeDeleteCmd = function (client, resourceGroup, settingName, options, _) {
    var progress = cli.interaction.progress(utils.format($('Deleting autoscale setting \"%s\"'), settingName));
    var response = null;
    try {
      response = client.autoscaleOperations.deleteSetting(resourceGroup, settingName, _);

      log.silly(!response ? util.inspect(response) : 'nothing in response');
    } finally {
      progress.end();
    }  
    
    insightsUtils.formatOutput(cli, log, options, response); 
  };

  insightsAutoscaleSettingCommand._executeSetCmd = function (client, resourceGroup, settingName, parameters, options, _) {
    var progress = cli.interaction.progress(util.format($('Create or set the autoscale setting \"%s\".'), settingName));
    var response = null;
    try {
      response = client.autoscaleOperations.createOrUpdateSetting(resourceGroup, settingName, parameters, _);
    } finally {
      progress.end();
    }

    insightsUtils.formatOutput(cli, log, options, response);
  };
};
