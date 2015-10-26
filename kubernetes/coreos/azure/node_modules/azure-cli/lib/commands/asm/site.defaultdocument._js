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
  var siteDefaultDocument = site.category('defaultdocument')
    .description($('Commands to manage your Web Site default documents'));

  siteDefaultDocument.command('list [name]')
    .usage('[options] [name]')
    .description($('Show your site default documents'))
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
      cli.interaction.formatOutput(siteConfigurations.defaultDocuments, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell('Name', item);
          });
        } else {
          log.info($('No default documents defined yet'));
        }
      });
    });

  siteDefaultDocument.command('add [document] [name]')
    .usage('[options] <document> [name]')
    .description($('Add a site default document (by default, to the end of the list)'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-d, --document <document>', $('the new default document'))
    .option('-p, --position <position>', $('the position of the new default document'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (document, name, options, _) {
      document = cli.interaction.promptIfNotGiven($('Document: '), document, _);

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

      if (siteConfigurations.defaultDocuments.indexOf(document) > -1) {
        throw new Error($('Duplicate default document'));
      }

      if (options.position) {
        if (options.position > siteConfigurations.defaultDocuments.length) {
          throw new Error(util.format($('Provided position %s is larger than current default document number %s'), options.position, siteConfigurations.defaultDocuments.length));
        } else {
          siteConfigurations.defaultDocuments.splice(options.position, 0, document);
        }
      } else {
        siteConfigurations.defaultDocuments.push(document);
      }

      site.doSiteConfigPUT(siteConfigurations, context, _);
    });

  siteDefaultDocument.command('delete [document] [name]')
    .usage('[options] <document> [name]')
    .description($('Delete a site default document'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-d, --document <document>', $('the new default document'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (document, name, options, _) {
      document = cli.interaction.promptIfNotGiven('Document: ', document, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete default document %s? [y/n] '), document), _)) {
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
      if (siteConfigurations.defaultDocuments) {
        for (var i = 0; i < siteConfigurations.defaultDocuments.length; i++) {
          if (utils.ignoreCaseEquals(siteConfigurations.defaultDocuments[i], document)) {
            siteConfigurations.defaultDocuments.splice(i, 1);
            found = true;
            i--;
          }
        }

        if (found) {
          site.doSiteConfigPUT(siteConfigurations, context, _);
        }
      }

      if (!found) {
        throw new Error(util.format('Default document "%s" does not exist.', document));
      }
    });
};