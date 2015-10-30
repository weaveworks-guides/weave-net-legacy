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
var fs = require('fs');
var util = require('util');

var azureSdkStream = require('./lib/azureSdkStream');
var deployLib = require('./lib/deployLib');
var deployTracker = require('./lib/deployTracker');
var propertyPrompts = require('./lib/propertyPrompts');
var profile = require('../../../util/profile');
var utils = require('../../../util/utils');
var validation = require('../../../util/validation');

var $ = utils.getLocaleString;

exports.init = function initApiAppCommands(cli) {
  var log = cli.output;

  var apiapp = cli.category('apiapp')
    .description($('Commands to manage ApiApps'));

  apiapp.command('list [resource-group]')
    .description($('List currently deployed ApiApps in a subscription or resource group'))
    .option('-g --resource-group <resource-group>', $('the resource group name, if not given list all ApiApps in subscription'))
    .option('-s --subscription <subscription>', $('The subscription identifier'))
    .option('-d --detailed', $('Include ApiApp package version and auth setting (call will be slower)'))
    .execute(function (resourceGroup, options, _) {
      options = options || {};
      var subscription = profile.current.getSubscription(options.subscription);
      var client = createApiAppClient(subscription);
      var resourceClient = createResourceClient(subscription);

      var apiApps = cli.interaction.withProgress($('Listing ApiApps'),
        function (log, _) {
          var groups = [];
          if (!resourceGroup) {
            groups = azureSdkStream.toArray(resourceClient.resourceGroups.listStream(), _)
              .map(function (g) { return g.name; });
          } else {
            groups = [resourceGroup];
          }
          return __.flatten(groups.map_(_, function(_, group) {
            return azureSdkStream.toArray(client.apiApps.listStream(group, options.detailed ? 'detail' : 'basic'), _);
          }));
        },
      _);

      cli.interaction.formatOutput(apiApps, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Resource Group'), resourceGroupFromId(item.id));
            row.cell($('Name'), item.name);
            row.cell($('Package Id'), item.package.id);
            if (options.detailed) {
              row.cell($('Version'), item.package.version);
              row.cell($('Auth'), item.accessLevel);
            }
            row.cell($('Url'), item.api.endpoint || $('[Codeless]'));
          });
        } else {
          log.info($('No ApiApps found.'));
        }
      });
    });

  apiapp.command('show [resource-group] [name]')
    .description($('Get detailed information about a deployed ApiApp'))
    .option('-g --resource-group <resource-group>', $('Name of the resource group containing the ApiApp'))
    .option('-n --name <name>', $('Name of the ApiApp'))
    .option('-s --subscription <subscription>', $('The subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      options = options || {};
      var subscription = profile.current.getSubscription(options.subscription);

      var client = createApiAppClient(subscription);
      var response = cli.interaction.withProgress($('Getting ApiApp'),
        function (log, _) {
          return client.apiApps.get(resourceGroup, name, _);
        }, _);

      var apiAppReportFormat = [
        [$('Name'), 'name'],
        [$('Location'), 'location'],
        [$('Resource Group'), 'id', function () { return resourceGroup; }],
        [$('Package Id'), 'package.id'],
        [$('Package Version'), 'package.version'],
        [$('Update Policy'), 'updatePolicy'],
        [$('Access Level'), 'accessLevel'],
        [$('Hosting site name'), 'host.resourceName'],
        [$('Gateway name'), 'gateway.resourceName']
      ];

      cli.interaction.formatOutput(response.apiApp, function (data) {
        log.report(apiAppReportFormat, data);
      });
    });

  apiapp.command('create [resource-group] [name] [plan]')
    .description($('Create a new ApiApp instance'))
    .option('-n --name <name>', $('Name of the ApiApp instance'))
    .option('-g --resource-group <resource-group>', $('Name of the resource group'))
    .option('-p --plan <plan>', $('Name or Resource Id of the App Service Plan to use'))
    .option('-u --nuget-package <package>', $('Package name and version to deploy (optional)'))
    .option('--parameters <parameters>', $('A JSON-formatted string containing parameters'))
    .option('--parameters-file <parametersFile>', $('A file containing parameters in JSON format'))
    .option('-s --subscription <subscription>', $('The subscription identifier'))
    .option('--nowait', $('Do not wait for the deployment to complete'))
    .execute(function (resourceGroup, name, plan, options, _) {
      options = options || {};

      // Normalize options object for positional and flag arguments
      var normalizedParameters = utils.normalizeParameters({
        resourceGroup: [resourceGroup, options.resourceGroup],
        name: [name, options.name],
        plan: [plan, options.plan]
      });

      if (normalizedParameters.err) {
        throw normalizedParameters.err;
      }

      __.extend(options, normalizedParameters.values);

      validation.validateArgs('apiapp create', function (v) {
        v.string(options.resourceGroup, 'resourceGroup');
        v.string(options.plan, 'plan');
      });

      if (options.name) {
        var message = deployLib.validateApiAppName(options.name);
        if (!!message) {
          throw new Error(util.format($('Invalid ApiApp Name: %s'), message));
        }
      }

      if (!options.nugetPackage) {
        options.nugetPackage = 'Microsoft.ApiApp';
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var packageInfo = parsePackageName(options.nugetPackage);
      var resourceClient = utils.createResourceClient(subscription);

      cli.interaction.withProgress($('Checking resource group and app service plan'),
        function (log, _) {

          if (!resourceClient.resourceGroups.checkExistence(options.resourceGroup, _)) {
            throw new Error(util.format($('The resource group %s does not exist'), options.resourceGroup));
          }

          var hostingPlanResource = getHostingPlanResource(resourceClient, options.resourceGroup, options.plan, _);
          if (!hostingPlanResource) {
            throw new Error(util.format($('The app service plan \'%s\' does not exist'),
              options.plan));
          }
          options.location = hostingPlanResource.location;
          options.plan = hostingPlanResource.id;
        }, _);

      var prompter =
        objectPrompter(options) ||
        filePrompter(options, _) ||
        interactivePrompter(options, cli.interaction);

      var deployer = new deployLib.ApiAppDeployer({
        subscription: subscription,
        name: options.name,
        resourceGroup: options.resourceGroup,
        location: options.location,
        package: packageInfo,
        tags: options.tags,
        hostingPlanId: options.plan,
        valueProvider: prompter,
        withProgress: cli.interaction.withProgress.bind(cli.interaction)
      });

      var deployment = deployer.doDeployment(_);

      if (!options.noWait) {
        var finalResult = cli.interaction.withProgress($('Waiting for deployment completion'),
          function(l, _) {
            var progress = this;
            var finalResult = {
              operations: []
            };

            var tracker = deployTracker.create(resourceClient, options.resourceGroup, deployment.name);
            tracker.on('start', function (err, deployment) {
              finalResult.startDeployment = deployment;
              if (!log.format().json) {
                progress.write(function () {
                  log.info($('Deployment started:'));
                  log.report([
                    [$('Subscription Id'), 'subscription'],
                    [$('Resource Group'), 'resourceGroup'],
                    [$('Deployment Name'), 'name'],
                    [$('Correlation Id'), 'correlationId'],
                    [$('Timestamp'), 'timestamp']
                  ], {
                    subscription: subscription.id,
                    resourceGroup: options.resourceGroup,
                    name: deployment.name,
                    correlationId: deployment.properties.correlationId,
                    timestamp: deployment.properties.timestamp
                  });

                  log.data('');
                  log.data(util.format($('%s %s %s %s'),
                    padRight($('Operation'), 19),
                    padRight($('State'), 13),
                    padRight($('Status'), 13),
                    padRight($('Resource'), 50)));
                  log.data(util.format('%s %s %s %s', fill('-', 19), fill('-', 13), fill('-', 13), fill('-', 50)));
                });
              }
            });

            tracker.on('operation', function (err, op) {
              finalResult.operations.push(op);
              if (!log.format().json) {
                progress.write(function () {
                  log.data(util.format($('%s %s %s %s'),
                    padRight(op.operationId, 19),
                    padRight(op.properties.provisioningState, 13),
                    padRight(op.properties.statusCode, 13),
                    op.properties.targetResource.id));
                });
              }
            });

            finalResult.finalDeployment = waitForDeploymentDone(tracker, _);
            return finalResult;
          }, _);

        cli.interaction.formatOutput(finalResult, function (data) {
          log.info('Deployment complete with status:', data.finalDeployment.properties.provisioningState);
        });

        if (finalResult.finalDeployment.properties.provisioningState !== 'Succeeded') {
          throw new Error(util.format(
            $('Deployment id %s failed with status %s'),
            finalResult.finalDeployment.id,
            finalResult.finalDeployment.properties.provisioningState));
        }
      } else {
        cli.interaction.formatOutput(deployment, function (data) {
          log.info(util.format($('Created apiapp deployment in resource group %s using deployment named %s'), options.resourceGroup, data.name));
          log.info(util.format($('use \'azure group deployment show %s %s\' to monitor the deployment status'), options.resourceGroup, data.name));
        });
      }
    });
};

