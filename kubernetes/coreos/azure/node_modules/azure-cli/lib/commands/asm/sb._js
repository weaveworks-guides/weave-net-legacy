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

'use strict';

var util = require('util');
var azureCommon = require('azure-common');
var profile = require('../../util/profile');
var utils = require('../../util/utils');

var $ = utils.getLocaleString;

var namespaceNameIsValid = azureCommon.validate.namespaceNameIsValid;

exports.init = function (cli) {
  var log = cli.output;

  var sb = cli.category('sb')
    .description($('Commands to manage your Service Bus configuration'));

  var sbnamespace = sb.category('namespace')
    .description($('Commands to manage your Service Bus namespaces'));

  sbnamespace.command('list')
    .description($('List currently defined service bus namespaces'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var service = createService(options.subscription);

      var namespaces;
      var progress = cli.interaction.progress($('Getting namespaces'));

      try {
        namespaces = service.namespaces.list(_).namespaces;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(namespaces, function(outputData) {
        if(outputData.length === 0) {
          log.info($('No namespaces defined'));
        } else {
          log.table(outputData, function (row, ns) {
            row.cell($('Name'), ns.name);
            row.cell($('Region'), ns.region);
            row.cell($('Status'), ns.status);
          });
        }
      });
    });

  sbnamespace.command('show [name]')
    .description($('Get detailed information about a single service bus namespace'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Service Bus namespace: '), name, _);
      namespaceNameIsValid(name, _);
      var service = createService(options.subscription);

      var namespace;
      var progress = cli.interaction.progress($('Getting namespace'));

      try {
        namespace = service.namespaces.get(name, _).namespace;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(namespace, function(outputData) {
        Object.keys(outputData).forEach(function (key) {
          if (key !== '_') {
            log.data(util.format($('%s: %s'), key, outputData[key]));
          }
        });
      });
    });

  sbnamespace.command('check <name>')
    .description($('Check that a service bus namespace is legal and available'))
    .usage('[options] <name>')
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      namespaceNameIsValid(name, _);
      var service = createService(options.subscription);

      var isAvailable;
      var progress = cli.interaction.progress(util.format($('Checking namespace %s'), name));

      try {
        isAvailable = service.namespaces.checkAvailability(name, _).isAvailable;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput({ available: isAvailable }, function(outputData) {
        if (outputData.available) {
          log.data(util.format($('Namespace %s is available'), name));
        } else {
          log.data(util.format($('Namespace %s is not available'), name));
        }
      });
    });

  sbnamespace.command('create [namespace] [region]')
    .description($('Create a service bus namespace'))
    .usage('[options] <namespace> <region>')
    .option('-n, --namespace <namespace>', $('the namespace name'))
    .option('-r, --region <region>', $('the region to create the namespace in'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (namespace, region, options, _) {
      var service = createService(options.subscription);

      namespace = cli.interaction.promptIfNotGiven($('Namespace name: '), namespace, _);
      region = cli.interaction.chooseIfNotGiven($('Region: '), $('Getting regions'), region,
          function (cb) {
            service.getServiceBusRegions(function (err, regions) {
              if (err) { return cb(err); }
              cb(null, regions.regions.map(function (region) { return region.code; }));
            });
          }, _);
      var progress = cli.interaction.progress(util.format($('Creating namespace %s in region %s'), namespace, region));
      var createdNamespace = service.namespaces.create(namespace, region, _).namespace;
      progress.end();

      cli.interaction.formatOutput(createdNamespace, function(outputData) {
        Object.keys(outputData).forEach(function (key) {
          log.data(util.format($('%s: %s'), key, outputData[key]));
        });
      });
    });

  sbnamespace.command('delete [namespace]')
    .description($('Delete a service bus namespace'))
    .option('-n, --namespace <namespace>', $('the namespace name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (namespace, options, _) {
      namespace = cli.interaction.promptIfNotGiven($('Namespace name: '), namespace, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete namespace %s? [y/n] '), namespace), _)) {
        return;
      }

      var service = createService(options.subscription);

      var progress = cli.interaction.progress(util.format($('Deleting namespace %s'), namespace));
      try {
        service.namespaces.deleteMethod(namespace, _);
      } finally {
        progress.end();
      }
    });

  var location = sbnamespace.category('location')
    .description($('Commands to manage your Service Bus locations'));

  location.list = location.command('list')
    .description($('Show list of available service bus locations'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var service = createService(options.subscription);
      var progress = cli.interaction.progress($('Getting locations'));
      var regions;
      try {
        regions = service.getServiceBusRegions(_).regions;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(regions, function(outputData) {
        log.table(outputData, function (row, region) {
          row.cell($('Name'), region.fullName);
          row.cell($('Code'), region.code);
        });
      });
    });

  function createService(subscription) {
    return utils.createServiceBusClient(profile.current.getSubscription(subscription));
  }
};