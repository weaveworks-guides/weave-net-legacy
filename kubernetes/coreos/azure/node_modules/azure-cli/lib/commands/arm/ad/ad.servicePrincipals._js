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
  var adSP = ad.category('sp')
    .description($('Commands to display active directory service principals'));

  adSP.command('list')
    .description($('Get all active directory service principals in current subscription\'s tenant'))
    .option('| more', $('Provides paging support. Press \'Enter\' for more information.'))
    .execute(function (options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);
      var progress = cli.interaction.progress($('Listing active directory service principals'));
      try {
        adUtils.listGraphObjects(client, 'servicePrincipal', cli.interaction, log, _);
      } finally {
        progress.end();
      }
    });

  adSP.command('show')
    .description($('Get active directory service principals'))
    .option('--spn <spn>', $('the name of the service principal to return'))
    .option('--objectId <objectId>', $('the object id of the service principal to return'))
    .option('--search <search>', $('search display name of the service principal starting with the provided value'))
    .execute(function (options, _) {
      var spn = options.spn,
          objectId = options.objectId,
          search = options.search;

      adUtils.validateParameters({
        spn: spn,
        objectId: objectId,
        search:search
      });
      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);
      var progress = cli.interaction.progress($('Getting active directory service principals'));
      var servicePrincipals = [];
      try {
        if (spn) {
          servicePrincipals = client.servicePrincipal.getByServicePrincipalName(spn, _).servicePrincipals;
        } else if (objectId) {
          var servicePrincipal = client.servicePrincipal.get(objectId, _).servicePrincipal;
          if (servicePrincipal) {
            servicePrincipals.push(servicePrincipal);
          }
        } else {
          servicePrincipals = client.servicePrincipal.list(search, _).servicePrincipals;
        }
      } finally {
        progress.end();
      }

      if (servicePrincipals.length > 0) {
        adUtils.displayServicePrincipals(servicePrincipals, cli.interaction, log);
      } else {
        log.data($('No matching service principal was found'));
      }
    });

  adSP.command('create <application-id>')
    .description($('Create active directory service principal'))
    .usage('[options] <application-id>')
    .option('--applicationId <application-id>', $('the application Id for which service principal is created'))
    .execute(function (applicationId, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);
      var spParams = {
        accountEnabled: true,
        appId: applicationId
      };

      var servicePrincipal = withProgress(util.format($('Creating service principal for application %s'), applicationId),
      function (log, _) {
        return client.servicePrincipal.create(spParams, _).servicePrincipal;
      }, _);

      adUtils.displayAServicePrincipal(servicePrincipal, log);
    });

  adSP.command('delete <object-id>')
    .description($('Deletes active directory service principal'))
    .usage('[options] <object-id>')
    .option('--objectId <object-id>', $('the object id of the service principal to delete'))
    .option('-q, --quiet', $('quiet mode (do not ask for delete confirmation)'))
    .execute(function (objectId, options, _) {
      if (!objectId) {
        return cli.missingArgument('objectId');
      }

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete service principal %s? [y/n] '), objectId), _)) {
        return;
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);
      var progress = cli.interaction.progress(util.format($('Deleting service principal %s'), objectId));
      try {
        client.servicePrincipal.deleteMethod(objectId, _);
      } finally {
        progress.end();
      }
    });
};