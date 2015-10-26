//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

var __ = require('underscore');
var util = require('util');

var profile = require('../../util/profile');

var utils = require('../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var cloudService = cli.category('service')
    .description($('Commands to manage your Cloud Services'));

  cloudService.command('create [serviceName]')
    .description($('Create a cloud service'))
    .usage('[options] <serviceName>')
    .option('--serviceName <serviceName>', $('the cloud service name'))
    .option('--description <description>', $('the description. Defaults to \'Service host\''))
    .option('--location <location>', $('the location. Optional if affinitygroup is specified'))
    .option('--affinitygroup <affinitygroup>', $('the affinity group. Optional if location is specified'))
    .option('--label <label>', $('the label. Defaults to serviceName'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serviceName, options, _) {
      var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));
      var managementService = utils.createManagementClient(profile.current.getSubscription(options.subscription));

      serviceName = cli.interaction.promptIfNotGiven($('New cloud service name: '), serviceName, _);
      var location = options.location;
      var affinitygroup = options.affinitygroup;

      if (!location && !affinitygroup) {
        // If nothing is specified, assume location
        location = cli.interaction.chooseIfNotGiven($('Location: '), $('Getting locations'), location,
          function (cb) {
            managementService.locations.list(function (err, result) {
              if (err) { return cb(err); }

              cb(null, result.locations.map(function (location) { return location.name; }));
            });
          }, _);
      }

      var createOptions = {
        serviceName: serviceName
      };

      if (__.isString(options.description)) {
        createOptions.description = options.description;
      }

      if (location) {
        createOptions.location = location;
      }

      if (affinitygroup) {
        createOptions.affinityGroup = affinitygroup;
      }

      if (options.label) {
        createOptions.label = options.label;
      } else {
        createOptions.label = serviceName;
      }

      var progress = cli.interaction.progress($('Creating cloud service'));
      try {
        service.hostedServices.create(createOptions, _);
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput({ serviceName: serviceName }, function(outputData) {
        log.data($('Cloud service name'), outputData.serviceName);
      });
    });

  cloudService.command('list')
    .description($('List Azure cloud services'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));

      var cloudServices;
      var progress = cli.interaction.progress($('Getting cloud services'));

      try {
        cloudServices = service.hostedServices.list(_).hostedServices;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(cloudServices, function(outputData) {
        if(outputData.length === 0) {
          log.info($('No Cloud Services exist'));
        } else {
          log.table(outputData, function (row, item) {
            row.cell($('Name'), item.serviceName);
            row.cell($('Location'), item.properties.location || '');
            row.cell($('Affinity Group'), item.properties.affinityGroup || '');
          });
        }
      });
    });

  cloudService.command('show [serviceName]')
    .description($('Show Azure cloud service'))
    .usage('[options] <serviceName>')
    .option('--serviceName <serviceName>', $('the cloud service name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serviceName, options, _) {
      var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));

      serviceName = cli.interaction.promptIfNotGiven($('Cloud Service name: '), serviceName, _);

      var progress = cli.interaction.progress($('Getting cloud service'));
      var cloudService;
      try {
        cloudService = service.hostedServices.get(serviceName, _);
      } finally {
        progress.end();
      }

      if (cloudService) {
        cli.interaction.formatOutput(cloudService, function (outputData) {
          log.data($('Name'), outputData.serviceName);
          log.data($('Url'), outputData.uri);

          if (outputData.properties.extendedProperties) {
            cli.interaction.logEachData($('Extended Properties'), outputData.properties.extendedProperties);
          }
          delete outputData.properties.extendedProperties;

          cli.interaction.logEachData($('Properties'), outputData.properties);
        });
      } else {
        log.info($('Cloud service not found'));
      }
    });

  cloudService.command('delete [serviceName]')
    .description($('Delete a cloud service'))
    .usage('[options] <serviceName>')
    .option('--serviceName <serviceName>', $('the cloud service name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serviceName, options, _) {
      var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));

      serviceName = cli.interaction.promptIfNotGiven($('Cloud service name: '), serviceName, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete cloud service %s? [y/n] '), serviceName), _)) {
        return;
      }

      var progress = cli.interaction.progress($('Deleting cloud service'));
      try {
        service.hostedServices.deleteMethod(serviceName, _);
      } finally {
        progress.end();
      }
    });

  cloudService.command('get-deployment-event [serviceName] [startTime] [endTime]')
    .description($('Get details of deployment events.'))
    .usage('[options] <serviceName> <startTime> <endTime>')
    .option('--service-name <service-name>', $('the cloud service name'))
    .option('-d, --deployment-name <deployment-name>', $('the deployment name'))
    .option('-t, --start-time <start-time>', $('the start time specified in UTC e.g. 2015-06-17T17:58:50.4290652Z, 2015-06-17'))
    .option('-e, --end-time <end-time>', $('the end time specified in UTC'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serviceName, startTime, endTime, options, _) {
      var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));
      serviceName = cli.interaction.promptIfNotGiven($('Cloud service name: '), serviceName, _);
      startTime = cli.interaction.promptIfNotGiven($('Start time: '), startTime, _);
      endTime = cli.interaction.promptIfNotGiven($('End time: '), endTime, _);

      var progress;
      var deploymentEvents;
      if (options.deploymentName) {
        progress = cli.interaction.progress(util.format($('Getting deployment events of the deployment "%s" in the cloud service "%s"'), options.deploymentName, serviceName));
        try {
          deploymentEvents = service.deployments.listEvents(serviceName, options.deploymentName, startTime, endTime, _);
        } finally {
          progress.end();
        }
      } else {
        progress = cli.interaction.progress(util.format($('Getting deployment events of deployments in the cloud service "%s"'), serviceName));
        try {
          deploymentEvents = service.deployments.listEventsBySlot(serviceName, 'Production', startTime, endTime, _);
        } finally {
          progress.end();
        }

        var showDeploymentEvents = function (events) {
          var output = cli.output;
          if (events && events.length > 0) {
            cli.interaction.formatOutput(events, function (events) {
              output.header('Reboot events');
              for (var i = 0; i < events.length; i++) {
                output.header('Event #' + (i + 1));
                output.nameValue();
                var rebootEvent = events[i];
                output.nameValue($('Role name'), rebootEvent.roleName, 2);
                output.nameValue($('Instance name'), rebootEvent.instanceName, 2);
                output.nameValue($('Reboot reason'), rebootEvent.rebootReason, 2);
                output.nameValue($('Reboot start time'), rebootEvent.rebootStartTime, 2);
              }
            });
          } else {
            if (output.format().json) {
              output.json([]);
            } else {
              output.warn($('No deployment events found'));
            }
          }
        };

        // TODO: SDK seems returning next link but we don't have a SDK method
        // to fetch the next page, will add this once SDK gets updated.
        showDeploymentEvents(deploymentEvents);
      }
    });
};