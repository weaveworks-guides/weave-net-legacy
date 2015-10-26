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

var profile = require('../../../util/profile');
var providerUtils = require('../providers/providerUtils');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var group = cli.category('location')
    .description($('Commands to get the available locations for all resource types'));

  group.command('list')
    .description($('list the available locations'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceTypes, resourceGroup, options, _) {

      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);

      var allProviders;
      cli.interaction.withProgress($('Getting Resource Providers'),
        function (log, _) {
          allProviders = providerUtils.getAllProviders(client, _);
        }, _);

      var allResources = buildResourceListWithLocation(allProviders);

      cli.interaction.formatOutput(allResources, function (data) {
        if (data.length === 0) {
          log.info($('No resources found'));
        } else {
          log.table(data, function (row, resource) {
            row.cell($('Name'), resource.name);
            row.cell($('Location'), resource.location);
          });
        }
      });
    });

  function buildResourceListWithLocation(allProviders) {
    var allResources = [];

    var locationList;
    var currentLocation;
    for (var i = 0; i < allProviders.length; i++) {
      var provider = allProviders[i];
      for (var j = 0; j < provider.resourceTypes.length; j++) {
        locationList = '';
        var resourceType = provider.resourceTypes[j];
        for (var k = 0; k < resourceType.locations.length; k++) {
          currentLocation = resourceType.locations[k];
          if (currentLocation) {
            locationList = locationList ? locationList + ',' + currentLocation : currentLocation;
          }
        }
        if (locationList) {
          allResources.push({
            name: provider.namespace + '/' + resourceType.name,
            location: locationList
          });
        }
      }
    }
    return allResources;
  }
};