function waitForDeploymentDone(tracker, done) {
  var doneOnce = __.once(done);
  tracker.on('error', doneOnce);
  tracker.on('done', doneOnce);
}

function resourceGroupFromId(id) {
  var re = /^\/subscriptions\/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\/resourcegroups\/([^/]+)\//;
  var match = id.match(re);
  if (match) {
    return match[1];
  }

  return 'Unknown';
}

function parsePackageName(packageName) {
  if (utils.stringIsNullOrEmpty(packageName)) {
    return null;
  }

  var result = {
    fullName: packageName,
    id: packageName
  };

  var versionStartRe = /\.\d+\./;
  var match = packageName.match(versionStartRe);
  if (match !== null) {
    // we have a version, extract it
    result.version = packageName.slice(match.index + 1);
    result.id = packageName.slice(0, match.index);
  }
  return result;
}

function objectPrompter(options) {
  if (options.parameters) {
    var parameterValues = JSON.parse(options.parameters);
    if (options.name) {
      parameterValues.$apiAppName = options.name;
    }
    return propertyPrompts.object(parameterValues);
  }
  return null;
}

function filePrompter(options, _) {
  if (options.parametersFile) {
    var buffer = fs.readFile(options.parametersFile, _);
    var parameterValues = JSON.parse(buffer.toString().trim());
    if (options.name) {
      parameterValues.$apiAppName = options.name;
    }
    return propertyPrompts.object(parameterValues);
  }
  return null;
}

