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

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var url = require('url');
var util = require('util');
var uuid = require('node-uuid');

var azureCommon = require('azure-common');
var _ = require('underscore');

var blobUtils = require('./blobUtils');
var constants = require('./constants');
var log = require('./logging');
var utilsCore = require('./utilsCore');

var locale = require('../locales/en-us.json');

var BEGIN_CERT = '-----BEGIN CERTIFICATE-----';
var END_CERT = '-----END CERTIFICATE-----';

exports.POLL_REQUEST_INTERVAL = 1000;

var moduleVersion = require('../../package.json').version;

exports.moduleVersion = moduleVersion;

exports.azureDir = utilsCore.azureDir;
exports.camelcase = utilsCore.camelcase;
exports.ignoreCaseEquals = utilsCore.ignoreCaseEquals;
exports.stringStartsWith = utilsCore.stringStartsWith;
exports.pathExistsSync = utilsCore.pathExistsSync;

var getUserAgent = exports.getUserAgent = function () {
  return util.format('WindowsAzureXplatCLI/%s', moduleVersion);
};

exports.createClient = function (factoryMethod, credentials, endpoint) {
  var client = factoryMethod(credentials,
    exports.stringTrimEnd(endpoint, '/'))
    .withFilter(exports.certAuthFilter(credentials))
    .withFilter(log.createLogFilter())
    .withFilter(azureCommon.UserAgentFilter.create(exports.getUserAgent()))
    .withFilter(exports.createPostBodyFilter())
    .withFilter(exports.createFollowRedirectFilter())
    .withFilter(polishErrorCausedByArmProviderNotRegistered());

  return client;
};

function _createAsmClient(factoryMethod, subscription) {
  return exports.createClient(factoryMethod,
    subscription._createCredentials(),
    subscription.managementEndpointUrl);
}

function _createArmClient(factoryMethod, subscription) {
  return exports.createClient(factoryMethod,
    subscription._createCredentials(),
    subscription.resourceManagerEndpointUrl);
}

exports.getHDInsightClusterManagementClient = function (cloudServiceName, subscription) {
  var factoryMethod = require('azure-asm-hdinsight').createHDInsightClusterManagementClient;
  var client = _createAsmClient(factoryMethod, subscription);
  client.cloudServiceName = cloudServiceName;
  return client;
};

exports.getHDInsightCluster2ManagementClient = function (cloudServiceName, subscription) {
  var factoryMethod = require('azure-asm-hdinsight').createHDInsightCluster2ManagementClient;
  var client = _createAsmClient(factoryMethod, subscription);
  client.cloudServiceName = cloudServiceName;
  return client;
};

exports.getHDInsightJobManagementClient = function (clusterDnsName, userName, password) {
  var hdinsight = require('azure-asm-hdinsight');
  var client = hdinsight.createHDInsightJobManagementClient(clusterDnsName,
    new hdinsight.createBasicAuthenticationCloudCredentials({ username: userName, password: password }));
  return client;
};

