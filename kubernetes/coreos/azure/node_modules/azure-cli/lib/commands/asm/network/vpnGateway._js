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
var util = require('util');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var constants = require('./constants');

function VpnGateway(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(VpnGateway.prototype, {

  create: function (networkName, options, _) {
    var self = this;
    var parameters = self._parseGateway(options);
    var progress = self.interaction.progress(util.format($('Creating VPN Gateway for the virtual network "%s"'), networkName));
    try {
      self.networkManagementClient.gateways.create(networkName, parameters, _);
    } finally {
      progress.end();
    }
    self.show(networkName, options, _);
  },

  show: function (networkName, options, _) {
    var self = this;
    var gateway = self.get(networkName, _);

    if (!gateway) {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('VPN Gateway not found for the virtual network "%s"'), networkName));
      }
      return;
    }

    self.interaction.formatOutput(gateway, function (gateway) {
      self.output.nameValue($('VIP Address'), gateway.vipAddress);
      self.output.nameValue($('Gateway type'), gateway.gatewayType);
      self.output.nameValue($('Gateway size'), gateway.gatewaySKU);
      self.output.nameValue($('State'), gateway.state);
      if (gateway.defaultSite) {
        self.output.nameValue($('Local network default site name'), gateway.defaultSite.name);
      }
      if (gateway.lastEvent) {
        self.output.header($('Last event'));
        self.output.nameValue($('Timestamp'), gateway.lastEvent.timestamp, 2);
        self.output.nameValue($('ID'), gateway.lastEvent.id, 2);
        self.output.nameValue($('Message'), gateway.lastEvent.message, 2);
        self.output.nameValue($('Data'), gateway.lastEvent.data, 2);
      }
    });
  },

  delete: function (networkName, options, _) {
    var self = this;
    var gateway = self.get(networkName, _);
    if (!gateway) {
      throw new Error(utils.format($('Gateway not found for the virtual network "%s"'), networkName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete VPN Gateway for the virtual network %s? [y/n] '), networkName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting VPN Gateway for the virtual network "%s"'), networkName));
    try {
      self.networkManagementClient.gateways.deleteMethod(networkName, _);
    } finally {
      progress.end();
    }
  },

  resize: function (networkName, sku, options, _) {
    var self = this;
    var gateway = self.get(networkName, _);
    if (!gateway) {
      throw new Error(utils.format($('VPN Gateway not found for the virtual network "%s"'), networkName));
    }

    options.sku = sku;
    var parameters = self._parseGateway(options);
    var progress = self.interaction.progress(util.format($('Resizing VPN Gateway for the virtual network "%s"'), networkName));
    try {
      self.networkManagementClient.gateways.resize(networkName, parameters, _);
    } finally {
      progress.end();
    }
  },

  reset: function (networkName, options, _) {
    var self = this;
    var gateway = self.get(networkName, _);
    if (!gateway) {
      throw new Error(utils.format($('VPN Gateway not found for the virtual network "%s"'), networkName));
    }

    var parameters = {
      gatewaySKU: 'Default'
    };

    var progress = self.interaction.progress(util.format($('Resetting VPN Gateway for the virtual network "%s"'), networkName));
    try {
      self.networkManagementClient.gateways.reset(networkName, parameters, _);
    } finally {
      progress.end();
    }
  },

  setDefaultSite: function (networkName, siteName, options, _) {
    var self = this;
    var gateway = self.get(networkName, _);
    if (!gateway) {
      throw new Error(utils.format($('VPN Gateway not found for the virtual network "%s"'), networkName));
    }

    var parameters = {
      defaultSite: siteName
    };

    var progress = self.interaction.progress(util.format($('Setting local network default site for the virtual network "%s"'), networkName));
    try {
      self.networkManagementClient.gateways.setDefaultSites(networkName, parameters, _);
    } finally {
      progress.end();
    }
  },

  removeDefaultSite: function (networkName, options, _) {
    var self = this;
    var gateway = self.get(networkName, _);
    if (!gateway) {
      throw new Error(utils.format($('VPN Gateway not found for the virtual network "%s"'), networkName));
    }

    var progress = self.interaction.progress(util.format($('Removing local network default site configured in a virtual network "%s"'), networkName));
    try {
      self.networkManagementClient.gateways.removeDefaultSites(networkName, _);
    } finally {
      progress.end();
    }
  },

  listConnections: function (networkName, options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting the network connections'));
    var connectionList = null;
    try {
      connectionList = self.networkManagementClient.gateways.listConnections(networkName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(connectionList.connections, function (data) {
      if (data.length === 0) {
        self.output.warn($('No VPN Gateway connections found'));
      } else {
        var indent = 0;
        self.output.header('Connections', indent, true);

        indent += 2;
        var counter = 0;
        data.forEach(function (item) {
          self.output.header(util.format($('Connection %s', counter)), indent);
          indent += 2;
          self.output.nameValue('Local network site name', item.localNetworkSiteName, indent);
          self.output.nameValue('State', item.connectivityState, indent);
          self.output.nameValue('Bytes of data transferred in', item.ingressBytesTransferred, indent);
          self.output.nameValue('Bytes of data transferred out', item.egressBytesTransferred, indent);
          self.output.nameValue('Last connection established', item.lastConnectionEstablished, indent);

          if (item.allocatedIpAddresses) {
            self.output.list('VPN Client IP Addresses', item.allocatedIpAddresses, indent);
          }

          if (item.lastEvent) {
            self.output.nameValue('Last event ID', item.lastEvent.id, indent);
            self.output.nameValue('Last event message', item.lastEvent.message, indent);
            self.output.nameValue('Last event timestamp', item.lastEvent.timestamp, indent);
          }
          indent -= 2;
          counter++;
        });
      }
    });
  },

  get: function (networkName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up network VPN Gateway in virtual network "%s"'), networkName));
    try {
      var gateway = self.networkManagementClient.gateways.get(networkName, _);
      return gateway;
    } catch (e) {
      if (e.statusCode === 400) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  setSharedKey: function (vnetName, keyValue, options, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Setting up shared key for vnet "%s"'), vnetName));
    self._validateDefaultSite(vnetName, options, _);

    options.value = keyValue;
    try {
      self.networkManagementClient.gateways.setSharedKey(vnetName, options.siteName, options, _);
    } finally {
      progress.end();
    }
  },

  resetSharedKey: function (vnetName, keyLength, options, _) {
    var self = this;
    options.keyLength = keyLength;

    self._validateDefaultSite(vnetName, options, _);

    var progress = self.interaction.progress(util.format($('Resetting shared key for vnet "%s"'), vnetName));
    try {
      self.networkManagementClient.gateways.resetSharedKey(vnetName, options.siteName, options, _);
    } finally {
      progress.end();
    }
  },

  listDevices: function (options, _) {
    var self = this;
    var progress = self.interaction.progress($('Listing VPN devices'));
    var devices = null;
    try {
      devices = self.networkManagementClient.gateways.listSupportedDevices(_);
    } finally {
      progress.end();
    }

    // creating array for proper results output
    var devicesArray = [];
    devices.vendors.forEach(function (item) {
      item.platforms.forEach(function (platform) {
        platform.oSFamilies.forEach(function (os) {
          devicesArray.push({name: item.name, platform: platform.name, os: os.name});
        });
      });
    });

    self.interaction.formatOutput(devicesArray, function (data) {
      self.output.table(data, function (row, device) {
        row.cell($('Vendor'), device.name);
        row.cell($('Platform'), device.platform);
        row.cell($('OS Family'), device.os);
      });
    });
  },

  getDeviceScript: function (vnetName, options, _) {
    var self = this;
    options.oSFamily = options.osFamily;

    var progress = self.interaction.progress($('Getting script for VPN device'));
    var script = null;
    try {
      script = self.networkManagementClient.gateways.getDeviceConfigurationScript(vnetName, options, _);
    } finally {
      progress.end();
    }

    self.output.log(script);
  },

  startDiagnosticsSession: function (vnetName, options, _) {
    var self = this;
    options.captureDurationInSeconds = options.duration;
    options.customerStorageKey = options.storageAccountKey;
    options.customerStorageName = options.storageAccountName;

    var progress = self.interaction.progress(util.format($('Starting diagnostics session in a virtual network "%s"'), vnetName));
    var session;
    try {
      session = self.networkManagementClient.gateways.startDiagnostics(vnetName, options, _);
    } finally {
      progress.end();
    }
  },

  stopDiagnosticsSession: function (vnetName, options, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Stopping diagnostics session in a virtual network "%s"'), vnetName));
    options.operation = 'StopDiagnostics';
    var session;
    try {
      session = self.networkManagementClient.gateways.stopDiagnostics(vnetName, options, _);
    } finally {
      progress.end();
    }
  },

  getDiagnosticsSession: function (vnetName, options, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Getting diagnostics session in a virtual network "%s"'), vnetName));
    var session;
    try {
      session = self.networkManagementClient.gateways.getDiagnostics(vnetName, _);
    } finally {
      progress.end();
    }

    if (!session) {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('VPN Gateway not found for the virtual network "%s"'), networkName));
      }
      return;
    }

    self.interaction.formatOutput(session, function (session) {
      self.output.nameValue('Diagnostics URL', session.diagnosticsUrl);
    });
  },

  _validateDefaultSite: function (vnetName, options, _) {
    var self = this;
    if (!options.siteName) {
      var gateway = self.get(vnetName, _);
      if (!gateway) {
        throw new Error(util.format($('VPN Gateway not found for virtual network "%s"'), vnetName));
      } else {
        if (!gateway.defaultSite.name) {
          throw new Error(util.format($('Default local network site is not set for virtual network "%s"'), vnetName));
        }

        options.siteName = gateway.defaultSite.name;
      }
    }
  },

  _parseGateway: function (options) {
    var gateway = {};

    if (options.type) {
      gateway.gatewayType = utils.verifyParamExistsInCollection(constants.vpnGateway.type,
        options.type, 'type');
    }
    if (options.sku) {
      gateway.gatewaySKU = utils.verifyParamExistsInCollection(constants.vpnGateway.sku,
        options.sku, 'sku');
    }
    return gateway;
  }
});

module.exports = VpnGateway;