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

var fs = require('fs');
var path = require('path');
var util = require('util');
var utils = require('../../../util/utils');
var packagingLib = require('./lib/packaging');

var $ = utils.getLocaleString;

/* jshint unused:false */
exports.init = function initApiAppCommands(cli) {
  var log = cli.output;

  var apiapp = cli.category('apiapp')
    .description($('Commands to manage ApiApps'));

  var packageCommand = apiapp.category('package')
    .description($('Commands to create and publish ApiApp packages'));

  packageCommand.command('create [packageSource]')
    .description($('Create an ApiApp package that can be published'))
    .option('-p, --package-source <packageSource>', $('Directory containing source to be packaged'))
    .option('-o, --output <dest>', $('Directory or filename to generate'))
    .execute(function (packageSource, options, _) {

      packageSource = cli.interaction.promptIfNotGiven($('Package source: '), packageSource, _);
      var dest = options.output || '.';

      var result = packagingLib.validate(packageSource, _);
      if (!result.isValid) {
        log.error($('Package errors:'));
        result.errors.forEach(function (err) { log.error(err); });
        throw new Error(util.format($('Package source %s failed validation.'), packageSource));
      }

      if (fs.existsSync(dest) && fs.stat(dest, _).isDirectory()) {
        dest = path.join(dest, packagingLib.defaultPackageName(packageSource, _));
      }

      packagingLib.createPackage(packageSource, dest, _);
      log.info(util.format($('Created package file %s'), dest));
    });
};
