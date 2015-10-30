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
var tagUtils = require('../tag/tagUtils');
var resourceUtils = require('../resource/resourceUtils');
var VNetUtil = require('../../../util/vnet.util');
var PublicIp = require('./publicIp');
var Subnet = require('./subnet');

function VirtualNetworkGateway(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.publicIpCrud = new PublicIp(cli, networkResourceProviderClient);
  this.subnetCrud = new Subnet(cli, networkResourceProviderClient);
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(VirtualNetworkGateway.prototype, {
  create: function (resourceGroupName, name, options, _) {
    var self = this;
    self._validate(options);

    var parameters = self._parse(resourceGroupName, name, options, _);

    var gateway = self.get(resourceGroupName, name, _);
    if (gateway) {
      throw new Error(util.format($('A virtual network gateway with name "%s" already exists in the resource group "%s"'), name, resourceGroupName));
    }

    self._createOrUpdate(resourceGroupName, name, parameters, true, _);
    self.show(resourceGroupName, name, options, _);
  },

  set: function (resourceGroupName, name, options, _) {
    var self = this;
    self._validate(options);

    var gateway = self.get(resourceGroupName, name, _);
    if (!gateway) {
      throw new Error(util.format($('A virtual network gateway with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    var parameters = self._parse(resourceGroupName, name, options, _, gateway);

    self._createOrUpdate(resourceGroupName, name, parameters, false, _);
    self.show(resourceGroupName, name, options, _);
  },

  list: function (resourceGroupName, options, _) {
    var self = this;
    var gateways = null;

    var progress = self.interaction.progress($('Looking up virtual network gateways'));
    try {
      gateways = self.networkResourceProviderClient.virtualNetworkGateways.list(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(gateways.virtualNetworkGateways, function (data) {
      if (data.length === 0) {
        self.output.warn($('No virtual network gateways found'));
      } else {
        self.output.table(data, function (row, gateway) {
          row.cell($('Name'), gateway.name);
          row.cell($('Location'), gateway.location);
          row.cell($('VPN type'), gateway.vpnType);
          row.cell($('Enable BGP'), gateway.enableBgp);
          row.cell($('Private IP allocation'), gateway.ipConfigurations[0].privateIpAllocationMethod);
          row.cell($('Private IP address'), gateway.ipConfigurations[0].privateIpAddress || '');
        });
      }
    });
  },

  show: function (resourceGroupName, name, options, _) {
    var self = this;
    var gateway = self.get(resourceGroupName, name, _);

    self.interaction.formatOutput(gateway, function (gateway) {
      if (gateway !== null) {
        var resourceInformation = resourceUtils.getResourceInformation(gateway.id);
        self.output.nameValue($('Id'), gateway.id);
        self.output.nameValue($('Name'), resourceInformation.resourceName || gateway.name);
        self.output.nameValue($('Type'), resourceInformation.resourceType || gateway.type);
        self.output.nameValue($('Location'), gateway.location);
        self.output.nameValue($('Tags'), tagUtils.getTagsInfo(gateway.tags));
        self.output.nameValue($('Provisioning state'), gateway.provisioningState);
        self.output.nameValue($('VPN type'), gateway.vpnType);
        self.output.nameValue($('Enable BGP'), gateway.enableBgp);

        self.output.header($('IP configurations'));
        gateway.ipConfigurations.forEach(function (ipConfig) {
          self.output.nameValue($('Id'), ipConfig.id, 2);
          self.output.nameValue($('Name'), ipConfig.name, 2);
          self.output.nameValue($('Provisioning state'), ipConfig.provisioningState, 2);
          self.output.nameValue($('Private IP allocation method'), ipConfig.privateIpAllocationMethod, 2);
          self.output.nameValue($('Private IP address'), ipConfig.privateIpAddress, 2);
          self.output.nameValue($('Public IP id'), ipConfig.publicIpAddress.id, 2);
          self.output.nameValue($('Subnet id'), ipConfig.subnet.id, 2);
          self.output.data('');
        });
      } else {
        self.output.warn(util.format($('Virtual network gateway "%s" not found in the resource group "%s"'), name, resourceGroupName));
      }
    });
  },

  delete: function (resourceGroupName, name, options, _) {
    var self = this;

    var gateway = self.get(resourceGroupName, name, _);
    if (!gateway) {
      throw new Error(util.format($('Virtual network gateway "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete virtual network gateway "%s"? [y/n] '), name), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting virtual network gateway "%s"'), name));
    try {
      self.networkResourceProviderClient.virtualNetworkGateways.deleteMethod(resourceGroupName, name, _);
    } finally {
      progress.end();
    }
  },

  get: function (resourceGroupName, name, _) {
    var self = this;
    var gateway;
    var progress = self.interaction.progress(util.format($('Looking up virtual network gateway "%s"'), name));
    try {
      gateway = self.networkResourceProviderClient.virtualNetworkGateways.get(resourceGroupName, name, _);
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      } else {
        throw e;
      }
    } finally {
      progress.end();
    }
    return gateway.virtualNetworkGateway;
  },

  _createOrUpdate: function (resourceGroupName, name, parameters, isCreating, _) {
    var self = this;
    var action = isCreating ? 'Creating' : 'Updating';
    var progress = self.interaction.progress(util.format($('%s virtual network gateway "%s"'), action, name));
    try {
      self.networkResourceProviderClient.virtualNetworkGateways.createOrUpdate(resourceGroupName, name, parameters, _);
    } finally {
      progress.end();
    }
  },

  _validate: function (options) {
    var self = this;

    if (options.type) {
      utils.verifyParamExistsInCollection(constants.vpnGateway.type, options.type, '--type');
    }

    if (options.privateIpAddress) {
      var ipValidationResult = self.vnetUtil.parseIPv4(options.privateIpAddress);
      if (ipValidationResult.error) {
        throw new Error($('--private-ip-address parameter is in invalid format'));
      }
    }

    if (options.enableBgp) {
      utils.verifyParamExistsInCollection(['true', 'false'], options.enableBgp, '--enable-bgp');
    }
  },

  _parse: function (resourceGroupName, name, options, _, gateway) {
    var self = this;

    var parameters = {
      gatewayType: 'Vpn',
      vpnType: constants.vpnGateway.type[0],
      enableBgp: 'true',
      location: '',
      tags: {},
      ipConfigurations: [
        {
          name: 'ip-config',
          privateIpAllocationMethod: 'Static',
          privateIpAddress: '',
          publicIpAddress: {
            id: ''
          },
          subnet: {
            id: ''
          }
        }
      ]
    };

    if (gateway) parameters = gateway;

    if (options.type) {
      parameters.vpnType = options.type;
    }

    if (options.enableBgp) {
      parameters.enableBgp = options.enableBgp;
    }

    if (options.privateIpAddress) {
      parameters.ipConfigurations[0].privateIpAddress = options.privateIpAddress;
    }

    if (options.location) {
      parameters.location = options.location;
    }

    if (options.tags) {
      var tags = tagUtils.buildTagsParameter(null, options);
      tagUtils.appendTags(parameters, tags);
    }

    if (options.tags === false) {
      gateway.tags = {};
    }

    if (options.publicIpId) {
      if (options.publicIpName) {
        self.output.warn($('--public-ip-name parameter will be ignored because --public-ip-id and --public-ip-name are mutually exclusive'));
      }
      parameters.ipConfigurations[0].publicIpAddress.id = options.publicIpId;
    } else {
      if (options.publicIpName) {
        var publicip = self.publicIpCrud.get(resourceGroupName, options.publicIpName, _);
        if (!publicip) {
          throw new Error(util.format($('A public ip with name "%s" not found in the resource group "%s"'), options.publicIpName, resourceGroupName));
        }
        parameters.ipConfigurations[0].publicIpAddress.id = publicip.id;
      }
    }

    if (options.subnetId) {
      if (options.vnetName || options.subnetName) {
        self.output.warn($('--vnet-name, --subnet-name parameters will be ignored because --subnet-id and --vnet-name, --subnet-name are mutually exclusive'));
      }
      parameters.ipConfigurations[0].subnet.id = options.subnetId;
    } else {
      if (options.vnetName && options.subnetName) {
        var subnet = self.subnetCrud.get(resourceGroupName, options.vnetName, options.subnetName, _);
        if (!subnet) {
          throw new Error(util.format($('A subnet with name "%s" not found in the resource group "%s"'), options.subnetName, resourceGroupName));
        }
        parameters.ipConfigurations[0].subnet.id = subnet.id;
      }
    }

    return parameters;
  }

});

module.exports = VirtualNetworkGateway;