exports.createInsightsClient = function (subscription) {
  var factoryMethod = require('azure-arm-insights').createInsightsClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createInsightsManagementClient = function (subscription) {
  var factoryMethod = require('azure-arm-insights').createInsightsManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

//website provider might not be registered yet, so make sure to register it
exports.createWebsiteClient = function (subscription, callback) {
  var client;
  subscription.registerAsmProvider('website', function (err) {
    if (err) {
      return callback(err);
    }
    var factoryMethod = require('azure-asm-website').createWebSiteManagementClient;
    client = _createAsmClient(factoryMethod, subscription);
    return callback(null, client);
  });
};

exports.createWebSiteExtensionsClient = function (siteName, hostNameSuffix, username, password) {
  var baseUri = util.format('https://%s.scm.%s:443', siteName, hostNameSuffix);
  var azureWebSite = require('azure-asm-website');
  var service = azureWebSite.createWebSiteExtensionsClient(siteName, new azureWebSite.createBasicAuthenticationCloudCredentials({
    username: username,
    password: password,
  }), baseUri)
    .withFilter(log.createLogFilter())
    .withFilter(azureCommon.UserAgentFilter.create(getUserAgent()))
    .withFilter(createPostBodyFilter())
    .withFilter(createFollowRedirectFilter());

  return service;
};

exports.createWebappManagementClient = function (subscription) {
  var factoryMethod = require('azure-arm-website').createWebSiteManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createRedisCacheManagementClient = function (subscription) {
  var factoryMethod = require('azure-arm-rediscache').createRedisCacheManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createUsageManagementClient = function (subscription) {
  var factoryMethod = require('azure-arm-commerce').createUsageAggregationManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createSqlClient = function (subscription) {
  var factoryMethod = require('azure-asm-sql').createSqlManagementClient;
  return _createAsmClient(factoryMethod, subscription);
};

exports.createServiceBusClient = function (subscription) {
  var factoryMethod = require('azure-asm-sb').createServiceBusManagementClient;
  return _createAsmClient(factoryMethod, subscription);
};

exports.createManagementClient = function (subscription) {
  var factoryMethod = require('azure-asm-mgmt').createManagementClient;
  return _createAsmClient(factoryMethod, subscription);
};

exports.createStorageClient = function (subscription) {
  var factoryMethod = require('azure-asm-storage').createStorageManagementClient;
  return _createAsmClient(factoryMethod, subscription);
};

exports.createStorageResourceProviderClient = function (subscription) {
  // Levarage the temporary SRP client
  var factoryMethod = require('./../commands/arm/temporary/storage').createStorageManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createComputeResourceProviderClient = function (subscription) {
  var factoryMethod = require('azure-arm-compute').createComputeManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createNetworkResourceProviderClient = function (subscription) {
  var factoryMethod = require('azure-arm-network').createNetworkResourceProviderClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createTrafficManagerResourceProviderClient = function (subscription) {
  var factoryMethod = require('azure-arm-trafficmanager').createTrafficManagerManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createDnsResourceProviderClient = function (subscription) {
  var factoryMethod = require('azure-arm-dns').createDnsManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createComputeClient = function (subscription) {
  var factoryMethod = require('azure-asm-compute').createComputeManagementClient;
  return _createAsmClient(factoryMethod, subscription);
};

exports.createNetworkClient = function (subscription) {
  var factoryMethod = require('azure-asm-network').createNetworkManagementClient;
  return _createAsmClient(factoryMethod, subscription);
};

exports.createTrafficManagerClient = function (subscription) {
  var factoryMethod = require('azure-asm-trafficmanager').createTrafficManagerManagementClient;
  return _createAsmClient(factoryMethod, subscription);
};

exports.createResourceClient = function (subscription) {
  var factoryMethod = require('azure-arm-resource').createResourceManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createResourceFeatureClient = function (subscription) {
  var factoryMethod = require('azure-arm-resource').createResourceFeatureClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createEventsClient = function (subscription) {
  var factoryMethod = require('azure-monitoring').createEventsClient;
  return _createArmClient(factoryMethod, subscription);
};

exports.createKeyVaultClient = function (subscription, vaultUri) {
  var keyvault = require('azure-keyvault');
  var factoryMethod = keyvault.createKeyVaultClient;
  return exports.createClient(factoryMethod,
                              subscription._createCredentials(keyvault.RESOURCE_ID),
                              vaultUri);
};

exports.createGalleryClient = function (subscription) {
  var factoryMethod = require('azure-gallery').createGalleryClient;
  return exports.createClient(factoryMethod,
    new azureCommon.AnonymousCloudCredentials(),
    subscription.galleryEndpointUrl);
};

exports.createMobileClient = function (subscription) {
  return _createAsmClient(function (credentials) {

    //propagates errors that ErrorHandlingFilter in azureCommon.Service would swallow
    var errorPropagationFilter = function handle(resource, next, callback) {
      return next(resource, function (err, response, body) {
        if (body !== undefined && response !== undefined && (response.statusCode < 200 || response.statusCode >= 300)) {
          callback(body, response, body);
        } else {
          callback(err, response, body);
        }
      });
    };

    var client = new azureCommon.Service(credentials, [errorPropagationFilter]);
    client.longRunningOperationRetryTimeout = 5000;
    return client;
  }, subscription);
};

exports.createApiAppManagementClient = function (subscription) {
  var factoryMethod = require('azure-arm-apiapp').createApiAppManagementClient;
  return _createArmClient(factoryMethod, subscription);
};

/**
 * Create old-style service object
 * @param {string} serviceFactoryName name of factory function off azure module
 */
function createService(factoryMethod, subscription) {
  var managementEndpoint = url.parse(subscription.managementEndpointUrl);
  var service = factoryMethod(subscription.id, {
    keyvalue: subscription.managementCertificate.key,
    certvalue: subscription.managementCertificate.cert,
  },
    {
      host: managementEndpoint.hostname,
      port: managementEndpoint.port,
      serializetype: 'XML'
    }).withFilter(new utils.RequestLogFilter(log));
  return service;
}

exports.createWebsiteManagementService = function (subscription) {
  var factoryMethod = require('azure-asm-website').createWebsiteManagementService;
  return createService(factoryMethod, subscription);
};

// TODO: workaround for release 0.7.4. Remove in vnext and fix underlying issue in SDK.
function createPostBodyFilter() {
  return function handle(resource, next, callback) {
    if ((resource.method === 'POST' || resource.method === 'PUT' || resource.method === 'PATCH') && !resource.body) {
      resource.body = '';
    }

    var stream = next(resource, callback);
    stream.on('error', function () {
    });
    return stream;
  };
}

exports.createPostBodyFilter = createPostBodyFilter;

function certAuthFilter(credentials) {
  return function handle(resource, next, callback) {
    if (credentials && credentials.credentials && credentials.credentials.key && credentials.credentials.cert) {
      resource.key = credentials.credentials.key;
      resource.cert = credentials.credentials.cert;
    }
    return next(resource, callback);
  };
}

exports.certAuthFilter = certAuthFilter;

function createFollowRedirectFilter() {
  return function handle(resource, next, callback) {
    function handleRedirect(err, response, body) {
      if (response &&
        response.headers.location &&
        response.statusCode >= 300 &&
        response.statusCode < 400) {

        resource.url = response.headers.location;
        next(resource, handleRedirect);
      } else if (callback) {
        callback(err, response, body);
      }
    }

    return next(resource, handleRedirect);
  };
}

exports.createFollowRedirectFilter = createFollowRedirectFilter;

polishErrorCausedByArmProviderNotRegistered = function () {
  return function handle(resource, next, callback) {
    var nextStream = next(resource, function (err, response, body) {
      if (err && err.message && response && response.statusCode === 409) {
        var re = /.*registered to use namespace \'(.+)\'/i;
        var found = re.exec(err.message);
        var providerName = (found && found.length === 2) ? found[1] : null;
        if (providerName) {
          err.message = util.format('The subscription must be registered to use namespace "%s". ' +
                                    'This can be achieved by executing the command: "azure provider ' +
                                    'register %s".', providerName, providerName);
        }
      }
      callback(err, response, body);
    });
    return nextStream;
  };
};

exports.createScmManagementService = function (repository, auth) {
  var authentication = auth.split(':');
  var repositoryUrl = url.parse(repository);
  var azureWebSite = require('azure-asm-website');

  var service = azureWebSite.createScmService({
    user: authentication[0],
    pass: authentication[1]
  }, {
    host: repositoryUrl.hostname,
    port: repositoryUrl.port
  });

  service.userAgent = getUserAgent();

  return service;
};

exports.createBlobService = function () {
  var storage = require('azure-storage');
  var blobService = storage.createBlobService.apply(this, arguments);
  blobService.userAgent = getUserAgent();
  return blobService;
};

exports.createSqlService = function () {
  var azureSqlMgmt = require('azure-asm-sql');
  var sqlService = azureSqlMgmt.createSqlService.apply(this, arguments);
  sqlService.userAgent = getUserAgent();
  return sqlService;
};

exports.getLocaleString = function (string) {
  var result = locale[string];
  if (!result) {
    if (process.env.AZURE_DEBUG_LABELS) {
      throw new Error(util.format('Invalid resource %s', string));
    } else {
      return string;
    }
  }

  return result;
};

function RequestLogFilter(logger) {
  this.logger = logger;
}

RequestLogFilter.prototype.handle = function (requestOptions, next) {
  var self = this;

  this.logger.silly('requestOptions');
  this.logger.json('silly', requestOptions);
  if (next) {
    next(requestOptions, function (returnObject, finalCallback, nextPostCallback) {
      self.logger.silly('returnObject');
      self.logger.json('silly', returnObject);

      if (nextPostCallback) {
        nextPostCallback(returnObject);
      } else if (finalCallback) {
        finalCallback(returnObject);
      }
    });
  }
};

exports.RequestLogFilter = RequestLogFilter;

exports.isSha1Hash = function (str) {
  return (/\b([a-fA-F0-9]{40})\b/).test(str);
};

exports.webspaceFromName = function (name) {
  return (name.replace(/ /g, '').toLowerCase() + 'webspace');
};

exports.getCertFingerprint = function (pem) {
  var certBase64 = exports.extractBase64CertFromPEM(pem);
  // Calculate sha1 hash of the cert
  var cert = new Buffer(certBase64, 'base64');
  var sha1 = crypto.createHash('sha1');
  sha1.update(cert);
  return sha1.digest('hex');
};

exports.isPemCert = function (data) {
  return data.indexOf(BEGIN_CERT) !== -1 && data.indexOf(END_CERT) !== -1;
};

exports.extractBase64CertFromPEM = function (pem) {
  // Extract the base64 encoded cert out of pem file
  var beginCert = pem.indexOf(BEGIN_CERT) + BEGIN_CERT.length;
  if (pem[beginCert] === '\n') {
    beginCert = beginCert + 1;
  } else if (pem[beginCert] === '\r' && pem[beginCert + 1] === '\n') {
    beginCert = beginCert + 2;
  }

  var endCert = '\n' + pem.indexOf(END_CERT);
  if (endCert === -1) {
    endCert = '\r\n' + pem.indexOf(END_CERT);
  }

  return pem.substring(beginCert, endCert);
};

exports.getOrCreateBlobStorage = function (cli, storageClient, location, affinityGroup, name, storagePrefix, callback) {
  var progress;

  /*jshint camelcase:false*/
  function callback_(error, blobStorageUrl) {
    progress.end();
    callback(error, blobStorageUrl);
  }

  function createNewStorageAccount_() {
    if (exports.stringIsNullOrEmpty(storagePrefix)) {
      storagePrefix = name;
    }
    var storageAccountName = blobUtils.normalizeServiceName(storagePrefix + (new Date()).getTime().toString());
    cli.output.verbose('Creating a new storage account \'' + storageAccountName + '\'');
    var storageOptions = {
      name: storageAccountName,
      label: storageAccountName,
      geoReplicationEnabled: false,
      accountType: 'Standard_LRS'
    };

    if (affinityGroup) {
      storageOptions.affinityGroup = affinityGroup;
    } else if (location) {
      storageOptions.location = location;
    } else {
      throw new Error('location or affinityGroup must be specified');
    }

    progress = cli.interaction.progress('Creating a new storage account \'' + storageAccountName + '\'');
    storageClient.storageAccounts.create(storageOptions, function (error) {
      if (error) {
        callback_(error);
      } else {
        cli.output.verbose('Storage account successfully created');
        cli.output.verbose('Getting properties for \'' + storageAccountName + '\' storage account');

        storageClient.storageAccounts.get(storageAccountName, function (error, response) {
          if (error) {
            callback_(error);
          } else {
            var storageAccount = response.storageAccount;
            if (storageAccount) {
              var blobStorageUrl = storageAccount.properties.endpoints[0];
              if (blobStorageUrl.slice(-1) === '/') {
                blobStorageUrl = blobStorageUrl.slice(0, -1);
              }

              callback_(null, blobStorageUrl);
            } else {
              callback_(new Error('No storage account found'));
            }
          }
        });
      }
    });
  }

  progress = cli.interaction.progress('Retrieving storage accounts');
  cli.output.verbose('Getting list of available storage accounts');
  storageClient.storageAccounts.list(function (error, response) {
    if (error) {
      callback_(error);
    } else {
      var storageAccounts = response.storageAccounts;
      for (var i = 0; i < storageAccounts.length; i++) {
        if ((location && storageAccounts[i].properties.location && storageAccounts[i].properties.location.toLowerCase() === location.toLowerCase()) ||
          affinityGroup && storageAccounts[i].properties.affinityGroup && storageAccounts[i].properties.affinityGroup.toLowerCase() === affinityGroup.toLowerCase()) {
          if (!exports.stringIsNullOrEmpty(storagePrefix)) {
            if (!exports.stringStartsWith(storageAccounts[i].name, storagePrefix)) {
              continue;
            }
          }
          var blobStorageUrl = storageAccounts[i].properties.endpoints[0];
          if (blobStorageUrl.slice(-1) === '/') {
            blobStorageUrl = blobStorageUrl.slice(0, -1);
          }

          callback_(null, blobStorageUrl);
          return;
        }
      }
      createNewStorageAccount_();
    }
  });
};

exports.writeFileSyncMode = function writeFileSyncMode(path, data, encoding, mode) {
  mode = mode || parseInt('600', 8); // maximum protection by default
  var fd = fs.openSync(path, 'w', mode);
  try {
    if (typeof data === 'string') {
      fs.writeSync(fd, data, 0, encoding);
    } else {
      fs.writeSync(fd, data, 0, data.length, 0);
    }
  } finally {
    fs.closeSync(fd);
  }
};

exports.getDnsPrefix = function (dnsName, allowEmpty) {
  if (dnsName) {
    // remove protocol if any, take the last element
    dnsName = dnsName.split('://').slice(-1)[0];
    // take first element
    dnsName = dnsName.split('.', 1)[0];
  }
  if (!dnsName && !allowEmpty) {
    throw new Error('Missing or invalid dns-name');
  }
  return dnsName;
};

/**
 * Resolve location name if 'name' is location display name.
 *
 * @param {string}   name       The display name or location name. Required
 * @param {function} callback   The callback function called on completion. Required.
 */
exports.resolveLocationName = function (managementClient, name, callback) {
  managementClient.locations.list(function (error, response) {
    var resolvedLocation = null;
    if (!error) {
      if (response.locations.length > 0) {
        for (var i = 0; i < response.locations.length; i++) {
          var locationInfo = response.locations[i];
          if (exports.ignoreCaseEquals(locationInfo.name, name)) {
            callback(null, locationInfo);
            return;
          } else if (!resolvedLocation && (exports.ignoreCaseEquals(locationInfo.DisplayName, name))) {
            // This is the first matched display name save the corresponding location
            // We ignore further matched display name, but will continue with location
            // matching
            resolvedLocation = locationInfo;
          }
        }

        if (resolvedLocation) {
          callback(null, resolvedLocation);
        } else {
          callback({
            message: 'No location found which has DisplayName or Name same as value of --location',
            code: 'Not Found'
          }, name);
        }
      } else {
        // Return a valid error
        callback({ message: 'Server returns empty location list', code: 'Not Found' }, name);
      }
    } else {
      callback(error, null);
    }
  });
};

exports.parseInt = function (value) {
  var intValue = parseInt(value, 10);
  if (intValue != value || value >= 65536 * 65536) { // just some limits
    return NaN;
  }
  return intValue;
};

exports.getUTCTimeStamp = function () {
  var now = new Date();
  return (now.getUTCFullYear() + '-' +
  ('0' + (now.getUTCMonth() + 1)).slice(-2) + '-' +
  ('0' + now.getUTCDate()).slice(-2) + ' ' +
  ('0' + now.getUTCHours()).slice(-2) + ':' +
  ('0' + now.getUTCMinutes()).slice(-2));
};

exports.logLineFormat = function logLineFormat(object, logFunc, prefix) {
  prefix = prefix || '';
  switch (typeof object) {
    case 'object':
      // if this is a date then we call toISOString and print that
      if (_.isDate(object)) {
        logFunc(prefix.cyan + object.toISOString().green);
      } else {
        for (var i in object) {
          logLineFormat(object[i], logFunc, prefix + i + ' ');
        }
      }
      return;
    case 'string':
      logFunc(prefix.cyan + ('"' + object + '"').green);
      return;
    case 'boolean':
      logFunc(prefix.cyan + object.toString().green);
      return;
    case 'number':
      logFunc(prefix.cyan + object.toString().green);
      return;
    case 'undefined':
      return;
    default:
      logFunc(prefix.cyan + '?' + object + '?'); // unknown type
  }
};

exports.validateEndpoint = function (endpoint) {
  if (!exports.stringStartsWith(endpoint, 'http://') && !exports.stringStartsWith(endpoint, 'https://')) {
    // Default to https
    endpoint = 'https://' + endpoint;
  }

  var parts = url.parse(endpoint);
  if (!parts.hostname) {
    throw new Error('Invalid endpoint format.');
  }

  parts.port = (parts.port && parseInt(parts.port, 10)) || (/https/i.test(parts.protocol) ?
    constants.DEFAULT_HTTPS_PORT :
    constants.DEFAULT_HTTP_PORT);

  return url.format(parts);
};

/**
 * Determines if a string is null or empty.
 *
 * @param {string}       text      The string to test.
 * @return {Bool} True if the string string is null or empty; false otherwise.
 */
exports.stringIsNullOrEmpty = function (text) {
  return text === null ||
    text === undefined ||
    text.trim() === '';
};


exports.stripBOM = function (content) {
  if (Buffer.isBuffer(content)) {
    content = content.toString();
  }
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
};

/**
 * Determines if a string ends with another.
 *
 * @param {string}       text      The string to assert.
 * @param {string}       suffix    The string suffix.
 * @param {bool}         ignoreCase Boolean value indicating if casing should be ignored.
 * @return {Bool} True if the string ends with the suffix; false otherwise.
 */
exports.stringEndsWith = function (text, suffix, ignoreCase) {
  if (_.isNull(suffix)) {
    return true;
  }

  if (ignoreCase) {
    text = text.toLowerCase();
    suffix = suffix.toLowerCase();
  }

  return text.substr(text.length - suffix.length) === suffix;
};

exports.stringTrimEnd = function (text, charToTrim) {
  if (!text) {
    return text;
  }

  if (!charToTrim) {
    charToTrim = ' ';
  }

  var subtract = 0;
  while (subtract < text.length && text[text.length - (subtract + 1)] === charToTrim) {
    subtract++;
  }

  return text.substr(0, text.length - subtract);
};


exports.logError = function (log, message, err) {
  if (arguments.length == 1) {
    err = message;
    message = undefined;
  } else {
    log.error(message);
  }

  if (err) {
    if (err.message) {
      //                log.error(err.message);
      log.verbose('stack', err.stack);
      log.json('silly', err);
    }
    else if (err.Message) {
      //                log.error(err.Message);
      log.json('verbose', err);
    }
  }
};

exports.clearConfig = function () {
  var azureConfigPath = path.join(exports.azureDir(), 'config.json');

  if (exports.pathExistsSync(azureConfigPath)) {
    fs.unlinkSync(azureConfigPath);
    return true;
  }
};

exports.copyIisNodeWhenServerJsPresent = function (log, rootPath, callback) {
  try {
    var iisnodeyml = 'iisnode.yml';
    log.silly('copyWebConfigWhenServerJsPresent');
    if (!exports.pathExistsSync(iisnodeyml) && (exports.pathExistsSync(path.join(rootPath, 'server.js')) || exports.pathExistsSync(path.join(rootPath, 'app.js')))) {
      log.info('Creating default ' + iisnodeyml + ' file');
      var sourcePath = path.join(__dirname, '../templates/node/' + iisnodeyml);
      fs.readFile(sourcePath, function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        fs.writeFile(path.join(rootPath, iisnodeyml), result, callback);
      });
    }
    else {
      callback();
    }
  }
  catch (e) {
    callback(e);
  }
};

exports.normalizeParameters = function (paramDescription) {
  var key, positionalValue, optionValue;
  var paramNames = Object.keys(paramDescription);
  var finalValues = {};

  for (var i = 0; i < paramNames.length; ++i) {
    key = paramNames[i];
    positionalValue = paramDescription[key][0];
    optionValue = paramDescription[key][1];
    if (!_.isUndefined(positionalValue) && !_.isUndefined(optionValue)) {
      return { err: new Error('You must specify ' + key + ' either positionally or by name, but not both') };
    } else {
      finalValues[key] = positionalValue || optionValue;
    }
  }

  return { values: finalValues };
};

/**
 * fs.exists wrapper for streamline
 */
exports.fileExists = function (filePath, cb) {
  var func = fs.exists;
  if (!func) {
    func = path.exists;
  }
  func(filePath, function (exists) {
    cb(null, exists);
  });
};

/**
 * Wildcard Util only support two wildcard character * and ?
 */
exports.Wildcard = {
  /**
   * does the specified the character contain wildcards
   */
  containWildcards: function (str) {
    var wildcardReg = /[*?]/img;
    return str !== null && wildcardReg.test(str);
  },

  /**
   * Get the max prefix string of the specified string which doesn't contain wildcard
   */
  getNonWildcardPrefix: function (str) {
    var nonWildcardReg = /[^*?]*/img;
    var prefix = '';

    if (str !== null) {
      var result = str.match(nonWildcardReg);
      if (result !== null && result.length > 0) {
        prefix = result[0];
      }
    }

    return prefix;
  },

  /**
   * Convert wildcard pattern to regular expression
   */
  wildcardToRegexp: function (str, isCaseInsensitive) {
    var strRegexp = '';
    if (str !== null) {
      strRegexp = str.replace(/\?/g, '.').replace(/\*/g, '.*');
    }

    var regexp = new RegExp();
    if (isCaseInsensitive && isCaseInsensitive === true) {
      regexp.compile('^' + strRegexp + '$', 'ig');
    }
    else {
      regexp.compile('^' + strRegexp + '$');
    }
    return regexp;
  },

  /**
   * Is the specified string match the case sensitive specified wildcard pattern
   */
  isMatch: function (str, pattern) {
    var reg = exports.Wildcard.wildcardToRegexp(pattern);
    return reg.test(str);
  },
  
  /**
   * Is the specified string match the case insensitive specified wildcard pattern
   */
  isMatchCaseInsensitive: function (str, pattern) {
    var reg = exports.Wildcard.wildcardToRegexp(pattern, true);
    return reg.test(str);
  }
};

/**
 * Invalid file name chars in windows.
 * http://msdn.microsoft.com/en-us/library/system.io.path.getinvalidfilenamechars.aspx
 */
exports.invalidFileNameChars = [34, 60, 62, 124, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 58, 42, 63, 92, 47];

/**
 * Reserved file name in windows
 */
exports.reservedBaseFileNamesInWindows = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];

/**
 * Is the reserved file name in windows
 */
exports.isReservedFileNameInWindows = function (name) {
  name = (name || '').toLowerCase();
  var index = exports.reservedBaseFileNamesInWindows.indexOf(name);
  return index !== -1;
};

/*
 * Escape file path
 */
exports.escapeFilePath = function (name) {
  if (exports.isWindows()) {
    //only escape file name on windows
    var regExp = exports.getReplaceRegExpFromCharCode(exports.invalidFileNameChars);
    name = name.replace(regExp, function (code) {
      return '%' + code.charCodeAt(0).toString(16);
    });
    var extName = path.extname(name);
    var baseName = path.basename(name, extName);
    if (exports.isReservedFileNameInWindows(baseName)) {
      name = util.format('%s (1)%s', baseName, extName);
    }
  }
  return name;
};

/**
 * Is windows platform
 */
exports.isWindows = function () {
  return !!process.platform.match(/^win/);
};

/**
 * Join the char code into a replace regular expression
 * For example,
 *   [65,66] => /A|B/img
 *   [63,66] => /\?|B/img
 */
exports.getReplaceRegExpFromCharCode = function (charCodeArray) {
  function charCodeToRegChar(charCode) {
    var str = String.fromCharCode(charCode);
    switch (str) {
      case '*':
      case '?':
      case '.':
      case '\\':
      case '|':
      case '/':
        str = '\\' + str;
        break;
    }
    return str;
  }

  var regExp = new RegExp();
  if (charCodeArray.length) {
    var regStr = charCodeToRegChar(charCodeArray[0]);
    for (var i = 1; i < charCodeArray.length; i++) {
      regStr += '|' + charCodeToRegChar(charCodeArray[i]);
    }
    regExp.compile(regStr, 'gim');
  }
  return regExp;
};

/**
 * Add function overloads to an object that vary by
 * declared argument length.
 *
 * @param {function} func the function overloads.
 *
 * @returns The 'overloaded' function
 */
exports.overload = function () {

  function final() {
    throw new Error(util.format($('Unknown overload for %s parameters'), arguments.length));
  }

  var func = final;
  /* jshint loopfunc: true */
  for (var i = 0; i < arguments.length; ++i) {
    func = (function (old, func) {
      return function () {
        if (func.length === arguments.length) {
          return func.apply(this, arguments);
        } else if (typeof old === 'function') {
          return old.apply(this, arguments);
        }
      };
    })(func, arguments[i]);
  }

  return func;
};

//"<root>\test\framework\cli-test.js" contains associated test stubs. Please keep them in sync.
exports.uuidGen = function () {
  return uuid.v4();
};

exports.toLowerCaseAndRemoveSpace = function (str) {
  if (!str) {
    return str;
  }

  return str.replace(/ /gi, '').toLowerCase();
};

exports.ignoreCaseAndSpaceEquals = function (a, b) {
  return a === b || (exports.toLowerCaseAndRemoveSpace(a) === exports.toLowerCaseAndRemoveSpace(b));
};

exports.atLeastOneParameIsSet = function (params) {
  for (var i = 0; i < params.length; i++) {
    if (!exports.stringIsNullOrEmpty(params[i])) {
      return true;
    }
  }
  return false;
};

exports.allParamsAreSet = function (params) {
  for (var i = 0; i < params.length; i++) {
    if (exports.stringIsNullOrEmpty(params[i])) {
      return false;
    }
  }

  return true;
};

// many of the commands accepts arguments whose valid values can be from an enum. For example
// protocol argument for endpoints create, valid values are ['tcp', 'udp', 'http'].
// This method can be used to validate user provided input against the possible valid
// values (supportedTypes). This method do case ignore comparison and return matched enum
// value.If no match found exception will be thrown and exception message will inform valid
// values.
exports.verifyParamExistsInCollection = function (supportedTypes, paramToCheck, paramName) {
  var i = _.indexOf(_.map(supportedTypes, function (s) {
    return s.toLowerCase();
  }), paramToCheck.toLowerCase());
  if (i === -1) {
    throw new Error(util.format(exports.getLocaleString('Given %s is invalid, supported values are %s'), paramName, supportedTypes.join(', ')));
  }

  return supportedTypes[i];
};

exports.hasValidProperty = function (object, propName) {
  if (object === null || object === undefined) {
    return false;
  }

  if (!object.hasOwnProperty(propName)) {
    return false;
  }

  if (object[propName] === null || object[propName] === undefined) {
    return false;
  }

  return true;
};

exports.parseResourceReferenceUri = function (referenceUri) {
  var parts = referenceUri.split('/');
  return {
    subscriptionId: parts[2],
    resourceGroupName: parts[4],
    provider: parts[6], // e.g. Microsoft.Network
    parentResource: parts.slice(7, parts.length - 1).join('/'), // e.g. virtualNetworks/<vnet-name>/subnets
    resourceName: parts[parts.length - 1] // e.g. <subnet-name>
  };
};

exports.isAttributesMatched = function (item, attributes) {
  for (var key in attributes) {
    var value1 = attributes[key];
    var value2 = item[key];
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      value1 = value1.toLowerCase();
      value2 = value2.toLowerCase();
    }
    if (value1 !== value2) return false;
  }

  return true;
};

/**
 * Looks through the list and returns the element that matches attributes,
 * case-insensitive.
 */
exports.findFirstCaseIgnore = function (list, attributes) {
  if (_.isEmpty(attributes)) {
    return undefined;
  }
  return _.find(list, function (item) {
    return exports.isAttributesMatched(item, attributes);
  });
};

/**
 * Looks through the list and returns the index of element that matches attributes or -1 if it is not present,
 * case-insensitive.
 */
exports.indexOfCaseIgnore = function (list, attributes) {
  if (_.isEmpty(list) || _.isEmpty(attributes)) {
    return -1;
  }
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var match = exports.isAttributesMatched(item, attributes);
    if (match) return i;
  }
  return -1;
};

exports.getOptionalArg = function (argument) {
  var optionalArg = {
    hasValue: false,
    value: null,
    validate: function (object, validator, args, def) {
      if (this.hasValue && this.value !== null) {
        if (!args) {
          args = [];
        }
        args.unshift(this.value);
        return validator.apply(object, args);
      }
      return def;
    }
  };

  if (argument) {
    optionalArg.hasValue = true;
    if (argument !== true && argument !== '\'\'') {
      optionalArg.value = argument;
    }
  }

  return optionalArg;
};

exports.trimTrailingChar = function (str, charToTrim) {
  while (str.length > 0 && str.charAt(str.length - 1) == charToTrim) {
    str = str.substr(0, str.length - 1);
  }
  return str;
};

exports.capitalizeFirstLetter = function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

exports.toRange = function (array) {
  return '[' + array[0] + '-' + array[1] + ']';
};
