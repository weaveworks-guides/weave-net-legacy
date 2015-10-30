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

var linkedRevisionControl = require('../../util/git/linkedrevisioncontrol');

exports.init = function(cli) {
  var log = cli.output;
  var site = cli.category('site');

  var repository = site.category('repository')
    .description($('Commands to manage your Web Site repositories'));

  repository.command('branch <branch> [name]>')
    .usage('[options] <branch> [name]')
    .description($('Set your repository branch'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(branch, name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        settingKey: 'branch',
        settingValue: branch,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      var repositoryUri = site.ensureRepositoryUri(context, _);
      if (repositoryUri) {
        doSettingsSet(context, _);
      } else {
        log.error($('Repository is not setup'));
      }
    });

  repository.command('delete [name]')
    .usage('[options] [name]')
    .description($('Delete your repository'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      var repositoryUri = site.ensureRepositoryUri(context, _);
      if (repositoryUri) {
        if (!options.quiet && !cli.interaction.confirm($('Delete repository? [y/n] '), _)) {
          return;
        }

        doDeleteRepository(context, _);
        site.doRepositoryDelete(context, _);
      } else {
        log.error($('Repository is not setup'));
      }
    });

  repository.command('sync [name]')
    .usage('[options] [name]')
    .description($('Sync your repository'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      var repositoryUri = site.ensureRepositoryUri(context, _);
      if (repositoryUri) {
        site.doRepositorySync(context, _);
      } else {
        log.error($('Repository is not setup'));
      }
    });

  repository.command('update [name]')
    .usage('[options] [name]')
    .description($('Link a website to a github account for deployment'))
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

      var websiteClient = new WebsitesClient(cli, context.subscription);
      websiteClient.lookupSiteName(context, _);

      var sites = site.doSitesGet(context, _).filter(function (s) {
        var currentSiteName = WebsitesClient.parseSiteName(s.name);
        return utils.ignoreCaseEquals(currentSiteName.name, context.site.name);
      });

      var lvcClient = linkedRevisionControl.createClient(cli, 'git', websiteClient);

      for (var i = 0; i < sites.length; i++) {
        var currentSite = sites[i];

        var siteNameParts = WebsitesClient.parseSiteName(currentSite.name);
        options = {
          subscription: context.subscription,
          site: {
            name: siteNameParts.name,
            slot: siteNameParts.slot,
            webspace: currentSite.webSpace
          },
          flags: { siteExists: true }
        };

        lvcClient.init(options, _);
        lvcClient.deploy(options, _);
      }
    });

  function doSettingsGet(context, _) {
    var service = createExtensionsClient(context, _);

    var progress = cli.interaction.progress($('Getting repository settings'));
    try {
      if (context.settingKey !== undefined) {
        return service.settings.get(context.settingKey, _).value;
      } else {
        return service.settings.list(_).settings;
      }
    } finally {
      progress.end();
    }
  }

  repository.doSettingsGet = doSettingsGet;

  function doSettingsSet(context, _) {
    var service = createExtensionsClient(context, _);

    var progress = cli.interaction.progress(util.format($('Setting %s to %s'), context.settingKey, context.settingValue));
    try {
      var settings = {};
      settings[context.settingKey] = context.settingValue;
      return service.settings.update(settings, _);
    } finally {
      progress.end();
    }
  }

  function doDeleteRepository(context, _) {
    var service = createExtensionsClient(context, _);

    var progress = cli.interaction.progress($('Deleting repository files'));
    try {
      return service.repository.delete(_);
    } finally {
      progress.end();
    }
  }

  function createExtensionsClient(context, _) {
    var webSiteClient = new WebsitesClient(cli, context.subscription);

    var suffix = webSiteClient.getHostNameSuffix(context.subscription, _);

    var service = utils.createWebSiteExtensionsClient(
      WebsitesClient.getSiteHostName(context.site.name, context.site.slot),
      suffix,
      context.repositoryAuth.split(':')[0],
      context.repositoryAuth.split(':')[1]);

    return service;
  }
};
