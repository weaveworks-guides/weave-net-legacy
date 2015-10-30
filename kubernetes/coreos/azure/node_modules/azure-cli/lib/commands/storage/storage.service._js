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
var commander = require('commander');
var StorageUtil = require('../../util/storage.util');
var utils = require('../../util/utils');
var validation = require('../../util/validation');
var performStorageOperation = StorageUtil.performStorageOperation;
var startProgress = StorageUtil.startProgress;
var endProgress = StorageUtil.endProgress;

var $ = utils.getLocaleString;

/**
* Add storage account command line options
*/
commander.Command.prototype.addStorageAccountOption = function() {
  this.option('-a, --account-name <accountName>', $('the storage account name'));
  this.option('-k, --account-key <accountKey>', $('the storage account key'));
  this.option('-c, --connection-string <connectionString>', $('the storage connection string'));
  this.option('-vv', $('run storage command in debug mode'));
  return this;
};

/**
* Init storage service property command
*/
exports.init = function(cli) {

  //Init StorageUtil
  StorageUtil.init(cli);

  var MAX_RULES = 5;
  var SupportedMethods = { DELETE: 0, GET: 1, HEAD: 2, MERGE: 3, POST: 4, OPTIONS: 5, PUT: 6, TRACE: 7, CONNECT: 8 };

  /**
  * Define storage service property command usage
  */
  var storage = cli.category('storage')
    .description($('Commands to manage your Storage objects'));

  var logger = cli.output;

  var logging = storage.category('logging')
    .description($('Commands to manage your Storage logging properties'));

  logging.command('show')
    .description($('Show the logging properties of the storage services '))
    .option('--blob', $('show logging properties for blob service'))
    .option('--table', $('show logging properties for table service'))
    .option('--queue', $('show logging properties for queue service'))
    .addStorageAccountOption()
    .execute(showLoggingProperties);

  logging.command('set')
    .description($('Set the logging properties of the storage service'))
    .option('--blob', $('set logging properties for blob service'))
    .option('--table', $('set logging properties for table service'))
    .option('--queue', $('set logging properties for queue service'))
    .option('--version <version>', $('the version string'))
    .option('--retention <retention>', $('set logging retention in days'))
    .option('--read', $('enable logging for read requests'))
    .option('--read-off', $('disable logging for read requests'))
    .option('--write', $('enable logging for write requests'))
    .option('--write-off', $('disable logging for write requests'))
    .option('--delete', $('enable logging for delete requests'))
    .option('--delete-off', $('disable logging for delete requests'))
    .addStorageAccountOption()
    .execute(setLoggingProperties);

  var metrics = storage.category('metrics')
    .description($('Commands to manage your Storage metrics properties'));

  metrics.command('show')
    .description($('Show the metrics properties of the storage services '))
    .option('--blob', $('show metrics properties for blob service'))
    .option('--table', $('show metrics properties for table service'))
    .option('--queue', $('show metrics properties for queue service'))
    .addStorageAccountOption()
    .execute(showMetricsProperties);

  metrics.command('set')
    .description($('Set the metrics properties of the storage service'))
    .option('--blob', $('set metrics properties for blob service'))
    .option('--table', $('set metrics properties for table service'))
    .option('--queue', $('set metrics properties for queue service'))
    .option('--version <version>', $('the version string'))
    .option('--retention <retention>', $('set metrics retention in days'))
    .option('--hour', $('set hourly metrics properties'))
    .option('--hour-off', $('turn off hourly metrics properties'))
    .option('--minute', $('set minute metrics properties'))
    .option('--minute-off', $('turn off minute metrics properties'))
    .option('--api', $('include API in metrics '))
    .option('--api-off', $('exclude API from metrics'))
    .addStorageAccountOption()
    .execute(setMetricsProperties);

  var cors = storage.category('cors')
    .description($('Commands to manage your Storage CORS (Cross-Origin Resource Sharing)'));

  cors.command('set')
    .description($('Set the CORS rules of the storage service'))
    .option('--blob', $('set CORS rules for blob service'))
    .option('--table', $('set CORS rules for table service'))
    .option('--queue', $('set CORS rules for queue service'))
    .option('--file', $('set CORS rules for file service'))
    .option('--cors <cors>', $('the CORS rules array in json format'))
    .addStorageAccountOption()
    .execute(setCORS);

  cors.command('show')
    .description($('Show the CORS rules of the storage service'))
    .option('--blob', $('show CORS rules for blob service'))
    .option('--table', $('show CORS rules for table service'))
    .option('--queue', $('show CORS rules for queue service'))
    .option('--file', $('show CORS rules for file service'))
    .addStorageAccountOption()
    .execute(showCORS);
      
  cors.command('delete')
    .description($('Delete all the CORS rules of the storage service'))
    .option('--blob', $('delete CORS rules for blob service'))
    .option('--table', $('delete CORS rules for table service'))
    .option('--queue', $('delete CORS rules for queue service'))
    .option('--file', $('delete CORS rules for file service'))
    .option('-q, --quiet', $('delete the CORS rules without confirmation'))
    .addStorageAccountOption()
    .execute(deleteCORS);

  /**
  * Implement storage service property cli
  */

  /**
  * Show storage logging properties
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function showLoggingProperties(options, _) {
    var types = getServiceTypes(options, false);
    var operations = [];

    types.forEach(function(type) {
      var client = getServiceClient(type, options);
      operations.push(StorageUtil.getStorageOperation(client, type, 'getServiceProperties'));
    });

    var tips = util.format($('Getting storage logging properties for service: %s'), types);
    startProgress(tips);

    var serviceProperties = [];
    try {
      for (var index = 0; index < operations.length; index++) {
        var property = performStorageOperation(operations[index], _);
        property.type = operations[index].type;
        serviceProperties.push(property);
      }
    } finally {
      endProgress();
    }

    var output = [];
    serviceProperties.forEach(function(property) {
      property.Logging.Type = property.type;
      output.push(property.Logging);
    });

    cli.interaction.formatOutput(output, function(outputData) {
      logger.table(outputData, function(row, item) {
        row.cell($('Service Type'), item.Type);
        row.cell($('Version'), item.Version);
        row.cell($('Retention Days'), getRetentionString(item.RetentionPolicy));
        row.cell($('Read Requests'), getStatusString(item.Read));
        row.cell($('Write Requests'), getStatusString(item.Write));
        row.cell($('Delete Requests'), getStatusString(item.Delete));
      });
    });
  }

  /**
  * Set storage logging properties
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function setLoggingProperties(options, _) {
    var types = getServiceTypes(options, true);
    var client = getServiceClient(types[0], options);
    var getOperation = StorageUtil.getStorageOperation(client, types[0], 'getServiceProperties');
    var setOperation = StorageUtil.getStorageOperation(client, types[0], 'setServiceProperties');

    var tips = util.format($('Setting storage logging properties for service: %s'), types);
    startProgress(tips);
    try {
      var serviceProperties = performStorageOperation(getOperation, _);
      generateServiceLoggingProperties(serviceProperties, options);
      performStorageOperation(setOperation, _, serviceProperties);
    } finally {
      endProgress();
    }

    showLoggingProperties(options, _);
  }

  /**
  * Show storage metrics properties
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function showMetricsProperties(options, _) {
    var types = getServiceTypes(options, false);
    var operations = [];

    types.forEach(function(type) {
      var client = getServiceClient(type, options);
      operations.push(StorageUtil.getStorageOperation(client, type, 'getServiceProperties'));
    });

    var tips = util.format($('Getting storage metrics properties for service: %s'), types);
    startProgress(tips);

    var serviceProperties = [];
    try {
      for (var index = 0; index < operations.length; index++) {
        var property = performStorageOperation(operations[index], _);
        property.type = operations[index].type;
        serviceProperties.push(property);
      }
    } finally {
      endProgress();
    }

    var output = [];
    serviceProperties.forEach(function(property) {
      var properties = { type: property.type, HourMetrics: [], MinuteMetrics: [] };
      properties.HourMetrics.push(property.HourMetrics);
      properties.MinuteMetrics.push(property.MinuteMetrics);
      output.push(properties);
    });

    cli.interaction.formatOutput(output, function(outputData) {
      outputData.forEach(function(properties) {
        logger.data(util.format($('The metrics properties for %s service are: '), properties.type));
        logger.table(properties.HourMetrics, function(row, item) {
          row.cell($('Metrics Type'), 'Hourly');
          row.cell($('Enabled'), getStatusString(item.Enabled));
          row.cell($('Version'), item.Version);
          row.cell($('Retention Days'), getRetentionString(item.RetentionPolicy));
          row.cell($('Include APIs'), getStatusString(item.IncludeAPIs));
        });
        logger.data('');
        logger.table(properties.MinuteMetrics, function(row, item) {
          row.cell($('Metrics Type'), 'Minute');
          row.cell($('Enabled'), getStatusString(item.Enabled));
          row.cell($('Version'), item.Version);
          row.cell($('Retention Days'), getRetentionString(item.RetentionPolicy));
          row.cell($('Include APIs'), getStatusString(item.IncludeAPIs));
        });
        logger.data('\n');
      });
    });
  }

  /**
  * Set storage metrics properties
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function setMetricsProperties(options, _) {
    var types = getServiceTypes(options, true);
    var client = getServiceClient(types[0], options);
    var getOperation = StorageUtil.getStorageOperation(client, types[0], 'getServiceProperties');
    var setOperation = StorageUtil.getStorageOperation(client, types[0], 'setServiceProperties');

    var tips = util.format($('Setting storage metric properties for service: %s'), types);
    startProgress(tips);
    try {
      var serviceProperties = performStorageOperation(getOperation, _);
      generateServiceMetricsProperties(serviceProperties, options);
      performStorageOperation(setOperation, _, serviceProperties);
    } finally {
      endProgress();
    }

    showMetricsProperties(options, _);
  }

  /**
  * Set storage CORS rules
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function setCORS(options, _) {
    var types = getServiceTypes(options, true, true);
    var client = getServiceClient(types[0], options);
    var getOperation = StorageUtil.getStorageOperation(client, types[0], 'getServiceProperties');
    var setOperation = StorageUtil.getStorageOperation(client, types[0], 'setServiceProperties');

    if (!options.cors) {
      throw new Error($('Please set the --cors value'));
    }

    var tips = util.format($('Setting storage CORS rules for service: %s'), types[0]);
    startProgress(tips);
    try {
      var serviceProperties = performStorageOperation(getOperation, _);
      serviceProperties.Cors.CorsRule = [];

      var rules = JSON.parse(options.cors);
      rules.forEach(function (rule) {
        var ruleOptions = options;
        ruleOptions.add = true;
        ruleOptions.allowedOrigins = rule.AllowedOrigins ? rule.AllowedOrigins.toString() : '';
        ruleOptions.allowedMethods = rule.AllowedMethods ? rule.AllowedMethods.toString() : '';
        ruleOptions.allowedHeaders = rule.AllowedHeaders ? rule.AllowedHeaders.toString() : '';
        ruleOptions.exposedHeaders = rule.ExposedHeaders ? rule.ExposedHeaders.toString() : '';
        ruleOptions.maxAge = rule.MaxAgeInSeconds ? rule.MaxAgeInSeconds.toString() : '';
        generateCORSRules(serviceProperties, ruleOptions);
      });   
      performStorageOperation(setOperation, _, serviceProperties);
    } finally {
      endProgress();
    }

    showCORS(options, _);
  }

  /**
  * Show storage CORS rules
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function showCORS(options, _) {
    var types = getServiceTypes(options, true, true);
    var client = getServiceClient(types[0], options);
    var getOperation = StorageUtil.getStorageOperation(client, types[0], 'getServiceProperties');

    var tips = util.format($('Getting storage CORS rules for service: %s'), types[0]);
    var serviceProperties = {};
    startProgress(tips);
    try {
      serviceProperties = performStorageOperation(getOperation, _);
    } finally {
      endProgress();
    }

    var output = serviceProperties.Cors.CorsRule ? serviceProperties.Cors.CorsRule : {};    

    cli.interaction.formatOutput(output, function(outputData) {
      var number = 1;
      if (outputData.length > 0) {
        outputData.forEach(function(rule) {
          logger.data(util.format($('CORS rule %s: '), number++));
          logger.data(util.format($('  Allowed Origins: %s'), rule.AllowedOrigins));
          logger.data(util.format($('  Allowed Methods: %s'), rule.AllowedMethods));
          logger.data(util.format($('  Allowed Headers: %s'), rule.AllowedHeaders));
          logger.data(util.format($('  Exposed Headers: %s'), rule.ExposedHeaders));
          logger.data(util.format($('  Maximum Age: %s'), rule.MaxAgeInSeconds));
          logger.data('');
        });
      } else {
        logger.info(util.format($('No CORS rule is set')));    
      }
    });
  }

  /**
  * Delete storage CORS rules
  * @param {object} options commadline options
  * @param {callback} _ callback function
  */
  function deleteCORS(options, _) {
    var types = getServiceTypes(options, true, true);
    var client = getServiceClient(types[0], options);
    var getOperation = StorageUtil.getStorageOperation(client, types[0], 'getServiceProperties');
    var setOperation = StorageUtil.getStorageOperation(client, types[0], 'setServiceProperties');
    var force = !!options.quiet;

    if (force !== true) {
      force = cli.interaction.confirm($('Do you want to delete the CORS rules? [y/n]'), _);
      if (force !== true) {
        return;
      }
    }

    var tips = util.format($('Deleting storage CORS rules for service: %s'), types[0]);
    startProgress(tips);
    try {
      var serviceProperties = performStorageOperation(getOperation, _);
      options.add = false;
      generateCORSRules(serviceProperties, options);
      performStorageOperation(setOperation, _, serviceProperties);
    } finally {
      endProgress();
    }

    logger.info(util.format($('CORS rules for %s service have been deleted successfully'), types[0]));
  }

  /**
  * @ignore
  * Get storage type from options
  * @param {object} options commadline options
  * @param {bool} whether the operation is exclusive for one service type
  * @param {bool} whether the file service is supported
  * @return {types} service types in an array
  */
  function getServiceTypes(options, exclusive, supportFile) {
    var isBlob = options.blob;
    var isTable = options.table;
    var isQueue = options.queue;
    var isFile = options.file;

    var count = 0;
    count = isBlob ? count + 1 : count;
    count = isTable ? count + 1 : count;
    count = isQueue ? count + 1 : count;
    if (supportFile) {
      count = isFile ? count + 1 : count;
    } else if (isFile) {
       throw new Error($('File service doesn\'t support the operation'));
    }

    if (count === 0) {
      if (exclusive) {
        throw new Error($('Please define the service type'));
      } else {
        isBlob = isTable = isQueue = true;
        isFile = supportFile;
      }
    } else if (count > 1 && exclusive) {
      throw new Error($('Please define only one service type'));
    }

    var types = [];
    if (isBlob) {
      types.push(StorageUtil.OperationType.Blob);
    }
    if (isTable) {
      types.push(StorageUtil.OperationType.Table);
    }
    if (isQueue) {
      types.push(StorageUtil.OperationType.Queue);
    }
    if (isFile) {
      types.push(StorageUtil.OperationType.File);
    }
    return types;
  }

  /**
  * @ignore
  * Get service client from user specified credential or env variables
  * @param {string} [type] operation type
  * @param {object} [options] commadline options
  */
  function getServiceClient(type, options) {
    switch (type) {
      case StorageUtil.OperationType.Blob:
        return StorageUtil.getServiceClient(StorageUtil.getBlobService, options);
      case StorageUtil.OperationType.Queue:
        return StorageUtil.getServiceClient(StorageUtil.getQueueService, options);
      case StorageUtil.OperationType.Table:
        return StorageUtil.getServiceClient(StorageUtil.getTableService, options);
      case StorageUtil.OperationType.File:
        return StorageUtil.getServiceClient(StorageUtil.getFileService, options);
    }
  }

  /**
  * @ignore
  * Generate service logging properties
  * @param {object} [serviceProperties] current service properties
  * @param {object} [options] commadline options
  * @return {object} service properties
  */
  function generateServiceLoggingProperties(serviceProperties, options) {
    if (options.Version) {
      serviceProperties.Logging.Version = '1.0';
    }

    if (options.retention) {
      if (!StorageUtil.isValidRetention(options.retention)) {
        throw new Error($('--retention must be set with a positive integer'));
      }
      if (typeof options.retention === 'string') {
        options.retention = parseInt(options.retention, 10);
      }
      serviceProperties.Logging.RetentionPolicy = {};
      if (options.retention !== 0) {
        serviceProperties.Logging.RetentionPolicy.Enabled = true;
        serviceProperties.Logging.RetentionPolicy.Days = options.retention;
      } else {
        serviceProperties.Logging.RetentionPolicy.Enabled = false;
        delete serviceProperties.Logging.RetentionPolicy.Days;
      }
    }

    if (options.read && options.readOff) {
      throw new Error($('--read and --read-off cannot be both defined'));
    } else if (options.read) {
      serviceProperties.Logging.Read = true;
    } else if (options.readOff) {
      serviceProperties.Logging.Read = false;
    }

    if (options.write && options.writeOff) {
      throw new Error($('--write and --write-off cannot be both defined'));
    } else if (options.write) {
      serviceProperties.Logging.Write = true;
    } else if (options.writeOff) {
      serviceProperties.Logging.Write = false;
    }

    if (options.delete && options.deleteOff) {
      throw new Error($('--delete and --delete-off cannot be both defined'));
    } else if (options.delete) {
      serviceProperties.Logging.Delete = true;
    } else if (options.deleteOff) {
      serviceProperties.Logging.Delete = false;
    }
  }

  /**
  * @ignore
  * Generate service metrics properties
  * @param {object} [serviceProperties] current service properties
  * @param {object} [options] commadline options
  * @return {object} service properties
  */
  function generateServiceMetricsProperties(serviceProperties, options) {
    if (!options.hour && !options.minute && !options.hourOff && !options.minuteOff) {
      throw new Error($('Please define one of them: --hour, --minute, --hour-off or --minute-off'));
    } else if (options.hour && options.minute) {
      throw new Error($('Only one of --hour and --minute should be defined'));
    }

    if (options.hour && options.hourOff) {
      throw new Error($('--hour and --hour-off cannot be both defined'));
    } else if (options.hour) {
      setMetrics(serviceProperties.HourMetrics, options);
    } else if (options.hourOff) {
      disableMetrics(serviceProperties.HourMetrics);
    }

    if (options.minute && options.minuteOff) {
      throw new Error($('--minute and --minute-off cannot be both defined'));
    } else if (options.minute) {
      setMetrics(serviceProperties.MinuteMetrics, options);
    } else if (options.minuteOff) {
      disableMetrics(serviceProperties.MinuteMetrics);
    }
  }

  /**
  * @ignore
  * Set metrics
  * @param {object} [metrics] metrics to set
  * @param {object} [options] commadline options
  */
  function setMetrics(metrics, options) {
    metrics.Enabled = true;

    if (options.Version) {
      metrics.Version = '1.0';
    }

    if (options.retention) {
      if (!StorageUtil.isValidRetention(options.retention)) {
        throw new Error($('--retention must be set with a positive integer'));
      }
      if (typeof options.retention === 'string') {
        options.retention = parseInt(options.retention, 10);
      }
      metrics.RetentionPolicy = {};
      if (options.retention !== 0) {
        metrics.RetentionPolicy.Enabled = true;
        metrics.RetentionPolicy.Days = options.retention;
      } else {
        metrics.RetentionPolicy.Enabled = false;
        delete metrics.RetentionPolicy.Days;
      }
    }

    if (options.api && options.apiOff) {
      throw new Error($('--api and --api-off cannot be both defined'));
    } else if (options.api) {
      metrics.IncludeAPIs = true;
    } else if (options.apiOff) {
      metrics.IncludeAPIs = false;
    }
  }

  /**
  * @ignore
  * Disable metrics
  * @param {object} [metrics] metrics to disable
  */
  function disableMetrics(metrics) {
    if (metrics) {
      metrics.Enabled = false;
      delete metrics.IncludeAPIs;
    }
  }

  /**
  * @ignore
  * Get status string
  * @param {boolean} [isOn] whether it is turned on
  * @return {string} the status string
  */
  function getStatusString(isOn) {
    return isOn ? $('on') : $('off');
  }

  /**
  * @ignore
  * Get retention setting string
  * @param {boolean} [isOn] whether it is turned on
  * @return {string} the status string
  */
  function getRetentionString(retention) {
    if (retention && retention.Enabled) {
      return retention.Days.toString();
    } else {
      return $('Not set');
    }
  }

  /**
  * @ignore
  * Generate service CORS rules
  * @param {object} [serviceProperties] current service properties
  * @param {object} [options] commadline options
  * @return {object} service properties
  */
  function generateCORSRules(serviceProperties, options) {
    if (options.add) {
      var rule = {
        AllowedOrigins: options.allowedOrigins.split(','),
        AllowedMethods: parseAndValidateCORSRuleMethods(options.allowedMethods),
        AllowedHeaders: options.allowedHeaders.split(','),
        ExposedHeaders: options.exposedHeaders.split(','),
        MaxAgeInSeconds: parseAndValidateCORSRuleMaxAge(options.maxAge),
      };
      serviceProperties.Cors.CorsRule.push(rule);

      if (serviceProperties.Cors.CorsRule.length > MAX_RULES) {
        throw new Error(util.format($('You can only specify up to %s CORS rules per storage service'), MAX_RULES));
      }      
    } else {
      serviceProperties.Cors = {};
    }
  }

  /**
  * @ignore
  * Validates CORS rule allowed methods
  *   * The methods (or HTTP verbs) specified in the AllowedMethods element must conform to the methods supported by Azure storage service APIs. 
  *   * Supported methods are DELETE, GET, HEAD, MERGE, POST, OPTIONS, PUT, TRACE and CONNECT.
  * @param {string} [methods] the allowed methods in the rule
  */
  function parseAndValidateCORSRuleMethods(methods) {
    var allowed = methods.toUpperCase().split(',');
    allowed.forEach(function(method) {
      method = method.trim();
      validation.isValidEnumValue(method, Object.keys(SupportedMethods));
    });
    return allowed;
  }

  /**
  * @ignore
  * Validates CORS rule maximum age in seconds
  * @param {string} [maxAge] the maximum age in the rule
  */
  function parseAndValidateCORSRuleMaxAge(maxAge) {
    if (maxAge && !validation.isInt(maxAge)) {
      throw new Error($('The maximum age should be an integer'));
    }
    return parseInt(maxAge);
  }
};
