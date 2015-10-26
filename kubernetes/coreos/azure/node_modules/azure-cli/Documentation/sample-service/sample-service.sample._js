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

/*
* You can test sample commands get loaded by xplat by following steps:
* a. Copy the folder to '<repository root>\lib\commands\arm'
* b. Under <repository root>, run 'node bin/azure config mode arm'
* c. Run 'node bin/azure', you should see 'sample' listed as a command set
* d. Run 'node bin/azure', you should see 'create', "delete", etc 
      showing up in the help text 
*/

'use strict';

var util = require('util');

var profile = require('../../../util/profile');
var utils = require('../../../util/utils');

var sampleUtils = require('./sampleUtils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var sample = cli.category('sample')
    .description($('Commands to manage your Azure samples'));

  sample.command('create [sampleName]')
    .description($('Create a sample'))
    .option('--sampleName <sampleName>', $('the name of the new sample'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (sampleName, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.getSampleClient(subscription);

      if (!sampleName) {
        return cli.missingArgument('sampleName');
      }

      var progress = cli.interaction.progress(util.format($('Creating sample %s'), sampleName));
      var result;
      try {
        result = client.samples.create(sampleName, _);
      } finally {
        progress.end();
      }

      var samples = [];
      sample.push(result.sample);
      cli.interaction.formatOutput(samples, function (data) {
          if (data.length === 0) {
            log.info($('No samples defined'));
          } else {
            log.table(data, displayASample);
          }
      });
    });

  sample.command('delete [sampleName]')
    .description($('Create a sample'))
    .option('--sampleName <sampleName>', $('the name of the sample to delete'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (sampleName, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.getSampleClient(subscription);
      
      if (!sampleName) {
        return cli.missingArgument('sampleName');
      }

      var progress = cli.interaction.progress(util.format($('Deleting sample %s'), sampleName));

      var result;
      try {
        result = client.samples.delete(sampleName, _);
      } finally {
        progress.end();
      }
    });

  sample.command('list')
    .description($('Get all available samples'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.getSampleClient(subscription);
      var progress = cli.interaction.progress($('Listing samples'));
      var result;
      try {
        result = client.samples.list(_);
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(result.samples, function (data) {
        if (data.length === 0) {
          log.info($('No samples defined'));
        } else {
          log.table(data, displayASample);
        }
      });
    });

  sample.command('show [name]')
    .description($('Get an available sample'))
    .option('-n --name <name>', $('the sample name'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
    if (!name) {
      return cli.missingArgument('name');
    }
    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.getSampleClient(subscription);
    var progress = cli.interaction.progress($('Getting sample'));
    var result;
    try {
      result = client.sample.list(_);
    } finally {
      progress.end();
    }

    var samples = result.sample.filter(function (r) {
      return utils.ignoreCaseEquals(r.properties.sampleName, name);
    });

    cli.interaction.formatOutput(samples, function (data) {
      if (data.length === 0) {
        log.info($('No samples found'));
      } else {
        log.table(data, displayASample);
      }
    });
  });
};

function displayASample(row, sample) {
  row.cell($('Name'), sample.properties.sampleName);
  var sampleDetails = sampleUtils.getsampleDetails(sample);
  row.cell($('Properties'), sampleDetails.properties);
}
