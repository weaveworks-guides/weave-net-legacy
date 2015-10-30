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
var constants = require('../../arm/network/constants');
var NetworkConfig = require('./networkConfig');
var Nsg = require('./nsg');

function Subnet(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.networkConfig = new NetworkConfig(cli, networkManagementClient);
  this.nsgCrud = new Nsg(cli, networkManagementClient);
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(Subnet.prototype, {
  create: function (vnetName, subnetName, options, _) {
    var self = this;
    var networkConfiguration = self.networkConfig.get(_);
    var vNetList = networkConfiguration.VirtualNetworkConfiguration.VirtualNetworkSites;
    var vNet = utils.findFirstCaseIgnore(vNetList, {Name: vnetName});
    if (!vNet) {
      throw new Error(util.format($('A virtual network with name "%s" not found'), vnetName));
    }
    if (!vNet.Subnets) {
      vNet.Subnets = [];
    }

    var subnetsList = vNet.Subnets;
    var subnet = utils.findFirstCaseIgnore(subnetsList, {Name: subnetName});
    if (subnet) {
      throw new Error(util.format($('A subnet with name "%s" already exists in the virtual network"%s"'), subnetName, vnetName));
    }

    if (options.networkSecurityGroupName) {
      var nsg = self.nsgCrud.get(options.networkSecurityGroupName, constants.NSG_DEFAULT_DETAIL_LEVEL, _);
      if (!nsg) {
        throw new Error(util.format($('A network security group with name "%s" not found'), options.networkSecurityGroupName));
      }
    }

    var subnetInput = {
      'Name': subnetName,
      'AddressPrefix': options.addressPrefix
    };

    subnetsList.push(subnetInput);
    var progress = self.interaction.progress(util.format($('Creating subnet "%s"'), subnetName));
    try {
      self.networkConfig.set(networkConfiguration, _);
      if (options.networkSecurityGroupName) {
        self.addNsg(options.networkSecurityGroupName, vnetName, subnetName, options, _);
      }
    } finally {
      progress.end();
    }
    self.show(vnetName, subnetName, options, _);
  },

  set: function (vnetName, subnetName, options, _) {
    var self = this;
    var networkConfiguration = self.networkConfig.get(_);
    var vNetList = networkConfiguration.VirtualNetworkConfiguration.VirtualNetworkSites;
    var vNet = utils.findFirstCaseIgnore(vNetList, {Name: vnetName});
    if (!vNet) {
      throw new Error(util.format($('A virtual network with name "%s" not found'), vnetName));
    }

    var subnetList = vNet.Subnets;
    var subnet = utils.findFirstCaseIgnore(subnetList, {Name: subnetName});
    if (!subnet) {
      throw new Error(util.format($('A virtual network "%s" does not contain a subnet with name "%s"'), vnetName, subnetName));
    }

    if (options.addressPrefix) {
      subnet.AddressPrefix = options.addressPrefix;
    }

    var progress = self.interaction.progress(util.format($('Updating subnet "%s"'), subnetName));
    try {
      self.networkConfig.set(networkConfiguration, _);
    } finally {
      progress.end();
    }
    self.show(vnetName, subnetName, options, _);
  },

  list: function (vnetName, options, _) {
    var self = this;
    var vNetList = self._getNetworkSites(options, _);

    var vnet = utils.findFirstCaseIgnore(vNetList, {Name: vnetName});
    if (vnet) {
      self.interaction.formatOutput(vnet.Subnets, function (data) {
        if (!data || data.length === 0) {
          throw new Error($('No virtual network subnets found'));
        } else {
          self.output.table(data, function (row, item) {
            row.cell($('Name'), item.Name);
            row.cell($('Address prefix'), item.AddressPrefix);
          });
        }
      });
    } else {
      self.output.warn(util.format($('Virtual network with name "%s" not found'), vnetName));
    }
  },

  get: function (vnetName, subnetName, options, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the subnet "%s"'), subnetName));
    try {
      var vNetList = self._getNetworkSites(options, _);
      var vnet = utils.findFirstCaseIgnore(vNetList, {Name: vnetName});
      if (!vnet) {
        self.output.warn(util.format($('Virtual network with name "%s" not found'), vnetName));
        return;
      }

      var subnetList = vnet.Subnets;
      if (!subnetList || subnetList.length === 0) {
        throw new Error($('Virtual network has no subnets'));
      }
      return utils.findFirstCaseIgnore(subnetList, {Name: subnetName});
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  show: function (vnetName, subnetName, options, _) {
    var self = this;
    var subnet = self.get(vnetName, subnetName, options, _);

    self.interaction.formatOutput(subnet, function (subnet) {
      if (subnet) {
        self.output.nameValue($('Name'), subnet.Name);
        self.output.nameValue($('Address prefix'), subnet.AddressPrefix);
      } else {
        if (self.output.format().json) {
          self.output.json({});
        } else {
          self.output.warn(util.format($('A virtual network subnet with name "%s" not found'), subnetName));
        }
      }
    });
  },

  delete: function (vnetName, subnetName, options, _) {
    var self = this;
    var networkConfiguration = self.networkConfig.get(_);

    var vnet = utils.findFirstCaseIgnore(networkConfiguration.VirtualNetworkConfiguration.VirtualNetworkSites, {Name: vnetName});
    if (!vnet) {
      throw new Error(util.format($('A virtual network with name "%s" not found'), vnetName));
    }

    var index = utils.indexOfCaseIgnore(vnet.Subnets, {Name: subnetName});
    if (index === -1) {
      throw new Error(util.format($('Virtual network subnet with name "%s" not found in virtual network "%s"'), subnetName, vnetName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete the virtual network subnet "%s" ? [y/n] '), subnetName), _)) {
      return;
    }

    vnet.Subnets.splice(index, 1);
    self.networkConfig.set(networkConfiguration, _);
  },

  addNsg: function (nsgName, vnetName, subnetName, options, _) {
    var self = this;
    var nsg = self.nsgCrud.get(nsgName, constants.NSG_DEFAULT_DETAIL_LEVEL, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found'), nsgName));
    }

    var subnet = self.get(vnetName, subnetName, options, _);
    if (!subnet) {
      throw new Error(util.format($('A subnet with name "%s" was not found in virtual network "%s"'), subnetName, vnetName));
    }

    var parameters = {
      name: nsgName
    };

    var progress = self.interaction.progress(util.format($('Creating a network security group "%s"'), nsgName));
    try {
      self.networkManagementClient.networkSecurityGroups.addToSubnet(vnetName, subnetName, parameters, _);
    } finally {
      progress.end();
    }
  },

  removeNsg: function (nsgName, vnetName, subnetName, options, _) {
    var self = this;
    var nsg = self.nsgCrud.get(nsgName, constants.NSG_DEFAULT_DETAIL_LEVEL, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found'), nsgName));
    }

    var subnet = self.get(vnetName, subnetName, options, _);
    if (!subnet) {
      throw new Error(util.format($('A subnet with name "%s" was not found in virtual network "%s"'), subnetName, vnetName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete nsg "%s" and subnet "%s" association? [y/n] '), nsgName, subnetName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Creating a network security group "%s"'), nsgName));
    try {
      self.networkManagementClient.networkSecurityGroups.removeFromSubnet(vnetName, subnetName, nsgName, _);
    } finally {
      progress.end();
    }
  },

  _getNetworkSites: function (options, _) {
    var self = this;
    var networkConfiguration = self.networkConfig.get(_);
    if (!networkConfiguration.VirtualNetworkConfiguration) {
      networkConfiguration.VirtualNetworkConfiguration = {};
    }
    return networkConfiguration.VirtualNetworkConfiguration.VirtualNetworkSites;
  }
});

module.exports = Subnet;
