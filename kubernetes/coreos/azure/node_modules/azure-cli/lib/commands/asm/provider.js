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

var util = require('util');

var profile = require('../../util/profile');
var utils = require('../../util/utils');

var $ = utils.getLocaleString;

// Testing commands to register and unregister providers. Not useful in day to day
// azure usage.

exports.init = function (cli) {
  'use strict';

  if (!process.env.AZURE_CLI_TEST_COMMANDS) {
    return;
  }

  var provider = cli.category('provider')
    .description($('Commands to register and unregister providers with your subscription'));

  provider.command('register [resourceName]')
    .description($('Register a resource provider'))
    .usage('[options] <resourceName>')
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (resourceName, options, cb) {
      var service = utils.createManagementClient(profile.current.getSubscription(options.subscription));
      var progress = cli.interaction.progress(util.format($('Registering resource %s'), resourceName));

      service.subscriptions.registerResource(resourceName, function (err) {
        progress.end();
        cb(err);
      });
    });

  provider.command('unregister [resourceName]')
    .description($('Unregister a resource provider'))
    .usage('[options] <resourceName>')
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (resourceName, options, cb) {
      var service = utils.createManagementClient(profile.current.getSubscription(options.subscription));
      var progress = cli.interaction.progress(util.format($('Unregistering resource %s'), resourceName));

      service.subscriptions.unregisterResource(resourceName, function (err) {
        progress.end();
        cb(err);
      });
    });
};