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

var utils = require('../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var site = cli.category('site');

  var siteAppsettings = site.category('appsetting');

  var siteConfig = site.category('config')
    .deprecatedDescription('Commands to manage your Web Site configurations', 'site appsetting');

  siteConfig.command('list [name]')
    .usage('[options] [name]')
    .deprecatedDescription($('Show your site application settings'), 'site appsetting')
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function () {
      siteAppsettings.listCommand.apply(siteAppsettings, arguments);
    });

  siteConfig.command('add <keyvaluepair> [name]')
    .usage('[options] <keyvaluepair> [name]')
    .deprecatedDescription($('Add an application setting for your site (for values containing the character \';\', use quotes in the format of "\\"value\\"". e.g. SB_CONN="\\"Endpoint=sb://namespace.servicebus.windows.net/;SharedSecretIssuer=owner"\\")'), 'site appsetting')
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function () {
      siteAppsettings.addCommand.apply(siteAppsettings, arguments);
    });

  siteConfig.command('clear <key> [name]')
    .usage('[options] <key> [name]')
    .deprecatedDescription($('Clear an application setting for your site'), 'site appsetting')
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function () {
      siteAppsettings.deleteCommand.apply(siteAppsettings, arguments);
    });

  siteConfig.command('get <key> [name]')
    .usage('[options] <key> [name]')
    .deprecatedDescription($('Get an application setting for your site'), 'site appsetting')
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function () {
      siteAppsettings.showCommand.apply(siteAppsettings, arguments);
    });
};