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

'use strict';

var util = require('util');

var profile = require('../../../util/profile');
var providerUtils = require('./providerUtils');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var withProgress = cli.interaction.withProgress.bind(cli.interaction);

  var provider = cli.category('provider')
    .description($('Commands to manage resource provider registrations'));


  provider.command('list')
    .description($('List currently registered providers in ARM'))
    .option('-s --subscription <subscription>', $('Subscription to list providers for'))
    .execute(withClient(function (client, options, _) {
      var providers;
      withProgress($('Getting ARM registered providers'),
        function (log, _) {
          providers = providerUtils.getAllProviders(client, _);
        }, _);

      cli.interaction.formatOutput(providers, function (data) {
        if (data.length === 0) {
          log.info($('No providers defined'));
        } else {
          log.table(data, function (row, provider) {
            row.cell($('Namespace'), provider.namespace);
            row.cell($('Registered'), provider.registrationState);
          });
        }
      });
    }));

  provider.command('show [namespace]')
    .description($('Show details about the requested provider namespace'))
    .usage('[options] <namespace>')
    .option('-n --namespace <namespace>', $('the provider namespace to show'))
    .option('-s --subscription <subscription', $('subscription to show provider for'))
    .execute(withClient(function (client, namespace, options, _) {
      var provider = withProgress($('Getting provider information'),
        function (log, _) {
          return client.providers.get(namespace, _).provider;
        }, _);
      cli.interaction.formatOutput(provider, function (data) {
        if (!data) {
          log.info($('No provider information available'));
        } else {
          log.data($('Namespace:'), data.namespace);
          log.data($('Registration state:'), data.registrationState);
          log.data('');
          log.table(data.resourceTypes, function (row, rt) {
            row.cell($('Resource Type Name'), rt.name);
            row.cell($('Locations'), rt.locations.join(', '));
          });
        }
      });
    }));

  provider.command('register [namespace]')
    .description($('Register namespace provider with the subscription'))
    .usage('[options] <namespace>')
    .option('-n --namespace <namespace>', $('the provider namespace to register'))
    .option('-s --subscription <subscription>', $('Subscription to register'))
    .execute(function (namespace, options, _) {
      if (!namespace) {
        return cli.missingArgument('namespace');
      }

      var subscription = profile.current.getSubscription(options.subscription);
      withProgress(util.format($('Registering provider %s with subscription %s'), namespace, subscription.id),
        function (log, _) {
          subscription.registerArmProvider(namespace, true,  _);
        }, _);
    });

  provider.command('unregister [namespace]')
    .description($('Un-register namespace provider with the subscription'))
    .usage('[options] <namespace>')
    .option('-n --namespace <namespace>', $('the provider namespace to register'))
    .option('-s --subscription <subscription>', $('Subscription to register'))
    .execute(function (namespace, options, _) {
      if (!namespace) {
        return cli.missingArgument('namespace');
      }

      var subscription = profile.current.getSubscription(options.subscription);
      withProgress(util.format($('Un-registering provider %s with subscription %s'), namespace, subscription.id),
        function (log, _) {
          subscription.unRegisterArmProvider(namespace, _);
        }, _);
    });
};

function withClient(wrappedFunction) {
  return function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var options = args[args.length - 2];
    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.createResourceClient(subscription);
    return wrappedFunction.apply(this, [client].concat(args));
  };
}
