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

var streams = require('streamline/lib/streams/streams');
var util = require('util');

var profile = require('../../../util/profile');
var utils = require('../../../util/utils');

var groupUtils = require('./groupUtils');
var permissionsUtils = require('../role/permissionsUtils');
var rbacClients = require('../role/rbacClients');
var resourceUtils = require('../resource/resourceUtils');
var tagUtils = require('../tag/tagUtils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var group = cli.category('group')
    .description($('Commands to manage your resource groups'));

  group.command('create [name] [location]')
    .description($('Creates a new resource group'))
    .usage('[options] <name> <location>')
    .option('-n --name <name>', $('the resource group name'))
    .option('-l --location <location>', $('the location where we will create the group'))
    .option('-d --deployment-name <deployment-name>', $('the name of the deployment we will create (only valid when a template is used)'))
    .fileRelatedOption('-f --template-file <template-file>', $('the path to the template file in the file system'))
    .option('--template-uri <template-uri>', $('the uri to the remote template file'))
    .option('--template-version <template-version>', $('the content version of the template'))
    .option('-p --parameters <parameters>', $('a JSON-formatted string containing parameters'))
    .fileRelatedOption('-e --parameters-file <parametersFile>', $('a file containing parameters'))
    .option('-t --tags <tags>', $('Tags to set to the resource group. Can be multiple. ' +
            'In the format of \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, location, options, _) {
      var updatedGroup = group.createResourceGroup(name, location, options, _);
      showResourceGroup(updatedGroup);
    });

  group.command('set [name]')
    .description($('Set tags to a resource group'))
    .usage('[options] <name> <tags>')
    .option('-n --name <name>', $('the resource group name'))
    .option('-t --tags <tags>', $('Tags to set to the resource group. Can be multiple. ' +
          'In the format of \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
    .option('--no-tags', $('remove all existing tags'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      var updatedGroup = group.createResourceGroup(name, '', options, _);
      showResourceGroup(updatedGroup);
    });

  group.createResourceGroup = function (name, location, options, _) {
    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.createResourceClient(subscription);

    var existingGroup;

    cli.interaction.withProgress(util.format($('Getting resource group %s'), name),
      function (log, _) {
        existingGroup = groupUtils.getGroup(client, name, _);
      }, _);

    if (!location) {
      if (existingGroup) {
        location = existingGroup.location;
      }
      else {
        throw new Error('Please provide a location to create a resource group. ' +
          'You can run \'azure location list\' to get the list of valid locations for resource group.');
      }
    }

    var message = util.format($('Creating resource group %s'), name);
    var doneMessage = util.format($('Created resource group %s'), name);
    if (existingGroup) {
      message = util.format($('Updating resource group %s'), name);
      doneMessage = util.format($('Updated resource group %s'), name);
    }

    var tags = (existingGroup && existingGroup.tags) || {};
    tags = tagUtils.buildTagsParameter(tags, options);

    var group;
    cli.interaction.withProgress(message,
      function (log, _) {
        if (!existingGroup) {
          group = client.resourceGroups.createOrUpdate(name, {
            location: location,
            tags: tags
          }, _);
        } else {
          group = client.resourceGroups.patch(name, {
            location: location,
            tags: tags
          }, _);
        }

      }, _);

    log.info(doneMessage);

    if (options.templateFile || options.templateUri || options.deploymentName) {
      groupUtils.createDeployment(cli, name, options.deploymentName, options, _);
    }

    return group.resourceGroup;
  };

  group.command('delete [name]')
    .description($('Deletes a resource group'))
    .usage('[options] <name>')
    .option('-n --name <name>', $('the resource group name'))
    .option('-q, --quiet', $('quiet mode (do not ask for delete confirmation)'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete resource group %s? [y/n] '), name), _)) {
        return;
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);
      var progress = cli.interaction.progress(util.format($('Deleting resource group %s'), name));
      try {
        client.resourceGroups.deleteMethod(name, _);
      } finally {
        progress.end();
      }
    });

  group.command('list')
    .description($('Lists the resource groups for your subscription'))
    .option('-d, --details', $('show additional resource group details such as resources, permissions etc.'))
    .option('-t --tags <tags>', $('Tag to use to filter to the resource group. Can only take 1 tag. ' +
        'In the format of "name=value". Name is required and value is optional. ' +
        'For example, -t tag1 or -t tag1=value1.'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);
      var progress = cli.interaction.progress($('Listing resource groups'));
      var resourceGroups;
      var parameters = {};

      if (options.tags) {
        tagUtils.populateQueryFilterWithTagInfo(options.tags, parameters);
      }

      try {
        var response = client.resourceGroups.list(parameters, _);
        resourceGroups = response.resourceGroups;

        while(response.nextLink) {
          response = client.resourceGroups.listNext(response.nextLink, _);
          resourceGroups.contact(response.resourceGroups);
        }
      } finally {
        progress.end();
      }

      //TODO, remove when CSM implements service side filtering on resource groups
      if (parameters.tagName) {
        resourceGroups = resourceGroups.filter(function (element) {
          return (element.tags.hasOwnProperty(parameters.tagName)) &&
            (!parameters.tagValue || parameters.tagValue === element.tags[parameters.tagName]);
        });
      }

      if (options.details) {
        progress = cli.interaction.progress($('Listing resources for the groups'));
        try {
          var authzClient = rbacClients.getAuthzClient(subscription);
          for (var i in resourceGroups) {
            var resourceGroup = resourceGroups[i];
            resourceGroup.resources = client.resources.list({ resourceGroupName: resourceGroup.name }, _).resources;
            resourceGroup.permissions = authzClient.permissions.listForResourceGroup(resourceGroup.name, _).permissions;
          }
        } finally {
          progress.end();
        }
      }

      if (options.details) {
        resourceGroups.forEach(function (rg) {        
          formatResourcesForOutput(rg);
        });
      }

      cli.interaction.formatOutput(resourceGroups, function (data) {
        if (data.length === 0) {
          log.info($('No matched resource groups were found'));
        } else {
          if (options.details) {
            data.forEach(function (rg) {
              showResourceGroup(rg, true);
              log.data($(''));
            });
          } else {
            log.table(data, function (row, group) {
              row.cell($('Name'), group.name);
              row.cell($('Location'), group.location);
              row.cell($('Provisioning State'), group.provisioningState);
              row.cell($('Tags:'), tagUtils.getTagsInfo(group.tags));
            });
          }
        }
      });
    });

  group.command('show [name]')
    .description($('Shows a resource group for your subscription'))
    .usage('[options] <name>')
    .option('-n --name <name>', $('the resource group name'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);
      var authzClient = rbacClients.getAuthzClient(subscription);

      var progress = cli.interaction.progress($('Listing resource groups'));
      var resourceGroup;
      try {
        resourceGroup = client.resourceGroups.get(name, _).resourceGroup;
      } finally {
        progress.end();
      }

      // Get resources for the resource group
      progress = cli.interaction.progress($('Listing resources for the group'));
      try {
        resourceGroup.resources = client.resources.list({ resourceGroupName: name }, _).resources;
        resourceGroup.permissions = authzClient.permissions.listForResourceGroup(name, _).permissions;
      } finally {
        progress.end();
      }

      formatResourcesForOutput(resourceGroup);
      cli.interaction.formatOutput(resourceGroup, function (outputData) {
        showResourceGroup(outputData, true);
      });
    });

  function formatResourcesForOutput(resourceGroup) {
    if (resourceGroup.resources && resourceGroup.resources.length > 0) {
      resourceGroup.resources = resourceGroup.resources.map(function (r) {
        var resourceInformation = resourceUtils.getResourceInformation(r.id);
        var formattedResource = {
          id: r.id,
          name: resourceInformation.resourceName,
          type: resourceUtils.getResourceTypeName(resourceInformation.resourceType),
          location: r.location,
          tags: tagUtils.getTagsInfo(r.tags)
        };
        return formattedResource;
      });
    }
  }

  function showResourceGroup(resourceGroup, showDetail) {
    log.data($('Id:                 '), resourceGroup.id);
    log.data($('Name:               '), resourceGroup.name);
    log.data($('Location:           '), resourceGroup.location);
    log.data($('Provisioning State: '), resourceGroup.provisioningState);
    log.data(util.format($('Tags: %s'), tagUtils.getTagsInfo(resourceGroup.tags)));

    if (showDetail) {
      if (resourceGroup.resources && resourceGroup.resources.length > 0) {
        log.data($('Resources:'));
        log.data($(''));

        for (var i=0; i < resourceGroup.resources.length; i++) {
          var item = resourceGroup.resources[i];
          log.data($('  Id      :'), item.id);
          log.data($('  Name    :'), item.name);
          log.data($('  Type    :'), item.type);
          log.data($('  Location:'), item.location);
          log.data($('  Tags    :'), item.tags);
          log.data($(''));
        }
      } else {
        log.data($('Resources:  []'));
      }

      if (resourceGroup.permissions) {
        var permissionDetails = permissionsUtils.getPermissionDetails(resourceGroup.permissions);
        log.data($('Permissions:'));
        log.data($('  Actions: ') + permissionDetails.actions);
        log.data($('  NotActions: ') + permissionDetails.notActions);
      }
    }
    log.data('');
  }

  var grouplog = group.category('log')
    .description($('Commands to manage resource group logs'));

  var logReport = [
    [$('EventId'), 'eventDataId'],
    [
      $('Authorization'), 'authorization',
      [
        ['action', 'action'],
        ['role', 'role'],
        ['scope', 'scope']
      ]
    ],
    [$('ResourceUri'), 'resourceUri'],
    [$('SubscriptionId'), 'subscriptionId'],
    [$('EventTimestamp (UTC)'), 'eventTimestamp', log.report.asDate],
    [$('OperationName'), 'operationName.localizedValue'],
    [$('OperationId'), 'operationId'],
    [$('Status'), 'status.localizedValue'],
    [$('SubStatus'), 'subStatus.localizedValue'],
    [$('Caller'), 'caller'],
    [$('CorrelationId'), 'correlationId'],
    [$('Description'), 'description'],
    [$('HttpRequest'), 'httpRequest', log.report.allProperties],
    [$('Level'), 'level'],
    [$('ResourceGroup'), 'resourceGroupName'],
    [$('ResourceProvider'), 'resourceProviderName.localizedValue'],
    [$('EventSource'), 'eventSource.localizedValue'],
    [$('Properties'), 'properties', log.report.allProperties]
  ];

  grouplog.command('show [name]')
    .description($('Retrieves and shows logs for resource group operations'))
    .option('-n --name <name>', $('the resource group name'))
    .option('-a --all', $('returns logs for all operations (including CRUD and deployment)'))
    .option('-l --last-deployment', $('returns logs for the last deployment'))
    .option('-d --deployment <name>', $('the name of the deployment whose logs you want to see'))
    .option('-s --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      if (!name) {
        return cli.missingArgument('name');
      }

      if ([options.all, options.lastDeployment, options.deployment].filter(function (opt) { return opt; }).length > 1) {
        throw new Error($('Must specify only one of --all, --last-deployment, or --deployment switches'));
      }

      var subscription = profile.current.getSubscription(options.subscription);

      var progress = cli.interaction.progress($('Getting group logs'));
      function endProgress() {
        if (progress) {
          progress.end();
          progress = null;
        }
      }

      var logStream;

      if (options.all) {
        logStream = groupUtils.getAllEvents(subscription, name);
      } else if (options.deployment) {
        logStream = groupUtils.getDeploymentLog(subscription, name, options.deployment);
      } else {
        logStream = groupUtils.getLastDeploymentLog(subscription, name);
      }

      logStream = new streams.ReadableStream(logStream);

      var logEntry = logStream.read(_);
      endProgress();

      var isJson = cli.output.format().json;
      var logEntrySet = [];

      while (logEntry !== null) {
        if (isJson) {
          logEntrySet.push(logEntry);
        } else {
          log.data('----------');
          log.report(logReport, logEntry);
        }
        logEntry = logStream.read(_);
      }

      if (isJson && logEntrySet.length > 0) {
        cli.output.json(logEntrySet);
      }
    });
};


