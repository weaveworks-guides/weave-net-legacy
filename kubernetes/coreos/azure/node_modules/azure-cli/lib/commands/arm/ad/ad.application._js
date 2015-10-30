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
var adUtils = require('./adUtils');
var profile = require('../../../util/profile');
var utils = require('../../../util/utils');
var util = require('util');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var withProgress = cli.interaction.withProgress.bind(cli.interaction);

  var ad = cli.category('ad')
    .description($('Commands to display active directory objects'));
  var adApp = ad.category('app')
    .description($('Commands to display active directory applications'));

  adApp.command('create')
    .description($('Creates a new active directory application'))
    .option('-n --name <name>', $('the display name for the application'))
    .option('--home-page <home-page>', $('the URL to the application homepage'))
    .option('-a --available', $('indicates if the application will be available to other tenants'))
    .option('-p --password <password>', $('the value for the password credential associated with the application that will be valid for one year by default'))
    .option('-i --identifier-uris <identifier-uris>', $('the comma-delimitied URIs that identify the application'))
    .option('--key-value <key-value>', $('the value for the key credentials associated with the application that will be valid for one year by default'))
    .option('--key-type <key-type>', $('the type of the key credentials associated with the application. Acceptable values are AsymmetricX509Cert, Password and Symmetric'))
    .option('--key-usage <key-usage>', $('the usage of the key credentials associated with the application. Acceptable values are Sign and Verify'))
    .option('--start-date <start-date>', $('the start date after which password or key would be valid. Default value is current time'))
    .option('--end-date <end-date>', $('the end date till which password or key is valid. Default value is one year after current time'))
    .execute(function (options, _) {
      if (!options.name || !options.homePage || !options.identifierUris) {
        throw new Error($('--name, --home-page and --identifier-uris are all required parameters.'));
      }
      if (options.password && options.keyValue) {
        throw new Error($('specify either --password or --key-value, but not both'));
      }

      var startDate = options.startDate ? new Date(Date.parse(options.startDate)) : new Date(Date.now());
      var endDate = (function () {
        if (options.endDate) {
          return new Date(Date.parse(options.endDate));
        } else {
          var date = new Date(startDate);
          date.setFullYear(startDate.getFullYear() + 1);
          return date;
        }
      })();

      var keyType = options.keyType ? options.KeyType : 'AsymmetricX509Cert';
      var keyUsage = options.keyUsage ? options.keyUsage : 'Verify';

      var uris = options.identifierUris ? options.identifierUris.split(',') : [];

      var appParams = {
        availableToOtherTenants: options.available ? true : false,
        displayName: options.name,
        homepage: options.homePage,
        identifierUris: uris
      };

      if (options.password) {
        appParams.passwordCredentials = [{
          startDate: startDate,
          endDate: endDate,
          keyId: utils.uuidGen(),
          value: options.password
        }];
      } else if (options.keyValue) {
        appParams.keyCredentials = [{
          startDate: startDate,
          endDate: endDate,
          keyId: utils.uuidGen(),
          value: options.keyValue,
          usage: keyUsage,
          type: keyType
        }];
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);

      var application = withProgress(util.format($('Creating application %s'), options.name),
      function (log, _) {
        return client.application.create(appParams, _).application;
      }, _);

      adUtils.displayAApplication(application, log);

    });

  adApp.command('delete <object-id>')
    .description($('Deletes the active directory application'))
    .usage('[options] <object-id>')
    .option('--objectId <object-id>', $('the object id of the application to remove'))
    .option('-q, --quiet', $('quiet mode (do not ask for delete confirmation)'))
    .execute(function (objectId, options, _) {
      if (!objectId) {
        return cli.missingArgument('objectId');
      }

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete application %s? [y/n] '), objectId), _)) {
        return;
      }
      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);
      var progress = cli.interaction.progress(util.format($('Deleting application %s'), objectId));
      try {
        client.application.deleteMethod(objectId, _);
      } finally {
        progress.end();
      }
    });

};
