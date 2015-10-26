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
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var withProgress = cli.interaction.withProgress.bind(cli.interaction);

  var feature = cli.category('feature')
    .description($('Commands to manage your features'));

  feature.command('list')
    .description($('List all features available for your subscription'))
    .usage('[options]')
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceFeatureClient(subscription);
      var allFeatures = client.features.listAll(_).features;      
      cli.interaction.formatOutput(allFeatures, function (data) {
        if (data.length === 0) {
          log.info($('No features were found'));
        } else {
          log.table(data, function (row, feature) {
            row.cell($('Provider Name'), getProviderName(feature.name));
            row.cell($('Feature Name'), getFeatureName(feature.name));            
            row.cell($('Registration State'), feature.properties.state);
          });                     
        }
      });            
    });

  feature.command('show [providerName] [featureName]')
    .description($('Shows a feature'))
    .usage('[options] <providerName> <featureName>')
    .option('-p --providerName <providerName>', $('the resource provider name'))
    .option('-n --featureName <featureName>', $('the feature name'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (providerName, featureName, options, _) {
      if (!providerName) {
        return cli.missingArgument('providerName');
      } else if (!featureName) {
        return cli.missingArgument('featureName');
      }
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceFeatureClient(subscription);
      
      var feature = client.features.get(providerName, featureName, _);

      cli.interaction.formatOutput(feature, function (data) {
        if (!data) {
          log.info($('No such feature was found'));
        } else {
          log.data($('Feature Name:       ') + getFeatureName(data.name));
          log.data($('Provider Name:      ') + getProviderName(data.name));
          log.data($('Registration State: ') + feature.properties.state);
        }
      });      
    });

  feature.command('register [providerName] [featureName]')
    .description($('Registers a previewed feature of a resource provider.'))
    .usage('[options] <providerName> <featureName>')
    .option('-p --providerName <providerName>', $('the resource provider name'))
    .option('-n --name <featureName>', $('the feature name'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (providerName, featureName, options, _) {
      if (!providerName) {
        return cli.missingArgument('providerName');
      } else if (!featureName) {
        return cli.missingArgument('featureName');
      }
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceFeatureClient(subscription);

      withProgress(util.format($('Registering feature %s with subscription %s'), featureName, subscription.id),
        function (log, _) {
          client.features.register(providerName, featureName, _);
        }, _);            
    });

  function getFeatureName(name) {
    return name.split('/')[1];
  }

  function getProviderName(name) {
    return name.split('/')[0];
  }
   
};


