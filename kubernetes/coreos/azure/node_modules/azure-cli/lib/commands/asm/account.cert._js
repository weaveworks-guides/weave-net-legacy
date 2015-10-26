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

var __ = require('underscore');
var util = require('util');

var profile = require('../../util/profile');
var publishSettings = require('../../util/profile/publishSettings');
var utils = require('../../util/utils');

var $ = utils.getLocaleString;

function outputFile(options) {
  return options.file || util.format('%s.pem', options.subscription.id);
}

function writePemFile(filename, managementCertificate) {
  utils.writeFileSyncMode(filename,
    managementCertificate.key + managementCertificate.cert,
    'utf8');
}

function exportPublishSettingsCertificate(options) {
  var subscriptions = publishSettings.import(options.publishsettings);

  if (!options.subscription) {
    options.subscription = subscriptions[0];
  } else {
    var found = __.filter(subscriptions, function (s) {
      return utils.ignoreCaseEquals(options.subscription, s.name) ||
      utils.ignoreCaseEquals(options.subscription, s.id);
    });

    if (found.length === 0) {
      throw new Error(util.format($('Subscription %s was not found in the publishSettings file'), options.subscription));
    }

    options.subscription = found[0];
  }

  writePemFile(outputFile(options), options.subscription.managementCertificate);
}

function exportLoadedSubscription(options) {
  options.subscription = profile.current.getSubscription(options.subscription);
  options.subscription.exportManagementCertificate(outputFile(options));
}

exports.init = function (cli) {
  var account = cli.category('account');
  var cert = account.category('cert')
    .description($('Commands to manage your account certificates'));

  cert.command('export')
    .description($('Exports the publish settings file as a PEM file'))
    .option('-f, --file <file>', $('the name of the cert file. If not specified, generate a file in pwd using the subscription ID as the file name'))
    .option('-p, --publishsettings <publishsettings>', $('the publish settings file'))
    .option('--subscription <subscription>', $('the Name or ID for the subscription whose cert you want to export. If not specified, use the current subscription'))
    /* jshint unused: false */
    .execute(function (options, _) {
      if (options.publishsettings) {
        exportPublishSettingsCertificate(options);
      } else {
        exportLoadedSubscription(options);
      }
      cli.output.info(util.format($('Certificate exported to %s'), outputFile(options)));
    });
};
