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

var fs = require('fs');
var path = require('path');
var util = require('util');

var profile = require('../../util/profile');
var utils = require('../../util/utils');

var WebsitesClient = require('./websites/websitesclient');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var site = cli.category('site');

  var diagnostic = site.category('log')
    .description($('Commands to manage your Web Site diagnostics'));

  diagnostic.command('download [name]')
    .description($('Download diagnostic log'))
    .option('-o, --output <path>', $('the output path, default is local folder'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        path: '',
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      if (options.output && __.isString(options.output)) {
        context.path = options.output;
      }

      if (!(/[.]zip$/i.test(context.path))) {
        context.path = path.join(context.path, 'diagnostics.zip');
      }

      if (utils.pathExistsSync(context.path)) {
        if (!cli.interaction.confirm(util.format($('Replace existing %s ? [y/n] ', context.path), _))) {
          return;
        }
      }

      var repositoryUri = site.ensureRepositoryUri(context, _);
      if (repositoryUri) {
        doDownloadDiagnostic(context, _);
      } else {
        log.error($('Repository is not setup'));
      }
    });

  diagnostic.command('tail [name]')
    .description($('Live diagnostic log'))
    .option('-p, --path <path>', $('the log path under LogFiles folder'))
    .option('-f, --filter <filter>', $('the filter matching line'))
    .option('--log', $('indicates to write output as log data'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        path: options.path || '',
        filter: options.filter || '',
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        },
      };

      var repositoryUri = site.ensureRepositoryUri(context, _);
      if (repositoryUri) {
        var buf = doLogStream(context, _, function (err, line) {
          if (options.log) {
            log.data(line);
          } else {
            process.stdout.write(line);
          }
        });
        log.info(buf);
      } else {
        log.error($('Repository is not setup'));
      }
    });

  diagnostic.command('set [name]')
    .description($('Configure diagnostics'))
    .option('-a, --application', $('use this flag to enable application diagnostics.'))
    .option('-A, --disable-application', $('use this flag to disable application diagnostics.'))
    .option('-w, --web-server-logging', $('use this flag to enable web server logging.'))
    .option('-W, --disable-web-server-logging', $('use this flag to disable web server logging.'))
    .option('-e, --detailed-error-messages', $('use this flag to enable detailed error messages.'))
    .option('-E, --disable-detailed-error-messages', $('use this flag to disable detailed error messages.'))
    .option('-f, --failed-request-tracing', $('use this flag to enable failed request tracing.'))
    .option('-F, --disable-failed-request-tracing', $('use this flag to disable failed request tracing.'))
    .option('-o, --out <out>', $('takes file or storage. When -a is specified, use this parameter to specify the output of the log.'))
    .option('-l, --level <level>', $('takes error, warning, verbose or info. When -a is specified, use this parameter to specify the log level. But default is error.'))
    .option('-t, --storage-account <storage-account>', $('use this parameter to specify the storage account where the log will be stored.'))
    .option('--slot <slot>', $('the name of the slot'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      if (!(options.webServerLogging ||
        options.disableWebServerLogging ||
        options.detailedErrorMessages ||
        options.disableDetailedErrorMessages ||
        options.failedRequestTracing ||
        options.disableFailedRequestTracing ||
        options.application ||
        options.disableApplication)) {
        throw new Error($('Command needs to perform at least one diagnostic change'));
      }

      if (options.application || options.disableApplication) {
        if (options.application) {
          options.out = cli.interaction.chooseIfNotGiven($('Output: '), 'Getting output options', options.out,
              function (cb) {
                return cb(null, [ 'file', 'storage' ]);
              }, _);

          if (options.out === 'storage') {
            options.storageAccount = cli.interaction.chooseIfNotGiven($('Storage account: '), $('Getting storage accounts'), options.storageAccount,
              function (cb) {
                var storageService = utils.createStorageClient(profile.current.getSubscription(options.subscription));
                storageService.storageAccounts.list(function (err, accounts) {
                  if (err) { return cb(err); }
                  cb(null, accounts.storageServices.map(function (a) {
                    return a.serviceName;
                  }));
                });
              }, _);
          }
        }

        if (options.level) {
          options.level = options.level.toLowerCase();
          if (options.level === 'error') {
            options.level = 'Error';
          } else if (options.level === 'warning') {
            options.level = 'Warning';
          } else if (options.level === 'verbose') {
            options.level = 'Verbose';
          } else if (options.level === 'info') {
            options.level = 'Information';
          } else {
            throw new Error($('Invalid error level'));
          }
        } else {
          // Default is error
          options.level = 'Error';
        }

        var subscriptionId = profile.current.getSubscription(options.subscription).id;
        var websitesClient = new WebsitesClient(cli, subscriptionId);
        if (options.application === true) {
          websitesClient.enableApplicationDiagnostic(name, options.out, { level: options.level, storageAccount: options.storageAccount }, _);
        } else if (options.disableApplication === true) {
          websitesClient.disableApplicationDiagnostic(name, options.out, { level: options.level, storageAccount: options.storageAccount }, _);
        }
      }

      if (options.webServerLogging ||
        options.disableWebServerLogging ||
        options.detailedErrorMessages ||
        options.disableDetailedErrorMessages ||
        options.failedRequestTracing ||
        options.disableFailedRequestTracing) {

        var parsedSiteName = WebsitesClient.parseSiteName(name);
        var context = {
          subscription: profile.current.getSubscription(options.subscription).id,
          site: {
            name: parsedSiteName.name,
            slot: options.slot ? options.slot : parsedSiteName.slot
          },
        };

        site.lookupSiteNameAndWebSpace(context, _);
        var config = {};

        if (options.webServerLogging || options.disableWebServerLogging) {
          config.httpLoggingEnabled = (options.webServerLogging === true).toString();
        }

        if (options.detailedErrorMessages || options.disableDetailedErrorMessages) {
          config.detailedErrorLoggingEnabled = (options.detailedErrorMessages === true).toString();
        }

        if (options.failedRequestTracing || options.disableFailedRequestTracing) {
          config.requestTracingEnabled = (options.failedRequestTracing === true).toString();
        }

        site.doSiteConfigPUT(config, context, _);
      }
    });

  function doDownloadDiagnostic(context, done) {
    var service = utils.createScmManagementService(context.repositoryUri, context.repositoryAuth, log);
    var progress = cli.interaction.progress(util.format($('Downloading diagnostic log to %s'), context.path));
    var logStream = fs.createWriteStream(context.path);
    var isDone = false;
    service.getDumpToStream(logStream, function (err) {
      if (err) {
        progress.end();
        if (!isDone) {
          isDone = true;
          done(err);
        }
      }
    });

    logStream.on('error', function (err) {
      if (!isDone) {
        progress.end();
        isDone = true;
        done(err);
      }
    });

    logStream.on('close', function () {
      if (!isDone) {
        progress.end();
        isDone = true;
        done();
      }
    });
  }

  function doLogStream(context, _, chunkcb) {
    var service = utils.createScmManagementService(context.repositoryUri, context.repositoryAuth, log);

    var options = {};
    if (context.filter) {
      options['filter'] = context.filter;
    }

    return service.getLogStream(context.path, { filter: context.filter }, chunkcb, _);
  }
};
