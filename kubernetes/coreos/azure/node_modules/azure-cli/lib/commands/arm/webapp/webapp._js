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

/*
* You can test webapp commands get loaded by xplat by following steps:
* a. Copy the folder to '<repository root>\lib\commands\arm'
* b. Under <repository root>, run 'node bin/azure config mode arm'
* c. Run 'node bin/azure', you should see 'webapp' listed as a command set
* d. Run 'node bin/azure', you should see 'create', "delete", etc 
      showing up in the help text 
*/

'use strict';

var util = require('util');

var profile = require('../../../util/profile');
var utils = require('../../../util/utils');
var webappUtils = require('./webappUtils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var webapp = cli.category('webapp')
    .description($('Commands to manage your Azure webapps'));

  webapp.command('create [resource-group] [name] [location] [plan]')
    .description($('create a web app'))
    .option('-g --resource-group <resource-group>', $('Name of the resource group'))
    .option('-n --name <name>', $('the name of the webapp to create'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-l --location <location>', $('the geographic region to create the webapp'))
    .option('-p --plan <plan>', $('the name of the app service plan eg: Default1.'))
    .option('-s, --subscription <id>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, plan, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = webappUtils.createWebappManagementClient(subscription);
      if (!name) {
        return cli.missingArgument('name');
      }
      var webSiteSlotName = name;
      if (Boolean(options.slot)) {
        webSiteSlotName = name.concat('/', options.slot);
      }
      var progress = cli.interaction.progress(util.format($('Creating webapp %s'), webSiteSlotName));
      var parameters = {
        webSite: {
          name: webSiteSlotName,
          location: location,
          properties: {
            serverFarm: plan
          }
        }
      };
      var result;
      try {
        result = client.webSites.createOrUpdate(resourceGroup, name, options.slot, parameters, _);
      } finally {
        progress.end();
      }
      log.info('Webapp ' + webSiteSlotName + ' has been created ');
    });
  webapp.command('stop [resource-group] [name]')
    .description($('Stop a web app'))
    .option('-g --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n --name <name>', $('the name of the webapp to stop'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (resourceGroup, name, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = webappUtils.createWebappManagementClient(subscription);
      if (!name) {
        return cli.missingArgument('name');
      }
      var progress = cli.interaction.progress(util.format($('Stopping webapp %s'), name));
      var result;
      try {
        result = client.webSites.stop(resourceGroup, name, options.slot, _);
      } finally {
        progress.end();
      }
      var webSiteSlotName = name;
      if (Boolean(options.slot)) {
        webSiteSlotName = name.concat('/', options.slot);
      }
      log.info('Webapp ' + webSiteSlotName + ' has been stopped ');
    });

  webapp.command('start [resource-group] [name]')
    .description($('Start a web app'))
    .option('-g --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n --name <name>', $('the name of the webapp to start'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (resourceGroup, name, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = webappUtils.createWebappManagementClient(subscription);
      if (!name) {
        return cli.missingArgument('name');
      }
      var webSiteSlotName = name;
      if (Boolean(options.slot)) {
        webSiteSlotName = name.concat('/', options.slot);
      }
      var progress = cli.interaction.progress(util.format($('Starting webapp %s'), webSiteSlotName));
      var result;
      try {
        result = client.webSites.start(resourceGroup, name, options.slot, _);
      } finally {
        progress.end();
      }
      log.info('Webapp ' + webSiteSlotName + ' has been started ');
    });
  webapp.command('restart [resource-group] [name]')
    .description($('Stop and then start a web app'))
    .option('-g --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n --name <name>', $('the name of the webapp to restart'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (resourceGroup, name, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = webappUtils.createWebappManagementClient(subscription);
      if (!name) {
        return cli.missingArgument('name');
      }
      var webSiteSlotName = name;
      if (Boolean(options.slot)) {
        webSiteSlotName = name.concat('/', options.slot);
      }
      var progress = cli.interaction.progress(util.format($('Restarting webapp %s'), name));
      var result;
      try {
        result = client.webSites.restart(resourceGroup, name, options.slot, _);
      } finally {
        progress.end();
      }
      log.info('Webapp ' + webSiteSlotName + ' has been restarted ');
    });
  webapp.command('delete [resource-group] [name]')
    .description($('Delete a webapp'))
    .option('-g --resource-group <resource-group>', $('Name of the resource group'))
    .option('-n --name <name>', $('the name of the webapp to delete'))
    .option('--slot <slot>', $('the name of the slot to be deleted'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = webappUtils.createWebappManagementClient(subscription);
      if (!name) {
        return cli.missingArgument('name');
      }
      if (!options.quiet) {
        if (!options.slot) {
          if (!cli.interaction.confirm(util.format('Delete site %s? [y/n] ', name), _)) {
            return;
          }
        } else if (!cli.interaction.confirm(util.format('Delete site %s in slot %s? [y/n] ', name, options.slot), _)) {
          return;
        }
      }
      var progress = cli.interaction.progress(util.format($('Deleting webapp %s'), name));
      var delProperties = {
        deleteMetrics: true,
        deleteEmptyServerFarm: false,
        deleteAllSlots: true
      };
      var result;
      try {
        result = client.webSites.deleteMethod(resourceGroup, name, options.slot, delProperties, _);
      } finally {
        progress.end();
      }
      log.info(util.format($('Webapp %s has been deleted'), name));
    });

  webapp.command('list [resource-group]')
    .description($('List your webapps'))
    .option('-g --resource-group <resource-group>', $('the name of the resource group'))
	.option('-s --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = webappUtils.createWebappManagementClient(subscription);
      var progress = cli.interaction.progress($('Listing webapps'));
      var name;
      var result;
      try {
        result = client.webSites.list(resourceGroup, name, _);
      } finally {
        progress.end();
      }
      cli.interaction.formatOutput(result.webSites, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Name '), item.name);
            row.cell($('Status '), item.properties.state);
            row.cell($('Location '), item.location);
            row.cell($('SKU '), item.properties.sku);
            row.cell($('URL '), item.properties.hostNames);
          });
        } else {
          log.info(util.format($('No web apps found.')));
        }
      });
    });

  webapp.command('show [resource-group] [name]')
    .description($('Get an available webapp'))
    .option('-g --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n --name <name>', $('the name of the webapp to show'))
    .option('--slot <slot>', $('the name of the slot to show'))
    .option('-s --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      if (!name) {
        return cli.missingArgument('name');
      }
      var subscription = profile.current.getSubscription(options.subscription);
      var client = webappUtils.createWebappManagementClient(subscription);
      var progress = cli.interaction.progress($('Getting webapp'));
      var getProp;
      var result;
      try {
        result = client.webSites.get(resourceGroup, name, options.slot, getProp, _);
      } finally {
        progress.end();
      }
      cli.interaction.formatOutput(result, function (data) {
        if (!data) {
          log.info($('No webapp information available'));
        } else {
          log.data($('Web app Name  :'), data.webSite.name);
          log.data($('SKU           :'), data.webSite.properties.sku);
          log.data($('Enabled       :'), data.webSite.properties.enabled);
          log.data($('Last Modified :'), data.webSite.properties.lastModifiedTimeUtc);
          log.data($('Location      :'), data.webSite.location);
          log.data('');
          if (data.webSite.properties.hostNames[0] && data.webSite.properties.hostNames[0].length > 0) {
            log.table(data.webSite.properties.hostNames, function (row, s) {
              row.cell($('Host Name'), s);
            });
          }
          log.data('');
        }
      });
    });
};
