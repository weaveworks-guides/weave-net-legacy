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
  var siteDomain = site.category('domain')
    .description($('Commands to manage your Web Site domains'));

  siteDomain.command('list [name]')
    .usage('[options] [name]')
    .description($('Show your site domains'))
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

      var siteConfigurations = site.doSiteGet(context, _);
      cli.interaction.formatOutput(siteConfigurations.hostNames, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Name'), item);
          });
        } else {
          log.info($('No host names defined yet'));
        }
      });
    });

  siteDomain.command('add [domain] [name]')
    .usage('[options] <dn> [name]')
    .description($('Add a site domain'))
    .option('-d, --dn <dn>', $('the new domain name'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (dn, name, options, _) {
      dn = cli.interaction.promptIfNotGiven($('Domain name: '), dn, _);

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      site.lookupSiteNameAndWebSpace(context, _);

      var siteConfigurations = site.doSiteGet(context, _);
      siteConfigurations.hostNames.push(dn);
      site.doSitePUT(context,  {
        hostNames: siteConfigurations.hostNames
      }, _);
    });

  siteDomain.command('delete [dn] [name]')
    .usage('[options] <dn> [name]')
    .description($('Delete a site domain'))
    .option('-d, --dn <dn>', $('the domain name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (dn, name, options, _) {
      dn = cli.interaction.promptIfNotGiven($('Domain name: '), dn, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete domain name %s? [y/n] '), dn), _)) {
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

      var siteConfigurations = site.doSiteGet(context, _);
      var found = false;
      if (siteConfigurations.hostNames) {
        for (var i = 0; i < siteConfigurations.hostNames.length; i++) {
          if (utils.ignoreCaseEquals(siteConfigurations.hostNames[i], dn)) {
            siteConfigurations.hostNames.splice(i, 1);
            found = true;
            i--;
          }
        }

        if (found) {
          site.doSitePUT(context, {
            hostNames: siteConfigurations.hostNames
          }, _);
        }
      }

      if (!found) {
        throw new Error(util.format($('Domain "%s" does not exist'), dn));
      }
    });
};