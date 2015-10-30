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

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var ad = cli.category('ad')
    .description($('Commands to display active directory objects'));
  var adGroup = ad.category('group')
    .description($('Commands to display active directory groups'));

  adGroup.command('list')
    .description($('Get active directory groups in current subscription\'s tenant'))
    .option('| more', $('Provides paging support. Press \'Enter\' for more information.'))
    .execute(function (objectId, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);
      var progress = cli.interaction.progress($('Listing active directory groups'));
      try {
        adUtils.listGraphObjects(client, 'group', cli.interaction, log, _);
      } finally {
        progress.end();
      }
    });

  adGroup.command('show')
    .description($('Get active directory groups'))
    .option('--objectId <objectId>', $('the object Id of the group to return'))
    .option('--search <search>', $('Search by display name which starts with the provided value'))
    .execute(function (options, _) {
      var objectId = options.objectId,
          search = options.search;

      adUtils.validateParameters({
        objectId: objectId,
        search: search
      });

      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);
      var progress = cli.interaction.progress($('Getting group list'));
      
      var groups;
      try {
        groups = getSpecificGroups(client, objectId, search, _);
      } finally {
        progress.end();
      }

      if (groups.length > 0) {
        adUtils.displayGroups(groups, cli.interaction, log);
      } else {
        log.data($('No matching group was found'));
      }
    });

  var adGroupMember = adGroup.category('member')
    .description($('Commands to provide an active directory sub group or member info'));

  adGroupMember.command('list [objectId]')
    .description($('Provides an active directory sub group or member info'))
    .option('--objectId <objectId>', $('Object id of group whose members to return.'))
    .execute(function (objectId, options, _) {
      if (!objectId) {
        return cli.missingArgument('objectId');
      }
      var subscription = profile.current.getSubscription(options.subscription);
      var client = adUtils.getADGraphClient(subscription);

      var progress = cli.interaction.progress($('Getting group members'));
      try {
        adUtils.listGroupMembers(client, objectId, cli.interaction, log, _);
      } finally {
        progress.end();
      }
  });
};

function getSpecificGroups(client, objectId, search, _) {
  if (search) {
    return client.group.list(null, search, _).groups;
  } else {
    var group = client.group.get(objectId, _).group;
    return group ? [group] : [];
  }
}