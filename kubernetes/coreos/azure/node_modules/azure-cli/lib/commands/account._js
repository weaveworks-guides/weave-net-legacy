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

/* jshint unused: false */

var __ = require('underscore');
var util = require('util');
var wrap = require('wordwrap').hard(0, 75);

var profile = require('../util/profile');
var tokenCache = require('../util/authentication/adalAuth').tokenCache;
var utils = require('../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var account = cli.category('account')
    .description($('Commands to manage your account information and publish settings'));

  account.command('list')
    .description($('List the imported subscriptions'))
    .execute(function (options, _) {
      var subscriptions = __.values(profile.current.subscriptions);
      log.table(subscriptions, function (row, s) {
        row.cell($('Name'), s.name);
        row.cell($('Id'), s.id);
        row.cell($('Current'), s.isDefault);
        row.cell($('State'), s.state || 'n/a');
      });
    });

  account.command('show [subscriptionNameOrId]')
    .description($('Show details about a subscription'))
    .option('-s --subscriptionNameOrId <subscriptionNameOrId>', $('The subscription to show'))
    .option('-d --details', $('Show extra information about the subscription'))
    .execute(function (subscriptionNameOrId, options, _) {
      var subscriptions = profile.current.getSubscription(subscriptionNameOrId, true);

      cli.interaction.formatOutput(subscriptions, function (data) {
        for (var i=0; i < data.length; i++) {
          log.data($('Name                        :'), data[i].name);
          log.data($('ID                          :'), data[i].id);
          log.data($('State                       :'), data[i].state || 'n/a');
          log.data($('Tenant ID                   :'), data[i].tenantId);
          log.data($('Is Default                  :'), data[i].isDefault);
          log.data($('Environment                 :'), data[i].environment.name);

          if (data[i].managementCertificate) {
            log.data($('Has Certificate             :'), 'Yes');
          } else {
            log.data($('Has Certificate             :'), 'No');
          }
          
          if (data[i].user) {
            log.data($('Has Access Token            :'), 'Yes');
            log.data($('User name                   :'), data[i].user.name);
          } else {
            log.data($('Has Access Token            :'), 'No');
          }
          
          if (options.details) {
            log.data($('Registered ASM Providers    :'), data[i].registeredProviders);
          }

          log.data('');
        }
      }); 
    });

  account.command('set <subscriptionNameOrId>')
    .description($('Set the current subscription'))
    .execute(function (subscriptionNameOrId, options, _) {
      var subscriptions = profile.current.getSubscription(subscriptionNameOrId, true);
      
      //No subscription found
      if (subscriptions.length === 0) {
        throw new Error(util.format($('Invalid subscription "%s"'), subscriptionNameOrId));
      }
      
      var newSubscription = subscriptions[0];
      //Multiple subscriptions found
      if (subscriptions.length > 1) {
        log.warn(util.format($('We found multiple subscriptions matching the name "%s". ' + 
          'We are setting the first subscription match, with id - "%s" as the current subscription. ' + 
          'Provide the "subscription-id" to set a specific subscription.'), 
          newSubscription.name, newSubscription.id));
      }

      profile.current.currentSubscription = newSubscription;
      profile.current.save();
      log.info(util.format($('Setting subscription to "%s" with id "%s".'), 
        newSubscription.name, newSubscription.id));
      log.info($('Changes saved'));
    });

  account.command('clear')
    .description($('Remove a subscription or environment, or clear all of the stored account and environment info'))
    .option('-s --subscription <subscriptionNameOrId>', $('Subscription name or id to remove'))
    .option('-e --environment <environmentName>', $('Environment name to remove'))
    .option('-q --quiet', $('quiet mode, do not ask for delete confirmation'))
    .execute(function (options, _) {
      var matchSubscription = function () { return false; };
      var matchEnvironment = function () { return false; };
      var clearAll = false;

      if(!options.subscription && !options.environment) {
        clearAll = true;
        var shouldClear = options.quiet || cli.interaction.confirm($('This will clear all account information. Are you sure? [y/n] '), _);
        if (!shouldClear) {
          return;
        }
        matchSubscription = function () { return true; };
        matchEnvironment = function () { return true; };
      } else {
        if (options.subscription) {
          matchSubscription = function (s) {
            return s.id === options.subscription || utils.ignoreCaseEquals(s.name, options.subscription);
          };
        }
        if (options.environment) {
          matchEnvironment = function (e) {
            return utils.ignoreCaseEquals(e.name, options.environment);
          };
        }
      }

      __.values(profile.current.subscriptions)
        .filter(matchSubscription)
        .forEach(function (subscription) {
          profile.current.deleteSubscription(subscription.id);
        });

      __.values(profile.current.environments)
        .filter(matchEnvironment)
        .forEach(function (env) {
          profile.current.deleteEnvironment(env.name);
        });

      profile.current.save();
      if (clearAll) {
        profile.clearAzureDir();
        tokenCache.clear(_);
      }
    });

  if (cli.isAsmMode()) {
    account.command('import <file>')
    .description($('Import a publishsettings file or certificate for your account'))
    .option('--skipregister', $('skip registering resources'))
    .execute(function (file, options, _) {
      profile.current.importPublishSettings(file);
      profile.current.save();
    });

    account.command('download')
    .description($('Launch a browser to download your publishsettings file'))
    .option('-e, --environment <environment>', $('the publish settings download environment'))
    .option('-r, --realm <realm>', $('the organization\'s realm, aka \'tenant\''))
    .execute(function (options, _) {
      var url = profile.current.getEnvironment(options.environment).getPublishingProfileUrl(options.realm);
      cli.interaction.launchBrowser(url, _);
      log.help($('Save the downloaded file, then execute the command'));
      log.help($('  account import <file>'));
    });
  }
};
