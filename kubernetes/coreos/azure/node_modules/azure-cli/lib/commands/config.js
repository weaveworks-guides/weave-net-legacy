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

var util = require('util');

var utils = require('../util/utils');
var utilsCore = require('../util/utilsCore');
var Constants = require('../util/constants');
var validation = require('../util/validation');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var config = cli.category('config')
    .description($('Commands to manage your local settings'));

  config.command('list')
    .description($('List config settings'))
    .action(function () {
      log.info($('Getting config settings'));

      var cfg = utilsCore.readConfig();
      if (!log.format().json && Object.keys(cfg).length === 0) {
        log.info($('No config settings found'));
        return;
      }
      log.table(cfg, function (row, name) {
        row.cell('Setting', name);
        row.cell('Value', cfg[name]);
      });
    });

  config.command('delete <name>')
  .description($('Delete a config setting'))
  .action(function (name) {
    var cfg = utilsCore.readConfig();
    if (!(name in cfg)) {
      log.warn(util.format($('Setting "%s" does not exist'), name));
      return;
    }
    log.info(util.format($('Deleting "%s"'), name));
    delete cfg[name];
    utilsCore.writeConfig(cfg);
    log.info($('Changes saved'));
  });

  config.command('set <name> <value>')
    .usage('<name> <value>')
    .description($('Update a config setting'))
    .action(function (name, value) {
      var cfg = utilsCore.readConfig();
      if (name === 'endpoint') {
        value = utils.validateEndpoint(value);
      }

      log.info(util.format($('Setting "%s" to value "%s"'), name, value));
      cfg[name] = value;
      utilsCore.writeConfig(cfg);
      log.info($('Changes saved'));
    });

  config.command('mode <name>')
  .description($('Sets the cli working mode, valid names are \'arm\' for resource manager and \'asm\' for service management'))
  .action(function (name) {
    validation.isValidEnumValue(name, [ Constants.API_VERSIONS.ASM, Constants.API_VERSIONS.ARM ]);

    var cfg = utilsCore.readConfig();
    cfg.mode = name.toLowerCase();
    utilsCore.writeConfig(cfg);
    log.info(util.format($('New mode is %s'), name));
  });
};
