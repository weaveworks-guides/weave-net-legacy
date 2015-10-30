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
  var siteDomain = site.category('handler')
    .description($('Commands to manage your Web Site handler mappings'));

  siteDomain.command('list [name]')
    .usage('[options] [name]')
    .description($('Show your site handler mappings documents'))
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
      cli.interaction.formatOutput(siteConfigurations.handlerMappings, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Extension'), item.extension);
            row.cell($('Script Processor Path'), item.scriptProcessor);
            row.cell($('Additional Arguments'), item.arguments ? item.arguments : '');
          });
        } else {
          log.info($('No handler mappings defined yet'));
        }
      });
    });

  siteDomain.command('add [extension] [processor] [name]')
    .usage('[options] <extension> <processor> [name]')
    .description($('Add a handler mapping'))
    .option('-e, --extension <extension>', $('the handler mapping extension'))
    .option('-p, --processor <processor>', $('the path to the script processor (executable that will process the file given by the extension)'))
    .option('-a, --arguments <arguments>', $('the additional arguments'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (extension, processor, name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      extension = cli.interaction.promptIfNotGiven($('Extension: '), extension, _);
      processor = cli.interaction.promptIfNotGiven($('Script Processor Path: '), processor, _);

      site.lookupSiteNameAndWebSpace(context, _);

      var siteConfigurations = site.doSiteConfigGet(context, _);
      var handler = {};

      if (options['arguments']) {
        handler.arguments = options['arguments'];
      }

      handler['extension'] = extension;
      handler['scriptProcessor'] = processor;

      siteConfigurations.handlerMappings.push(handler);

      site.doSiteConfigPUT(siteConfigurations, context, _);
    });

  siteDomain.command('delete [extension] [name]')
    .usage('[options] <extension> [name]')
    .description($('Delete a site handler mapping'))
    .option('-e, --extension <extension>', $('the extension'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (extension, name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      extension = cli.interaction.promptIfNotGiven($('Extension: '), extension, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete handler mapping with %s extension? [y/n] '), extension), _)) {
        return;
      }

      site.lookupSiteNameAndWebSpace(context, _);

      var siteConfigurations = site.doSiteConfigGet(context, _);
      var found = false;
      if (siteConfigurations.handlerMappings) {
        for (var i = 0; i < siteConfigurations.handlerMappings.length; i++) {
          if (utils.ignoreCaseEquals(siteConfigurations.handlerMappings[i].extension, extension)) {
            siteConfigurations.handlerMappings.splice(i, 1);
            found = true;
            i--;
          }
        }

        if (found) {
          site.doSiteConfigPUT(siteConfigurations, context, _);
        }
      }

      if (!found) {
        throw new Error(util.format($('Handler mapping for extension "%s" does not exist'), extension));
      }
    });
};