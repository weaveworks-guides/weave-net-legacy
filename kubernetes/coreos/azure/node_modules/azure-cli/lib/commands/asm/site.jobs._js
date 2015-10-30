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

var path = require('path');
var fs = require('fs');
var util = require('util');

var profile = require('../../util/profile');
var utils = require('../../util/utils');
var WebsitesClient = require('./websites/websitesclient');

var validation = require('../../util/validation');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var site = cli.category('site');
  var siteJobs = site.category('job')
    .description($('Commands to manage your Web Site WebJobs'));

  siteJobs.command('list [name]')
    .description($('List all the WebJobs under a web site'))
    .option('--job-type <job-type>', $('optional. The type of the webjob. Valid value is "triggered" or "continuous". By default return webjobs of all types.'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      if (options.jobType) {
        validation.isValidEnumValue(options.jobType, [ 'continuous', 'triggered' ]);
      }

      var service = createWebsiteExtensionsClient(context, _);
      var continuousJobs;
      var triggeredJobs;
      var webJobs = [];

      var progress = cli.interaction.progress($('Getting WebJobs'));
      try {
        if (!options.jobType || options.jobType === 'continuous') {
          continuousJobs = service.continuousWebJobs.list(_);
        }

        if (!options.jobType || options.jobType === 'triggered') {
          triggeredJobs = service.triggeredWebJobs.list(_);
        }
      } finally {
        progress.end();
      }

      if (continuousJobs) {
        webJobs = webJobs.concat(continuousJobs.continuousWebJobs);
      }

      if (triggeredJobs) {
        webJobs = webJobs.concat(triggeredJobs.triggeredWebJobs);
      }

      cli.interaction.formatOutput(webJobs, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Name'), item.name);
            row.cell($('Type'), item.type);
            row.cell($('Run Command'), item.runCommand);
            row.cell($('Status'), item.status);
          });
        } else {
          log.info($('No jobs exist.'));
        }
      });
    });

  siteJobs.command('show [jobName] [jobType] [name]')
    .usage('[options] <jobName> <jobType> [name]')
    .description($('Show details of a specific webjob'))
    .option('--job-name <job-name>', $('required. The name of the webjob.'))
    .option('--job-type <job-type>', $('required. The type of the webjob. Valid value is "triggered" or "continuous".'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (jobName, jobType, name, options, _) {
      if (jobType) {
        validation.isValidEnumValue(jobType, [ 'continuous', 'triggered' ]);
      } else {
        throw new Error($('--job-type is required'));
      }

      if (!jobName) {
        throw new Error($('--job-name is required'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      var service = createWebsiteExtensionsClient(context, _);
      var operation = service[jobType.toLowerCase() + 'WebJobs'];

      var webJob;
      var progress = cli.interaction.progress($('Getting WebJob'));
      try {
        webJob = operation.get(jobName, _);
      } finally {
        progress.end();
      }

      var jobTypeKey = jobType.toLowerCase() + 'WebJob';

	  if (log.format().json) {
	    log.json(webJob[jobTypeKey]);
	  } else {
        cli.interaction.logEachData($('WebJob'), webJob[jobTypeKey]);
	  }
    });

  siteJobs.command('delete [jobName] [jobType] [name]')
    .usage('[options] <jobName> <jobType> [name]')
    .description($('Delete a WebJob'))
    .option('--job-name <job-name>', $('required. The name of the webjob.'))
    .option('--job-type <job-type>', $('required. The type of the webjob. Valid value is "triggered" or "continuous".'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (jobName, jobType, name, options, _) {
      if (jobType) {
        validation.isValidEnumValue(jobType, [ 'continuous', 'triggered' ]);
      } else {
        throw new Error($('--job-type is required'));
      }

      if (!jobName) {
        throw new Error($('--job-name is required'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      if (!options.quiet && !cli.interaction.confirm(util.format('Delete WebJob %s? [y/n] ', jobName), _)) {
        return;
      }

      var service = createWebsiteExtensionsClient(context, _);
      var operation = service[jobType.toLowerCase() + 'WebJobs'];
      var progress = cli.interaction.progress($('Deleting WebJob'));
      try {
        operation.deleteMethod(jobName, _);
      } finally {
        progress.end();
      }

      log.info(util.format($('WebJob %s has been deleted'), jobName));
    });

  siteJobs.command('upload [jobName] [jobType] [jobFile] [name]')
    .usage('[options] <jobName> <jobType> <jobFile> [name]')
    .description($('Upload a new WebJob'))
    .option('--job-name <job-name>', $('required. The name of the webjob.'))
    .option('--job-type <job-type>', $('required. The type of the webjob. Valid values are "triggered" or "continuous".'))
    .option('--job-file <job-file>', $('required. The job file.'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (jobName, jobType, jobFile, name, options, _) {
      if (jobType) {
        validation.isValidEnumValue(jobType, [ 'continuous', 'triggered' ]);
      } else {
        throw new Error($('--job-type is required'));
      }

      if (!jobName) {
        throw new Error($('--job-name is required'));
      }

      if (!jobFile) {
        throw new Error($('--job-file is required'));
      } else if (!fs.existsSync(jobFile)) {
        throw new Error($('Specified file does not exist'));
      } else if (path.extname(jobFile) !== '.zip') {
        throw new Error($('WebJobs need to be zip files'));
      }

      if (options.singleton &&
        !utils.ignoreCaseEquals(jobType, 'continuous')) {
        throw new Error($('Only continuous jobs can be set to singleton'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      var service = createWebsiteExtensionsClient(context, _);
      var progress = cli.interaction.progress($('Uploading new WebJob'));
      try {
        var fileContent = fs.readFile(jobFile, _);
        var operation = service[jobType.toLowerCase() + 'WebJobs'];
        operation.uploadZip(jobName, path.basename(jobFile), fileContent, _);
      } finally {
        progress.end();
      }

      checkIfValid(service, jobName, jobType, _);

      log.info(util.format($('WebJob %s has been uploaded'), jobName));
    });

  function checkIfValid (service, jobName, jobType, callback) {
    setTimeout(function () {
      var progress = cli.interaction.progress($('Getting WebJob'));
      var operation = service[jobType.toLowerCase() + 'WebJobs'];
      operation.get(jobName, function (err) {
        progress.end();

        if (err) {
          callback(new Error($('WebJob is not valid')));
        } else {
          callback();
        }
      });
    }, 2000);
  }

  siteJobs.command('start [jobName] [jobType] [name]')
    .usage('[options] <jobName> <jobType> [name]')
    .description($('Start a WebJob'))
    .option('--job-name <job-name>', $('required. The name of the webjob.'))
    .option('--job-type <job-type>', $('required. The type of the webjob. Valid value is "triggered" or "continuous".'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (jobName, jobType, name, options, _) {
      if (jobType) {
        validation.isValidEnumValue(jobType, [ 'continuous', 'triggered' ]);
      } else {
        throw new Error($('--job-type is required'));
      }

      if (!jobName) {
        throw new Error($('--job-name is required'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      var service = createWebsiteExtensionsClient(context, _);
      var progress = cli.interaction.progress($('Starting WebJob'));
      try {
        if (utils.ignoreCaseEquals(jobType, 'continuous')) {
          service.continuousWebJobs.start(jobName, _);
        } else if (utils.ignoreCaseEquals(jobType, 'triggered')) {
          service.triggeredWebJobs.run(jobName, _);
        }
      } finally {
        progress.end();
      }

      log.info(util.format($('WebJob %s has been started'), jobName));
    });

  siteJobs.command('stop [jobName] [name]')
    .usage('[options] <jobName> <jobType> [name]')
    .description($('Stops a WebJob. Only continuous jobs can  be stopped'))
    .option('--job-name <job-name>', $('required. The name of the webjob.'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (jobName, name, options, _) {
      if (!jobName) {
        throw new Error($('--job-name is required'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      var service = createWebsiteExtensionsClient(context, _);
      var progress = cli.interaction.progress($('Stopping WebJob'));
      try {
        service.continuousWebJobs.stop(jobName, _);
      } finally {
        progress.end();
      }

      log.info(util.format($('WebJob %s has been stopped'), jobName));
    });

  var siteJobHistory = siteJobs.category('history')
    .description($('Commands to manage your Web Site WebJobs History'));

  siteJobHistory.command('list [jobName] [name]')
    .description($('List all the triggered WebJobs runs under a web site'))
    .option('--job-name <job-name>', $('required. The name of the webjob.'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (jobName, name, options, _) {
      if (!jobName) {
        throw new Error($('--job-name is required'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      var service = createWebsiteExtensionsClient(context, _);

      var webJobRuns;
      var progress = cli.interaction.progress($('Getting WebJob runs'));
      try {
        webJobRuns = service.triggeredWebJobs.listRuns(jobName, _);
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(webJobRuns.triggeredWebJobRuns, function (data) {
        if (data.length > 0) {
          log.table(data, function (row, item) {
            row.cell($('Id'), item.id);
            row.cell($('Status'), item.status);

            var duration = item.duration;
            row.cell($('Duration'), util.format('%d:%d:%d.%d',
              duration.hours(), duration.minutes(),
              duration.seconds(), duration.milliseconds));
            row.cell($('Start Time'), item.startTime);
            row.cell($('End Time'), item.endTime);
          });
        } else {
          log.info($('No job runs exist.'));
        }
      });
    });

  siteJobHistory.command('show [jobName] [runId] [name]')
    .description($('Get the detaisl for a triggered WebJobs run under a web site'))
    .option('--job-name <job-name>', $('required. The name of the webjob.'))
    .option('--run-id <run-id>', $('optional. The id of the run history. If not specified, show the latest run.'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (jobName, runId, name, options, _) {
      if (!jobName) {
        throw new Error($('--job-name is required'));
      }

      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      var service = createWebsiteExtensionsClient(context, _);

      var webJobRun;
      var progress = cli.interaction.progress($('Getting WebJob run'));
      try {
        webJobRun = service.triggeredWebJobs.getRun(jobName, runId, _);
      } finally {
        progress.end();
      }

      cli.interaction.logEachData($('WebJob run'), webJobRun.triggeredJobRun);
    });

  function createWebsiteExtensionsClient(context, _) {
    var websiteClient = new WebsitesClient(cli, context.subscription);
    websiteClient.lookupSiteNameAndWebSpace(context, _);
    var siteData = websiteClient.getSite(context, _);
    var authData = websiteClient.getRepositoryAuthData(siteData);
    var siteName = WebsitesClient.getSiteHostName(context.site.name, context.site.slot);
    var hostNameSuffix = websiteClient.getHostNameSuffix(context.subscription, _);
    var service = utils.createWebSiteExtensionsClient(siteName, hostNameSuffix, authData.username, authData.password);

    return service;
  }
};
