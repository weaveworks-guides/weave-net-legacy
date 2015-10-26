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

var __ = require('underscore');
var util = require('util');

var profile = require('../util/profile');
var utils = require('../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var account = cli.category('account');
  var environment = account.category('env')
    .description($('Commands to manage your account environment'));

  environment.command('list')
    .description($('List the environments'))
    .execute(function (options, callback) {
      var environments = profile.current.environments;

      if (log.format().json) {
        log.json(environments);
      } else {
        log.table(Object.keys(environments), function (row, s) {
          row.cell('Name', s);
        });
      }

      callback();
    });

  environment.command('show [environment]')
    .description($('Show an environment'))
    .option('--environment <environment>', $('the environment name'))
    .execute(function (environment, options, _) {
      environment = cli.interaction.promptIfNotGiven('Environment name: ', environment, _);

      var existingEnvironment = profile.current.getEnvironment(environment);

      if (!existingEnvironment) {
        throw new Error(util.format($('Unknown environment %s'), environment));
      } else {
        if (log.format().json) {
          log.json(existingEnvironment);
        } else {
          fields = __.keys(existingEnvironment);
          var endpointsForDisplay = __.object(fields.map(function (endpoint) {
            var value = '';
            try {
              value = existingEnvironment[endpoint];
            } catch(ex) {
              // endpoint's not set
            }
            return [endpoint, value];
          }));

          var report = fields.sort()
            .filter(function (field) { return field !== 'name'; })
            .map(function (field) { return [field, field]; });

          log.report([['Name', 'name']].concat(report), endpointsForDisplay);
          return;
        }
      }
    });

  //
  // Convert a property name from the environment
  // from 'managementEndpointUrl' to '--management-endpoint-url'
  //
  function nameToOptionString(name) {
    var parts = name.split(/(?=[A-Z])/);
    return util.format('--%s <%s>',
      parts.map(function (s) { return s.toLowerCase(); }).join('-'),
      name);
  }

  //
  // Add an option to the given command for each
  // parameter in an environment.
  //
  function addEnvironmentOptions(cmd) {
    profile.Environment.parameters
      .sort(function (p) { return p.name; })
      .forEach(function (p) {
        cmd.option(nameToOptionString(p.name), p.description);
      });
    return cmd;
  }

  function createUpdateObject(options) {
    return __.pick(options, __.pluck(profile.Environment.parameters, 'name'));
  }

  var addCommand = environment.command('add [environment]')
    .description($('Add an environment'))
    .option('--environment <environment>', $('the environment name'));

  addCommand = addEnvironmentOptions(addCommand);
  addCommand
    .execute(function (environment, options, _) {
      environment = cli.interaction.promptIfNotGiven('New Environment name: ', environment, _);

      var existingEnvironment = profile.current.getEnvironment(environment);

      if (existingEnvironment) {
        throw new Error(util.format($('Duplicate environment %s'), existingEnvironment));
      }

      var update = createUpdateObject(options);
      if (!update.managementEndpointUrl) {
        throw new Error($('management endpoint url must be given when creating an environment'));
      }

      var newEnvironment = new profile.Environment(update);
      newEnvironment.name = environment;
      profile.current.addEnvironment(newEnvironment);
      profile.current.save();
      log.info(util.format($('New environment %s created'), environment));
    });

  var setCommand = environment.command('set [environment]')
    .description($('Update an environment'))
    .option('--environment <environment>', $('the environment name'));

  setCommand = addEnvironmentOptions(setCommand);

  setCommand
    .execute(function (environment, options, _) {
      environment = cli.interaction.promptIfNotGiven('New Environment name: ', environment, _);

      var updates = createUpdateObject(options);
      if (__.keys(updates).length === 0) {
        throw new Error($('No URL to update was specified'));
      }

      var existingEnvironment = profile.current.getEnvironment(environment);

      if (!existingEnvironment) {
        throw new Error(util.format($('Unknown environment %s'), environment));
      } else {
        __.extend(existingEnvironment, updates);
        profile.current.save();
      }
    });

  environment.command('delete [environment]')
    .description($('Delete an environment'))
    .option('--environment <environment>', $('the environment name'))
    .execute(function (environment, options, _) {
      environment = cli.interaction.promptIfNotGiven('New Environment name: ', environment, _);

      var existingEnvironment = profile.current.getEnvironment(environment);

      if (!existingEnvironment) {
        throw new Error(util.format($('Unknown environment %s'), environment));
      } else {
        profile.current.deleteEnvironment(existingEnvironment);
        profile.current.save();
      }
    });
};