function interactivePrompter(options, interaction) {
  var corePrompter = propertyPrompts.interactive(interaction);
  if (options.name) {
    return function(parameterInfo, done) {
      if (parameterInfo.name === '$apiAppName') {
        return done(null, options.name);
      }
      return corePrompter(parameterInfo, done);
    };
  }
  return corePrompter;
}

function getHostingPlanResource(client, resourceGroup, planId, _) {
  var planName;

  var idRe = /\/resourceGroups\/([^\/]+)\/providers\/Microsoft.Web\/serverFarms\/(.+)$/i;
  var match = planId.match(idRe);
  if (!match) {
    planName = planId;
  } else {
    resourceGroup = match[1];
    planName = match[2];
  }

  try {
    var response = client.resources.get(resourceGroup, {
      resourceName: planName,
      resourceType: 'serverFarms',
      resourceProviderNamespace: 'Microsoft.Web',
      resourceProviderApiVersion: '2014-06-01'
    }, _);
    return response.resource;
  } catch(ex) {
    if (ex.statusCode && ex.statusCode === 404) {
      return null;
    }
    throw ex;
  }
}

function padRight(s, len) {
  s = s || '';
  if (s.length > len) { return s; }
  return (s + new Array(len + 1).join(' ')).slice(0, len);
}

function fill(ch, num) {
  return new Array(num + 1).join(ch);
}

function createResourceClient(subscription) {
  var client = utils.createResourceClient(subscription);
  azureSdkStream.streamify(client.resourceGroups, 'list', 'listNext', 'resourceGroups');
  return client;
}

function createApiAppClient(subscription) {
  var client = utils.createApiAppManagementClient(subscription);
  azureSdkStream.streamify(client.apiApps, 'list', 'listNext', 'apiApps');
  azureSdkStream.streamify(client.apiApps, 'listAll', 'listNext', 'apiApps');
  return client;
}