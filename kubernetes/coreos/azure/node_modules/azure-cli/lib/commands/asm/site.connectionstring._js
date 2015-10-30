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
var WebsitesClient = require('./websites/websitesclient');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var site = cli.category('site');
  var siteConnectionStrings = site.category('connectionstring')
    .description($('Commands to manage your Web Site connection strings'));

  siteConnectionStrings.command('list [name]')
    .usage('[options] [name]')
    .description($('Show your site application settings'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      site.lookupSiteNameAndWebSpace(context, _);

      var siteConfigurations = site.doSiteConfigGet(context, _);
      cli.interaction.formatOutput(siteConfigurations.connectionStrings, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Name'), item.name);
            row.cell($('Type'), item.type);
          });
        } else {
          log.info($('No connection strings defined yet'));
        }
      });
    });

  siteConnectionStrings.command('add [connectionname] [value] [type] [name]')
    .usage('[options] <connectionname> <value> <type> [name]')
    .description($('Add a connection string to your site'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-c, --connectionname <connectionname>', $('the connection string name'))
    .option('-v, --value <value>', $('the connection string value'))
    .option('-t, --type <type>', $('the connection string type'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (connectionname, value, type, name, options, _) {
      connectionname = cli.interaction.promptIfNotGiven($('Connection String Name: '), connectionname, _);
      value = cli.interaction.promptIfNotGiven($('Connection String Value: '), value, _);
      type = cli.interaction.chooseIfNotGiven($('Connection String Type: '), $('Getting types'), type,
          function (cb) {
            cb(null, [ 'SQLAzure', 'SQLServer', 'Custom', 'MySql' ]);
          }, _);

      if (utils.ignoreCaseEquals(type, 'SQLAzure')) {
        type = 2;
      } else if (utils.ignoreCaseEquals(type, 'SQLServer')) {
        type = 1;
      } else if (utils.ignoreCaseEquals(type, 'Custom')) {
        type = 3;
      } else if (utils.ignoreCaseEquals(type, 'MySql')) {
        type = 0;
      } else {
        throw new Error($('Invalid connection string type. Valid types are: SQLAzure, SQLServer, Custom or MySql'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      site.lookupSiteNameAndWebSpace(context, _);
      var siteConfigurations = site.doSiteConfigGet(context, _);
      siteConfigurations.connectionStrings.push({
        connectionString: value,
        name: connectionname,
        type: type
      });

      site.doSiteConfigPUT(siteConfigurations, context, _);
    });

  siteConnectionStrings.command('delete [connectionname] [name]')
    .usage('[options] <connectionname> [name]')
    .description($('Delete a connection string for your site'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-c, --connectionname <connectionname>', $('the connection string name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (connectionname, name, options, _) {
      connectionname = cli.interaction.promptIfNotGiven($('Connection String Name: '), connectionname, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Deleteconnection string %s? [y/n] '), connectionname), _)) {
        return;
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      site.lookupSiteNameAndWebSpace(context, _);
      var siteConfigurations = site.doSiteConfigGet(context, _);

      var found = false;
      if (siteConfigurations.connectionStrings) {
        for (var i = 0; i < siteConfigurations.connectionStrings.length; i++) {
          if (utils.ignoreCaseEquals(siteConfigurations.connectionStrings[i].name, connectionname)) {
            siteConfigurations.connectionStrings.splice(i, 1);
            found = true;
            i--;
          }
        }

        if (found) {
          site.doSiteConfigPUT(siteConfigurations, context, _);
        }
      }

      if (!found) {
        throw new Error(util.format($('Connection string with name "%s" does not exist'), connectionname));
      }
    });

  siteConnectionStrings.command('show [connectionname] [name]')
    .usage('[options] <connectionname> [name]')
    .description($('Show a connection string for your site'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-c, --connectionname <connectionname>', $('the connection string name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (connectionname, name, options, _) {
      connectionname = cli.interaction.promptIfNotGiven($('Connection String Name: '), connectionname, _);

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      site.lookupSiteNameAndWebSpace(context, _);
      var siteConfigurations = site.doSiteConfigGet(context, _);

      var match = siteConfigurations.connectionStrings.filter(function (c) {
        return utils.ignoreCaseEquals(c.name, connectionname);
      })[0];

      if (match) {
        cli.interaction.formatOutput(match, function (data) {
          cli.interaction.logEachData($('Connection String'), data);
        });
      } else {
        throw new Error(util.format($('Connection string with name "%s" does not exist'), connectionname));
      }
    });
};