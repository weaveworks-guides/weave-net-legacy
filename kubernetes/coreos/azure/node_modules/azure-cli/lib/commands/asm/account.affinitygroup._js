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

var util = require('util');

var profile = require('../../util/profile');
var utils = require('../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var account = cli.category('account');
  var affinityGroup = account.category('affinity-group')
    .description($('Commands to manage your Affinity Groups'));

  affinityGroup.command('list')
    .description($('List affinity groups available for your account'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var service = utils.createManagementClient(profile.current.getSubscription(options.subscription));

      var affinityGroups;
      var progress = cli.interaction.progress($('Getting affinity groups'));

      try {
        affinityGroups = service.affinityGroups.list(_).affinityGroups;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(affinityGroups, function(outputData) {
        if(outputData.length === 0) {
          log.info($('No affinity groups defined'));
        } else {
          log.table(outputData, function (row, item) {
            row.cell($('Name'), item.name);
            row.cell($('Label'), item.label);
            row.cell($('Location'), item.location);
          });
        }
      });
    });

  affinityGroup.command('create <name>')
    .description($('Create an affinity group'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .option('-l, --location <name>', $('the data center location'))
    .option('-e, --label <label>', $('the affinity group label'))
    .option('-d, --description <description>', $('the affinity group description'))
    .execute(function (name, options, _) {
      var service = utils.createManagementClient(profile.current.getSubscription(options.subscription));

      var affinityGroupOptions = {
        label: options.label ? options.label : options.description ? name : '',
        description: (typeof options.description === 'string' ? options.description : undefined),
        location: options.location,
        name: name
      };

      var progress = cli.interaction.progress($('Creating affinity group'));
      try {
        service.affinityGroups.create(affinityGroupOptions, _);
      } finally {
        progress.end();
      }
    });

  affinityGroup.command('show <name>')
    .description($('Show details about an affinity group'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var service = utils.createManagementClient(profile.current.getSubscription(options.subscription));

      var affinityGroup;
      var progress = cli.interaction.progress($('Getting affinity groups'));

      try {
        affinityGroup = service.affinityGroups.get(name, _);
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(affinityGroup, function(outputData) {
        Object.keys(outputData).forEach(function (key) {
          if (key !== '_') {
            if (key === 'storageServices') {
              log.data(util.format($('%s: '), key));
              outputData[key].forEach(function (item) {
                Object.keys(item).forEach(function (property) {
                  log.data(util.format($('       %s: %s'), property, item[property]));
                });
              });
            } else {
              log.data(util.format($('%s: %s'), key, outputData[key]));
            }
          }
        });
      });
    });

  affinityGroup.command('delete <name>')
    .description($('Delete an affinity group'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var service = utils.createManagementClient(profile.current.getSubscription(options.subscription));

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete affinity group %s? [y/n] '), name), _)) {
        return;
      }

      var progress = cli.interaction.progress($('Deleting affinity group'));
      try {
        service.affinityGroups.deleteMethod(name, _);
      } finally {
        progress.end();
      }
    });
};