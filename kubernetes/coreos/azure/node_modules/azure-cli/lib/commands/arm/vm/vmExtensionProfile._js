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

var __ = require('underscore');
var fs = require('fs');
var util = require('util');
var path = require('path');
var exec = require('child_process').exec;
var openssl = require('openssl-wrapper');
var js2xmlparser = require('js2xmlparser');
var utils = require('../../../util/utils');
var tagUtils = require('../tag/tagUtils');
var EndPointUtil = require('../../../util/endpointUtil');
var blobUtil = require('../../../util/blobUtils');
var vmConstants = require('../../../util/vmConstants');

var $ = utils.getLocaleString;

function VMExtensionProfile(cli, params, serviceClients) {
    this.cli = cli;
    this.output = cli.output;
    this.params = params;
    this.serviceClients = serviceClients;
}

__.extend(VMExtensionProfile.prototype, {
  generateExtensionProfile: function() {
    var extensionProfile = this._parseExtensionProfileParams(this.params);
    return {
      profile: extensionProfile
    };
  },

  generateDockerExtensionProfile: function(_) {
    if ((this.params.dockerPort && typeof this.params.dockerPort === 'boolean') || !this.params.dockerPort) {
      this.params.dockerPort = vmConstants.EXTENSIONS.DOCKER_PORT;
    } else {
      var endPointUtil = new EndPointUtil();
      var dockerPortValidation = endPointUtil.validatePort(this.params.dockerPort, 'docker port');
      if (dockerPortValidation.error) {
        throw new Error(dockerPortValidation.error);
      }
    }

    if ((this.params.dockerCertDir && typeof this.params.dockerCertDir === 'boolean') || !this.params.dockerCertDir) {
      var homePath = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
      this.params.dockerCertDir = path.join(homePath, '.docker');
    }

    if (utils.stringIsNullOrEmpty(this.params.version)) {
      this.params.version = vmConstants.EXTENSIONS.DOCKER_VERSION_ARM;
    }

    var dockerCertPaths = {
      caKey: path.join(this.params.dockerCertDir, 'ca-key.pem'),
      ca: path.join(this.params.dockerCertDir, 'ca.pem'),
      serverKey: path.join(this.params.dockerCertDir, this.params.vmName + '-server-key.pem'),
      server: path.join(this.params.dockerCertDir, this.params.vmName + '-server.csr'),
      serverCert: path.join(this.params.dockerCertDir, this.params.vmName + '-server-cert.pem'),
      clientKey: path.join(this.params.dockerCertDir, 'key.pem'),
      client: path.join(this.params.dockerCertDir, 'client.csr'),
      clientCert: path.join(this.params.dockerCertDir, 'cert.pem')
    };

    this._checkAndGenerateDockerCertificatesIfNeeded(dockerCertPaths, this.params.dockerCertCn, _);

    this.params.extensionName = vmConstants.EXTENSIONS.DOCKER_NAME;
    this.params.publisherName = vmConstants.EXTENSIONS.DOCKER_PUBLISHER;
    this.params.publicConfig = this._createDockerPublicConfiguration();
    this.params.privateConfig = this._createDockerPrivateConfiguration(dockerCertPaths);
    this.params.autoUpgradeMinorVersion = true;

    return this.generateExtensionProfile();
  },

  generateVMAccessExtensionProfile: function() {
    if (this.params.osType === 'Linux') {
      return this._generateVMAccessLinuxProfile();
    } else if (this.params.osType === 'Windows') {
      return this._generateVMAccessWindowsProfile();
    }

    return null;
  },

  generateVMDiagExtensionProfile: function(_) {
    if (this.params.osType === 'Linux') {
      return this._generateVMDiagLinuxProfile(_);
    } else if (this.params.osType === 'Windows') {
      return this._generateVMDiagWindowsProfile(_);
    }

    return null;
  },

  _generateVMDiagLinuxProfile: function(_) {
    if (utils.stringIsNullOrEmpty(this.params.version)) {
      this.params.version = vmConstants.EXTENSIONS.LINUX_DIAG_VERSION;
    }

    this.params.extensionName = vmConstants.EXTENSIONS.LINUX_DIAG_NAME;
    this.params.publisherName = vmConstants.EXTENSIONS.LINUX_DIAG_PUBLISHER;
    this.params.publicConfig = this._createDiagPublicConfiguration();
    this.params.privateConfig = this._createDiagPrivateConfiguration(_);
    this.params.autoUpgradeMinorVersion = true;

    return this.generateExtensionProfile();
  },

   _generateVMDiagWindowsProfile: function(_) {
     if (utils.stringIsNullOrEmpty(this.params.version)) {
       this.params.version = vmConstants.EXTENSIONS.IAAS_DIAG_VERSION;
     }

     this.params.extensionName = vmConstants.EXTENSIONS.IAAS_DIAG_NAME;
     this.params.publisherName = vmConstants.EXTENSIONS.IAAS_DIAG_PUBLISHER;
     this.params.publicConfig = this._createDiagPublicConfiguration();
     this.params.privateConfig = this._createDiagPrivateConfiguration(_);
     this.params.autoUpgradeMinorVersion = true;

     return this.generateExtensionProfile();
  },

  _createDiagPublicConfiguration: function() {
    var config = {
      xmlCfg: null,
      storageAccount: null
    };

    if (!utils.stringIsNullOrEmpty(this.params.configFile)) {
      var configFile = fs.readFileSync(this.params.configFile);
      config.xmlCfg = new Buffer(configFile).toString('base64');
    } else {
      if (this.params.osType === 'Windows') {
        this.cli.output.verbose($('--config-file is not specified, using default one.'));
        config.xmlCfg = new Buffer(this._generateDefaultXmlCfg(this.params.vmID)).toString('base64');
      } else {
        return null;
      }
    }

    config.storageAccount = this._getStorageAccountName();

    return config;
  },

  _generateDefaultXmlCfg: function(vmID) {
    var wadCfg = {
      DiagnosticMonitorConfiguration: {
        '@': {
          overallQuotaInMB: '25000'
        },
        PerformanceCounters: {
          '@': {
            scheduledTransferPeriod: 'PT1M'
          },
          PerformanceCounterConfiguration: {
            '@': {
              counterSpecifier: '\\\Processor(_Total)\\\% Processor Time',
              sampleRate: 'PT1M',
              unit: 'percent'
            }
          }
        },
        WindowsEventLog: {
          '@': {
            scheduledTransferPeriod: 'PT1M'
          },
          DataSource: {
            '@': {
              name: 'System!*'
            }
          }
        },
        Metrics: {
          '@': {
            resourceId: vmID
          },
          MetricAggregation: [
            {
              '@': {
                scheduledTransferPeriod: 'PT1H'
              }
            },
            {
              '@': {
                scheduledTransferPeriod: 'PT1M'
              }
            }
          ]
        }
      }
    };

    var options = { declaration: { include: false }, prettyPrinting: { enabled: false } };
    var xmlCfg = js2xmlparser('WadCfg', wadCfg, options);
    return xmlCfg;
  },

  _createDiagPrivateConfiguration: function(_) {
    var config = {
      storageAccountName: null,
      storageAccountKey: null,
      storageAccountEndPoint: 'https://core.windows.net:443/'
    };

    config.storageAccountName = this._getStorageAccountName();
    var keys = this.serviceClients.storageManagementClient.storageAccounts.listKeys(this.params.resourceGroupName, config.storageAccountName, _);
    config.storageAccountKey = keys.storageAccountKeys.key1;

    return config;
  },

  _getStorageAccountName: function() {
    if(!utils.stringIsNullOrEmpty(this.params.storageAccountName)) {
      return this.params.storageAccountName;
    }

    if (utils.stringIsNullOrEmpty(this.params.osDiskUri)) {
      throw new Error($('params.osDiskUri is required when --storage-account-name parameter is not specified'));
    }

    var osDiskUri = blobUtil.splitDestinationUri(this.params.osDiskUri);
    return osDiskUri.accountName;
  },

  _generateVMAccessLinuxProfile: function() {
    if (utils.stringIsNullOrEmpty(this.params.userName) &&
        utils.stringIsNullOrEmpty(this.params.removeUser) &&
        !this.params.resetSsh) {
      throw new Error($('Either --user-name or --remove-user or --reset-ssh params are required.'));
    }

    if (!utils.stringIsNullOrEmpty(this.params.userName)) {
      if (utils.stringIsNullOrEmpty(this.params.password) && utils.stringIsNullOrEmpty(this.params.sshKeyFile)) {
        throw new Error(util.format($('Either password or SSH key are required to reset access for user %s.'), this.params.userName));
      }
    }

    if (utils.stringIsNullOrEmpty(this.params.version)) {
      this.params.version = vmConstants.EXTENSIONS.LINUX_ACCESS_VERSION;
    }

    this.params.extensionName = vmConstants.EXTENSIONS.LINUX_ACCESS_NAME;
    this.params.publisherName = vmConstants.EXTENSIONS.LINUX_ACCESS_PUBLISHER;
    this.params.privateConfig = this._createVMAccessLinuxPrivateConfig();

    return this.generateExtensionProfile();
  },

  _generateVMAccessWindowsProfile: function() {
    var self = this;
    if (utils.stringIsNullOrEmpty(this.params.userName) || utils.stringIsNullOrEmpty(this.params.password)) {
      throw new Error($('Both user name and password are required.'));
    }

    if (!utils.stringIsNullOrEmpty(this.params.removeUser) ||
        this.params.resetSsh ||
        !utils.stringIsNullOrEmpty(this.params.sshKeyFile)) {
      self.output.warn($('Resetting access on Windows VM, --reset-ssh, --ssh-key-file and--remove-user parameters will be ignored.'));
    }

    if (utils.stringIsNullOrEmpty(this.params.version)) {
      this.params.version = vmConstants.EXTENSIONS.WINDOWS_ACCESS_VERSION;
    }

    this.params.extensionName = vmConstants.EXTENSIONS.WINDOWS_ACCESS_NAME;
    this.params.publisherName = vmConstants.EXTENSIONS.WINDOWS_ACCESS_PUBLISHER;
    this.params.publicConfig = { UserName: this.params.userName };
    this.params.privateConfig = { Password: this.params.password };

    return this.generateExtensionProfile();
  },

  _parseExtensionProfileParams: function(params) {
    if (params.publicConfig && params.publicConfigPath) {
      throw new Error($('Both optional parameters --public-config and --public-config-path cannot be specified together.'));
    }

    if (params.privateConfig && params.privateConfigPath) {
      throw new Error($('Both optional parameters --private-config and --private-config-path cannot be specified together.'));
    }

    var extensionProfile = {
      name: params.extensionName,
      type: vmConstants.EXTENSIONS.TYPE,
      location: params.location,
      tags: null,
      publisher: params.publisherName,
      extensionType: params.extensionName,
      typeHandlerVersion: params.version,
      settings: null,
      protectedSettings: null
    };

    if (params.publicConfig) {
      if (typeof params.publicConfig === 'string') {
        extensionProfile.settings = this._parseExtensionConfig(params.publicConfig, $('Error parsing public config'));
      } else {
        extensionProfile.settings = params.publicConfig;
      }
    }

    if (params.privateConfig) {
      if (typeof params.privateConfig === 'string') {
        extensionProfile.protectedSettings = this._parseExtensionConfig(params.privateConfig, $('Error parsing private config'));
      } else {
        extensionProfile.protectedSettings = params.privateConfig;
      }
    }

    if (params.publicConfigPath) {
      var publicConfig = fs.readFileSync(params.publicConfigPath);
      extensionProfile.settings = this._parseExtensionConfig(publicConfig.toString(), util.format($('Error parsing public config from file %s'), params.publicConfigPath));
    }

    if (params.privateConfigPath) {
      var privateConfig = fs.readFileSync(params.privateConfigPath);
      extensionProfile.protectedSettings = this._parseExtensionConfig(privateConfig.toString(), util.format($('Error parsing private config from file %s'), params.privateConfigPath));
    }

    if (params.tags) {
      extensionProfile.tags = {};
      extensionProfile.tags = tagUtils.buildTagsParameter(extensionProfile.tags, { tags: params.tags });
    }

    if (params.autoUpgradeMinorVersion) {
      extensionProfile.autoUpgradeMinorVersion = true;
    }

    return extensionProfile;
  },

  _parseExtensionConfig: function(config, errorMessage) {
    try {
      var parsedConfig = JSON.parse(config);
      return parsedConfig;
    } catch (err) {
      throw new Error(util.format($('%s. %s'), errorMessage, err));
    }
  },

  _createVMAccessLinuxPrivateConfig: function() {
    var privateConfig = {};

    if (this.params.resetSsh) {
      privateConfig['reset_ssh'] = true;
    }

    if (!utils.stringIsNullOrEmpty(this.params.userName)) {
      privateConfig['username'] = this.params.userName;
    }

    if (!utils.stringIsNullOrEmpty(this.params.password)) {
      privateConfig['password'] = this.params.password;
    }

    if (!utils.stringIsNullOrEmpty(this.params.expiration)) {
      privateConfig['expiration'] = this.params.expiration;
    }

    if (!utils.stringIsNullOrEmpty(this.params.sshKeyFile)) {
      var publicKey = this._parseSSHPublicKeyPemFile(this.params.sshKeyFile);
      privateConfig['ssh_key'] = publicKey;
    }

    if (!utils.stringIsNullOrEmpty(this.params.removeUser)) {
      privateConfig['remove_user'] = this.params.removeUser;
    }

    return privateConfig;
  },

  _parseSSHPublicKeyPemFile: function (sshKeyFile) {
    var self = this;
    self.output.info(util.format($('Verifying the public key SSH file: %s'), sshKeyFile));
    var sshPublickeyPemData = fs.readFileSync(sshKeyFile);
    var sshPublickeyPemDataStr = sshPublickeyPemData.toString();
    if (!utils.isPemCert(sshPublickeyPemDataStr)) {
      throw new Error($('Specified SSH public key file is not in PEM format'));
    }

    return sshPublickeyPemDataStr;
  },

  _checkAndGenerateDockerCertificatesIfNeeded: function(dockerCertPaths, serverCN, _) {
    var self = this;
    var dockerDirExists = utils.fileExists(this.params.dockerCertDir, _);
    var progress;
    var password = 'Docker123';
    if (!dockerDirExists) {
      self.output.verbose($('Docker certificates were not found.'));
      fs.mkdir(this.params.dockerCertDir, _);
      progress = this.cli.interaction.progress($('Generating docker certificates.'));
      try {
        this._generateDockerCertificates(dockerCertPaths, password, serverCN, _);
      } finally {
        progress.end();
      }
    } else {
      // We need to check if all certificates are in place.
      // If not, generate them from the scratch
      var missingClientCertificates = this._checkExistingDockerClientCertificates(dockerCertPaths, _);
      if (missingClientCertificates.length === 0) {
        self.output.verbose($('Found docker client certificates.'));
        var missingServerCertificates = this._checkExistingDockerServerCertificates(dockerCertPaths, _);
        if (missingServerCertificates.length === 0) {
          self.output.verbose($('Found docker server certificates.'));
        } else {
          this._generateDockerServerCertificates(dockerCertPaths, password, serverCN, _);
        }
      } else {
        for (i = 0; i < missingClientCertificates.length; i++) {
          self.output.verbose(missingClientCertificates[i]);
        }

        progress = this.cli.interaction.progress($('Generating docker certificates.'));
        try {
          this._generateDockerCertificates(dockerCertPaths, password, serverCN, _);
        } finally {
          progress.end();
        }
      }
    }
  },

  _checkExistingDockerClientCertificates: function(dockerCertPaths, _) {
    var missingCertificates = [];
    this._checkIfDockerCertificateExist(missingCertificates, dockerCertPaths.caKey, _);
    this._checkIfDockerCertificateExist(missingCertificates, dockerCertPaths.ca, _);
    this._checkIfDockerCertificateExist(missingCertificates, dockerCertPaths.clientKey, _);
    this._checkIfDockerCertificateExist(missingCertificates, dockerCertPaths.clientCert, _);

    return missingCertificates;
  },

  _checkExistingDockerServerCertificates: function(dockerCertPaths, _) {
    var missingCertificates = [];
    this._checkIfDockerCertificateExist(missingCertificates, dockerCertPaths.serverKey, _);
    this._checkIfDockerCertificateExist(missingCertificates, dockerCertPaths.serverCert, _);

    return missingCertificates;
  },

  _checkIfDockerCertificateExist: function(missingCertificates, filepath, _) {
    var fileExists = utils.fileExists(filepath, _);
    if (!fileExists) {
      missingCertificates.push(util.format($('%s file was not found'), filepath));
    }
  },

  _generateDockerCertificates: function(dockerCertPaths, password, serverCN, _) {
    var self = this;
    /*jshint camelcase: false */
    self.output.verbose(util.format($('Password for docker certificates is "%s"'), password));
    try {
      exec('openssl version', _);
    } catch (e) {
      throw new Error(util.format($('Please install/configure OpenSSL client. Error: %s'), e.message));
    }

    this._executeOpensslCommand('genrsa', {
      des3: true,
      passout: 'pass:' + password,
      out: dockerCertPaths.caKey
    }, _);

    /*jshint camelcase: false */
    this._executeOpensslCommand('req', {
      new: true,
      x509: true,
      days: 365,
      passin: 'pass:' + password,
      subj: '/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=\\*',
      key: dockerCertPaths.caKey,
      out: dockerCertPaths.ca
    },  _);

    this._generateDockerServerCertificates(dockerCertPaths, password, serverCN, _);
    this._generateDockerClientCertificates(dockerCertPaths, password, _);

    // setting cert permissions
    fs.chmodSync(dockerCertPaths.caKey, 0600);
    fs.chmodSync(dockerCertPaths.ca, 0600);
    return;
  },

  _generateDockerServerCertificates: function(dockerCertPaths, password, serverCN, _) {
    /*jshint camelcase: false */
    this._executeOpensslCommand('genrsa', {
      des3: true,
      passout: 'pass:' + password,
      out: dockerCertPaths.serverKey
    },  _);

    if (utils.stringIsNullOrEmpty(serverCN)) {
      serverCN = '*';
    }
    this._executeOpensslCommand('req', {
      new: true,
      passin: 'pass:' + password,
      subj: '/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=' + serverCN,
      key: dockerCertPaths.serverKey,
      out: dockerCertPaths.server
    },  _);

    /*jshint camelcase: false */
    this._executeOpensslCommand('x509', {
      req: true,
      days: 365,
      in : dockerCertPaths.server,
      passin: 'pass:' + password,
      set_serial: 01,
      CA: dockerCertPaths.ca,
      CAkey: dockerCertPaths.caKey,
      out: dockerCertPaths.serverCert
    },  _);

    this._executeOpensslCommand('rsa', {
      passin: 'pass:' + password,
      in : dockerCertPaths.serverKey,
      passout: 'pass:' + password,
      out: dockerCertPaths.serverKey
    },  _);

    fs.chmodSync(dockerCertPaths.serverKey, 0600);
    fs.chmodSync(dockerCertPaths.server, 0600);
    fs.chmodSync(dockerCertPaths.serverCert, 0600);
  },

  _generateDockerClientCertificates: function(dockerCertPaths, password, _) {
    /*jshint camelcase: false */
    this._executeOpensslCommand('genrsa', {
      des3: true,
      passout: 'pass:' + password,
      out: dockerCertPaths.clientKey
    },  _);

    this._executeOpensslCommand('req', {
      new: true,
      passin: 'pass:' + password,
      subj: '/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=\\*',
      key: dockerCertPaths.clientKey,
      out: dockerCertPaths.client
    },  _);

    var configPath = path.join(this.params.dockerCertDir, 'extfile.cnf');
    fs.writeFile(configPath, 'extendedKeyUsage = clientAuth',  _);
    /*jshint camelcase: false */
    this._executeOpensslCommand('x509', {
      req: true,
      days: 365,
      in : dockerCertPaths.client,
      passin: 'pass:' + password,
      set_serial: 01,
      extfile: configPath,
      CA: dockerCertPaths.ca,
      CAkey: dockerCertPaths.caKey,
      out: dockerCertPaths.clientCert
    },  _);

    this._executeOpensslCommand('rsa', {
      passin: 'pass:' + password,
      in : dockerCertPaths.clientKey,
      passout: 'pass:' + password,
      out: dockerCertPaths.clientKey
    },  _);

    fs.chmodSync(dockerCertPaths.clientKey, 0600);
    fs.chmodSync(dockerCertPaths.client, 0600);
    fs.chmodSync(configPath, 0600);
    fs.chmodSync(dockerCertPaths.clientCert, 0600);
  },

  _executeOpensslCommand: function(command, options, _) {
    var self = this;
    try {
      openssl.exec(command, options, _);
    } catch (err) {
      // This is not an actual error, 'openssl.exec' command throws log messages.
      // So we will just output them to verbose log without interrupting the command.
      self.output.verbose(err);
    }
  },

  _createDockerPublicConfiguration: function() {
    var publicConfig = {
      docker: {
        port: this.params.dockerPort.toString()
      }
    };

    return publicConfig;
  },

  _createDockerPrivateConfiguration: function(dockerCertPaths) {
    var certs = this._getDockerServerCertsInBase64(dockerCertPaths);
    var privateConfig = {
      certs: {
        ca: certs.caCert,
        cert: certs.serverCert,
        key: certs.serverKey
      },
    };

    return privateConfig;
  },

  _getDockerServerCertsInBase64: function(dockerCertPaths) {
    var caCert = this._convertFileToBase64(dockerCertPaths.ca);
    var serverKey = this._convertFileToBase64(dockerCertPaths.serverKey);
    var serverCert = this._convertFileToBase64(dockerCertPaths.serverCert);

    return {
      caCert: caCert,
      serverKey: serverKey,
      serverCert: serverCert
    };
  },

  _convertFileToBase64: function(filePath) {
    var file = fs.readFileSync(filePath);
    return new Buffer(file).toString('base64');
  }
});

module.exports = VMExtensionProfile;