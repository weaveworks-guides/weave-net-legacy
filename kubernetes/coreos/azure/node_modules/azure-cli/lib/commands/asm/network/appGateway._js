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
var path = require('path');
var fs = require('fs');
var util = require('util');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var constants = require('./constants');
var VNetUtil = require('../../../util/vnet.util');

function AppGateway(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(AppGateway.prototype, {
  create: function (appGatewayName, vnetName, subnetNames, options, _) {
    var self = this;
    options.subnetNames = subnetNames;
    var appGateway = self.get(appGatewayName, _);
    if (appGateway) {
      throw new Error(util.format($('Application Gateway "%s" already exists'), appGatewayName));
    }

    var appGatewayConfig = {};
    self._validateAppGatewayOptions(appGatewayName, vnetName, appGatewayConfig, options, true);

    var progress = self.interaction.progress(util.format($('Creating an Application Gateway "%s" for virtual network "%s"'), appGatewayName, vnetName));
    try {
      self.networkManagementClient.applicationGateways.create(appGatewayConfig, _);
    } finally {
      progress.end();
    }
  },

  set: function (appGatewayName, vnetName, options, _) {
    var self = this;
    var appGateway = self.get(appGatewayName, _);
    if (!appGateway) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    self._validateAppGatewayOptions(appGatewayName, vnetName, appGateway, options, false);
    var progress = self.interaction.progress(util.format($('Updating an Application Gateway "%s" for virtual network "%s"'), appGatewayName, vnetName));
    try {
      self.networkManagementClient.applicationGateways.update(appGatewayName, appGateway, _);
    } finally {
      progress.end();
    }
  },

  get: function (appGatewayName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up an Application Gateway "%s"'), appGatewayName));
    try {
      var appGateway = self.networkManagementClient.applicationGateways.get(appGatewayName, _);
      return appGateway;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  show: function (appGatewayName, options, _) {
    var self = this;
    var appGateway = self.get(appGatewayName, _);

    self.interaction.formatOutput(appGateway, function (appGateway) {
      if (appGateway === null) {
        self.output.warn(util.format($('An Application Gateway with name "%s" not found'), appGatewayName));
      } else {
        self.output.nameValue($('Name'), appGateway.name);
        self.output.nameValue($('State'), appGateway.state);
        self.output.nameValue($('Description'), appGateway.description);
        self.output.nameValue($('Instance count'), appGateway.instanceCount);
        self.output.nameValue($('Gateway size'), appGateway.gatewaySize);
        self.output.nameValue($('Virtual network name'), appGateway.vnetName);

        self.output.header($('Subnets'));
        appGateway.subnets.forEach(function (subnet) {
          self.output.nameValue($('Name'), subnet, 2);
        });

        if (appGateway.virtualIPs.length > 0) {
          self.output.header($('Virtual IP\'s'));
          appGateway.virtualIPs.forEach(function (ip) {
            self.output.nameValue($('Name'), ip, 2);
          });
        }
      }
    });
  },

  list: function (options, _) {
    var self = this;
    var progress = self.interaction.progress($('Looking up Application Gateways'));

    var appGateways;
    try {
      appGateways = self.networkManagementClient.applicationGateways.list(_);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(appGateways.applicationGateways, function (data) {
      if (data.length === 0) {
        self.output.warn($('No Application Gateways found'));
      } else {
        self.output.table(data, function (row, gateway) {
          row.cell($('Name'), gateway.name);
          row.cell($('State'), gateway.state);
          row.cell($('Virtual network name'), gateway.vnetName);
          row.cell($('Gateway size'), gateway.gatewaySize);
          row.cell($('Instance count'), gateway.instanceCount);
          row.cell($('Virtual IP\'s count'), gateway.virtualIPs.length);
          row.cell($('Subnets count'), gateway.subnets.length);
        });
      }
    });
  },

  delete: function (appGatewayName, options, _) {
    var self = this;
    if (!options.quiet && !self.interaction.confirm(util.format($('Delete Application Gateway "%s"? [y/n] '), appGatewayName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkManagementClient.applicationGateways.deleteMethod(appGatewayName, _);
    } finally {
      progress.end();
    }
  },

  start: function (appGatewayName, options, _) {
    var self = this;
    options.operationType = 'start';
    var progress = self.interaction.progress(util.format($('Starting an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkManagementClient.applicationGateways.executeOperation(appGatewayName, options, _);
    } finally {
      progress.end();
    }
  },

  stop: function (appGatewayName, options, _) {
    var self = this;
    options.operationType = 'stop';
    var progress = self.interaction.progress(util.format($('Stopping an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkManagementClient.applicationGateways.executeOperation(appGatewayName, options, _);
    } finally {
      progress.end();
    }
  },

  showConfig: function (appGatewayName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);

    self.interaction.formatOutput(config, function (config) {
      if (config === null) {
        self.output.warn(util.format($('Application Gateway "%s" not found'), appGatewayName));
      } else {
        self.output.header($('Frontend IP configurations'));
        config.frontendIPConfigurations.forEach(function (fip) {
          self.output.nameValue($('Name'), fip.name, 2);
          self.output.nameValue($('Type'), fip.type, 2);
          self.output.nameValue($('Static IP address'), fip.staticIPAddress, 2);
          self.output.data('');
        });

        self.output.header($('Backend address pools'));
        config.backendAddressPools.forEach(function (pool) {
          self.output.nameValue($('Name'), pool.name, 2);
          self.output.header($('Backend servers'), 2);
          pool.backendServers.forEach(function (server) {
            self.output.nameValue($('IP address'), server.iPAddress, 4);
          });
          self.output.data('');
        });

        self.output.header($('Http settings'));
        config.backendHttpSettingsList.forEach(function (settings) {
          self.output.nameValue($('Name'), settings.name, 2);
          self.output.nameValue($('Port'), settings.port, 2);
          self.output.nameValue($('Protocol'), settings.protocol, 2);
          self.output.nameValue($('Cookie based affinity'), settings.cookieBasedAffinity, 2);
          self.output.data('');
        });

        self.output.header($('Frontend ports'));
        config.frontendPorts.forEach(function (frontendPort) {
          self.output.nameValue($('Name'), frontendPort.name, 2);
          self.output.nameValue($('Port'), frontendPort.port, 2);
          self.output.data('');
        });

        self.output.header($('Http listeners'));
        config.httpListeners.forEach(function (listener) {
          self.output.nameValue($('Name'), listener.name, 2);
          self.output.nameValue($('Frontend port'), listener.frontendPort, 2);
          self.output.nameValue($('Protocol'), listener.protocol, 2);
          self.output.data('');
        });

        self.output.header($('Load balancing rules'));
        config.httpLoadBalancingRules.forEach(function (rule) {
          self.output.nameValue($('Name'), rule.name, 2);
          self.output.nameValue($('Type'), rule.type, 2);
          self.output.nameValue($('Http settings'), rule.backendHttpSettings, 2);
          self.output.nameValue($('Listener'), rule.listener, 2);
          self.output.nameValue($('Backend address pool'), rule.backendAddressPool, 2);
          self.output.data('');
        });
      }

    });
  },

  exportConfig: function (appGatewayName, filePath, options, _) {
    var self = this;
    var gateway = self.get(appGatewayName, _);
    if (!gateway) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    var config = self.getConfig(appGatewayName, _);
    if (config) {
      fs.writeFileSync(filePath, JSON.stringify(config));
      self.output.verbose(util.format($('Application Gateway configuration exported to %s'), filePath));
    } else {
      self.output.warn(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }
  },

  importConfig: function (appGatewayName, filePath, options, _) {
    var self = this;
    var appGateway = self.get(appGatewayName, _);
    if (!appGateway) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    self.output.verbose(util.format($('Loading Application Gateway configuration file: %s'), filePath));
    var configAsString = fs.readFileSync(filePath, 'utf8');
    var config = JSON.parse(configAsString);

    self.setConfig(appGatewayName, config, _);
  },

  getConfig: function (appGatewayName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Getting configuration for an Application Gateway "%s"'), appGatewayName));
    var config;
    try {
      config = self.networkManagementClient.applicationGateways.getConfig(appGatewayName, _);
      delete config.statusCode;
      delete config.requestId;
    } catch (error) {
      if (error.code === 'ResourceNotFound' || error.code === 'NotFound') {
        config = null;
      }
    } finally {
      progress.end();
    }
    return config;
  },

  setConfig: function (appGatewayName, config, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Setting configuration for an Application Gateway "%s"'), appGatewayName));
    try {
      self.networkManagementClient.applicationGateways.setConfig(appGatewayName, config, _);
    }
    finally {
      progress.end();
    }
  },

  addBackendAddressPool: function (appGatewayName, poolName, options, _) {
    var self = this;
    var dnsServers = self._parseDnsServers(options);
    var config = self.getConfig(appGatewayName, _);
    if (config) {
      var pool = utils.findFirstCaseIgnore(config.backendAddressPools, {name: poolName});
      if (pool) {
        throw new Error(util.format($('A backend address pool with name "%s" already exists for an Application Gateway "%s"'), poolName, appGatewayName));
      } else {
        var addressPool = {
          name: poolName,
          backendServers: dnsServers
        };
        config.backendAddressPools.push(addressPool);

        self.setConfig(appGatewayName, config, _);
      }
    } else {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }
  },

  removeBackendAddressPool: function (appGatewayName, poolName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (config) {
      var index = utils.indexOfCaseIgnore(config.backendAddressPools, {name: poolName});
      if (index !== -1) {
        if (!options.quiet && !self.interaction.confirm(util.format($('Delete a backend address pool "%s?" [y/n] '), poolName), _)) {
          return;
        }
        config.backendAddressPools.splice(index, 1);
        self.setConfig(appGatewayName, config, _);
      } else {
        throw new Error(util.format($('A backend address pool with name "%s" not found for an Application Gateway "%s"'), poolName, appGatewayName));
      }
    } else {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }
  },

  addHttpSettings: function (appGatewayName, httpSettingsName, options, _) {
    var self = this;
    var httpSettings = self._parseHttpSettings(httpSettingsName, options, true);
    var config = self.getConfig(appGatewayName, _);
    if (config) {
      var settings = utils.findFirstCaseIgnore(config.backendHttpSettingsList, {name: httpSettingsName});
      if (settings) {
        throw new Error(util.format($('A http settings with name "%s" already exists for an Application Gateway "%s"'), httpSettingsName, appGatewayName));
      } else {
        config.backendHttpSettingsList.push(httpSettings);
        self.setConfig(appGatewayName, config, _);
      }
    } else {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }
  },

  removeHttpSettings: function (appGatewayName, httpSettingsName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (config) {
      var index = utils.indexOfCaseIgnore(config.backendHttpSettingsList, {name: httpSettingsName});
      if (index !== -1) {
        if (!options.quiet && !self.interaction.confirm(util.format($('Delete a http settings "%s?" [y/n] '), httpSettingsName), _)) {
          return;
        }
        config.backendHttpSettingsList.splice(index, 1);
        self.setConfig(appGatewayName, config, _);
      } else {
        throw new Error(util.format($('A http settings with name "%s" not found for an Application Gateway "%s'), httpSettingsName, appGatewayName));
      }
    } else {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }
  },

  addFrontendIp: function (appGatewayName, frontendIpName, options, _) {
    var self = this;
    var frontendIp = self._parseFrontendIp(frontendIpName, options, true);
    var config = self.getConfig(appGatewayName, _);
    if (config) {
      var ip = utils.findFirstCaseIgnore(config.frontendIPConfigurations, {name: frontendIpName});
      if (ip) {
        throw new Error(util.format($('A frontend ip with name "%s" already exists for an Application Gateway "%s"'), frontendIpName, appGatewayName));
      } else {
        config.frontendIPConfigurations.push(frontendIp);
        self.setConfig(appGatewayName, config, _);
      }
    } else {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }
  },

  removeFrontendIp: function (appGatewayName, frontendIpName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (!config) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    var index = utils.indexOfCaseIgnore(config.frontendIPConfigurations, {name: frontendIpName});
    if (index === -1) {
      throw new Error(util.format($('A frontend ip with name "%s" not found for an Application Gateway "%s'), frontendIpName, appGatewayName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete a frontend ip "%s?" [y/n] '), frontendIpName), _)) {
      return;
    }

    config.backendHttpSettingsList.splice(index, 1);
    self.setConfig(appGatewayName, config, _);
  },

  addFrontendPort: function (appGatewayName, frontendPortName, port, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (!config) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }
    var frontendPort = utils.findFirstCaseIgnore(config.frontendPorts, {name: frontendPortName});
    if (frontendPort) {
      throw new Error(util.format($('A frontend port with name "%s" already exists for an Application Gateway "%s"'), frontendPortName, appGatewayName));
    }
    frontendPort = {
      name: frontendPortName,
      port: port
    };

    config.frontendPorts.push(frontendPort);
    self.setConfig(appGatewayName, config, _);
    self.show(appGatewayName, options, _);
  },

  removeFrontendPort: function (appGatewayName, frontendPortName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (!config) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    var index = utils.indexOfCaseIgnore(config.frontendPorts, {name: frontendPortName});
    if (index === -1) {
      throw new Error(util.format($('Frontend port with name "%s" not found for an Application Gateway "%s'), frontendPortName, appGatewayName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete a frontend port "%s?" [y/n] '), frontendPortName), _)) {
      return;
    }

    config.frontendPorts.splice(index, 1);
    self.setConfig(appGatewayName, config, _);
  },

  addHttpListener: function (appGatewayName, httpListenerName, frontendPortName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (!config) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    if (!config.httpListeners || !config.httpListeners.length) {
      config.httpListeners = [];
    }

    if (utils.findFirstCaseIgnore(config.httpListeners, {name: httpListenerName})) {
      throw new Error(util.format($('An http listener with name "%s" already exists for an Application Gateway "%s"'), httpListenerName, appGatewayName));
    }

    if (!utils.findFirstCaseIgnore(config.frontendPorts, {name: frontendPortName})) {
      throw new Error(util.format($('Frontend port with name "%s" not found for an Application Gateway "%s'), frontendPortName, appGatewayName));
    }

    var httpListener = {
      name: httpListenerName,
      protocol: 'Http',
      frontendPort: frontendPortName
    };

    if (options.frontendIpName) {
      if (!utils.findFirstCaseIgnore(config.frontendIPConfigurations, {name: options.frontendIpName})) {
        throw new Error(util.format($('Frontend ip with name "%s" not found for an Application Gateway "%s'), options.frontendIpName, appGatewayName));
      }
      httpListener.frontendIP = options.frontendIpName;
    }

    if (options.protocol) {
      if (options.protocol.toLowerCase() === 'https' && !options.sslCert) {
        throw new Error($('--ssl-cert parameter is required when "--protocol Https" parameter is specified'));
      }
      var protocol = options.protocol.toLowerCase();
      httpListener.protocol = utils.capitalizeFirstLetter(protocol);
    }

    if (options.sslCert) {
      httpListener.sslCert = options.sslCert;
    }

    config.httpListeners.push(httpListener);
    self.setConfig(appGatewayName, config, _);
    self.show(appGatewayName, options, _);
  },

  removeHttpListener: function (appGatewayName, httpListenerName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (!config) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    var index = utils.indexOfCaseIgnore(config.httpListeners, {name: httpListenerName});
    if (index === -1) {
      throw new Error(util.format($('Http listener with name "%s" not found for an Application Gateway "%s'), httpListenerName, appGatewayName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete http listener "%s?" [y/n] '), httpListenerName), _)) {
      return;
    }

    config.httpListeners.splice(index, 1);
    self.setConfig(appGatewayName, config, _);
  },

  addLoadBalancingRule: function (appGatewayName, ruleName, httpSettingsName, httpListenerName, addressPoolName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (!config) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    if (!config.httpLoadBalancingRules || !config.httpLoadBalancingRules.length) {
      config.httpLoadBalancingRules = [];
    }

    if (utils.findFirstCaseIgnore(config.httpLoadBalancingRules, {name: ruleName})) {
      throw new Error(util.format($('An http load balancing rule with name "%s" already exists for an Application Gateway "%s"'), ruleName, appGatewayName));
    }

    if (!utils.findFirstCaseIgnore(config.backendHttpSettingsList, {name: httpSettingsName})) {
      throw new Error(util.format($('Http settings with name "%s" not found for an Application Gateway "%s'), httpSettingsName, appGatewayName));
    }

    if (!utils.findFirstCaseIgnore(config.httpListeners, {name: httpListenerName})) {
      throw new Error(util.format($('Http listener with name "%s" not found for an Application Gateway "%s'), httpListenerName, appGatewayName));
    }

    if (!utils.findFirstCaseIgnore(config.backendAddressPools, {name: addressPoolName})) {
      throw new Error(util.format($('Address pool with name "%s" not found for an Application Gateway "%s'), addressPoolName, appGatewayName));
    }

    var lbRule = {
      name: ruleName,
      type: 'Basic',
      backendHttpSettings: httpSettingsName,
      listener: httpListenerName,
      backendAddressPool: addressPoolName
    };

    if (options.type) {
      lbRule.type = options.type;
    }

    config.httpLoadBalancingRules.push(lbRule);
    self.setConfig(appGatewayName, config, _);
    self.show(appGatewayName, options, _);
  },

  removeLoadBalancingRule: function (appGatewayName, ruleName, options, _) {
    var self = this;
    var config = self.getConfig(appGatewayName, _);
    if (!config) {
      throw new Error(util.format($('Application Gateway "%s" not found'), appGatewayName));
    }

    var index = utils.indexOfCaseIgnore(config.httpLoadBalancingRules, {name: ruleName});
    if (index === -1) {
      throw new Error(util.format($('An http load balancing rule with name "%s" not found for an Application Gateway "%s'), ruleName, appGatewayName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete http listener "%s?" [y/n] '), ruleName), _)) {
      return;
    }

    config.httpLoadBalancingRules.splice(index, 1);
    self.setConfig(appGatewayName, config, _);
  },

  addSsl: function (appGatewayName, certName, options, _) {
    var self = this;
    if (utils.stringIsNullOrEmpty(options.certFile)) {
      throw new Error($('--cert-file parameter must not be empty'));
    }

    if (utils.stringIsNullOrEmpty(options.password)) {
      throw new Error($('--password parameter must not be empty'));
    }

    var certificateObject = {password: options.password};

    var certFormat = path.extname(options.certFile).split('.')[1];
    certificateObject.certificateFormat = certFormat;

    var data = fs.readFileSync(options.certFile);
    certificateObject.data = data.toString('base64');

    var progress = self.interaction.progress(util.format($('Adding SSL certificate "%s" to Application Gateway "%s"'), certName, appGatewayName));
    try {
      self.networkManagementClient.applicationGateways.addCertificate(appGatewayName, certName, certificateObject, options, _);
    } finally {
      progress.end();
    }
  },

  removeSsl: function (appGatewayName, certName, options, _) {
    var self = this;
    if (!options.quiet && !self.interaction.confirm(util.format($('Remove certificate "%s" from Application Gateway "%s"? [y/n] '), certName, appGatewayName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Removing SSL certificate "%s" to Application Gateway "%s"'), certName, appGatewayName));
    try {
      self.networkManagementClient.applicationGateways.deleteCertificate(appGatewayName, certName, _);
    } finally {
      progress.end();
    }
  },

  _validateAppGatewayOptions: function (appGatewayName, vnetName, appGatewayConfig, options, useDefaults) {
    var self = this;

    appGatewayConfig.name = appGatewayName;
    appGatewayConfig.vnetName = vnetName;

    if (options.subnetNames) {
      appGatewayConfig.subnets = self._parseSubnets(options.subnetNames);
    } else if (useDefaults) {
      throw new Error($('--subnet-names parameter must be set'));
    }

    if (options.instanceCount) {
      var instanceCount = utils.parseInt(options.instanceCount);

      if (isNaN(instanceCount) || (instanceCount < 0)) {
        throw new Error($('--instance-count value must be positive integer'));
      }

      appGatewayConfig.instanceCount = instanceCount;
    } else if (useDefaults) {
      self.output.warn('--instance-count parameter is not specified, using default - ' + constants.appGateway.defaultInstanceCount);
      appGatewayConfig.instanceCount = constants.appGateway.defaultInstanceCount;
    }

    if (options.gatewaySize) {
      self._validateGatewaySize(options.gatewaySize);
      appGatewayConfig.gatewaySize = options.gatewaySize;
    } else if (useDefaults) {
      self.output.warn('--gateway-size parameter is not specified, using default - ' + constants.appGateway.sizes[0]);
      appGatewayConfig.gatewaySize = constants.appGateway.sizes[0];
    }
  },

  _validateGatewaySize: function (gatewaySize) {
    if (!utils.verifyParamExistsInCollection(constants.appGateway.sizes, gatewaySize, '--gateway-size')) {
      throw new Error(util.format($('--gateway-size must be one of the followings [%s]'), constants.appGateway.sizes));
    }
  },

  _parseSubnets: function (subnets) {
    var subnetsArray = subnets.split(',');
    for (var i = 0; i < subnetsArray.length; i++) {
      subnetsArray[i] = subnetsArray[i].trim();
    }
    return subnetsArray;
  },

  _parseDnsServers: function (options) {
    var self = this;

    var ipAddresses = options.servers.split(',');
    var dnsServers = [];

    ipAddresses.forEach(function (address) {
      var ipValidationResult = self.vnetUtil.parseIPv4(address);
      if (ipValidationResult.error) {
        var dnsValidationResult = self.vnetUtil.isValidDns(address);
        if (dnsValidationResult === false) {
          throw new Error(util.format($('Address "%s" is not valid IPv4 or DNS name'), address));
        }
      }
      var dns = {iPAddress: address};
      dnsServers.push(dns);
    });

    return dnsServers;
  },

  _parseHttpSettings: function (httpSettingsName, options, useDefaults) {
    var self = this;

    var httpSettings = {
      name: httpSettingsName
    };

    if (options.protocol) {
      var protocol = utils.verifyParamExistsInCollection(constants.appGateway.settings.protocol,
        options.protocol, 'protocol');
      httpSettings.protocol = utils.capitalizeFirstLetter(protocol);
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default protocol: %s'), constants.appGateway.settings.protocol[0]));
      httpSettings.protocol = constants.appGateway.settings.protocol[0];
    }

    if (options.port) {
      var portAsInt = utils.parseInt(options.port);
      if (isNaN(portAsInt) || portAsInt < constants.appGateway.settings.port[0] || portAsInt > constants.appGateway.settings.port[1]) {
        throw new Error(util.format($('port parameter must be an integer in range %s'),
          utils.toRange(constants.appGateway.settings.port)));
      }
      httpSettings.port = portAsInt;
    }

    if (options.cookieBasedAffinity) {
      var cookieBasedAffinity = utils.verifyParamExistsInCollection(constants.appGateway.settings.affinity,
        options.cookieBasedAffinity, 'cookie based affinity');
      httpSettings.cookieBasedAffinity = utils.capitalizeFirstLetter(cookieBasedAffinity);
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default cookie based affinity: %s'), constants.appGateway.settings.affinity[0]));
      httpSettings.cookieBasedAffinity = constants.appGateway.settings.affinity[0];
    }

    return httpSettings;
  },

  _parseFrontendIp: function (frontendIpName, options, useDefaults) {
    var self = this;

    var frontendIp = {
      name: frontendIpName
    };

    if (options.type) {
      var type = utils.verifyParamExistsInCollection(constants.appGateway.ip.type,
        options.type, 'type');
      frontendIp.type = utils.capitalizeFirstLetter(type);
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default type: %s'), constants.appGateway.ip.type[0]));
      frontendIp.type = constants.appGateway.ip.type[0];
    }

    if (options.staticIpAddress) {
      var ipValidationResult = self.vnetUtil.parseIPv4(options.staticIpAddress);
      if (ipValidationResult.error) {
        throw new Error(util.format($('IPv4 %s static ip address is not valid'), options.staticIpAddress));
      }
      frontendIp.staticIPAddress = options.staticIpAddress;
    }

    return frontendIp;
  }
});

module.exports = AppGateway;