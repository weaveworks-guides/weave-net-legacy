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

var connectionStringParser = require('azure-common').ConnectionStringParser;
var WebsitesClient = require('./websites/websitesclient');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var site = cli.category('site');
  var siteAppsettings = site.category('appsetting')
    .description($('Commands to manage your Web Site application settings'));

  siteAppsettings.listCommand = function (name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      site.lookupSiteNameAndWebSpace(context, _);

      var siteConfigurations = site.doSiteConfigGet(context, _);
      siteConfigurations.appSettings = getSettings(siteConfigurations.appSettings);

      cli.interaction.formatOutput(siteConfigurations.appSettings, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Name'), item.name);
            row.cell($('Value'), item.value);
          });
        } else {
          log.info($('No app settings defined yet'));
        }
      });
    };

  siteAppsettings.addCommand = function (keyvaluepair, name, options, _) {
    var parsedSiteName = WebsitesClient.parseSiteName(name);
    var context = {
      subscription: profile.current.getSubscription(options.subscription).id,
      site: {
        name: parsedSiteName.name,
        slot: options.slot ? options.slot : parsedSiteName.slot
      },
      keyvaluepair: keyvaluepair
    };

    var settings = connectionStringParser.parse(context.keyvaluepair, { skipLowerCase: true });

    site.lookupSiteNameAndWebSpace(context, _);
    var siteConfigurations = site.doSiteConfigGet(context, _);

    if (Object.keys(settings).length > 0) {
      /*jshint loopfunc:true*/
      for (var setting in settings) {
        if (settings.hasOwnProperty(setting)) {
          if (Object.keys(siteConfigurations.appSettings).some(function (kvp) {
            return utils.ignoreCaseEquals(kvp, setting);
          })) {
            // add should throw if any of the added kvp already exists
            throw new Error(util.format($('Application setting with key "%s" already exists'), setting));
          }

          siteConfigurations.appSettings[setting] = settings[setting];
        }
      }
    }

    site.doSiteConfigPUT(siteConfigurations, context, _);
  };

  siteAppsettings.deleteCommand = function (key, name, options, _) {
    var parsedSiteName = WebsitesClient.parseSiteName(name);
    var context = {
      subscription: profile.current.getSubscription(options.subscription).id,
      site: {
        name: parsedSiteName.name,
        slot: options.slot ? options.slot : parsedSiteName.slot
      },
      key: key
    };

    site.lookupSiteNameAndWebSpace(context, _);
    var siteConfigurations = site.doSiteConfigGet(context, _);

    var found = false;
    if (siteConfigurations.appSettings) {
      Object.keys(siteConfigurations.appSettings).forEach(function (currentKey) {
        if (utils.ignoreCaseEquals(currentKey, key)) {
          delete siteConfigurations.appSettings[currentKey];
          found = true;
        }
      });

      if (found) {
        if (!options.quiet && !cli.interaction.confirm(util.format($('Delete application setting %s? [y/n] '), key), _)) {
          return;
        }

        site.doSiteConfigPUT(siteConfigurations, context, _);
      }
    }

    if (!found) {
      throw new Error(util.format($('Application setting with key "%s" does not exist'), key));
    }
  };

  siteAppsettings.showCommand = function (key, name, options, _) {
    var parsedSiteName = WebsitesClient.parseSiteName(name);
    var context = {
      subscription: profile.current.getSubscription(options.subscription).id,
      site: {
        name: parsedSiteName.name,
        slot: options.slot ? options.slot : parsedSiteName.slot
      },
      key: key
    };

    site.lookupSiteNameAndWebSpace(context, _);
    var siteConfigurations = site.doSiteConfigGet(context, _);

    var found = false;
    if (siteConfigurations.appSettings) {
      Object.keys(siteConfigurations.appSettings).forEach(function (currentKey) {
        if (utils.ignoreCaseEquals(currentKey, key)) {
          log.data($('Value: '), siteConfigurations.appSettings[currentKey]);
          found = true;
          return;
        }
      });
    }

    if (!found) {
      throw new Error(util.format($('Application setting with key "%s" does not exist'), key));
    }
  };

  function getSettings(appSettings) {
    var settings = [];

    if (appSettings) {
      for (var setting in appSettings) {
        settings.push({
          name: setting,
          value: appSettings[setting]
        });
      }
    }

    return settings;
  }

  siteAppsettings.command('list [name]')
    .usage('[options] [name]')
    .description($('Show your site application settings'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(siteAppsettings.listCommand);

  siteAppsettings.command('add <keyvaluepair> [name]')
    .usage('[options] <keyvaluepair> [name]')
    .description($('Add an application setting for your site (for values containing the character \';\', use quotes in the format of "\\"value\\"". e.g. SB_CONN="\\"Endpoint=sb://namespace.servicebus.windows.net/;SharedSecretIssuer=owner"\\")'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(siteAppsettings.addCommand);

  siteAppsettings.command('delete <key> [name]')
    .usage('[options] <key> [name]')
    .description($('Delete an application setting for your site'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(siteAppsettings.deleteCommand);

  siteAppsettings.command('show <key> [name]')
    .usage('[options] <key> [name]')
    .description($('Show an application setting for your site'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(siteAppsettings.showCommand);
};