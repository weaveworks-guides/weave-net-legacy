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

var fs = require('fs');
var path = require('path');
var uuid = require('node-uuid');
var async = require('async');
var azureCommon = require('azure-common');

var profile = require('../../util/profile');
var utils = require('../../util/utils');
var PipelineChannel = require('./mobile/pipelineChannel');
var WebResource = azureCommon.WebResource;

var util = require('util');
var __ = require('underscore');
var $ = utils.getLocaleString;

exports.init = function (cli) {

  var log = cli.output;

  function serviceFilter(service, platform, externalPushEntity) {
    servicePlatform = service.platform || 'node';
    servicePushEntity = service.enableExternalPushEntity || 'false';

    if (platform != 'any' && servicePlatform != platform) {
      return false;
    }

    if (externalPushEntity != 'any' && servicePushEntity != externalPushEntity) {
      return false;
    }

    return true;
  }

  function nodeFilter(service) {
    return serviceFilter(service, 'node', 'any');
  }

  function defaultFilter(service) {
    return serviceFilter(service, 'any', 'any');
  }

  function promptServiceNameIfNotGiven(options, servicename, serviceFilter, _) {
    var result = cli.interaction.chooseIfNotGiven($('Mobile Service: '), $('Retrieving choices'), servicename,
      function (cb) {
        mobile.listServices(options, function (error, services) {
          if (error) { cb(error); }
          cb(null, services.filter(serviceFilter).map(function (service) { return service.name; }));
        });
      }, _);

    return result;
  }

  function promptTableNameIfNotGiven(options, tableName, _) {
    var result = cli.interaction.chooseIfNotGiven($('Table: '), $('Retrieving choices'), tableName,
      function (cb) {
        mobile.listTables(options, function (error, tables) {
          if (error) { cb(error); }
          cb(null, tables.map(function (table) { return table.name; }));
        });
      }, _);

    return result;
  }

  function promptDomainIfNotGiven(options, domain, _) {
    var result = cli.interaction.chooseIfNotGiven($('Domain: '), $('Retrieving choices'), domain,
      function (cb) {
        mobile.getDomains(options, function (error, domains) {
          if (error) { cb(error); }
          cb(null, domains.map(function (domain) { return domain; }));
        });
      }, _);

    return result;
  }

  function promptThumbprintIfNotGiven(options, thumbprint, _) {
    var result = cli.interaction.chooseIfNotGiven($('Thumbprint: '), $('Retrieving choices'), thumbprint,
      function (cb) {
        mobile.getCertificates(options, function (error, certificates) {
          if (error) { cb(error); }
          cb(null, certificates.map(function (certificate) { return certificate.thumbprint; }));
        });
      }, _);

    return result;
  }

  function promptIfNotGiven(prompt, value, _) {
    var result = cli.interaction.promptIfNotGiven(prompt, value, _);
    if (result.length === 0) {
      throw new Error(util.format($('%s must be specified'), prompt.split(':')[0]));
    }
    return result;
  }

  function promptString(prompt, callback) {
    cli.prompt(prompt, function (text) {
      if (text.length > 0) {
        callback(text);
      } else {
        throw (new Error(util.format($('%s must be specified'), prompt.split(':')[0])));
      }
    });
  }

  function getWebResource(options) {
    // Create HTTP transport objects
    var currentSubscription = profile.current.getSubscription(options.subscription),
        httpRequest = new WebResource();

    options.subscription = currentSubscription.id;

    httpRequest.url = currentSubscription.managementEndpointUrl + '/' + options.subscription;
    httpRequest = httpRequest.withHeader('x-ms-version', '2014-01-01');

    return httpRequest;
  }

  function createClient(options) {
    var currentSubscription = profile.current.getSubscription(options.subscription);
    return utils.createMobileClient(currentSubscription);
  }

  function getMobileChannel(options) {
    var client = createClient(options),
        webResource = getWebResource(options);

    webResource.json = true;

    var channel = new PipelineChannel(client, webResource, log)
        .path('services')
        .path('mobileservices')
        .header('Accept', 'application/json');

    return channel;
  }

  function getAppManagerChannel(options) {
    var client = createClient(options),
        webResource = getWebResource(options);

    webResource.json = false;
    var channel = new PipelineChannel(client, webResource, log)
        .header('Accept', 'application/xml')
        .path('applications');

    return channel;
  }

  function getOperationChannel(options, requestId) {
    var client = createClient(options),
        webResource = getWebResource(options);
        webResource.json = true;

    var channel = new PipelineChannel(client, webResource, log)
        .path('operations')
        .path(requestId)
        .header('Accept', 'application/json');

    return channel;
  }

  var mobile = cli.category('mobile')
    .description($('Commands to manage your Mobile Services'));

  mobile.getRegions = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('regions');

    channel.get(callback);
  };

  mobile.listServices = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices');

    channel.get(callback);
  };

  mobile.getService = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename);

    channel.get(callback);
  };

  mobile.recover = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('recover')
      .query('targetMobileService', options.targetservicename);

    channel.post(null, callback);
  };

 mobile.migrate = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('migrate')
      .query('targetMobileService', options.targetservicename);

    channel.post(null, callback);
  };

 mobile.getMigrationState = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('migrate')
      .query('operationId', options.orchestrationId);

    channel.get(callback);
  };

  mobile.getScaleSettings = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scalesettings');

    channel.get(function (error, scalesettings) {
      if (scalesettings) {
        scalesettings.numberOfInstances = scalesettings.numberOfInstances || 1;
        scalesettings.tier = findScale(scalesettings.tier || 'tier1', true);
      }

      callback(error, scalesettings);
    });
  };

  mobile.setScaleSettings = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scalesettings')
      .header('Content-Type', 'application/json');

    log.silly($('New scale settings:'));
    log.json('silly', settings);

    channel.put(JSON.stringify(settings), callback);
  };

  mobile.getServiceSettings = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('settings');

    channel.get(callback);
  };

  /**
  * Formats the raw crossDomainWhitelist setting into a string for display
  * @param {array} [crossDomainWhitelist] Array of hosts in form of { host: value }
  * @return {string} Comma seperated list of hosts
  */
  function formatCrossDomainWhitelistForDisplay(crossDomainWhitelist) {
    var result = '';
    if (crossDomainWhitelist) {
      if (Array.isArray(crossDomainWhitelist)) {
        var data = [];
        crossDomainWhitelist.forEach(function (host) { data.push(host.host); });
        result = data.join(',');
      }
    } else {
      result = 'localhost';
    }

    return result;
  }

  /**
  * Converts a comma seperated list of the crossDomainWhitelists into their
  * raw value representation of { host: value }
  * @param {string} [crossDomainWhitelist] Comma seperated list of hosts
  * @return {array} Array of hosts in form of { host: value }
  */
  function formatCrossDomainWhitelistForSaving(crossDomainWhitelist) {
    var result = [];
    crossDomainWhitelist.split(',').forEach(function (host) {
      result.push({ host: host });
    });
    return result;
  }

  mobile.setServiceSettings = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('settings')
      .header('Content-Type', 'application/json');

    log.silly($('New service settings:'));
    log.json('silly', settings);

    channel.patch(JSON.stringify(settings), callback);
  };

  mobile.getAuthSettings = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('authsettings');

    channel.get(callback);
  };

  mobile.setAuthSettings = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('authsettings')
      .header('Content-Type', 'application/json');

    log.silly($('New auth settings:'));
    log.json('silly', settings);

    channel.put(JSON.stringify(settings), callback);
  };

  mobile.getApnsSettings = function (options, callback) {
    mobile.getPushSettings(options, function (err, settings) {
      if (err) {
        callback(err);
      } else {
        var apns = settings.apnsCredentials;
        var result = {
          mode: 'none'
        };

        if (apns.apnsCertificate) {
          if (apns.endpoint === 'gateway.push.apple.com') {
            result.mode = 'prod';
          } else if (apns.endpoint === 'gateway.sandbox.push.apple.com') {
            result.mode = 'dev';
          }
        }

        callback(null, result);
      }
    });
  };

  mobile.setApnsSettings = function (options, settings, callback) {
    var apnsSettings = {
      apnsCredentials: {
        endpoint: 'None',
        apnsCertificate: settings.data,
        certificateKey: settings.password
      }
    };

    if (settings.mode === 'dev') {
      apnsSettings.apnsCredentials.endpoint = 'gateway.sandbox.push.apple.com';
    } else if (settings.mode === 'prod') {
      apnsSettings.apnsCredentials.endpoint = 'gateway.push.apple.com';
    }

    mobile.patchPushSettings(options, apnsSettings, callback);
  };

  mobile.getPushSettings = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
        .path('mobileservices')
        .path(options.servicename)
        .path('pushsettings');

    channel.get(callback);
  };

  mobile.patchPushSettings = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('pushsettings')
      .header('Content-Type', 'application/json');

    log.silly($('patch push settings:'));
    log.json('silly', settings);

    channel.patch(JSON.stringify(settings), callback);
  };

  mobile.getPushEntity = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
        .path('mobileservices')
        .path(options.servicename)
        .path('pushentity');

    channel.get(callback);
  };

  mobile.waitForPushEnabling = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
        .path('mobileservices')
        .path(options.servicename)
        .path('pushentity');

    channel.poll(function (error, body) {
      var retry = false;

      if (error) {
        callback(new Error($('Unable to determine the status of the async operation. Please check the status on the management portal.')));
      } else {
        log.silly($('push entity status'));
        log.json('silly', body);

        var status = body.externalPushEntitySettingsPropertyBag.externalPushEntityState;

        if (status === 'healthy') {
          callback();
        } else if (status === 'unhealthy') {
          callback(new Error($('Operation failed. Please confirm the status on the management portal')));
        } else {
          retry = true;
        }
      }
      
      return retry;
    });
  };

  mobile.setPushEntity = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
        .path('mobileservices')
        .path(options.servicename)
        .path('pushentity')
        .header('Content-Type', 'application/json');

    log.silly($('push entity settings'));
    log.json('silly', settings);

    channel.put(JSON.stringify(settings), callback);
  };

  mobile.getPreviews = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('previewfeatures');

    channel.get(callback);
  };

  mobile.enablePreview = function (options, feature, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('previewfeatures')
      .header('Content-Type', 'application/json');

    log.silly($('Enabling preview feature'));
    log.json('silly', feature);

    channel.post(JSON.stringify(feature), callback);
  };

  mobile.regenerateKey = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('regenerateKey')
      .query('type', options.type);

    channel.post(null, callback);
  };

  mobile.setKey = function (options, key, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('keys')
      .header('Content-Type', 'application/json');

    log.silly($('Setting key'));
    log.json('silly', key);

    channel.put(JSON.stringify(key), callback);
  };

  mobile.restartService = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('restart');

    channel.post(null, callback);
  };

  mobile.redeployService = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('redeploy');

    channel.post(null, callback);
  };

  mobile.getLogs = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('logs');

    if (options.query) {
      options.query.split('&').forEach(function (keyvalue) {
        var kv = keyvalue.split('=');
        if (kv.length === 2) {
          channel.query(kv[0], kv[1]);
        }
        else {
          return callback(new Error($('Invalid format of query parameter')));
        }
      });
    } else {
      if (options.continuationToken) {
        channel.query('continuationToken', options.continuationToken);
      }

      channel.query('$top', options.top || 10);

      var filter = [];
      if (options.type) {
        filter.push('Type eq \'' + options.type + '\'');
      }
      if (options.source) {
        filter.push('Source eq \'' + options.source + '\'');
      }
      if (filter.length > 0) {
        channel.query('$filter', filter.join(' and '));
      }
    }

    channel.get(callback);
  };

  mobile.listTables = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables');

    channel.get(callback);
  };

  mobile.getRepositorySharedFolder = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('repository')
      .path('service')
      .path('shared');

    channel.get(callback);
  };

  mobile.getSharedScripts = function (options, _) {
    var files = mobile.getRepositorySharedFolder(options, _);
    return __.filter(files, function (file) { return file.name.indexOf('.js', file.length - 3) !== -1; });
  };

  mobile.getSharedScript = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('repository')
      .path('service')
      .path('shared')
      .path(options.script.shared.name + '.js');

    channel.get(callback);
  };

  mobile.setSharedScript = function (options, script, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('repository')
      .path('service')
      .path('shared')
      .path(options.script.shared.name + '.js')
      .header('Content-Type', 'text/plain')
      .header('If-Match', '*');

    channel.put(script, callback);
  };

  mobile.loadAllScripts = function (options, _) {
    var results = async.parallel({
      table: function (_) { return mobile.getAllTableScripts(options, _); },
      shared: function (_) { return mobile.getSharedScripts(options, _); },
      scheduler: function (_) { return mobile.getSchedulerScripts(options, _); },
      api: function (_) { return mobile.getCustomApis(options, _); }
    }, _);

    return results;
  };

  mobile.deleteSharedScript = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('repository')
      .path('service')
      .path('shared')
      .path(options.script.shared.name + '.js')
      .header('If-Match', '*');

    channel.delete(callback);
  };

  /* Custom API Functions */

  mobile.getCustomApis = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('apis');

    channel.get(callback);
  };

  mobile.createApi = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('apis')
      .header('Content-Type', 'application/json');

    log.silly($('New api settings:'));
    log.json('silly', settings);

    channel.post(JSON.stringify(settings), callback);
  };

  mobile.getCustomApi = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('apis')
      .path(options.apiname || options.script.api.name);

    channel.get(callback);
  };

  mobile.setCustomApi = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('apis')
      .path(options.apiname || options.script.api.name)
      .header('Content-Type', 'application/json');

    log.silly($('Updated api settings:'));
    log.json('silly', settings);

    channel.put(JSON.stringify(settings), callback);
  };

  mobile.getCustomApiScript = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('apis')
      .path(options.apiname || options.script.api.name)
      .path('script');

    channel.get(callback);
  };

  mobile.setCustomApiScript = function (options, script, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('apis')
      .path(options.apiname || options.script.api.name)
      .path('script')
      .header('Content-Type', 'text/plain');

    channel.put(script, callback);
  };

  mobile.deleteCustomApi = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('apis')
      .path(options.apiname || options.script.api.name);

    channel.delete(callback);
  };

  /* Scheduler Functions */

  mobile.getSchedulerScripts = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scheduler')
      .path('jobs');

    channel.get(callback);
  };

  mobile.getJob = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scheduler')
      .path('jobs')
      .path(options.jobname);

    channel.get(callback);
  };

  mobile.getSchedulerScript = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scheduler')
      .path('jobs')
      .path(options.script.scheduler.name)
      .path('script');

    channel.get(callback);
  };

  mobile.setSchedulerScript = function (options, script, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scheduler')
      .path('jobs')
      .path(options.script.scheduler.name)
      .path('script')
      .header('Content-Type', 'text/plain');

    channel.put(script, callback);
  };

  mobile.deleteSchedulerScript = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scheduler')
      .path('jobs')
      .path(options.jobname || options.script.scheduler.name);

    channel.delete(callback);
  };

  mobile.createJob = function (options, job, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scheduler')
      .path('jobs')
      .header('Content-Type', 'application/json');

    channel.post(job, callback);
  };

  mobile.setJob = function (options, job, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('scheduler')
      .path('jobs')
      .path(options.jobname)
      .header('Content-Type', 'application/json');

    log.silly($('New job settings:'));
    log.json('silly', job);

    channel.put(JSON.stringify(job), callback);
  };

  mobile.getTableScripts = function (options, table, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(table)
      .path('scripts');

    channel.get(callback);
  };

  mobile.getTableScript = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.script.table.name)
      .path('scripts')
      .path(options.script.table.operation)
      .path('code');

    channel.get(callback);
  };

  mobile.setTableScript = function (options, script, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.script.table.name)
      .path('scripts')
      .path(options.script.table.operation)
      .path('code')
      .header('Content-Type', 'text/plain');

    channel.put(script, callback);
  };

  mobile.deleteTableScript = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.script.table.name)
      .path('scripts')
      .path(options.script.table.operation);

    channel.delete(callback);
  };

  mobile.getAllTableScripts = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var results = [];
    mobile.listTables(options, function (error, tables) {
      if (error || tables.length === 0) {
        return callback(error, tables);
      }

      var resultCount = 0;
      var finalError;
      tables.forEach(function (table) {
        mobile.getTableScripts(options, table.name, function (error, scripts) {
          finalError = finalError || error;
          if (Array.isArray(scripts)) {
            scripts.forEach(function (script) {
              script.table = table.name;
              results.push(script);
            });
          }

          if (++resultCount == tables.length) {
            callback(finalError, results);
          }
        });
      });
    });
  };

  mobile.getTable = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename);

    channel.get(callback);
  };

  mobile.createTable = function (options, settings, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .header('Content-Type', 'application/json');

    log.silly($('Create table:'));
    log.json('silly', settings);

    channel.post(JSON.stringify(settings), callback);
  };

  mobile.deleteTable = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename);

    channel.delete(callback);
  };

  mobile.truncateTable = function (options, payload, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('truncate')
      .header('Content-Type', 'application/json');

    channel.post(payload, callback);
  };

  mobile.deleteTableRecord = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('data')
      .query('id', options.recordid);

    channel.delete(callback);
  };

  mobile.getPermissions = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('permissions');

    channel.get(callback);
  };

  mobile.updatePermissions = function (options, newPermissions, callback) {
    log.verbose('Subscription', options.subscription);
    mobile.getPermissions(options, function (error, currentPermissions) {
      if (error) {
        return callback(error);
      }

      for (var i in currentPermissions) {
        if (!newPermissions[i]) {
          newPermissions[i] = currentPermissions[i];
        }
      }

      log.silly(util.format($('Update table permissions for %s:'), options.tablename));
      log.json('silly', newPermissions);

      var channel = getMobileChannel(options)
        .path('mobileservices')
        .path(options.servicename)
        .path('tables')
        .path(options.tablename)
        .path('permissions')
        .header('Content-Type', 'application/json');

      channel.put(JSON.stringify(newPermissions), callback);
    });
  };

  mobile.getScripts = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('scripts');

    channel.get(callback);
  };

  mobile.getColumns = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('columns');

    channel.get(callback);
  };

  mobile.addColumn = function (options, column, payload, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('columns')
      .path(column)
      .header('Content-Type', 'application/json');

    log.silly(util.format($('Adding column %s:'), column));
    log.json('silly', payload);

    channel.post(JSON.stringify(payload), callback);
  };

  mobile.deleteColumn = function (options, column, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('columns')
      .path(column);

    channel.delete(callback);
  };

  mobile.createIndex = function (options, column, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('indexes')
      .path(column);

    channel.put(null, callback);
  };

  mobile.deleteIndex = function (options, column, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('indexes')
      .path(column);

    channel.delete(callback);
  };

  mobile.getMobileServiceApplication = function (options, callback) {
    var channel = getAppManagerChannel(options)
      .path(options.servicename + 'mobileservice')
      .header('Content-Type', 'application/xml');

    channel.get(callback);
  };

  mobile.deleteMobileServiceApplication = function (options, callback) {
    var channel = getAppManagerChannel(options)
      .path(options.servicename + 'mobileservice')
      .header('Content-Type', 'application/xml');

    channel.delete(function (error, body, res) {
      if (error) {
        log.silly(util.format($('Delete mobile service application error: %s'), JSON.stringify(error, null, 2)));
        return callback(error);
      }

      mobile.trackAsyncOperation(options, res.headers['x-ms-request-id'], function (error) {
        log.silly(util.format($('Delete mobile service application result: %s'), error ? JSON.stringify(error, null, 2) : 'ok'));
        callback(error);
      });
    });
  };

  mobile.getData = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('tables')
      .path(options.tablename)
      .path('data');

    if (options.query) {
      options.query.split('&').forEach(function (keyvalue) {
        var kv = keyvalue.split('=');
        if (kv.length === 2) {
          channel.query(kv[0], kv[1]);
        }
        else {
          return callback(new Error($('Invalid format of query parameter')));
        }
      });
    } else {
      channel.query('$top', options.top || 10);

      if (options.skip) {
        channel.query('$skip', options.skip);
      }
    }

    channel.get(callback);
  };

  mobile.trackAsyncOperation = function (options, requestId, callback) {
    var channel = getOperationChannel(options, requestId);

    var errorCounter = 0;
    channel.poll(function (error, body) {
      var retry = false;

      if (error) {
        if(++errorCounter < 3) {
          retry = true;
        } else {
          callback(new Error($('Unable to determine the status of the async operation. Please check the status on the management portal.')));
        }
      } else {
        log.silly(util.format($('Operation status: %s'), body.Status));

        if (body.Status === 'Failed') {
          callback(new Error($('Operation failed. Please confirm the status on the management portal')));
        } else if (body.Status === 'InProgress') {
          retry = true;
        } else if (body.Status === 'Succeeded') {
          callback();
        } else {
          callback(new Error($('Unexpected response from Microsoft Azure. ' +
            'Please confirm the status of the mobile service in the management portal')));
        }
      }

      return retry;
    });
  };

  var resourceTypeView = {
    'Microsoft.WindowsAzure.MobileServices.MobileService': 'Mobile service',
    'Microsoft.WindowsAzure.SQLAzure.DataBase': 'SQL database',
    'Microsoft.WindowsAzure.SQLAzure.Server': 'SQL server'
  };

  mobile.getFlatApplicationDescription = function (description) {
    var result = {
      State: description.State,
      Name: description.Name,
      Label: description.Label,
      Resources: []
    };

    function flatten(resource) {
      var list;
      if (Array.isArray(resource))
        list = resource;
      else if (typeof resource == 'object')
        list = [resource];

      if (list) {
        list.forEach(function (item) {
          result.Resources.push(item);
          item.TypeView = resourceTypeView[item.Type];
          item.NameView = item.Label || item.Name;
          if (typeof item.FailureCode === 'string') {
            var match = item.FailureCode.match(/<Message\>([^<]*)<\/Message\>/);
            item.Error = match ? match[1] : item.FailureCode;
          }
        });
      }
    }

    flatten(description.InternalResources.InternalResource);
    flatten(description.ExternalResources.ExternalResource);

    return result;
  };

  mobile.deleteService = function (options, callback) {
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename);

    if (options.deleteData) {
      channel.query('deletedata', 'true');
    }

    if (options.deleteNotificationHubNamespace) {
      channel.query('deleteServiceBusNamespace', 'true');
    }

    channel.delete(function (error, body) {
      log.silly($('Delete mobile service:'));
      log.silly(JSON.stringify(error, null, 2));
      log.silly(JSON.stringify(body, null, 2));

      // Treat not found (404) as success for delete purposes to match the logic we use on the portal
      if (error && error.Code === 404) {
        error = null;
      }
      callback(error);
    });
  };

  mobile.deleteSqlServer = function (options, resource, callback) {
    var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));
    sqlService.servers.deleteMethod(resource.Name, callback);
  };

  mobile.register = function (options, _) {
    var subscription = profile.current.getSubscription(options.subscription),
        progress = cli.interaction.progress($('Registering for mobile services'));

    try {
      subscription.registerAsmProvider('mobileservice', _);
    }
    finally {
      progress.end();
    }
  };

  mobile.getDomains = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('hostnames');

    channel.get(callback);
  };

  mobile.addDomain = function (options, domain, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('hostnames')
      .path(domain);

    channel.post(null, callback);
  };

  mobile.deleteDomain = function (options, domain, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('hostnames')
      .path(domain);

    channel.delete(callback);
  };

  mobile.getSslState = function (options, domain, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('hostnames')
      .path(domain)
      .path('ssl');

    channel.get(callback);
  };

  mobile.enableSsl = function (options, domain, thumbprint, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('hostnames')
      .path(domain)
      .path('ssl')
      .path(thumbprint);

    channel.post(null, callback);
  };

  mobile.disableSsl = function (options, domain, thumbprint, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('hostnames')
      .path(domain)
      .path('ssl')
      .path(thumbprint);

    channel.delete(callback);
  };

  mobile.getCertificates = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('certificates');

    channel.get(callback);
  };

  mobile.addCertificate = function (options, certificate, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('certificates')
      .header('Content-Type', 'application/json');

    channel.post(JSON.stringify(certificate), callback);
  };

  mobile.deleteCertificate = function (options, thumbprint, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('certificates')
      .path(thumbprint);

    channel.delete(callback);
  };

  var createMobileServiceApplicationTemplate =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<Application xmlns="http://schemas.microsoft.com/windowsazure">' +
      '<Name>##name##</Name>' +
      '<Label>##label##</Label>' +
      '<Description>##description##</Description>' +
      '<Configuration>##spec##</Configuration>' +
    '</Application>';

  mobile.createService = function (options, callback) {
    var subscription = profile.current.getSubscription(options.subscription);

    var channel = getAppManagerChannel(options)
      .header('Content-Type', 'application/xml');

    var serverRefName = 'ZumoSqlServer_' + uuid.v4().replace(/-/g, '');
    var serverSpec;

    if (options.sqlServer) {
      // use existing SQL server
      serverSpec = {
        Name: serverRefName,
        Type: 'Microsoft.WindowsAzure.SQLAzure.Server',
        URI: subscription.sqlManagementEndpointUrl +
                subscription.id + '/services/sqlservers/servers/' + options.sqlServer
      };
    } else {
      // create new SQL server
      serverSpec = {
        ProvisioningParameters: {
          AdministratorLogin: options.username,
          AdministratorLoginPassword: options.password,
          Location: options.sqlLocation
        },
        ProvisioningConfigParameters: {
          FirewallRules: [
            {
              Name: 'AllowAllWindowsAzureIps',
              StartIPAddress: '0.0.0.0',
              EndIPAddress: '0.0.0.0'
            }
          ]
        },
        Version: '1.0',
        Name: serverRefName,
        Type: 'Microsoft.WindowsAzure.SQLAzure.Server'
      };
    }

    var dbRefName = 'ZumoSqlDatabase_' + uuid.v4().replace(/-/g, '');
    var dbSpec;

    if (options.sqlDb) {
      // use existing SQL database

      dbSpec = {
        Name: dbRefName,
        Type: 'Microsoft.WindowsAzure.SQLAzure.DataBase',
        URI: subscription.sqlManagementEndpointUrl +
          subscription.id + '/services/sqlservers/servers/' + options.sqlServer +
          '/databases/' + options.sqlDb
      };
    } else {
      // create a new SQL database

      dbSpec = {
        ProvisioningParameters: {
          Name: options.servicename + '_db',
          Edition: 'WEB',
          MaxSizeInGB: '1',
          DBServer: {
            ResourceReference: serverRefName + '.Name'
          },
          CollationName: 'SQL_Latin1_General_CP1_CI_AS'
        },
        Version: '1.0',
        Name: dbRefName,
        Type: 'Microsoft.WindowsAzure.SQLAzure.DataBase'
      };
    }

    var spec = {
      SchemaVersion: '2012-05.1.0',
      Location: 'West US',
      ExternalResources: {},
      InternalResources: {
        ZumoMobileService: {
          ProvisioningParameters: {
            Name: options.servicename,
            Location: options.location,
            Platform: options.backend,
            ProvisioningVersion: '2014-1-1',
            EnableExternalPush: options.enhancedPush
          },
          ProvisioningConfigParameters: {
            Server: {
              StringConcat: [
                {
                  ResourceReference: serverRefName + '.Name'
                },
                subscription.sqlServerHostnameSuffix
              ]
            },
            Database: {
              ResourceReference: dbRefName + '.Name'
            },
            AdministratorLogin: options.username,
            AdministratorLoginPassword: options.password
          },
          Version: '2012-05-21.1.0',
          Name: 'ZumoMobileService',
          Type: 'Microsoft.WindowsAzure.MobileServices.MobileService'
        }
      }
    };

    if (options.sqlServer) {
      // use existing SQL server as an external resource
      spec.ExternalResources[serverRefName] = serverSpec;
    } else {
      // create a new SQL server as in internal resource
      spec.InternalResources[serverRefName] = serverSpec;
    }

    if (options.sqlDb) {
      spec.ExternalResources[dbRefName] = dbSpec;
    } else {
      // create a new SQL database as an internal resource
      spec.InternalResources[dbRefName] = dbSpec;
    }

    log.silly($('New mobile service application specification:'));
    log.silly(JSON.stringify(spec, null, 2));

    var encodedSpec = new Buffer(JSON.stringify(spec)).toString('base64');
    var payload = createMobileServiceApplicationTemplate
      .replace('##name##', options.servicename + 'mobileservice')
      .replace('##label##', options.servicename)
      .replace('##description##', options.servicename)
      .replace('##spec##', encodedSpec);

    log.silly($('New mobile service request body:'));
    log.silly(payload);

    var progress = cli.interaction.progress($('Creating mobile service'));
    try {
      channel.post(payload, function (error, body, res) {
        if (error) {
          progress.end();
          return callback(error);
        }

        log.silly(util.format($('Create mobile app HTTP response: %s'), res.statusCode));
        log.silly(JSON.stringify(res.headers, null, 2));

        // async operation, wait for completion
        mobile.trackAsyncOperation(options, res.headers['x-ms-request-id'], function (error) {
          if (error) {
            progress.end();
            return callback(error);
          }

          // get the application specification and confirm the status of individual components
          var channel = getAppManagerChannel(options)
            .path(options.servicename + 'mobileservice');

          channel.get(function (error, body) {
            progress.end();
            if (error) {
              return callback(error);
            }

            if (log.format().json) {
              log.json(body);
            } else {
              log.silly(JSON.stringify(body, null, 2));
              var flat = mobile.getFlatApplicationDescription(body);
              var logger = flat.State == 'Healthy' ? log.info : log.error;
              log.silly(JSON.stringify(flat, null, 2));
              logger(util.format($('Overall application state: %s'), flat.State));
              flat.Resources.forEach(function (resource) {
                logger(resource.TypeView + (resource.NameView ? ' (' + resource.NameView + ')' : '') + ' state: ' + resource.State);
                if (resource.Error) {
                  logger(resource.Error);
                }
              });
            }

            callback(body.State === 'Healthy' ? null : new Error($('Creation of a mobile service failed')));
          });
        });
      });
    }
    catch (e) {
      progress.end();
      throw e;
    }
  };

  mobile.command('locations')
        .description($('List available mobile service locations'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (options, _) {
          var progress = cli.interaction.progress($('Getting mobile service locations'));
          var result;
          try {
            result = mobile.getRegions(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (locations) {
            locations.forEach(function (region, index) {
              log.info(region.region + (index === 0 ? ' (default)' : ''));
            });
          });
        });

  mobile.command('create [servicename] [username] [password]')
        .usage('[options] [servicename] [sqlAdminUsername] [sqlAdminPassword]')
        .description($('Create a new mobile service'))
        .option('-r, --sqlServer <sqlServer>', $('use existing SQL server'))
        .option('-d, --sqlDb <sqlDb>', $('use existing SQL database'))
        .option('-l, --location <location>', $('create the service in a particular location; run azure mobile locations to get available locations'))
        .option('--sqlLocation <location>', $('create the SQL server in a particular location; defaults to mobile service location'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .option('-b, --backend <backend>', $('backend of mobile service. "node" and "dotnet" are examples.'))
        .option('-p, --push <push>', $('type of push; "nh" or "legacy" are allowed. "nh" will soon be the default for node service. ignored for dotnet services.'))
        .execute(function (servicename, username, password, options, _) {
          
          if (!options.backend) {
            // If platform value is not passed, Create a node app
            options.backend = 'Node';
          } else {
            if (options.backend.toLowerCase() !== 'node' && options.backend.toLowerCase() !== 'dotnet') {
              throw new Error('Backend can only have two values: "Node" or "DotNet"');
            }
          }

          if (options.sqlDb && !options.sqlServer) {
            throw new Error($('To use an existing SQL database, you must specify the name of an existing SQL server using the --sqlServer parameter.'));
          }

          options.enhancedPush = true;

          if (options.backend.toLowerCase() === 'node') {
            if (!options.push || (options.push.toLowerCase() !== 'legacy' && options.push.toLowerCase() !== 'nh' )) {
              throw new Error('-p/--push is required and can only have two values: "legacy" or "nh"');
            }

            options.enhancedPush = (options.push.toLowerCase() === 'nh');
          }

          if (!options.location) {
            var result = mobile.getRegions(options, _);
            if (!Array.isArray(result) || result.length === 0 || !result[0].region) {
              throw new Error($('Unable to determine the default mobile service location.'));
            }
            options.location = result[0].region;
          }

          options.sqlLocation = options.sqlLocation || options.location;
          options.servicename = cli.interaction.promptIfNotGiven($('Mobile service name: '), servicename, _);

          if (options.servicename.length < 2 || options.servicename.length > 48) {
            throw new Error($('Service name must be between 2 and 48 characters.'));
          } else if (!options.servicename.match(/^[a-zA-Z][0-9a-zA-Z-]*[0-9a-zA-Z]$/)) {
            throw new Error($('Service name must start with a letter, contain only letters, numbers, and hyphens, and end with a letter or number.'));
          }

          options.username = cli.interaction.promptIfNotGiven($('SQL administrator user name: '), username, _);
          if (!isUsernameValid(options.username)) {
            throw new Error($('Invalid username'));
          }

          if (options.sqlServer) {
            options.password = cli.interaction.promptPasswordOnceIfNotGiven($('SQL administrator password: '), password, _);
          } else {
            options.password = cli.interaction.promptPasswordIfNotGiven($('SQL administrator password: '), password, _);
          }
          if (!isPasswordValid(options.username, options.password)) {
            throw new Error($('Invalid password'));
          }

          mobile.register(options, _);
          mobile.createService(options, _);

          function isPasswordValid(username, password) {
            // Eight or more characters in length
            // Does not contain all or part of the username
            // Contains characters from at least 3 of the categories
            // - A-Z
            // - a-z
            // - 0-9
            // - Non-alphanumeric: !$#%

            var matches = 0;
            [new RegExp('[A-Z]'),
              new RegExp('[a-z]'),
              new RegExp('[0-9]'),
              new RegExp('[\\~\\`\\!\\@\\#\\$\\%\\^\\&\\*\\(\\)\\_\\-\\+\\=\\{\\[\\}\\]\\|\\\\:\\;\\"\\\'\\<\\,\\>\\.\\?\\/]')
            ].forEach(function (regex) {
              if (password.match(regex))
                matches++;
            });

            if (password.length >= 8 && password.indexOf(username) == -1 && matches > 2) {
              return true;
            } else {
              log.warn($('Password must:'));
              log.warn($('- be 8 or more characters long,'));
              log.warn($('- not contain the username,'));
              log.warn($('- contain characters from at least 3 of the categories:'));
              log.warn($('  - uppercase letter [A-Z],'));
              log.warn($('  - lowercase letter [a-z],'));
              log.warn($('  - digit [0-9],'));
              log.warn($('  - special character (e.g. !@#$%^&).'));
              return false;
            }
          }

          function isUsernameValid(username) {
            if (username.length > 0) {
              return true;
            } else {
              log.warn($('User name cannot be empty'));
              return false;
            }
          }

        });

  mobile.command('delete [servicename] [username] [password]')
        .description($('Delete a mobile service'))
        .option('-d, --deleteData', $('delete all data from the database'))
        .option('-a, --deleteAll', $('delete all data, SQL database, and SQL server'))
        .option('-n, --deleteNotificationHubNamespace', $('delete associated Notification Hub namespace and entities'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .option('-q, --quiet', $('do not prompt for confirmation'))
        .execute(function (servicename, username, password, options, _) {
          var prompt;
          if (options.deleteAll) {
            prompt = $('with all data, SQL database, and the SQL server');
            options.deleteSqlDb = options.deleteData = true;
          } else if (options.deleteSqlDb) {
            prompt = $('with all data and the SQL database, but leave SQL server intact');
            options.deleteData = true;
          } else if (options.deleteData) {
            prompt = $('with all data but leave SQL database and SQL server intact');
          } else {
            prompt = $('but leave all data, SQL database, and SQL server intact');
          }

          if (options.deleteNotificationHubNamespace) {
            prompt += $(' and delete associated Notification Hub Namespaces and its entities');
          }

          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          var progress = cli.interaction.progress($('Getting mobile service details')),
            result;
          try {
            result = mobile.getMobileServiceApplication(options, _);
          } finally {
            progress.end();
          }

          var resources = {},
              flat = mobile.getFlatApplicationDescription(result);
          log.silly(JSON.stringify(flat, null, 2));
          flat.Resources.forEach(function (resource) {
            if (!log.format().json) {
              log.data(resource.TypeView, resource.NameView ? resource.NameView.green : 'N/A'.green);
            }

            resources[resource.Type] = resource;
          });

          if (!options.quiet) {
            var proceed = cli.interaction.confirm(util.format($('Do you want to delete the mobile service %s? [y/n]: '), prompt), _);
            if (!proceed) {
              log.info($('Deletion cancelled with no changes made.'));
              return;
            }
          }

          // We delete the mobile service from ZRP first
          progress = cli.interaction.progress($('Deleting mobile service'));
          try {
            mobile.deleteService(options, _);
          } catch (e) {
            progress.end();
            log.error($('Failed to delete the mobile service.'));
            if (options.deleteAll) {
              log.error($('The deletion of the SQL server was cancelled.'));
            }
            throw (e);
          }

          // Only on successful deletion from ZRP do we continue
          progress.end();
          log.info($('Deleted mobile service.'));

          // delete SQL server
          var success = true;
          if (options.deleteAll) {
            progress = cli.interaction.progress($('Deleting SQL server'));
            try {
              mobile.deleteSqlServer(options, resources['Microsoft.WindowsAzure.SQLAzure.Server'], _);
            } catch (e) {
              // Continue on with the application delete
              progress.end();
              success = false;
              log.error($('Failed to delete SQL server'));
              log.error(e);
            }
            progress.end();

            if (success) {
              log.info($('Deleted SQL server'));
            }
          }

          // delete application
          progress = cli.interaction.progress($('Deleting mobile application'));
          try {
            mobile.deleteMobileServiceApplication(options, _);
          } catch (e) {
            progress.end();
            log.error($('Failed to delete mobile application.'));
            throw (e);
          }

          progress.end();

          log.info($('Deleted mobile application.'));
        });

  var scaleInformation = {
    tier1: { name: 'free', maxInstances: 1, oldKey: 'free' },
    tier2: { name: 'basic', maxInstances: 6, oldKey: 'standard' },
    tier3: { name: 'standard', maxInstances: 25, oldKey: 'premium' }
  };

  function displayScaleSettings(scalesettings) {
    log.data('tier', scaleInformation[scalesettings.tier].name.green);
    log.data('numberOfInstances', scalesettings.numberOfInstances.toString().green);
  }

  function findScale(scaleValueOrDisplayName, useOldKey) {
    scaleValueOrDisplayName = scaleValueOrDisplayName.toLowerCase();

    var scale = scaleInformation[scaleValueOrDisplayName];
    if (!__.isUndefined(scale)) {
      return scaleValueOrDisplayName;
    }

    var scaleValue,
        comparisonValue;
    __.every(scaleInformation, function (value, key) {
      comparisonValue = useOldKey ? value.oldKey : value.name;
      if (comparisonValue === scaleValueOrDisplayName) {
        scaleValue = key;
        return false;
      }
      return true;
    });

    return scaleValue;
  }

  mobile.command('list')
        .usage('[options]')
        .description($('List your mobile services'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (options, _) {
          var progress = cli.interaction.progress($('Getting list of mobile services'));
          var result;
          try {
            result = mobile.listServices(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (services) {
            if (services && services.length > 0) {
              log.table(services, function (row, s) {
                row.cell($('Name'), s.name);
                row.cell($('State'), s.state);
                row.cell($('URL'), s.applicationUrl);
              });
            } else {
              log.info($('No mobile services created yet. You can create new mobile services using the \'azure mobile create\' command.'));
            }
          });
        });

  mobile.command('show [servicename]')
        .usage('[servicename] [options]')
        .description($('Show details for a mobile service'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          ensuredServiceName(_);

          function ensuredServiceName(callback) {
            var results = {};
            var resultCount = 0;

            var progress = cli.interaction.progress($('Getting information'));

            function tryFinish() {
              if (++resultCount < 3) {
                return;
              }

              progress.end();

              log.silly($('Results:'));
              log.silly(JSON.stringify(results, null, 2));

              if (log.format().json) {
                log.json(results);
              } else {
                if (results.application) {
                  log.info($('Mobile application').blue);
                  var flat = mobile.getFlatApplicationDescription(results.application);
                  log.silly(JSON.stringify(flat, null, 2));
                  log.data($('status'), flat.State == 'Healthy' ? $('Healthy').green : flat.State.red);
                  flat.Resources.forEach(function (resource) {
                    log.data(resource.TypeView + ' name', resource.NameView ? resource.NameView.green : 'N/A'.green);
                    if (resource.Error) {
                      log.data(resource.TypeView + ' status', resource.State.red);
                      log.data(resource.TypeView + ' error', resource.Error.red);
                    }
                    else {
                      log.data(resource.TypeView + ' status', resource.State.green);
                    }
                  });
                }

                if (results.service) {
                  log.info('Mobile service'.blue);
                  ['name', 'state', 'applicationUrl', 'applicationKey', 'masterKey', 'scalesettings', 'region']
                    .forEach(function (item) {
                      if (results.service[item]) {
                        log.data(item, results.service[item].toString().green);
                      }
                    });

                  if (nodeFilter(results.service)) {
                    if (results.service.tables.length > 0) {
                      var tables = '';
                      results.service.tables.forEach(function (table) { tables += (tables.length > 0 ? ',' : '') + table.name; });
                      log.data('tables', tables.green);
                    } else {
                      log.info($('No tables are created. Use azure mobile table command to create tables.'));
                    }
                  }
                }

                if (results.scalesettings) {
                  log.info('Scale'.blue);
                  displayScaleSettings(results.scalesettings);
                }
              }

              if (!results.service && !results.application) {
                return callback('Cannot obtain informaton about the service ' + options.servicename +
                  '. Use azure mobile list to check if it exists.');
              } else {
                return callback();
              }
            }

            function createCallback(name) {
              return function (error, result) {
                log.silly(name, error);
                if (!error) {
                  results[name] = result;
                }

                if (name === 'service') {
                  if (result) {
                    mobile.getScaleSettings(options, createCallback('scalesettings'));
                  } else {
                    resultCount++;
                  }
                }

                tryFinish();
              };
            }

            try {
              mobile.getService(options, createCallback('service'));
              mobile.getMobileServiceApplication(options, createCallback('application'));
            } catch (e) {
              progress.end();
              callback(e);
            }
          }
        });

  mobile.command('restart [servicename]')
        .description($('Restart a mobile service'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          var progress = cli.interaction.progress(util.format($('Restarting mobile service: \'%s\''), options.servicename));
          var result;
          try {
            result = mobile.restartService(options, _);
          } finally {
            progress.end();
          }

          if (log.format().json) {
            log.json({});
          } else {
            log.info($('Service was restarted.'));
          }
        });
  
  mobile.command('redeploy [servicename]')
        .description($('Redeploy a mobile service with most recent runtime version'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          var progress = cli.interaction.progress(util.format($('Redeploying mobile service: \'%s\''), options.servicename));
          var result;
          try {
            result = mobile.redeployService(options, _);
          } finally {
            progress.end();
          }

          if (log.format().json) {
            log.json({});
          } else {
            log.info($('Service was redeployed.'));
          }
        });

  var mobileKey = mobile.category('key')
        .description($('Commands to manage your Mobile Service keys'));

  var keyTypes = ['application', 'master'];

  function promptKeyFields(options, servicename, type, _) {
    options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
    options.type = cli.interaction.chooseIfNotGiven($('Key type: '), $('Retrieving choices'), type,
      function (cb) {
        cb(null, keyTypes);
      }, _);

    if (!__.contains(keyTypes, options.type)) {
      throw new Error($('The key type must be \'application\' or \'master\'.'));
    }
  }

  mobileKey.command('regenerate [servicename] [type]')
        .description($('Regenerate the mobile service key'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, type, options, _) {
          promptKeyFields(options, servicename, type, _);

          var result,
              progress = cli.interaction.progress($('Regenerating key'));

          try {
            result = mobile.regenerateKey(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (keyData) {
            log.info(util.format($('New %s key is %s'), options.type, keyData[options.type + 'Key']));
          });
        });

  mobileKey.command('set [servicename] [type] [value]')
        .description($('Set the mobile service key to a specific value'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, type, value, options, _) {
          promptKeyFields(options, servicename, type, _);
          options.value = cli.interaction.promptIfNotGiven($('Key value: '), value, _);

          var result,
              progress = cli.interaction.progress($('Setting key'));

          try {
            result = mobile.setKey(options, { Type: options.type, Value: options.value }, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (keyData) {
            log.info(util.format($('New %s key is %s'), options.type, keyData[options.type + 'Key']));
          });
        });

  mobile.command('log [servicename]')
        .usage('[options] [servicename]')
        .description($('Get mobile service logs'))
        .option('-r, --query <query>', $('log query; takes precedence over --type, --source, --continuationToken, and --top'))
        .option('-t, --type <type>', $('filter entry by type'))
        .option('--source <source>', $('filter entry by source'))
        .option('-c, --continuationToken <token>', $('show logs starting from the specified continuation token'))
        .option('-p, --top <top>', $('return the first <top> number of remaining rows'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          var result,
              progress = cli.interaction.progress($('Retrieving logs'));

          try {
            result = mobile.getLogs(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (logs) {
            if (logs && logs.results && logs.results.length > 0) {
              logs.results.forEach(function (entry) {
                log.data('', '');

                for (var i in entry) {
                  log.data(i, entry[i]);
                }
              });

              log.data('', '');
              if (logs.continuationToken) {
                log.data($('Continuation token to receive the next result set:'), logs.continuationToken.green);
              }
            } else {
              log.info($('There are no matching log entries.'));
            }
          });
        });

  mobile.command('recover [unhealthyservicename] [healthyservicename]')
        .usage('[options] [unhealthyservicename] [healthyservicename]')
        .description($('Recovers an unhealthy mobile service using the capacity reserved by a healthy mobile service in a different region.'))
        .option('-q, --quiet', $('do not prompt for confirmation of recovery'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (unhealthyservice, healthyservice, options, callback) {
          if (unhealthyservice) {
            ensuredUnhealthyServiceName(unhealthyservice);
          } else {
            promptString($('Name of the unhealthy mobile service to recover: '), ensuredUnhealthyServiceName);
          }

          function ensuredUnhealthyServiceName(unhealthyservice) {
            options.servicename = unhealthyservice;

            if (healthyservice) {
              ensuredHealthyServiceName(healthyservice);
            } else {
              promptString($('Name of the healthy mobile service to use for capacity: '), ensuredHealthyServiceName);
            }

            function ensuredHealthyServiceName(healthyservice) {
              options.targetservicename = healthyservice;

              if (options.quiet) {
                doProceed(true);
              } else {
                cli.confirm(util.format($('Warning: this action will use the capacity from the mobile service \'%s\' and delete it. Do you want to recover the mobile service \'%s\'? [y/n]: '), healthyservice), doProceed);
              }

              function doProceed(decision) {
                if (!decision) {
                  log.info($('Recovery terminated with no changes made'));
                  callback();
                } else {
                  var progress = cli.interaction.progress($('Performing recovery'));
                  mobile.recover(options, function (error) {
                    if (error) {
                      progress.end();
                      callback(error);
                    } else {
                      progress = cli.interaction.progress($('Cleaning up'));
                      options.servicename = healthyservice;
                      mobile.deleteMobileServiceApplication(options, function (error) {
                        progress.end();
                        if (error) {
                          callback(error);
                        }
                        else {
                          log.info($('Recovery complete'));
                          callback();
                        }
                      });
                    }
                  });
                }
              }
            }
          }
        });

  mobile.command('migrate [sourceservicename] [destinationservicename]')
        .usage('[options] [sourceservicename] [destinationservicename]')
        .description($('Migrates the source mobile service using the capacity reserved by the destination mobile service in a different region. This command is for disaster recover scenarios and it may result in up to 30 minutes of downtime as the migration completes.'))
        .option('-q, --quiet', $('do not prompt for confirmation of migration'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (sourceservicename, destinationservicename, options, callback) {
          if (sourceservicename) {
            ensuredSourceServiceName(sourceservicename);
          } else {
            promptString($('Name of the source mobile service to migrate: '), ensuredSourceServiceName);
          }

          function ensuredSourceServiceName(sourceservice) {
            options.servicename = sourceservice;

            if (destinationservicename) {
              ensuredDestinationServiceName(destinationservicename);
            } else {
              promptString($('Name of the destination mobile service to use for capacity: '), ensuredDestinationServiceName);
            }

            function ensuredDestinationServiceName(destinationservice) {
              options.targetservicename = destinationservice;

              if (options.quiet) {
                doProceed(true);
              } else {
                cli.confirm(util.format($('Warning: this action will use the capacity from the mobile service \'%s\' and delete it and the host name for \'%s\' may not resolve for up to 30 minutes. Do you want to migrate the mobile service \'%s\'? [y/n]: '),
                 destinationservice, sourceservice, sourceservice), doProceed);
              }

              function doProceed(decision) {
                if (!decision) {
                  log.info($('Migration canceled with no changes made'));
                  callback();
                } else {
                  var progress = cli.interaction.progress($('Performing migration'));
                  mobile.migrate(options, function (error, body) {
                    progress.end();
                    if (error) {
                      callback(error);
                    } else {
                      progress = cli.interaction.progress(util.format($('Migration with id \'%s\' started. The migration may take several minutes to complete.'), body));
                      options.orchestrationId = body;
                      mobile.waitForMigration(options, function(error) {
                        progress.end();
                        if (error) {
                          callback(error);
                          return;
                        }
                        progress = cli.interaction.progress($('Cleaning up'));
                        options.servicename = destinationservice;
                        mobile.deleteMobileServiceApplication(options, function (error) {
                          progress.end();
                          if (error) {
                            callback(error);
                          }
                          else {
                            log.info($('Migration complete. It may take 30 minutes for DNS to resolve to the migrated site.'));
                            callback();
                          }
                        });
                      });
                    }
                  });
                }
              }
            }
          }
        });

  mobile.waitForMigration = function (options, callback) {
    log.verbose('Subscription', options.subscription);
    var channel = getMobileChannel(options)
      .path('mobileservices')
      .path(options.servicename)
      .path('migrate')
      .query('operationId', options.orchestrationId);

    function pollMigration() {
      channel.poll(function (error, body) {
        var retry = false;

        if (error) {
          callback(new Error($('Unable to determine the status of the async operation. Please check the status on the management portal.')));
        } else {
          var status = body;

          log.silly($('Migration status'));
          log.json('silly', status);
          
          if (status === 'Completed') {
            callback();
          } else if (status === 'Failed') {
            callback(new Error($('Operation failed. Please confirm the status on the management portal.')));
          } else {
            retry = true;
          }
        }

        return retry;
      });
    }
    
    // Wait before polling. By default this value will evaluate to 10 seconds
    // in production and zero during test runs.
    var sleepTime = channel.azureService.longRunningOperationRetryTimeout * 2;
    setTimeout(pollMigration, sleepTime);
  };

  var mobileConfig = mobile.category('config')
        .description($('Commands to manage your Mobile Service configuration'));

  mobileConfig.command('list [servicename]')
        .usage('[options] [servicename]')
        .description($('Show your mobile service configuration settings'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          // Load up all the settings that comprise the configuration
          var progress = cli.interaction.progress($('Getting mobile service configuration'));
          var results = {};
          try {
            results.service = mobile.getServiceSettings(options, _);
            results.auth = mobile.getAuthSettings(options, _);
            results.apns = mobile.getApnsSettings(options, _);
            results.gcm = mobile.getPushSettings(options, _);

            results.live = __.find(results.auth, function (authSettings) { return authSettings.provider === 'microsoft'; }) || {};
            results.auth = __.reject(results.auth, function (authSettings) { return authSettings.provider === 'microsoft'; });

            if (results.gcm && results.gcm['gcmCredentials']) {
              results.gcm = results.gcm['gcmCredentials'] || {};
              delete results.gcm.endpoint;
            }
          } finally {
            progress.end();
          }

          // Display the configuration
          cli.interaction.formatOutput(results, displayConfiguration);

          function displayConfiguration(results) {
            var settings = {};
            ['dynamicSchemaEnabled',
              'microsoftAccountClientSecret',
              'microsoftAccountClientId',
              'microsoftAccountPackageSID',
              'facebookClientId',
              'facebookClientSecret',
              'twitterClientId',
              'twitterClientSecret',
              'googleClientId',
              'googleClientSecret',
              'apns',
              'crossDomainWhitelist',
              'gcm'
            ].forEach(function (name) {
              settings[name] = $('Unable to obtain the value of this setting');
            });

            if (results.service) {
              if (typeof results.service.dynamicSchemaEnabled == 'boolean') {
                settings.dynamicSchemaEnabled = results.service.dynamicSchemaEnabled.toString();
              } else {
                settings.dynamicSchemaEnabled = $('Not configured');
              }

              settings.crossDomainWhitelist = formatCrossDomainWhitelistForDisplay(results.service.crossDomainWhitelist);
            }

            if (results.live) {
              settings.microsoftAccountClientSecret = results.live.secret || $('Not configured');
              settings.microsoftAccountClientId = results.live.appId || $('Not configured');
              settings.microsoftAccountPackageSID = results.live.packageSid || $('Not configured');
            }

            if (results.apns) {
              settings.apns = results.apns.mode || $('Not configured');
            }

            if (results.gcm) {
              settings.gcm = results.gcm.apiKey || $('Not configured');
            }

            if (Array.isArray(results.auth)) {
              ['twitter', 'facebook', 'google'].forEach(function (provider) {
                settings[provider + 'ClientId'] = $('Not configured');
                settings[provider + 'ClientSecret'] = $('Not configured');
              });

              results.auth.forEach(function (creds) {
                settings[creds.provider + 'ClientId'] = creds.appId;
                settings[creds.provider + 'ClientSecret'] = creds.secret;
              });
            }

            log.table(settings, function (row, item) {
              row.cell('Setting', item);
              if (settings[item] === undefined || settings[item] === $('Not configured')) {
                row.cell('Value', $('Not configured').blue);
              } else if (settings[item] === $('Unable to obtain the value of this setting')) {
                row.cell('Value', settings[item].red);
              } else {
                row.cell('Value', settings[item].green);
              }
            });
          }
        });

  function createSetConfigHandler(coreGetHandler, coreSetHandler, picker1, picker2, deprecated) {
    return function (options, newValue, callback) {
      if (deprecated) {
        log.info(deprecated.yellow);
      }

      coreGetHandler(options, function (error, result) {
        if (error) {
          return callback(error);
        }

        // Picker2 is set only for authentication provider settings
        if (picker2) {
          if (Array.isArray(result)) {
            // Look to see if we have any existing authentication provider settings
            var found;
            for (var i = 0; i < result.length; i++) {
              if (result[i].provider == picker1) {
                result[i][picker2] = newValue;
                found = true;
                break;
              }
            }

            // If not, we need to set the required fields
            if (!found) {
              var newProvider = { provider: picker1, appId: '', secret: '' };
              newProvider[picker2] = newValue;
              result.push(newProvider);
            }
          }
        } else {
          result[picker1] = newValue;
        }

        coreSetHandler(options, result, callback);
      });
    };
  }

  var setConfigHandlers = {
    'dynamicSchemaEnabled': createSetConfigHandler(mobile.getServiceSettings, mobile.setServiceSettings, 'dynamicSchemaEnabled'),
    'crossDomainWhitelist': createSetConfigHandler(mobile.getServiceSettings, mobile.setServiceSettings, 'crossDomainWhitelist'),
    'microsoftAccountClientSecret': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'microsoft', 'secret', $('"azure mobile config set <servicename> microsoftAccountClientSecret" is obsolete. Use "azure mobile auth microsoftaccount set"')),
    'microsoftAccountClientId': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'microsoft', 'appId', $('"azure mobile config set <servicename> microsoftAccountClientId" is obsolete. Use "azure mobile auth microsoftaccount set"')),
    'microsoftAccountPackageSID': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'microsoft', 'packageSid', $('"azure mobile config set <servicename> microsoftAccountPackageSID" is obsolete. Use "azure mobile auth microsoftaccount set"')),
    'facebookClientId': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'facebook', 'appId', $('"azure mobile config set <servicename> facebookClientId" is obsolete. Use "azure mobile auth facebook set"')),
    'facebookClientSecret': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'facebook', 'secret', $('"azure mobile config set <servicename> facebookClientSecret" is obsolete. Use "azure mobile auth facebook set"')),
    'twitterClientId': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'twitter', 'appId', $('"azure mobile config set <servicename> twitterClientId" is obsolete. Use "azure mobile auth twitter set"')),
    'twitterClientSecret': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'twitter', 'secret', $('"azure mobile config set <servicename> twitterClientSecret" is obsolete. Use "azure mobile auth twitter set"')),
    'googleClientId': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'google', 'appId', $('"azure mobile config set <servicename> googleClientId" is obsolete. Use "azure mobile auth google set"')),
    'googleClientSecret': createSetConfigHandler(mobile.getAuthSettings, mobile.setAuthSettings, 'google', 'secret', $('"azure mobile config set <servicename> googleClientSecret" is obsolete. Use "azure mobile auth google set"')),
    'apns': parseAndSetApnsSettings,
    'gcm': setGcmSettings
  };

  function parseAndSetApnsSettings(options, value, callback) {
    log.info($('"azure mobile config set <servicename> apns" is obsolete. Use "azure mobile push apns set"').yellow);

    var match = value.match(/^(dev|prod):((?::{2}|[^:])*):(.+)/);
    if (!match) {
      return callback(new Error($('The value of the apns setting must be in the format (dev|prod):<password>:<pkcs12CertificateFile>, ' +
        'e.g. dev:abc!123:./mycertificate.pfx. If the password contains : (colon) characters, they must be escaped as :: (double colon).')));
    }

    var settings = {
      mode: match[1],
      password: match[2].replace(/::/g, ':')
    };

    if (settings.password.match(/:/)) {
      log.warn(util.format($('Password was unescaped to %s'), settings.password));
    }

    settings.data = fs.readFileSync(match[3], 'base64');

    mobile.setApnsSettings(options, settings, callback);
  }

  function setGcmSettings(options, value, callback) {
    log.info($('"azure mobile config set <servicename> apns" is obsolete. Use "azure mobile push apns set"').yellow);
    var settings = {
      gcmCredentials: {
        apiKey: value,
        endpoint: 'https://android.googleapis.com/gcm/send'
      }
    };

    mobile.patchPushSettings(options, settings, callback);
  }

  mobileConfig.command('set <servicename> <key> [value]')
        .usage('[options] <servicename> <key> [value]')
        .description($('Set a mobile service configuration setting'))
        .option('-f, --file <file>', $('read the value of the setting from a file'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, key, value, options, callback) {
          if (!setConfigHandlers[key]) {
            log.info('Supported keys:');
            for (var i in getConfigHandlers) {
              log.info(i.blue);
            }
            return callback('Unsupported key ' + key.red);
          } else if (!value && !options.file) {
            return callback(new Error($('Either value parameter must be provided or --file option specified')));
          } else {
            if (!value && options.file) {
              value = fs.readFileSync(options.file, 'utf8');
              log.info('Value was read from ' + options.file);
            }

            if (key === 'dynamicSchemaEnabled') {
              if (value === 'true') {
                value = true;
              } else if (value === 'false') {
                value = false;
              } else {
                return callback(new Error($('The value must be either true or false')));
              }
            } else if (key === 'crossDomainWhitelist') {
              value = formatCrossDomainWhitelistForSaving(value);
            }

            options.servicename = servicename;
            setConfigHandlers[key](options, value, callback);
          }
        });

  function createGetConfigHandler(coreHandler, picker1, picker2, deprecated) {
    return function (options, callback) {
      if (deprecated) {
        log.info(deprecated.yellow);
      }

      coreHandler(options, function (error, result) {
        if (error) {
          return callback(error);
        }

        if (picker2) {
          if (Array.isArray(result)) {
            for (var i = 0; i < result.length; i++) {
              if (result[i].provider == picker1) {
                return callback(null, result[i][picker2]);
              }
            }
          } else {
            return callback(null, result[picker1][picker2]);
          }

          callback();
        } else {
          callback(null, result[picker1]);
        }
      });
    };
  }

  var getConfigHandlers = {
    'dynamicSchemaEnabled': createGetConfigHandler(mobile.getServiceSettings, 'dynamicSchemaEnabled'),
    'crossDomainWhitelist': createGetConfigHandler(mobile.getServiceSettings, 'crossDomainWhitelist'),
    'microsoftAccountClientSecret': createGetConfigHandler(mobile.getAuthSettings, 'microsoft', 'secret', $('"azure mobile config get <servicename> microsoftAccountClientSecret" is obsolete. Use "azure mobile auth microsoftaccount get"')),
    'microsoftAccountClientId': createGetConfigHandler(mobile.getAuthSettings, 'microsoft', 'appId', $('"azure mobile config get <servicename> microsoftAccountClientId" is obsolete. Use "azure mobile auth microsoftaccount get"')),
    'microsoftAccountPackageSID': createGetConfigHandler(mobile.getAuthSettings, 'microsoft', 'packageSid', $('"azure mobile config get <servicename> microsoftAccountPackageSID" is obsolete. Use "azure mobile auth microsoftaccount get"')),
    'facebookClientId': createGetConfigHandler(mobile.getAuthSettings, 'facebook', 'appId', $('"azure mobile config get <servicename> facebookClientId" is obsolete. Use "azure mobile auth facebook get"')),
    'facebookClientSecret': createGetConfigHandler(mobile.getAuthSettings, 'facebook', 'secret', $('"azure mobile config get <servicename> microsoftAccountClientSecret" is obsolete. Use "azure mobile auth facebook get"')),
    'twitterClientId': createGetConfigHandler(mobile.getAuthSettings, 'twitter', 'appId', $('"azure mobile config get <servicename> twitterClientId" is obsolete. Use "azure mobile auth twitter get"')),
    'twitterClientSecret': createGetConfigHandler(mobile.getAuthSettings, 'twitter', 'secret', $('"azure mobile config get <servicename> twitterClientSecret" is obsolete. Use "azure mobile auth twitter get"')),
    'googleClientId': createGetConfigHandler(mobile.getAuthSettings, 'google', 'appId', $('"azure mobile config get <servicename> googleClientId" is obsolete. Use "azure mobile auth google get"')),
    'googleClientSecret': createGetConfigHandler(mobile.getAuthSettings, 'google', 'secret', $('"azure mobile config get <servicename> googleClientSecret" is obsolete. Use "azure mobile auth google get"')),
    'apns': createGetConfigHandler(mobile.getApnsSettings, 'mode', null, $('"azure mobile config get <servicename> apns" is obsolete. Use "azure mobile push apns get"')),
    'gcm': createGetConfigHandler(mobile.getPushSettings, 'gcmCredentials', 'apiKey', $('"azure mobile config get <servicename> gcm" is obsolete. Use "azure mobile push gcm get"'))
  };

  mobileConfig.command('get [servicename] [key]')
        .usage('[options] [servicename] [key]')
        .description($('Get a mobile service configuration setting'))
        .option('-f, --file <file>', $('save the value of the setting to a file'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, key, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
          key = cli.interaction.chooseIfNotGiven($('Setting key: '), $('Getting choices'), key,
            function (cb) {
              cb(null, __.keys(getConfigHandlers));
            }, _);

          if (!getConfigHandlers[key]) {
            log.info($('Supported keys:'));
            for (var i in getConfigHandlers) {
              log.info(i.blue);
            }

            throw new Error(util.format($('Unsupported key %s'), key.red));
          }

          var result;
          var progress = cli.interaction.progress(util.format($('Retrieving setting: %s'), key));
          try {
            result = getConfigHandlers[key](options, _);
          } finally {
            progress.end();
          }

          var value = {};
          value[key] = result;

          cli.interaction.formatOutput(value, function (output) {
            if (output[key]) {
              if (key === 'crossDomainWhitelist') {
                output[key] = formatCrossDomainWhitelistForDisplay(output[key]);
              }

              if (typeof options.file === 'string') {
                fs.writeFileSync(options.file, output[key], 'utf8');
                log.info(util.format($('Written value to %s'), options.file));
              } else {
                log.data(key, output[key].toString().green);
              }
            } else {
              log.warn($('Setting is not configured').blue);
            }
          });
        });

  var mobileDomain = mobile.category('domain')
      .description($('Commands to manage your Mobile Service Domains'));

  mobileDomain.command('list [servicename]')
      .usage('[options] [servicename]')
      .description($('List domains for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var progress = cli.interaction.progress(util.format($('Listing domains for %s mobile service'), options.servicename));
        try {
          result = mobile.getDomains(options, _);
        } finally {
          progress.end();
        }

        cli.interaction.formatOutput(result, function (output) {
          output.forEach(function (domain) {
            log.data($('Domain'), domain.green);
          });
        });
      });

  mobileDomain.command('add [servicename] [domain]')
      .usage('[options] [servicename] [domain]')
      .description($('Add domain to mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, domain, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        domain = promptIfNotGiven($('Domain: '), domain, _);

        var progress = cli.interaction.progress(util.format($('Adding %s domain to %s mobile service'), domain, options.servicename));
        try {
          result = mobile.addDomain(options, domain, _);
        } finally {
          progress.end();
        }
      });

  mobileDomain.command('delete [servicename] [domain]')
      .usage('[options] [servicename]')
      .description($('Delete domain from mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, domain, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        domain = promptDomainIfNotGiven(options, domain, _);

        var progress = cli.interaction.progress(util.format($('Deleting %s domain from %s mobile service'), domain, options.servicename));
        try {
          result = mobile.deleteDomain(options, domain, _);
        } finally 
{          progress.end();
        }
      });

  var mobileDomainSsl = mobileDomain.category('ssl')
      .description($('Commands to manage SSL for your Mobile Service Domains'));

  mobileDomainSsl.command('show [servicename] [domain]')
      .usage('[options] [servicename] [domain]')
      .description($('Show SSL state for domain'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, domain, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        domain = promptDomainIfNotGiven(options, domain, _);

        var progress = cli.interaction.progress(util.format($('Show SSL state for %s domain from %s mobile service'), domain, options.servicename));
        try {
          result = mobile.getSslState(options, domain, _);
        } finally {
          progress.end();
        }

        cli.interaction.formatOutput(result, function (output) {
          if (output.sslState) {
            log.data($('SSL State'), output.sslState.green);
            log.data($('Certificate Thumbprint'), output.thumbprint.green);
          } else {
            log.data($('SSL State'), $('Disabled').green);
          }
        });
      });

  mobileDomainSsl.command('enable [servicename] [domain] [thumbprint]')
      .usage('[options] [servicename] [domain] [thumbprint]')
      .description($('Enable SSL for domain by attaching an SSL Certificate.  To add SSL Certificates use the "azure mobile cert add" command'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, domain, thumbprint, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        domain = promptDomainIfNotGiven(options, domain, _);
        thumbprint = promptThumbprintIfNotGiven(options, thumbprint, _).toUpperCase();

        var progress = cli.interaction.progress(util.format($('Enabling SSL for %s domain using certificate with thumbprint %s for %s mobile service'), domain, thumbprint, options.servicename));
        try {
          result = mobile.enableSsl(options, domain, thumbprint, _);
        } finally {
          progress.end();
        }
      });

  mobileDomainSsl.command('disable [servicename] [domain] [thumbprint]')
      .usage('[options] [servicename] [domain] [thumbprint]')
      .description($('Disable SSL for domain by detaching SSL Certificate.'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, domain, thumbprint, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        domain = promptDomainIfNotGiven(options, domain, _);
        thumbprint = promptThumbprintIfNotGiven(options, thumbprint, _).toUpperCase();

        var progress = cli.interaction.progress(util.format($('Disabling SSL for %s domain using certificate with thumbprint %s for %s mobile service'), domain, thumbprint, options.servicename));
        try {
          result = mobile.disableSsl(options, domain, thumbprint, _);
        } finally {
          progress.end();
        }
      });

  var mobileCert = mobile.category('cert')
      .description($('Commands to manage your Mobile Service Certificates for Domains'));

  mobileCert.command('list [servicename]')
      .usage('[options] [servicename]')
      .description($('List certificates for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var progress = cli.interaction.progress(util.format($('Listing certificates for %s mobile service'), options.servicename));
        try {
          result = mobile.getCertificates(options, _);
        } finally {
          progress.end();
        }

        cli.interaction.formatOutput(result, function (output) {
          output.forEach(function (certificate) {
            log.data($('Certificate'), null);
            log.data($('Thumbprint'), certificate.thumbprint.green);
            log.data($('Subject Name'), certificate.subjectName.green);
            log.data($('Issuer'), certificate.issuer.green);
            log.data($('Expiration Date'), certificate.expirationDate.green);
            log.data($('Issue Date'), certificate.issueDate.green);
          });
        });
      });

  mobileCert.command('add [servicename] [certificate-path] [key]')
      .usage('[options] [servicename] [certificate-path] [key]')
      .description($('Add certificate to mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, certificatePath, key, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        certificatePath = cli.interaction.promptIfNotGiven($('Certificate path: '), certificatePath, _);

        if (!fs.existsSync(certificatePath)) {
          throw new Error(util.format($('Invalid certificate file path %s'), certificatePath));
        }

        if (path.extname(certificatePath) !== '.pfx') {
          throw new Error($('Only pfx certificates are supported'));
        }

        key = promptIfNotGiven($('Certificate key: '), key, _);

        var progress = cli.interaction.progress(util.format($('Adding certificate with path %s for %s mobile service'), certificatePath, options.servicename));
        try {
          var certificateContent = fs.readFile(certificatePath, _);
          var cert = {
            PfxBlob : certificateContent.toString('base64'),
            Password : key
          };
          result = mobile.addCertificate(options, cert, _);
        } catch (exception) {
          log.error('Ensure that you are using a valid .pfx certificate file');
          throw exception;
        } finally {
          progress.end();
        }
      });

  mobileCert.command('delete [servicename] [thumbprint]')
      .usage('[options] [servicename] [thumbprint]')
      .description($('Delete certificate from mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, thumbprint, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        thumbprint = promptThumbprintIfNotGiven(options, thumbprint, _).toUpperCase();

        var progress = cli.interaction.progress(util.format($('Deleting certificate with %s thumbprint for %s mobile service'), thumbprint, options.servicename));
        try {
          result = mobile.deleteCertificate(options, thumbprint, _);
        } finally {
          progress.end();
        }
      });

  var mobilePush = mobile.category('push')
      .description($('Commands to manage your Mobile Service Push Settings'));

  var mobilePushNh = mobilePush.category('nh')
      .description($('Manage notification hub settings for mobile service'));

  mobilePushNh.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get notification hub settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var progress = cli.interaction.progress($('Getting notification hub settings for mobile service'));
        try {
          result = mobile.getPushEntity(options, _);
        } finally {
          progress.end();
        }

        cli.interaction.formatOutput(result, function (output) {
          if (output.enableExternalPushEntity === true) {
            log.info($('Enhanced Push is enabled'));
            log.data($('Notification Hub State'), output.externalPushEntitySettingsPropertyBag.externalPushEntityState);
            log.data($('Notification Hub Namespace'), output.externalPushEntitySettingsPropertyBag.pushEntityNamespace);
            log.data($('Notification Hub Entity'), output.externalPushEntitySettingsPropertyBag.pushEntityPath);
            log.data($('Notification Hub ConnectionString'), output.externalPushEntitySettingsPropertyBag.pushEntityConnectionString);
          } else {
            log.info($('Enhanced push is disabled. Run "azure mobile push nh enable [servicename]" to enable enhanced push'));
          }
        });
      });

  mobilePushNh.command('enable [servicename]')
      .usage('[options] [servicename]')
      .description($('Create notification hub for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .option('--nowait', $('Do not wait for push operation to complete'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var progress = cli.interaction.progress($('Enabling enhanced push for mobile service')),
          settings = {
            enableExternalPushEntity: true,
            externalPushEntitySettingsPropertyBag: {}
          };

        try {
          result = mobile.getPushEntity(options, _);
          if (result.enableExternalPushEntity === true && result.externalPushEntitySettingsPropertyBag.externalPushEntityState === 'healthy') {
            log.error($('Enhanced push for mobile service is already enabled.'));
            return;
          }

          mobile.setPushEntity(options, settings, _);
          if (!options.nowait) {
            mobile.waitForPushEnabling(options, _);
          }
        } finally {
          progress.end();
        }
      });

  mobilePushNh.command('disable [servicename]')
    .usage('[options] [servicename]')
    .description($('Create notification hub for mobile service'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (servicename, options, _) {
      options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

      var progress = cli.interaction.progress($('Disabling enhanced push for mobile service')),
        settings = {
          enableExternalPushEntity: false
        };

        try {
          mobile.setPushEntity(options, settings, _);
        } finally {
          progress.end();
        }
    });

  function setColorOrDefault(value) {
    if (value) {
      return value.green;
    } else {
      return $('Not configured').blue;
    }
  }

  function getPushSettings(options, progressInfo, settingsName, resultFormatter, _) {
    var result,
        progress = cli.interaction.progress(util.format($('Getting %s settings for %s mobile service'), progressInfo, options.servicename));
    try {
      result = mobile.getPushSettings(options, _);
    } finally {
      progress.end();
    }

    cli.interaction.formatOutput(result[settingsName], resultFormatter);
  }

  function setPushSettings(options, progressInfo, settings, _) {
    var progress = cli.interaction.progress(util.format($('Setting %s settings for %s mobile service'), progressInfo, options.servicename));
    try {
      mobile.patchPushSettings(options, settings, _);
    } finally {
      progress.end();
    }
  }

  function deletePushSettings(options, progressInfo, settings, _) {
    var progress = cli.interaction.progress(util.format($('Deleting %s settings for %s mobile service'), progressInfo, options.servicename));
    try {
      mobile.patchPushSettings(options, settings, _);
    } finally {
      progress.end();
    }
  }

  var mobilePushGcm = mobilePush.category('gcm')
      .description($('Manage GCM settings for mobile service'));

  mobilePushGcm.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get google cloud API key for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getPushSettings(options, $('GCM'), 'gcmCredentials', function (result) {
          log.data($('API Key'), setColorOrDefault(result.apiKey));
        }, _);
      });

  mobilePushGcm.command('set [servicename] [apiKey]')
      .usage('[options] [servicename] [apiKey]')
      .description($('Set google cloud API key for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, apiKey, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        options.apiKey = promptIfNotGiven('API Key', apiKey, _);

        var settings = {
          gcmCredentials: {
            apiKey: options.apiKey,
            endpoint: 'https://android.googleapis.com/gcm/send'
          }
        };

        setPushSettings(options, $('GCM'), settings, _);
      });

  mobilePushGcm.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete google cloud API key for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var settings = {
          gcmCredentials: {
          }
        };

        deletePushSettings(options, $('GCM'), settings, _);
      });

  var mobilePushApns = mobilePush.category('apns')
      .description($('Manage APNS settings for mobile service'));

  mobilePushApns.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get Apple push notification settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .option('-f, --file <file>', $('save the certificate to file'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getPushSettings(options, $('APNS'), 'apnsCredentials', function (result) {
          if (result.apnsCertificate && options.file) {
            fs.writeFileSync(options.file, result.apnsCertificate, 'base64');
            log.data($('Certificate'), setColorOrDefault(util.format($('Certificate saved to %s'), options.file)));
          }

          if (result.apnsCertificate) {
            if (result.endpoint === 'gateway.push.apple.com') {
              log.info(setColorOrDefault($('Production certificate is present')));
            } else if (result.endpoint === 'gateway.sandbox.push.apple.com') {
              log.info(setColorOrDefault($('Development certificate is present')));
            }
          } else {
            log.info(setColorOrDefault($('No certificate present')));
          }
        }, _);
      });

  mobilePushApns.command('set [servicename] [mode] [certificateFile]')
      .usage('[options] [servicename] [mode] [certificateFile]')
      .description($('Set Apple push notification settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .option('-p, --password <password>', $('password for certificateFile'))
      .execute(function (servicename, mode, certificateFile, password, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        options.mode = promptIfNotGiven($('Mode'), mode, _);

        if (options.mode.toLowerCase() === 'sandbox') {
          options.mode = 'gateway.sandbox.push.apple.com';
        } else if (options.mode.toLowerCase() === 'production') {
          options.mode = 'gateway.push.apple.com';
        } else {
          log.error($('Mode can only have two values : "sandbox" or "production"'));
          return;
        }

        options.certificateFile = promptIfNotGiven($('Certificate File'), certificateFile, _);
        options.certificateData = fs.readFileSync(options.certificateFile, 'base64');

        var settings = {
          apnsCredentials: {
            endpoint: options.mode,
            apnsCertificate: options.certificateData,
            certificateKey: options.password
          }
        };

        setPushSettings(options, $('APNS'), settings, _);
      });

  mobilePushApns.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete Apple push notification settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var settings = {
          apnsCredentials: {
          }
        };

        deletePushSettings(options, $('APNS'), settings, _);
      });

  var mobilePushMpns = mobilePush.category('mpns')
      .description($('Manage Windows Phone notification settings for mobile service'));

  mobilePushMpns.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get windows phone notification settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .option('-f, --file <file>', $('save the certificate to file'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getPushSettings(options, $('windows phone notification'), 'mpnsCredentials', function (result) {
          if (result.mpnsCertificate && options.file) {
            fs.writeFileSync(options.file, result.mpnsCertificate, 'base64');
            log.data($('Certificate'), setColorOrDefault(util.format($('Certificate saved to %s'), options.file)));
          }

          if (result.mpnsCertificate) {
            log.info(setColorOrDefault($('Certificate is present')));
          }

          if (result.enableUnauthenticatedSettings) {
            log.info(setColorOrDefault($('Unauthenticated push notifications is enabled')));
          } else {
            log.info(setColorOrDefault($('Unauthenticated push notifications is disabled')));
          }
        }, _);
      });

  mobilePushMpns.command('set [servicename] [certificateFile] [password]')
      .usage('[options] [servicename] [certificateFile] [password]')
      .description($('Set windows phone notification settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, certificateFile, password, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var settings;
        options.certificateFile = promptIfNotGiven($('Certificate File'), certificateFile, _);
        options.certificateData = fs.readFileSync(options.certificateFile, 'base64');
        options.password = promptIfNotGiven($('Certificate Password'), password, _);

        settings = {
          mpnsCredentials: {
            enableUnauthenticatedSettings: true,
            mpnsCertificate: options.certificateData,
            certificateKey: options.password
          }
        };

        setPushSettings(options, $('windows phone notification'), settings, _);
      });

  mobilePushMpns.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete windows phone notification settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var settings = {
          mpnsCredentials: {
            enableUnauthenticatedSettings: false
          }
        };

        deletePushSettings(options, $('windows phone notification'), settings, _);
      });

  var mobilePushWns = mobilePush.category('wns')
      .description($('Manage windows application credentials for mobile service'));

  mobilePushWns.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get windows application credentials for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getPushSettings(options, $('windows application credential'), 'wnsCredentials', function (result) {
          log.data($('Client Secret'), setColorOrDefault(result.clientSecret));
          log.data($('Package SID'), setColorOrDefault(result.packageSID));
        }, _);
      });

  mobilePushWns.command('set [servicename] [clientSecret] [packageSID]')
      .usage('[options] [servicename] [clientSecret] [packageSID]')
      .description($('Set windows application credentials for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, clientSecret, packageSID, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        options.clientSecret = promptIfNotGiven($('Client Secret'), clientSecret, _);
        options.packageSID = promptIfNotGiven($('Package SID'), packageSID, _);

        var settings = {
          wnsCredentials: {
            clientSecret: options.clientSecret,
            packageSID: options.packageSID
          }
        };

        setPushSettings(options, $('windows application credential'), settings, _);
      });

  mobilePushWns.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete windows application credentials for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var settings = {
          wnsCredentials: {}
        };

        deletePushSettings(options, $('windows application credentials'), settings, _);
      });

  var mobileAuth = mobile.category('auth')
      .description($('Commands to manage authentication settings for mobile service'));

  function getAuthSettingAndOutput(options, progressInfo, authType, resultHandler, _) {
    var result,
        progress = cli.interaction.progress(util.format($('Getting %s settings for %s mobile service'), progressInfo, options.servicename));
    try {
      result = mobile.getAuthSettings(options, _);
    } finally {
      progress.end();
    }

    var settingsForAuthType = __.find(result, function (authSettings) { return authSettings.provider === authType; }) || {};

    cli.interaction.formatOutput(settingsForAuthType, resultHandler);
  }

  function setAuthSettingsCore(options, progressInfo, authType, newAuthSettings, _) {
    var progress = cli.interaction.progress(util.format($('Setting %s settings for %s mobile service'), progressInfo, options.servicename));
    try {
      var result = mobile.getAuthSettings(options, _);

      result = __.reject(result, function (authSettings) { return authSettings.provider == authType; });
      result.push(newAuthSettings);

      mobile.setAuthSettings(options, result, _);
    } finally {
      progress.end();
    }
  }

  function deleteAuthSettingsCore(options, progressInfo, authType, _) {
    var progress = cli.interaction.progress(util.format($('Deleting %s settings for %s mobile service'), progressInfo, options.servicename));
    try {
      var result = mobile.getAuthSettings(options, _);
      mobile.setAuthSettings(options, __.reject(result, function (authSettings) { return authSettings.provider === authType; }), _);
    } finally {
      progress.end();
    }
  }

  var mobileAuthMicrosoft = mobileAuth.category('microsoftaccount')
      .description($('Manage microsoft account settings for mobile service'));

  mobileAuthMicrosoft.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get microsoft account settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getAuthSettingAndOutput(options, $('microsoft account'), 'microsoft', function (output) {
          log.data($('Client Id'), setColorOrDefault(output.appId));
          log.data($('Client Secret'), setColorOrDefault(output.secret));
          log.data($('Package SID '), setColorOrDefault(output.packageSid));
        }, _);
      });

  mobileAuthMicrosoft.command('set [servicename] [clientId] [clientSecret]')
      .usage('[options] [servicename] [clientId] [clientSecret]')
      .description($('Set microsoft account settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .option('--packageSid <packageSid>', $('Package SID to be set'))
      .execute(function (servicename, clientId, clientSecret, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        if (!options.packageSid) {
          options.clientId = promptIfNotGiven($('ClientId'), clientId, _);
          options.clientSecret = promptIfNotGiven($('ClientSecret'), clientSecret, _);
        }

        var progress = cli.interaction.progress(util.format($('Setting microsoft account settings for %s mobile service'), options.servicename));
        try {
          var result = mobile.getAuthSettings(options, _);

          var existingSettings = __.find(result, function (authSettings) { return authSettings.provider === 'microsoft'; });
          if (existingSettings) {
            result = __.reject(result, function (authSettings) { return authSettings.provider == 'microsoft'; });
          } else {
            existingSettings = {};
          }

          var updatedSettings = {
            provider: 'microsoft',
            appId: options.clientId || clientId || existingSettings.appId || '',
            secret: options.clientSecret || clientSecret || existingSettings.secret || '',
            packageSid: options.packageSid || existingSettings.packageSid || ''
          };

          result.push(updatedSettings);

          mobile.setAuthSettings(options, result, _);
        } finally {
          progress.end();
        }
      });

  mobileAuthMicrosoft.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete microsoft account settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        deleteAuthSettingsCore(options, $('microsoft account'), 'microsoft', _);
      });

  var mobileAuthFacebook = mobileAuth.category('facebook')
      .description($('Manage facebook settings for mobile service'));

  mobileAuthFacebook.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get facebook identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getAuthSettingAndOutput(options, $('facebook'), 'facebook', function (output) {
          log.data($('API Key'), setColorOrDefault(output.appId));
          log.data($('App Secret'), setColorOrDefault(output.secret));
        }, _);
      });

  mobileAuthFacebook.command('set [servicename] [apiKey] [appSecret]')
      .usage('[options] [servicename] [apiKey] [appSecret]')
      .description($('Set facebook identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, apiKey, appSecret, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        options.apiKey = promptIfNotGiven($('API Key'), apiKey, _);
        options.appSecret = promptIfNotGiven($('App Secret'), appSecret, _);

        var authSettings = {
          provider: 'facebook',
          appId: options.apiKey,
          secret: options.appSecret
        };

        setAuthSettingsCore(options, $('facebook'), 'facebook', authSettings, _);
      });

  mobileAuthFacebook.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete facebook identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        deleteAuthSettingsCore(options, $('facebook'), 'facebook', _);
      });

  var mobileAuthTwitter = mobileAuth.category('twitter')
      .description($('Manage twitter settings for mobile service'));

  mobileAuthTwitter.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get twitter identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getAuthSettingAndOutput(options, $('twitter'), 'twitter', function (output) {
          log.data($('API Key'), setColorOrDefault(output.appId));
          log.data($('API Secret'), setColorOrDefault(output.secret));
        }, _);
      });

  mobileAuthTwitter.command('set [servicename] [apiKey] [apiSecret]')
      .usage('[options] [servicename] [apiKey] [apiSecret]')
      .description($('Set twitter identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, apiKey, apiSecret, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        options.apiKey = promptIfNotGiven($('ClientId'), apiKey, _);
        options.apiSecret = promptIfNotGiven($('ClientSecret'), apiSecret, _);

        var authSettings = {
          provider: 'twitter',
          appId: options.apiKey,
          secret: options.apiSecret
        };

        setAuthSettingsCore(options, $('twitter'), 'twitter', authSettings, _);
      });

  mobileAuthTwitter.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete twitter identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        deleteAuthSettingsCore(options, $('twitter'), 'twitter', _);
      });

  var mobileAuthGoogle = mobileAuth.category('google')
      .description($('Manage Google settings for mobile service'));

  mobileAuthGoogle.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get google identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getAuthSettingAndOutput(options, $('google'), 'google', function (output) {
          log.data($('Client Id'), setColorOrDefault(output.appId));
          log.data($('Client Secret'), setColorOrDefault(output.secret));
        }, _);
      });

  mobileAuthGoogle.command('set [servicename] [clientId] [clientSecret]')
      .usage('[options] [servicename] [clientId] [clientSecret]')
      .description($('Set google identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, clientId, clientSecret, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        options.clientId = promptIfNotGiven($('ClientId'), clientId, _);
        options.clientSecret = promptIfNotGiven($('ClientSecret'), clientSecret, _);

        var authSettings = {
          provider: 'google',
          appId: options.clientId,
          secret: options.clientSecret
        };

        setAuthSettingsCore(options, $('google'), 'google', authSettings, _);
      });

  mobileAuthGoogle.command('delete [servicename]')
      .usage('[options] [servicename]')
      .description($('Delete google identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        deleteAuthSettingsCore(options, $('google'), 'google', _);
      });

  var mobileAuthAad = mobileAuth.category('aad')
  .description($('Manage azure active directory settings for mobile service'));

  mobileAuthAad.command('get [servicename]')
      .usage('[options] [servicename]')
      .description($('Get azure active directory identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        getAuthSettingAndOutput(options, $('AAD'), 'aad', function (output) {
          log.data($('Client Id'), setColorOrDefault(output.appId));
          aadTenantResultHandler(output);
        }, _);
      });

  mobileAuthAad.command('set [servicename] [clientId]')
      .usage('[options] [servicename] [clientId]')
      .description($('Set azure active directory identity settings for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, clientId, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        options.clientId = promptIfNotGiven($('ClientId'), clientId, _);

        var authSettings = {
          provider: 'aad',
          appId: options.clientId,
          secret: '',
          tenants: []
        };

        setAuthSettingsCore(options, $('AAD'), 'aad', authSettings, _);
      });

  mobileAuthAad.command('delete [servicename]')
    .usage('[options] [servicename]')
    .description($('Delete azure active directory identity settings for mobile service'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (servicename, options, _) {
      options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

      deleteAuthSettingsCore(options, $('AAD'), 'aad', _);
    });

  function aadTenantResultHandler(aad){
    if (typeof aad.tenants === 'undefined' || aad.tenants.length === 0) {
      log.data($('Tenants'), setColorOrDefault($('None')));
    } else {
      aad.tenants.forEach(function (tenant) {
       log.data($('Tenant'), setColorOrDefault(tenant)); 
      });
    }
  }

  function extractAadSettings(authObject){
    var aad = __.find(authObject, function (authSettings) { return authSettings.provider == 'aad'; });
    aad.secret = '';
    if(typeof aad.tenants === 'undefined'){
      aad.tenants = [];
    }
    return aad;
  }

  var mobileAuthAadTenant = mobileAuthAad.category('tenant')
        .description($('Manage azure active directory tenants for mobile service'));

  mobileAuthAadTenant.command('list [servicename]')
      .usage('[options] [servicename]')
      .description($('List azure active directory tenants for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

        var result, progress = cli.interaction.progress(util.format($('Getting AAD tenant settings for mobile service'), servicename));
        try {
          result = mobile.getAuthSettings(options, _);
        } finally {
          progress.end();
        }

        var aad = extractAadSettings(result);

        cli.interaction.formatOutput(aad.tenants, function() {
          return aadTenantResultHandler(aad);
        });
      });

  mobileAuthAadTenant.command('add [servicename] [tenant]')
      .usage('[options] [servicename] [tenant]')
      .description($('Add azure active directory tenant for mobile service'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function (servicename, tenant, options, _) {
        options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
        tenant = promptIfNotGiven($('Tenant: '), tenant, _);

        var progress = cli.interaction.progress(util.format($('Adding %s tenant to %s mobile service'), tenant, servicename));
        try {
          var result = mobile.getAuthSettings(options, _);

          var aad = extractAadSettings(result);
          if(!__.contains(aad.tenants, tenant)){
            aad.tenants.push(tenant);
            mobile.setAuthSettings(options, result, _);
          }
        } finally {
          progress.end();
        }

        log.info($('The tenant was successfully added.').green);
      });

  mobileAuthAadTenant.command('delete [servicename] [tenant]')
    .usage('[options] [servicename] [tenant]')
    .description($('Remove azure active directory tenant for mobile service'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (servicename, tenant, options, _) {
      options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

      tenant = cli.interaction.chooseIfNotGiven($('Tenant: '), $('Getting choices'), tenant,
        function (cb) {
          mobile.getAuthSettings(options, function (error, auth) {
            if (error) { cb(error); }
            cb(null, extractAadSettings(auth).tenants.map(function (tenant) { return tenant; }));
          });
        }, _);

      var progress = cli.interaction.progress(util.format($('Removing %s tenant from %s mobile service'), tenant, servicename));
      try {
        var result = mobile.getAuthSettings(options, _);

        var aad = extractAadSettings(result);

        aad.tenants = __.reject(aad.tenants, function (authTenant) { return authTenant == tenant; });
        mobile.setAuthSettings(options, result, _);

      } finally {
        progress.end();
      }

      log.info($('The tenant was successfully removed.').green);
    });

  var mobileTable = mobile.category('table')
        .description($('Commands to manage your Mobile Service tables'));

  mobileTable.command('list [servicename]')
        .usage('[options] [servicename]')
        .description($('List mobile service tables'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);

          var result,
              progress = cli.interaction.progress($('Getting table information'));

          try {
            result = mobile.listTables(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (tables) {
            if (tables && tables.length > 0) {
              log.table(tables, function (row, s) {
                row.cell($('Name'), s.name);
                row.cell($('Indexes'), s.metrics.indexCount);
              });
            } else {
              log.info($('No tables created yet. You can create a mobile service table using azure mobile table create command'));
            }
          });
        });

  function loadTableMetaData(options, callback) {
    var results = {};
    var operationCount = 0;

    function tryFinish() {
      if (++operationCount < 4) {
        return;
      }

      callback(null, results);
    }

    function createCallback(name) {
      return function (error, result) {
        log.silly(name, error);
        if (!error) {
          results[name] = result;
        }

        tryFinish();
      };
    }

    // unlike async.parallel, we want all operations to execute regardless if some have errors
    try {
      mobile.getTable(options, createCallback('table'));
      mobile.getPermissions(options, createCallback('permissions'));
      mobile.getColumns(options, createCallback('columns'));
      mobile.getScripts(options, createCallback('scripts'));
    } catch (e) {
      callback(e);
    }
  }

  mobileTable.command('show [servicename] [tablename]')
        .usage('[options] [servicename] [tablename]')
        .description($('Show details for a mobile service table'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, tablename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.tablename = promptTableNameIfNotGiven(options, tablename, _);

          var result,
              progress = cli.interaction.progress($('Getting table information'));

          try {
            result = loadTableMetaData(options, _);
          } finally {
            progress.end();
          }

          if (!result.table) {
            throw new Error(util.format($('Table %s or mobile service %s does not exist'), tablename, servicename));
          }
          cli.interaction.formatOutput(result, function (results) {
            log.info($('Table statistics:').green);
            log.data($('Number of records'), results.table.metrics.recordCount.toString().green);
            log.info($('Table operations:').green);
            log.table(['insert', 'read', 'update', 'delete'], function (row, s) {
              row.cell($('Operation'), s);

              var script;
              if (results.scripts) {
                for (var i = 0; i < results.scripts.length; i++) {
                  if (results.scripts[i].operation === s) {
                    script = results.scripts[i];
                    break;
                  }
                }

                row.cell('Script', script ? script.sizeBytes.toString() + ' bytes' : 'Not defined');
              } else {
                row.cell('Script', 'N/A');
              }

              if (results.permissions) {
                row.cell('Permissions', results.permissions[s] || 'default');
              } else {
                row.cell('Permissions', 'N/A');
              }
            });

            if (results.columns) {
              log.info($('Table columns:').green);
              log.table(results.columns, function (row, s) {
                row.cell($('Name'), s.name);
                row.cell($('Type'), s.type);
                row.cell($('Indexed'), s.indexed ? 'Yes' : '');
              });
            } else {
              log.error($('Unable to obtain table columns'));
            }
          });
        });

  var roles = ['user', 'public', 'application', 'admin'];
  var operations = ['insert', 'read', 'update', 'delete'];
  var methods = ['get', 'put', 'post', 'patch', 'delete'];
  function parsePermissions(permissions, keys) {
    var result = {};
    if (__.isString(permissions)) {
      permissions = permissions.toLowerCase();
      permissions.split(',').forEach(function (pair) {
        var match = pair.match(/^([^\=]+)\=(.+)$/);
        if (!match) {
          throw new Error(util.format($('Syntax error in parsing the permission pair "%s"'), pair));
        }

        if (match[1] !== '*' && !keys.some(function (key) { return key === match[1]; })) {
          throw new Error(util.format($('Unsupported operation name \'%s\'. Operation must be one of *, %s'), match[1], keys.join(', ')));
        }

        if (!roles.some(function (role) { return role === match[2]; })) {
          throw new Error(util.format($('Unsupported permission value \'%s\'. Permission must be one of %s'), match[2].red, roles.join(', ')));
        }

        if (match[1] === '*') {
          keys.forEach(function (key) {
            result[key] = match[2];
          });
        } else {
          result[match[1]] = match[2];
        }
      });
    }

    return result;
  }

  mobileTable.command('create [servicename] [tablename]')
        .usage('[options] [servicename] [tablename]')
        .description($('Create a new mobile service table'))
        .option('-p, --permissions <permissions>', $('comma delimited list of <operation>=<permission> pairs'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .option('--integerId', $('Create a table with an integer id column'))
        .execute(function (servicename, tablename, options, _) {
          var settings;
          try {
            settings = parsePermissions(options.permissions, operations);
          }
          catch (e) {
            log.error($('Permissions must be specified as a comma delimited list of <operation>=<permission> pairs.'));
            log.error(util.format($('<operation> must be one of %s'), operations.join(', ')));
            log.error(util.format($('<permission> must be one of %s'), roles.join(', ')));

            throw e;
          }

          // default table permissions to 'application'
          operations.forEach(function (operation) {
            if (!settings[operation]) {
              settings[operation] = 'application';
            }
          });

          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          settings.name = promptIfNotGiven($('Table name: '), tablename, _);

          if (options.integerId) {
            settings.idType = 'integer';
          } else {
            settings.idType = 'string';
          }

          var progress = cli.interaction.progress($('Creating table'));
          try {
            mobile.createTable(options, settings, _);
          } finally {
            progress.end();
          }
        });

  mobileTable.command('update [servicename] [tablename]')
        .usage('[options] [servicename] [tablename]')
        .description($('Update mobile service table properties'))
        .option('-p, --permissions <permissions>', $('comma delimited list of <operation>=<permission> pairs'))
        .option('--addColumn <columns>', $('comma separated list of <name>=<type> to add'))
        .option('--deleteColumn <columns>', $('comma separated list of columns to delete'))
        .option('-q, --quiet', $('do not prompt for confirmation of column deletion'))
        .option('--addIndex <columns>', $('comma separated list of columns to create an index on'))
        .option('--deleteIndex <columns>', $('comma separated list of columns to delete an index from'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, tablename, options, _) {
          if (!options.deleteIndex && !options.addIndex && !options.permissions && !options.deleteColumn && !options.addColumn) {
            throw new Error($('No updates specified. Check the list of available updates with --help and specify at least one.'));
          }

          try {
            options.permissions = parsePermissions(options.permissions, operations);
          } catch (e) {
            log.error($('Permissions must be specified as a comma delimited list of <operation>=<permission> pairs.'));
            log.error(util.format($('<operation> must be one of %s'), operations.join(', ')));
            log.error(util.format($('<permission> must be one of %s'), roles.join(', ')));

            throw e;
          }

          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.tablename = promptTableNameIfNotGiven(options, tablename, _);

          if (__.isString(options.deleteColumn) && !options.quiet) {
            if (cli.interaction.confirm($('Do you really want to delete the column(s)? [y/n]: '), _) === false) {
              log.info($('Update terminated with no changes made'));
              return;
            }
          }

          var plan = [];

          // add permission update to plan
          if (Object.getOwnPropertyNames(options.permissions).length > 0) {
            plan.push({
              progress: $('Updating permissions'),
              success: $('Updated permissions'),
              failure: $('Failed to update permissions'),
              handler: function (callback) {
                mobile.updatePermissions(options, options.permissions, callback);
              }
            });
          }

          // add index deletion to plan
          if (options.deleteIndex) {
            options.deleteIndex.split(',').forEach(function (column) {
              plan.push({
                progress: util.format($('Deleting index from column %s'), column),
                success: util.format($('Deleted index from column %s'), column),
                failure: util.format($('Failed to delete index from column %s'), column),
                handler: function (callback) {
                  mobile.deleteIndex(options, column, callback);
                }
              });
            });
          }

          // add column addition to plan, before adding index so both can be done in one command
          if (options.addColumn) {
            options.addColumn.split(',').forEach(function (columnPair) {
              var columnInfo = columnPair.split('=');

              // Convert system column types to auto
              if (columnInfo[0].substr(0, 2) === '__') {
                columnInfo[1] = 'auto';
              }

              plan.push({
                progress: util.format($('Adding column %s'), columnInfo[0]),
                success: util.format($('Added column %s'), columnInfo[0]),
                failure: util.format($('Failed to add column %s'), columnInfo[0]),
                handler: function (callback) {
                  mobile.addColumn(options, columnInfo[0], { type: columnInfo[1] }, callback);
                }
              });
            });
          }

          // add index addition to plan
          if (options.addIndex) {
            options.addIndex.split(',').forEach(function (column) {
              plan.push({
                progress: util.format($('Adding index to column %s'), column),
                success: util.format($('Added index to column %s'), column),
                failure: util.format($('Failed to add index to column %s'), column),
                handler: function (callback) {
                  mobile.createIndex(options, column, callback);
                }
              });
            });
          }

          // add column deletion to plan
          if (options.deleteColumn) {
            options.deleteColumn.split(',').forEach(function (column) {
              plan.push({
                progress: util.format($('Deleting column %s'), column),
                success: util.format($('Deleted column %s'), column),
                failure: util.format($('Failed to delete column %s'), column),
                handler: function (callback) {
                  mobile.deleteColumn(options, column, callback);
                }
              });
            });
          }

          // execute plan
          var failures = 0;
          for (var i = 0; i < plan.length; i++) {
            var step = plan[i],
                progress = cli.interaction.progress(step.progress);

            try {
              step.handler(_);
              log.info(step.success);
            } catch (e) {
              log.error(step.failure);
              failures++;
            } finally {
              progress.end();
            }
          }

          if (failures !== 0) {
            throw new Error($('Not all update operations completed successfully'));
          }
        });

  mobileTable.command('delete [servicename] [tablename]')
        .usage('[options] [servicename] [tablename]')
        .description($('Delete a mobile service table'))
        .option('-q, --quiet', $('do not prompt for confirmation'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, tablename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.tablename = promptTableNameIfNotGiven(options, tablename, _);

          if (!options.quiet) {
            if (cli.interaction.confirm($('Do you really want to delete the table? [y/n]: '), _) === false) {
              log.info($('Table was not deleted'));
              return;
            }
          }

          var progress = cli.interaction.progress($('Deleting table'));
          try {
            mobile.deleteTable(options, _);
          } finally {
            progress.end();
          }
        });

  var mobileData = mobile.category('data')
        .description($('Commands to manage your Mobile Service tables data'));

  mobileData.command('read [servicename] [tablename] [query]')
        .usage('[options] [servicename] [tablename] [query]')
        .description($('Query data from a mobile service table'))
        .option('-k, --skip <top>', $('skip the first <skip> number of rows'))
        .option('-t, --top <top>', $('return the first <top> number of remaining rows'))
        .option('-l, --list', $('display results in list format'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, tablename, query, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.tablename = promptTableNameIfNotGiven(options, tablename, _);
          options.query = query;

          var result,
              progress = cli.interaction.progress($('Reading table data'));

          try {
            result = mobile.getData(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (data) {
            if (!Array.isArray(data) || data.length === 0) {
              log.info($('No matching records found'));
            } else if (options.list) {
              data.forEach(function (record) {
                log.data('', '');
                for (var i in record) {
                  log.data(i, record[i] === null ? '<null>'.green : record[i].toString().green);
                }
              });
              log.data('', '');
            } else {
              log.table(data, function (row, s) {
                for (var i in s) {
                  row.cell(i, s[i]);
                }
              });
            }
          });
        });

  mobileData.command('truncate [servicename] [tablename]')
        .usage('[options] [servicename] [tablename]')
        .description($('Delete all data from a mobile service table'))
        .option('-q, --quiet', $('do not prompt for confirmation'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, tablename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.tablename = promptTableNameIfNotGiven(options, tablename, _);

          var result,
              progress;

          if (!options.quiet) {
            progress = cli.interaction.progress($('Retrieving table information'));
            try {
              result = mobile.truncateTable(options, JSON.stringify({ confirm: false }), _);
            } finally {
              progress.end();
            }

            if (result.rowCount === 0) {
              log.info($('There is no data in the table.'));
              return;
            }

            log.info(util.format($('There are %s data rows in the table'), result.rowCount));
            if (!cli.interaction.confirm($('Do you really want to delete all data from the table? [y/n]: '), _)) {
              log.info($('No data was deleted.'));
              return;
            }
          }

          progress = cli.interaction.progress($('Truncating table data'));
          try {
            result = mobile.truncateTable(options, JSON.stringify({ confirm: true }), _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (data) {
            log.info(util.format($('Deleted %s rows'), data.rowCount));
          });
        });

  mobileData.command('delete [servicename] [tablename] [recordid]')
        .description($('Delete a record from the mobile service table'))
        .option('-q, --quiet', $('do not prompt for confirmation'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, tablename, recordid, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.tablename = promptTableNameIfNotGiven(options, tablename, _);
          options.recordid = promptIfNotGiven($('Record id: '), recordid, _);

          var progress = cli.interaction.progress($('Deleting record'));
          try {
            mobile.deleteTableRecord(options, _);
          } finally {
            progress.end();
          }
        });

  function displayScheduledJob(row, s) {
    row.cell($('Job name'), s.name);
    row.cell($('Script name'), 'scheduler/' + s.name);
    row.cell($('Status'), s.status);
    row.cell($('Interval'), s.intervalUnit ? (s.intervalPeriod + ' [' + s.intervalUnit + ']') : 'on demand');
    row.cell($('Last run'), s.lastRun || 'N/A');
    row.cell($('Next run'), s.nextRun || 'N/A');
  }

  var mobileScript = mobile.category('script')
        .description($('Commands to manage your Mobile Service scripts'));

  mobileScript.command('list [servicename]')
        .description($('List mobile service scripts'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);

          var progress = cli.interaction.progress($('Retrieving script information'));
          var results = {};
          try {
            results = mobile.loadAllScripts(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(results, function (scripts) {
            if (!scripts.table) {
              log.error($('Unable to get table scripts'));
            } else if (!Array.isArray(scripts.table) || scripts.table.length === 0) {
              log.info($('There are no table scripts. Create scripts using the \'azure mobile script upload\' command.'));
            } else {
              log.info($('Table scripts').green);
              log.table(scripts.table, function (row, s) {
                row.cell($('Name'), 'table/' + s.table + '.' + s.operation);
                row.cell($('Size'), s.sizeBytes);
              });
            }

            if (!scripts.shared) {
              log.error($('Unable to get shared scripts'));
            } else if (!Array.isArray(scripts.shared) || scripts.shared.length === 0) {
              log.info($('There are no shared scripts. Create scripts using the \'azure mobile script upload\' command.'));
            } else {
              log.info($('Shared scripts').green);
              log.table(scripts.shared, function (row, s) {
                row.cell($('Name'), 'shared/' + s.name);
                row.cell($('Size'), s.size);
              });
            }

            if (!scripts.scheduler) {
              log.error($('Unable to get scheduled job scripts'));
            } else if (!Array.isArray(scripts.scheduler) || scripts.scheduler.length === 0) {
              log.info($('There are no scheduled job scripts. Create scheduled jobs using the \'azure mobile job\' command.'));
            } else {
              log.info($('Scheduled job scripts').green);
              log.table(scripts.scheduler, displayScheduledJob);
            }

            if (!scripts.api) {
              log.error($('Unable to get custom API scripts'));
            } else if (!Array.isArray(scripts.api) || scripts.api.length === 0) {
              log.info($('There are no custom API scripts. Create APIs using the \'azure mobile api\' command.'));
            } else {
              log.info($('Custom API scripts').green);
              log.table(scripts.api, displayCustomApi);
              if (scripts.api.some(function (api) { return api.hasAdditionalPermissions === true; })) {
                log.info($('* indicates the permissions metadata file has been manually modified.'));
              }
            }
          });
        });

  function checkScriptName(options) {
    if (!options.script) {
      log.info($('For table scripts, specify table/<tableName>.{insert|read|update|delete}'));
      log.info($('For shared scripts, specify shared/<scriptname>'));
      log.info($('For scheduler scripts, specify scheduler/<scriptName>'));
      log.info($('For custom API scripts, specify api/<scriptName>'));

      throw new Error(util.format($('Invalid script name \'%s\''), options.scriptname));
    }
  }

  function parseScriptName(scriptname) {
    var result = null,
        match = scriptname.match(/^(table|scheduler|shared|api)\/([^\.]+)/);

    if (!match) {
      return result;
    }

    var parts;
    if (match[1] === 'table') {
      parts = scriptname.match(/^table\/([^\.]+)\.(insert|read|update|delete)(?:$|\.js$)/);
      if (parts) {
        result = { type: 'table', table: { name: parts[1], operation: parts[2] } };
      }
    } else {
      parts = match[2].match(/([a-zA-Z0-9_]+)(?:$|\.js$)/);
      if (parts) {
        result = { type: match[1] };
        result[match[1]] = { name: parts[1] };
      }
    }

    return result;
  }

  function saveScriptFile(scriptSpec, script, output, force) {
    var file;
    var dir;

    if (output) {
      file = output;
    } else {
      dir = './' + scriptSpec.type;
      file = dir + '/';
      if (scriptSpec.type === 'table') {
        file += scriptSpec.table.name + '.' + scriptSpec.table.operation + '.js';
      } else {
        file += scriptSpec[scriptSpec.type].name + '.js';
      }
    }

    if (utils.pathExistsSync(file) && !force) {
      throw new Error(util.format($('File %s already exists. Use --override to override.'), file));
    } else {
      try {
        if (!output) {
          if (!utils.pathExistsSync(dir)) {
            fs.mkdirSync(dir);
          }
        }

        fs.writeFileSync(file, script, 'utf8');
        log.info(util.format($('Saved script to %s'), file));
      }
      catch (e) {
        throw new Error(util.format($('Unable to save file \'%s\''), file));
      }
    }

    return null;
  }

  var getScriptHandlers = {
    table: mobile.getTableScript,
    scheduler: mobile.getSchedulerScript,
    shared: mobile.getSharedScript,
    api: mobile.getCustomApiScript
  };

  mobileScript.command('download [servicename] [scriptname]')
        .description($('Downloads a mobile service script'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .option('-f, --file <file>', $('file to save the script to'))
        .option('-o, --override', $('override existing files'))
        .option('-c, --console', $('write the script to the console instead of a file'))
        .execute(function (servicename, scriptname, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.scriptname = promptIfNotGiven($('Script: '), scriptname, _);
          options.script = parseScriptName(options.scriptname);
          checkScriptName(options);

          var progress = cli.interaction.progress(util.format($('Downloading script: \'%s\''), options.scriptname));
          var script;
          try {
            script = getScriptHandlers[options.script.type](options, _);
          } finally {
            progress.end();
          }

          script = script.toString();

          if (options.console) {
            console.log(script);
          } else {
            saveScriptFile(options.script, script, options.file, options.override);
          }
        });

  var setScriptHandlers = {
    table: mobile.setTableScript,
    scheduler: mobile.setSchedulerScript,
    shared: mobile.setSharedScript,
    api: mobile.setCustomApiScript
  };

  mobileScript.command('upload [servicename] [scriptname]')
        .description($('Uploads a mobile service script'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .option('-f, --file <file>', $('file to read the script from'))
        .execute(function (servicename, scriptname, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.scriptname = promptIfNotGiven($('Script: '), scriptname, _);
          options.script = parseScriptName(options.scriptname);
          checkScriptName(options);

          if (!options.file) {
            options.file = './' + options.script.type + '/';
            if (options.script.table) {
              options.file += options.script.table.name + '.' + options.script.table.operation + '.js';
            } else {
              options.file += options.script[options.script.type].name + '.js';
            }
          }

          var script;
          try {
            script = fs.readFileSync(options.file, 'utf8');
          }
          catch (e) {
            throw new Error(util.format($('Unable to read script from file %s'), options.file));
          }

          var progress = cli.interaction.progress(util.format($('Uploading script: \'%s\''), options.scriptname));
          try {
            setScriptHandlers[options.script.type](options, script, _);
          } finally {
            progress.end();
          }
        });

  var deleteScriptHandlers = {
    table: mobile.deleteTableScript,
    scheduler: mobile.deleteSchedulerScript,
    shared: mobile.deleteSharedScript,
    api: mobile.deleteCustomApi
  };

  mobileScript.command('delete [servicename] [scriptname]')
        .description($('Deletes a mobile service script'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, scriptname, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.scriptname = promptIfNotGiven($('Script: '), scriptname, _);
          options.script = parseScriptName(options.scriptname);
          checkScriptName(options);

          var progress = cli.interaction.progress(util.format($('Deleting script: \'%s\''), options.scriptname));
          try {
            deleteScriptHandlers[options.script.type](options, _);
          } finally {
            progress.end();
          }
        });

  var mobileScale = mobile.category('scale')
        .description($('Commands to manage your Mobile Service scaling'));

  mobileScale.command('show [servicename]')
        .description($('Show the scale settings of a mobile service'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          var result,
              progress = cli.interaction.progress($('Retrieving scale settings'));
          try {
            result = mobile.getScaleSettings(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, displayScaleSettings);
        });

  mobileScale.command('change [servicename]')
        .description($('Change the scale settings of a mobile service'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .option('-t, --tier <tier>', $('choose the free, basic or standard tier'))
        .option('-i, --numberOfInstances <count>', $('number of instances in basic or standard mode'))
        .option('-q, --quiet', $('do not prompt for confirmation'))
        .execute(function (servicename, options, _) {
          var userSpecifiedTier = options.tier;
          if (!options.tier && !options.numberOfInstances) {
            throw new Error($('Specify at least one option. Type --help for more information.'));
          }

          // Convert options to internal values, confirm valid value was entered
          if (!__.isUndefined(options.tier)) {
            options.tier = findScale(options.tier);
            if (options.tier === undefined) {
              throw new Error(util.format($('Allowed values for tier are %s, %s or %s.'),
                scaleInformation['tier1'].name, scaleInformation['tier2'].name, scaleInformation['tier3'].name));
            }

            // If going to 'free' and they didn't specify a number, set it to 1
            if (options.tier === 'tier1' && __.isUndefined(options.numberOfInstances)) {
              options.numberOfInstances = 1;
            }
          }

          // Verify number of instances is valid
          if (!__.isUndefined(options.numberOfInstances) && isNaN(options.numberOfInstances)) {
            throw new Error($('Number of instances must be a positive integer.'));
          }

          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
          if (userSpecifiedTier === 'standard' && !options.quiet) {
            var proceed = cli.interaction.confirm($('Mobile service scale tiers have changed, set scale to Standard (previously Premium)? [y/n]: '), _);
            if (!proceed) {
              log.info($('Change scale cancelled with no changes made.'));
              return;
            }
          }

          var progress = cli.interaction.progress($('Rescaling the mobile service'));
          var scalesettings;
          try {
            scalesettings = mobile.getScaleSettings(options, _);
            scalesettings.tier = findScale(scalesettings.tier, true); // Remove post migration
          } catch (e) {
            // Only stop the progress bar on errors, since we have to do another call to save the changes yet
            progress.end();
            throw e;
          }

          var newScaleSettings = {
            tier: options.tier || scalesettings.tier,
            numberOfInstances: options.numberOfInstances || scalesettings.numberOfInstances
          };

          if (newScaleSettings.tier === scalesettings.tier &&
              newScaleSettings.numberOfInstances == scalesettings.numberOfInstances) {
            // Nothing to change
            progress.end();
            log.info($('Current scale settings of the mobile service already match the requested settings. No changes are made.'));
            return;
          }

          // Ensure limits are correct
          var scaleInfo = scaleInformation[newScaleSettings.tier];
          if (scaleInfo.maxInstances < newScaleSettings.numberOfInstances) {
            progress.end();
            if (scaleInfo.maxInstances === 1) {
              throw new Error(util.format($('Number of instances must be set to 1 when the mobile service is in the %s tier.'),
                scaleInfo.name));
            }

            throw new Error(util.format($('Cannot set number of instances to %d when the mobile service is in the %s tier. Valid values for this tier are 1 to %d.'),
              newScaleSettings.numberOfInstances, scaleInfo.name, scaleInfo.maxInstances));
          }

          try {
            mobile.setScaleSettings(options, newScaleSettings, _);
          } finally {
            progress.end();
          }
        });

  var mobileJob = mobile.category('job')
        .description($('Commands to manage your Mobile Service scheduled jobs'));

  mobileJob.command('list [servicename]')
        .usage('[options] [servicename]')
        .description($('List mobile service scheduled jobs'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, callback) {

          if (servicename) {
            ensuredServiceName(servicename);
          } else {
            promptString($('Mobile service name: '), ensuredServiceName);
          }

          function ensuredServiceName(servicename) {
            options.servicename = servicename;

            mobile.getSchedulerScripts(options, function (error, results) {
              if (error) {
                return callback(error);
              }

              if (log.format().json) {
                log.json(results);
              } else {
                if (!Array.isArray(results) || results.length === 0) {
                  log.info($('There are no scheduled jobs. Create scheduled jobs using the \'azure mobile job create\' command'));
                } else {
                  log.info($('Scheduled jobs').green);
                  log.table(results, displayScheduledJob);
                  log.info($('You can manipulate scheduled job scripts using the \'azure mobile script\' command.').green);
                }
              }

              callback();
            });
          }
        });

  var intervalUnits = ['second', 'minute', 'hour', 'day', 'month', 'year', 'none'];

  mobileJob.command('create [servicename] [jobname]')
        .usage('[options] [servicename] [jobname]')
        .description($('Create a mobile service scheduled job'))
        .option('-i, --interval <number>', $('job interval as an integer; defaults to 15'))
        .option('-u, --intervalUnit <unit>', $('specify one of: minute, hour, day, month or none for on-demand jobs; defaults to minute'))
        .option('-t, --startTime <time>', $('time of the first run of the script in ISO format; defaults to now'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, jobname, options, callback) {
          options.interval = typeof options.interval === 'undefined' ? 15 : +options.interval;
          options.intervalUnit = options.intervalUnit || 'minute';

          if (isNaN(options.interval) || options.interval < 0) {
            return callback(new Error($('The --interval must be a positive integer')));
          }

          if (!intervalUnits.some(function (unit) { return unit === options.intervalUnit; })) {
            return callback(util.format($('The --intervalUnit must be one of %s'), intervalUnits.join(', ')));
          }

          if (servicename) {
            ensuredServiceName(servicename);
          } else {
            promptString($('Mobile service name: '), ensuredServiceName);
          }

          function ensuredServiceName(servicename) {
            options.servicename = servicename;

            if (jobname) {
              ensuredJobName(jobname);
            } else {
              promptString($('Scheduled job name: '), ensuredJobName);
            }

            function ensuredJobName(jobname) {
              options.jobname = jobname;

              var job = {
                name: options.jobname
              };

              if (options.intervalUnit !== 'none') {
                job.intervalUnit = options.intervalUnit;
                job.intervalPeriod = options.interval;
                job.startTime = options.startTime || new Date().toISOString();
              }

              mobile.createJob(options, JSON.stringify(job), function (error) {
                if (error) {
                  return callback(error);
                }

                log.info($('Job was created in disabled state. You can enable the job using the \'azure mobile job update\' command').green);
                log.info($('You can manipulate the scheduled job script using the \'azure mobile script\' command').green);
                callback();
              });
            }
          }
        });

  mobileJob.command('update [servicename] [jobname]')
        .usage('[options] [servicename] [jobname]')
        .description($('Update a mobile service scheduled job'))
        .option('-i, --interval <number>', $('job interval as an integer'))
        .option('-u, --intervalUnit <unit>', $('specify one of: minute, hour, day, month or none for on-demand jobs'))
        .option('-t, --startTime <time>', $('time of the first run of the script in ISO format'))
        .option('-a, --status <status>', $('enabled or disabled'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, jobname, options, _) {

          if (typeof options.interval !== 'undefined' && isNaN(options.interval) || options.interval < 0) {
            throw new Error($('The --interval must be a positive integer'));
          }

          if (typeof options.intervalUnits !== 'undefined' && !intervalUnits.some(function (unit) { return unit === options.intervalUnit; })) {
            throw new Error(util.format($('The --intervalUnit must be one of %s'), intervalUnits.join(', ')));
          }

          if (typeof options.status !== 'undefined' && options.status !== 'enabled' && options.status !== 'disabled') {
            throw new Error($('The --status must be either enabled or disabled'));
          }

          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
          options.jobname = cli.interaction.chooseIfNotGiven($('Scheduled job name: '), $('Getting choices'), jobname,
            function (cb) {
              mobile.getSchedulerScripts(options, function (error, jobs) {
                if (error) { return cb(error); }
                log.silly(JSON.stringify(jobs));

                cb(null, jobs.map(function (job) { return job.name; }));
              });
            }, _);

          var progress = cli.interaction.progress($('Updating job settings'));
          var job, newJob;
          try {
            job = mobile.getJob(options, _);
          } catch (e) {
            progress.end();
            throw e;
          }

          log.silly($('Current settings for job: '));
          log.json('silly', job);

          if (options.intervalUnit === 'none') {
            newJob = {
              status: 'disabled',
              intervalUnit: undefined
            };
          } else {
            newJob = {
              intervalPeriod: +options.interval || job.intervalPeriod,
              intervalUnit: options.intervalUnit || job.intervalUnit,
              startTime: options.startTime || job.startTime || '1900-01-01T00:00:00Z',
              status: options.status || job.status
            };
          }

          var changed = false;
          for (var i in newJob) {
            if (newJob[i] !== job[i]) {
              changed = true;
              break;
            }
          }

          if (changed) {
            try {
              mobile.setJob(options, newJob, _);
            } catch (e) {
              progress.end();
              throw e;
            }
          } else {
            log.info($('The scheduled job settings already match the requested settings. No changes made'));
          }
          progress.end();

        });

  mobileJob.command('delete [servicename] [jobname]')
        .usage('[options] [servicename] [jobname]')
        .description($('Delete a mobile service scheduled job'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, jobname, options, callback) {

          if (servicename) {
            ensuredServiceName(servicename);
          } else {
            promptString($('Mobile service name: '), ensuredServiceName);
          }

          function ensuredServiceName(servicename) {
            options.servicename = servicename;

            if (jobname) {
              ensuredJobName(jobname);
            } else {
              promptString($('Scheduled job name: '), ensuredJobName);
            }

            function ensuredJobName(jobname) {
              options.jobname = jobname;
              mobile.deleteSchedulerScript(options, callback);
            }
          }
        });

  var mobilePreview = mobile.category('preview')
    .description($('Commands to enable preview features for your Mobile Service'));

  mobilePreview.command('list [servicename]')
        .description($('Show the preview features enabled for a mobile service'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          var progress = cli.interaction.progress($('Getting preview features'));
          var result;
          try {
            result = mobile.getPreviews(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (features) {
            if (features && (features.enabled && features.enabled.length > 0) || (features.available && features.available.length > 0)) {
              var combinedFeatures = __.union(features.enabled, features.available);
              log.table(combinedFeatures, function (row, f) {
                row.cell($('Preview feature'), f);
                row.cell($('Enabled'), __.contains(features.enabled, f) ? 'Yes'.green : 'No');
              });
              log.info($('You can enable preview features using the \'azure mobile preview enable\' command.'));
            } else {
              log.data($('There are no preview features available.'));
            }
          });
        });

  mobilePreview.command('enable [servicename] [featurename]')
        .usage('[options] [servicename] [featurename]')
        .description($('Enable a preview feature for a mobile service. Note that preview features cannot be disabled for a mobile service!'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (servicename, featurename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
          options.featurename = cli.interaction.chooseIfNotGiven($('Preview feature: '), $('Getting choices'), featurename,
            function (cb) {
              mobile.getPreviews(options, function (error, features) {
                if (error) { return cb(error); }
                cb(null, features.available);
              });
            }, _);

          var progress = cli.interaction.progress($('Enabling preview feature for mobile service'));
          var result;
          try {
            result = mobile.enablePreview(options, { enable: options.featurename }, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (feature) {
            log.info($('Result of enabling feature:').green);
            log.info(feature.summary);

            Object.keys(feature.data).forEach(function (property) {
              var value = feature.data[property];
              if (__.isObject(value)) {
                value = JSON.stringify(value);
              }
              log.data(util.format($('data.%s'), property), value.green);
            });

            log.verbose(util.format($('Detailed information: %s'), result.details));
          });
        });

  var mobileApi = mobile.category('api')
        .description($('Commands to manage your mobile service APIs'));

  mobileApi.command('list [servicename]')
        .description($('List mobile service custom APIs'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);

          var progress = cli.interaction.progress($('Retrieving list of APIs'));
          var result;
          try {
            result = mobile.getCustomApis(options, _);
          } finally {
            progress.end();
          }

          cli.interaction.formatOutput(result, function (apis) {
            if (!Array.isArray(apis) || apis.length === 0) {
              log.info($('There are no custom APIs. Create an API using the \'azure mobile api create\' command.'));
            } else {
              log.info($('APIs').green);
              log.table(apis, displayCustomApi);
              if (apis.some(function (api) { return api.hasAdditionalPermissions === true; })) {
                log.info($('* indicates the permissions metadata file has been manually modified.'));
              }
              log.info($('You can manipulate API scripts using the \'azure mobile script\' command.').green);
            }
          });
        });

  function displayCustomApi(row, s) {
    var name = s.name;
    if (s.hasAdditionalPermissions === true) {
      name += '*';
    }

    row.cell($('Name'), name);
    row.cell('Get', s.get || 'admin');
    row.cell('Put', s.put || 'admin');
    row.cell('Post', s.post || 'admin');
    row.cell('Patch', s.patch || 'admin');
    row.cell('Delete', s.delete || 'admin');
  }

  mobileApi.command('create [servicename] [apiname]')
        .description($('Creates a mobile service custom API'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .option('-p, --permissions <permissions>', $('comma delimited list of <method>=<permission> pairs'))
        .execute(function (servicename, apiname, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.apiname = promptIfNotGiven($('API name: '), apiname, _);

          var settings = parsePermissions(options.permissions, methods);

          // Populate default permissions for create to be application
          methods.forEach(function (method) {
            if (!settings[method]) {
              settings[method] = 'application';
            }
          });
          settings['name'] = options.apiname;

          // Now create the API
          var progress = cli.interaction.progress(util.format($('Creating custom API: \'%s\''), options.apiname));
          try {
            mobile.createApi(options, settings, _);
          } finally {
            progress.end();
          }

          log.info($('API was created successfully. You can modify the API using the \'azure mobile script\' command.').green);
        });

  mobileApi.command('update [servicename] [apiname]')
        .description($('Updates a mobile service custom API'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .option('-p, --permissions <permissions>', $('comma delimited list of <method>=<permission> pairs'))
        .option('-f, --force', $('override any custom changes to the permissions metadata file'))
        .execute(function (servicename, apiname, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.apiname = promptIfNotGiven($('API name: '), apiname, _);
          if (!options.permissions) {
            throw new Error($('No updates specified. Check the list of available updates with \'--help\' and specify at least one.'));
          }

          var settings = parsePermissions(options.permissions, methods);
          var progress = cli.interaction.progress(util.format($('Updating API: \'%s\''), options.apiname));

          // Load the current settings
          var result;
          try {
            result = mobile.getCustomApi(options, _);
          } catch (e) {
            // Only end progress on error as we have more work to do yet
            progress.end();
            throw e;
          }

          log.silly($('Existing api settings:'));
          log.json('silly', result);

          // If the json file has been modified, don't overwrite those changes unless explicitly asked to
          if (result.hasAdditionalPermissions === true && options.force !== true) {
            progress.end();
            throw new Error($('The permissions for this custom API cannot be changed because the metadata file has been edited directly. To change the permissions and overwrite the existing metadata use the \'--force\' option.'));
          }

          // Update any permissions that are not specified
          methods.forEach(function (method) {
            if (!settings[method]) {
              settings[method] = result[method];
            }
          });

          // Save the merged set of permissions
          try {
            mobile.setCustomApi(options, settings, _);
          } finally {
            progress.end();
          }
        });

  mobileApi.command('delete [servicename] [apiname]')
        .description($('Deletes a mobile service custom API'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, apiname, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, nodeFilter, _);
          options.apiname = promptIfNotGiven($('API name: '), apiname, _);

          var progress = cli.interaction.progress(util.format($('Deleting API: \'%s\''), options.apiname));
          try {
            result = mobile.deleteCustomApi(options, _);
          } finally {
            progress.end();
          }
        });

  var mobileAppSetting = mobile.category('appsetting')
        .description($('Commands to manage your mobile application app settings'));

  mobileAppSetting.command('list [servicename]')
        .description($('Show your mobile application app settings'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);

          var progress = cli.interaction.progress($('Retrieving app settings'));
          try {
            result = mobile.getServiceSettings(options, _);
          } finally {
            progress.end();
          }

          if (result.customApplicationSettings === undefined) {
            result.customApplicationSettings = [];
          }

          cli.interaction.formatOutput(result.customApplicationSettings, function (appSettings) {
            if (appSettings.length > 0) {
              log.table(appSettings, function (row, item) {
                row.cell($('Name'), item.name);
                row.cell($('Value'), item.value);
              });
            } else {
              log.info($('No app settings are defined'));
            }
          });
        });

  mobileAppSetting.command('add [servicename] [name] [value]')
        .description($('Add an application setting for your mobile service'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, name, value, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
          options.settingName = promptIfNotGiven($('App setting name: '), name, _);
          options.settingValue = promptIfNotGiven($('App setting value: '), value, _);

          var result,
              progress = cli.interaction.progress($('Retrieving app settings'));
          try {
            result = mobile.getServiceSettings(options, _);
          } finally {
            progress.end();
          }

          if (result.customApplicationSettings === undefined) {
            result.customApplicationSettings = [];
          }

          var lowerCaseName = options.settingName.toLowerCase(),
              setting = __.find(result.customApplicationSettings, function (setting) {
                return setting.name.toLowerCase() === lowerCaseName;
              });

          if (setting !== undefined) {
            throw new Error(util.format($('App setting with key \'%s\' already exists'), setting.name));
          }

          result.customApplicationSettings.push({ name: options.settingName, value: options.settingValue });

          progress = cli.interaction.progress($('Adding app setting'));
          try {
            result = mobile.setServiceSettings(options, result, _);
          } finally {
            progress.end();
          }
        });

  mobileAppSetting.command('delete [servicename] [name]')
        .description($('Remove an application setting for your mobile service'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, name, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
          options.settingName = promptIfNotGiven($('App setting name: '), name, _);

          var result,
              progress = cli.interaction.progress($('Retrieving app settings'));
          try {
            result = mobile.getServiceSettings(options, _);
          } finally {
            progress.end();
          }

          if (result.customApplicationSettings === undefined) {
            result.customApplicationSettings = [];
          }

          var lowerCaseName = options.settingName.toLowerCase(),
              newAppSettings = __.reject(result.customApplicationSettings, function (setting) {
                return setting.name.toLowerCase() === lowerCaseName;
              });

          if (newAppSettings.length === result.customApplicationSettings.length) {
            throw new Error(util.format($('App setting with key \'%s\' doesn\'t exist'), options.settingName));
          }

          result.customApplicationSettings = newAppSettings;
          progress = cli.interaction.progress(util.format($('Removing app setting \'%s\''), options.settingName));
          try {
            result = mobile.setServiceSettings(options, result, _);
          } finally {
            progress.end();
          }
        });

  mobileAppSetting.command('show [servicename] [name]')
        .description($('Show an application setting for your mobile service'))
        .option('-s, --subscription <id>', $('use the subscription id'))
        .execute(function (servicename, name, options, _) {
          options.servicename = promptServiceNameIfNotGiven(options, servicename, defaultFilter, _);
          options.settingName = promptIfNotGiven($('App setting name: '), name, _);

          var result,
              progress = cli.interaction.progress($('Retrieving app settings'));
          try {
            result = mobile.getServiceSettings(options, _);
          } finally {
            progress.end();
          }

          var lowerCaseName = options.settingName.toLowerCase(),
              setting = __.find(result.customApplicationSettings, function (setting) {
                return setting.name.toLowerCase() === lowerCaseName;
              });

          cli.interaction.formatOutput(setting, function (data) {
            if (data === undefined) {
              log.error(util.format($('App setting with key \'%s\' doesn\'t exist'), options.settingName));
            } else {
              log.info(util.format($('%s: %s'), data.name, data.value));
            }
          });
        });
};
