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

var profile = require('../../util/profile');
var utils = require('../../util/utils');

var WebsitesClient = require('./websites/websitesclient');
var $ = utils.getLocaleString;

exports.init = function (cli) {
  var site = cli.category('site');
  var siteScale = site.category('scale')
    .description($('Commands to manage your Web Site scaling'));

  siteScale.command('mode [mode] [name]')
    .description($('Set the web site mode'))
    .usage('[options] <mode> [name]')
    .option('--mode <mode>', $('the mode of the site (available are: free, basic, shared and standard)'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (mode, name, options, _) {
      mode = cli.interaction.chooseIfNotGiven($('Mode: '), $('Getting modes'), mode,
          function (cb) {
            cb(null, [ 'Free', 'Shared', 'Standard' ]);
          }, _);

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      site.lookupSiteNameAndWebSpace(context, _);
      
      var service = createWebsiteManagementService(context.subscription, _);

      var siteConfigurations = site.doSiteGet(context, _);
      var webHostingPlanName = siteConfigurations.serverFarm;

      var webHostingPlanConfig = {};
      webHostingPlanConfig.sKU = mode;

      service.webHostingPlans.update(context.site.webspace, webHostingPlanName, webHostingPlanConfig, _);
    });

  siteScale.command('instances [instances] [name]')
    .description($('Set the web site number of instances'))
    .usage('[options] <instances> [name]')
    .option('--instances <instances>', $('the number of instances'))
    .option('--size <size>', $('the size of the instances (available are: small, medium and large)'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (instances, name, options, _) {
      instances = cli.interaction.promptIfNotGiven($('Number of instances: '), instances, _);

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      var service = createWebsiteManagementService(context.subscription, _);

      site.lookupSiteNameAndWebSpace(context, _);
      var siteConfigurations = site.doSiteGet(context, _);

      if (options.size !== null)
      {
        options.size = options.size.charAt(0).toUpperCase() + options.size.slice(1);
      }

      if (siteConfigurations.sku === 'Free' || siteConfigurations.sku === 'Shared') {
        throw new Error($('Instances cannot be changed for sites in a Free or Shared SKU.'));
      }

      var webHostingPlanName = siteConfigurations.serverFarm;
      var webHostingPlanConfig = {};
      webHostingPlanConfig.numberOfWorkers = instances;
      webHostingPlanConfig.sKU = siteConfigurations.sku;
      webHostingPlanConfig.workerSize = options.size || null;

      var progress = cli.interaction.progress($('Updating a web hosting plan'));
      try {
        service.webHostingPlans.update(context.site.webspace, webHostingPlanName, webHostingPlanConfig, _);
      } finally {
        progress.end();
      }
    });

  function createWebsiteManagementService(subscription, callback) {
    return utils.createWebsiteClient(profile.current.getSubscription(subscription), callback);
  }
};