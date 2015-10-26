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
var vnetShowUtil = require('./vnetShowUtil');
var VNetUtil = require('../../../util/vnet.util');
var Nsg = require('./nsg');
var RouteTable = require('./routeTable');

function Subnet(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.nsgCrud = new Nsg(cli, networkResourceProviderClient);
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
  this.routeTableCrud = new RouteTable(cli, networkResourceProviderClient);
}

__.extend(Subnet.prototype, {
  create: function (resourceGroupName, vnetName, name, options, _) {
    var self = this;
    var subnet = self.get(resourceGroupName, vnetName, name, _);

    if (subnet) {
      throw new Error(util.format($('A subnet with name "%s" already exists in the resource group "%s"'), name, resourceGroupName));
    }

    var subnetProfile = self._parseSubnet(resourceGroupName, vnetName, options, true, _);
    var progress = self.interaction.progress(util.format($('Creating subnet "%s"'), name));

    try {
      self.networkResourceProviderClient.subnets.createOrUpdate(resourceGroupName, vnetName, name, subnetProfile, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, vnetName, name, options, _);
  },

  set: function (resourceGroupName, vnetName, name, options, _) {
    var self = this;
    var subnet = self.get(resourceGroupName, vnetName, name, _);

    if (!subnet) {
      throw new Error(util.format($('A subnet with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    var subnetProfile = self._parseSubnet(resourceGroupName, vnetName, options, false, _);

    if (options.addressPrefix) {
      subnet.addressPrefix = subnetProfile.addressPrefix;
    }

    if (options.networkSecurityGroupId || options.networkSecurityGroupName) {
      subnet.networkSecurityGroup = subnetProfile.networkSecurityGroup;
    }

    if (options.routeTableId || options.routeTableName) {
      subnet.routeTable = subnetProfile.routeTable;
    }

    var progress = self.interaction.progress(util.format($('Setting subnet "%s"'), name));
    try {
      self.networkResourceProviderClient.subnets.createOrUpdate(resourceGroupName, vnetName, name, subnet, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, vnetName, name, options, _);
  },

  list: function (resourceGroupName, vnetName, options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting virtual network subnets '));

    var subnets = null;
    try {
      subnets = self.networkResourceProviderClient.subnets.list(resourceGroupName, vnetName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(subnets.subnets, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn($('No subnets found'));
      } else {
        self.output.table(outputData, function (row, subnet) {
          row.cell($('Name'), subnet.name);
          row.cell($('Address prefix'), subnet.addressPrefix);
        });
      }
    });
  },

  show: function (resourceGroupName, vnetName, name, options, _) {
    var self = this;
    var subnet = self.get(resourceGroupName, vnetName, name, _);

    self.interaction.formatOutput(subnet, function (subnet) {
      if (subnet === null) {
        self.output.warn(util.format($('A subnet with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
      } else {
        vnetShowUtil.showSubnet(subnet, self.output);
      }
    });
  },

  get: function (resourceGroupName, vnetName, subnetName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the subnet "%s"'), subnetName));
    try {
      var subnet = self.networkResourceProviderClient.subnets.get(resourceGroupName, vnetName, subnetName, _);
      return subnet.subnet;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  delete: function (resourceGroupName, vnetName, name, options, _) {
    var self = this;
    var subnet = self.get(resourceGroupName, vnetName, name, _);

    if (!subnet) {
      throw new Error(util.format($('A subnet with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete subnet "%s"? [y/n] '), name), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting subnet "%s"'), name));
    try {
      self.networkResourceProviderClient.subnets.deleteMethod(resourceGroupName, vnetName, name, _);
    } finally {
      progress.end();
    }
  },

  _parseSubnet: function (resourceGroupName, vnetName, options, useDefaultSubnetCidr, _) {
    var self = this;

    var vnet = self.networkResourceProviderClient.virtualNetworks.get(resourceGroupName, vnetName, _);
    if (!vnet) {
      throw new Error(util.format($('Virtual network "%s" not found in resource group "%s"'), vnetName, resourceGroupName));
    }

    var addressSpace;
    if (options.addressPrefix) {
      self._validateAddressPrefix(options.addressPrefix);
      addressSpace = options.addressPrefix;
    }

    if (!addressSpace && useDefaultSubnetCidr) {
      var vnetAddressPrefix = vnet.virtualNetwork.addressSpace.addressPrefixes[0];
      if (!vnetAddressPrefix) {
        throw new Error(util.format($('Virtual network "%s" does not contain any address prefix'), vnetName));
      }
      addressSpace = vnetAddressPrefix.split('/')[0];
      addressSpace = addressSpace + '/' + self.vnetUtil.getDefaultSubnetCIDRFromAddressSpaceCIDR(parseInt(vnetAddressPrefix.split('/')[1]));

      self.output.warn(util.format($('using default address space %s'), addressSpace));
    }

    var parameters = {
      addressPrefix: addressSpace
    };

    if (options.networkSecurityGroupId) {
      if (options.networkSecurityGroupName) {
        self.output.warn($('--network-security-group-name parameter will be ignored because --network-security-group-id and --network-security-group-name parameters are mutually exclusive'));
      }
      if (options.networkSecurityGroupId !== true && options.networkSecurityGroupId !== '\'\'') {
        parameters.networkSecurityGroup = {
          id: options.networkSecurityGroupId
        };
      }
    } else if (options.networkSecurityGroupName) {
      if (utils.stringIsNullOrEmpty(options.networkSecurityGroupName)) {
        throw new Error($('A network security group name must not be null or empty string'));
      }

      var nsg = self.nsgCrud.get(resourceGroupName, options.networkSecurityGroupName, _);
      if (!nsg) {
        throw new Error(util.format($('A network security group with name "%s" not found in the resource group "%s"'),
          options.networkSecurityGroupName, resourceGroupName));
      }

      parameters.networkSecurityGroup = {
        id: nsg.id
      };
    }

    if (options.routeTableId) {
      if (options.routeTableName) {
        output.warn($('--route-table-name parameter will be ignored because --route-table-id and --route-table-name parameters are mutually exclusive'));
      }
      if (options.routeTableId !== true && options.routeTableId !== '\'\'') {
        parameters.routeTable = {
          id: options.routeTableId
        };
      }
    } else if (options.routeTableName) {
      if (utils.stringIsNullOrEmpty(options.routeTableName)) {
        throw new Error($('A route table name must not be null or empty string'));
      }

      var routeTable = self.routeTableCrud.get(resourceGroupName, options.routeTableName, _);
      if (!routeTable) {
        throw new Error(util.format($('A route table with name "%s" not found in the resource group "%s"'),
          options.routeTableName, resourceGroupName));
      }

      parameters.routeTable = {
        id: routeTable.id
      };
    }

    return parameters;
  },

  _validateAddressPrefix: function (addressPrefix) {
    var self = this;

    if (utils.stringIsNullOrEmpty(addressPrefix)) {
      throw new Error($('address prefix parameter must not be null or empty string'));
    }

    var ipValidationResult = self.vnetUtil.parseIPv4Cidr(addressPrefix);
    if (ipValidationResult.error) {
      throw new Error($(ipValidationResult.error));
    }
    if (ipValidationResult.cidr === null) {
      throw new Error($('The --address-prefix must be in cidr format (---.---.---.---/cidr)'));
    }
  }
});

module.exports = Subnet;
