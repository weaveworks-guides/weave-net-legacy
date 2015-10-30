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
var resourceUtils = require('../resource/resourceUtils');
var tagUtils = require('../tag/tagUtils');
var Subnet = require('./subnet');
var LoadBalancer = require('./loadBalancer');
var Nsg = require('./nsg');
var PublicIp = require('./publicIp');
var VNetUtil = require('../../../util/vnet.util');

function Nic(cli, serviceClients) {
  this.networkResourceProviderClient = serviceClients.networkResourceProviderClient;
  this.subnetCrud = new Subnet(cli, serviceClients.networkResourceProviderClient);
  this.loadBalancerCrud = new LoadBalancer(cli, serviceClients.networkResourceProviderClient);
  this.nsgCrud = new Nsg(cli, serviceClients.networkResourceProviderClient);
  this.publicIpCrud = new PublicIp(cli, serviceClients.networkResourceProviderClient);
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(Nic.prototype, {
  create: function (resourceGroupName, nicName, options, _) {
    var self = this;
    if (options.subnetId || (options.subnetName && options.subnetVnetName)) {
      var nic = self.get(resourceGroupName, nicName, _);
      if (nic) {
        throw new Error(util.format($('A network interface with name "%s" already exists in the resource group "%s"'), nicName, resourceGroupName));
      }

      var nicProfile = self._parseNic(resourceGroupName, nicName, options, _);
      var progress = self.interaction.progress(util.format($('Creating network interface "%s"'), nicName));
      try {
        self.networkResourceProviderClient.networkInterfaces.createOrUpdate(resourceGroupName, nicName, nicProfile, _);
      } finally {
        progress.end();
      }
      self.show(resourceGroupName, nicName, options, _);
    } else {
      throw new Error($('--subnet-id or --subnet-name, --subnet-vnet-name parameters must be provided'));
    }
  },

  set: function (resourceGroupName, nicName, options, _) {
    var self = this;
    var nic = self.get(resourceGroupName, nicName, _);
    if (!nic) {
      throw new Error(util.format($('A network interface with name "%s" not found in the resource group "%s"'), nicName, resourceGroupName));
    }

    var nicProfile = self._parseNic(resourceGroupName, nicName, options, _);

    if (options.privateIpAddress) {
      nic.ipConfigurations[0].privateIpAddress = options.privateIpAddress;
      nic.ipConfigurations[0].privateIpAllocationMethod = 'Static';
    }

    if (options.subnetId || (options.subnetName && options.subnetVnetName)) {
      nic.ipConfigurations[0].subnet = nicProfile.ipConfigurations[0].subnet;
    }

    var optionalNsgId = utils.getOptionalArg(options.networkSecurityGroupId);
    if (optionalNsgId.hasValue) {
      if (optionalNsgId.value !== null) {
        nic.networkSecurityGroup = nicProfile.networkSecurityGroup;
      } else {
        delete nic.networkSecurityGroup;
      }
    } else if (options.networkSecurityGroupName) {
      nic.networkSecurityGroup = nicProfile.networkSecurityGroup;
    }

    var optionalPublicipId = utils.getOptionalArg(options.publicIpId);
    if (optionalPublicipId.hasValue) {
      if (optionalPublicipId.value !== null) {
        nic.ipConfigurations[0].publicIpAddress = nicProfile.ipConfigurations[0].publicIpAddress;
      } else {
        delete nic.ipConfigurations[0].publicIpAddress;
      }
    } else if (options.publicIpName) {
      nic.ipConfigurations[0].publicIpAddress = nicProfile.ipConfigurations[0].publicIpAddress;
    }

    if (nicProfile.ipConfigurations && nicProfile.ipConfigurations.length > 0) {
      var ipConfig = nicProfile.ipConfigurations[0];
      if (ipConfig.loadBalancerBackendAddressPools) {
        nic.ipConfigurations[0].loadBalancerBackendAddressPools = ipConfig.loadBalancerBackendAddressPools;
      }

      if (ipConfig.loadBalancerInboundNatRules) {
        nic.ipConfigurations[0].loadBalancerInboundNatRules = ipConfig.loadBalancerInboundNatRules;
      }
    }

    var internalDnsNameLabel = utils.getOptionalArg(options.internalDnsNameLabel);
    if (internalDnsNameLabel.hasValue) {
      if (internalDnsNameLabel.value !== null) {
        nic.dnsSettings.internalDnsNameLabel = nicProfile.dnsSettings.internalDnsNameLabel;
      } else {
        delete nic.dnsSettings.internalDnsNameLabel;
      }
    }

    if (options.enableIpForwarding) {
      nic.enableIPForwarding = nicProfile.enableIPForwarding;
    }

    if (options.tags) {
      tagUtils.appendTags(nic, nicProfile.tags);
    }

    if (options.tags === false) {
      nic.tags = {};
    }

    self.update(resourceGroupName, nicName, nic, _);
    self.show(resourceGroupName, nicName, options, _);
  },

  list: function (resourceGroupName, options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting the network interfaces'));

    var nics = null;
    try {
      if (options.virtualMachineScaleSet) {
        nics = self.networkResourceProviderClient.networkInterfaces.listVirtualMachineScaleSetNetworkInterfaces(resourceGroupName, options.virtualMachineScaleSet, _);
      } else {
        nics = self.networkResourceProviderClient.networkInterfaces.list(resourceGroupName, _);
      }
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(nics.networkInterfaces, function (data) {
      if (data.length === 0) {
        self.output.warn($('No network interfaces found'));
      } else {
        self.output.table(data, function (row, nic) {
          row.cell($('Name'), nic.name);
          row.cell($('Location'), nic.location || '');
          row.cell($('MAC Address'), nic.macAddress || '');
          row.cell($('Internal DNS name'), nic.dnsSettings.internalDnsNameLabel || '');
          row.cell($('Internal FQDN'), nic.dnsSettings.internalFqdn || '');
          row.cell($('Enable IP forwarding'), nic.enableIPForwarding || false);
        });
      }
    });
  },

  show: function (resourceGroupName, nicName, options, _) {
    var self = this;
    var nic = null;

    if (options.virtualMachineScaleSet || options.virtualMachineIndex) {
      if (!(options.virtualMachineScaleSet && options.virtualMachineIndex)) {
        throw new Error(util.format($('--virtual-machine-scale-set and --virtual-machine-index must be specified')));
      }
      nic = self.getFromVMSS(resourceGroupName, options.virtualMachineScaleSet, options.virtualMachineIndex, nicName, _);
    } else {
      nic = self.get(resourceGroupName, nicName, _);
    }

    self.interaction.formatOutput(nic, function (nic) {
      if (nic === null) {
        self.output.warn(util.format($('A network interface with name "%s" not found in the resource group "%s"'), nicName, resourceGroupName));
      } else {
        var resourceInfo = resourceUtils.getResourceInformation(nic.id);
        self.output.nameValue($('Id'), nic.id);
        self.output.nameValue($('Name'), nic.name);
        self.output.nameValue($('Type'), resourceInfo.resourceType);
        self.output.nameValue($('Location'), nic.location);
        self.output.nameValue($('Provisioning state'), nic.provisioningState);
        self.output.nameValue($('MAC address'), nic.macAddress);
        self.output.nameValue($('Internal DNS name label'), nic.dnsSettings.internalDnsNameLabel);
        self.output.nameValue($('Internal FQDN'), nic.dnsSettings.internalFqdn);
        self.output.nameValue($('Enable IP forwarding'), nic.enableIPForwarding);
        self.output.nameValue($('Tags'), tagUtils.getTagsInfo(nic.tags));
        if (nic.networkSecurityGroup) {
          self.output.nameValue($('Network security group'), nic.networkSecurityGroup.id);
        }
        if (nic.virtualMachine) {
          self.output.nameValue($('Virtual machine'), nic.virtualMachine.id);
        }

        self.output.header($('IP configurations'));
        nic.ipConfigurations.forEach(function (config) {
          self.output.nameValue($('Name'), config.name, 2);
          self.output.nameValue($('Provisioning state'), config.provisioningState, 2);
          if (config.publicIpAddress) {
            self.output.nameValue($('Public IP address'), config.publicIpAddress.id, 2);
          }
          self.output.nameValue($('Private IP address'), config.privateIpAddress, 2);
          self.output.nameValue($('Private IP Allocation Method'), config.privateIpAllocationMethod, 2);
          self.output.nameValue($('Subnet'), config.subnet.id, 2);

          if (config.loadBalancerBackendAddressPools.length > 0) {
            self.output.header($('Load balancer backend address pools'), 2);
            config.loadBalancerBackendAddressPools.forEach(function (pool) {
              self.output.nameValue($('Id'), pool.id, 4);
            });
          }

          if (config.loadBalancerInboundNatRules.length > 0) {
            self.output.header($('Load balancer inbound NAT rules'), 2);
            config.loadBalancerInboundNatRules.forEach(function (rule) {
              self.output.nameValue($('Id'), rule.id, 4);
            });
          }

          self.output.data($(''), '');
        });
      }
    });
  },

  get: function (resourceGroupName, nicName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the network interface "%s"'), nicName));
    try {
      var nic = self.networkResourceProviderClient.networkInterfaces.get(resourceGroupName, nicName, _);
      return nic.networkInterface;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  getFromVMSS: function (resourceGroupName, vmssName, vmssIndex, nicName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the network interface "%s" in scale set "%s"'), nicName, vmssName));
    try {
      var nic = self.networkResourceProviderClient.networkInterfaces.getVirtualMachineScaleSetNetworkInterface(resourceGroupName, vmssName, vmssIndex, nicName, _);
      return nic.networkInterface;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  delete: function (resourceGroupName, nicName, options, _) {
    var self = this;
    var nic = self.get(resourceGroupName, nicName, _);

    if (!nic) {
      throw new Error(util.format($('A network interface with name "%s" not found in the resource group "%s"'), nicName, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete network interface "%s"? [y/n] '), nicName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting network interface "%s"'), nicName));
    try {
      self.networkResourceProviderClient.networkInterfaces.deleteMethod(resourceGroupName, nicName, _);
    } finally {
      progress.end();
    }
  },

  update: function (resourceGroupName, nicName, nicProfile, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Updating network interface "%s"'), nicName));
    try {
      self.networkResourceProviderClient.networkInterfaces.createOrUpdate(resourceGroupName, nicName, nicProfile, _);
    } finally {
      progress.end();
    }
  },

  addAddressPool: function (resourceGroupName, nicName, options, _) {
    this._updateAddressPool(resourceGroupName, nicName, options, true, _);
  },

  removeAddressPool: function (resourceGroupName, nicName, options, _) {
    this._updateAddressPool(resourceGroupName, nicName, options, false, _);
  },

  addInboundRule: function (resourceGroupName, nicName, options, _) {
    this._updateInboundRule(resourceGroupName, nicName, options, true, _);
  },

  removeInboundRule: function (resourceGroupName, nicName, options, _) {
    this._updateInboundRule(resourceGroupName, nicName, options, false, _);
  },

  _updateAddressPool: function (resourceGroupName, nicName, options, isAdding, _) {
    var self = this;
    var nic = self.get(resourceGroupName, nicName, _);

    if (!nic) {
      throw new Error(util.format($('A network interface with name "%s" not found in the resource group "%s"'), nicName, resourceGroupName));
    }

    var poolId = null;

    var ipConfiguration = nic.ipConfigurations[0];

    if (!ipConfiguration.loadBalancerBackendAddressPools) {
      ipConfiguration.loadBalancerBackendAddressPools = [];
    }

    if (options.lbAddressPoolId) {
      if (options.lbName) {
        self.output.warn('--lb-name parameter will be ignored');
      }

      if (options.addressPoolName) {
        self.output.warn('--address-pool-name parameter will be ignored');
      }

      poolId = options.lbAddressPoolId;
    } else if (options.lbName || options.addressPoolName) {
      if (!options.lbName) {
        throw new Error($('You must specify --lb-name parameter if --address-pool-name is specified'));
      }

      if (!options.addressPoolName) {
        throw new Error($('You must specify --address-pool-name parameter if --lb-name is specified'));
      }
      var lb = self.loadBalancerCrud.get(resourceGroupName, options.lbName, _);
      if (!lb) {
        throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s'), options.lbName, resourceGroupName));
      }

      var addressPool = utils.findFirstCaseIgnore(lb.loadBalancer.backendAddressPools, {name: options.addressPoolName});

      if (!addressPool) {
        throw new Error(util.format($('A backend address pool with name "%s" not found in the load balancer "%s" resource group "%s"'), options.addressPoolName, options.lbName, resourceGroupName));
      } else {
        poolId = addressPool.id;
      }
    } else {
      throw new Error($('You must specify --lb-address-pool-id or (--lb-name and --address-pool-name) parameters'));
    }

    if (isAdding) {
      if (!utils.findFirstCaseIgnore(ipConfiguration.loadBalancerBackendAddressPools, {id: poolId})) {
        ipConfiguration.loadBalancerBackendAddressPools.push({id: poolId});
      } else {
        throw new Error(util.format($('Specified backend address pool already attached to NIC "%s" in the resource group "%s"'), nicName, resourceGroupName));
      }
    } else {
      var index = utils.indexOfCaseIgnore(ipConfiguration.loadBalancerBackendAddressPools, {id: poolId});
      if (index !== -1) {
        ipConfiguration.loadBalancerBackendAddressPools.splice(index, 1);
      } else {
        throw new Error(util.format($('Specified backend address pool is not attached to NIC "%s" in the resource group "%s"'), nicName, resourceGroupName));
      }
    }

    self.update(resourceGroupName, nicName, nic, _);
  },

  _updateInboundRule: function (resourceGroupName, nicName, options, isAdding, _) {
    var self = this;
    var nic = self.get(resourceGroupName, nicName, _);

    if (!nic) {
      throw new Error(util.format($('A network interface with name "%s" not found in the resource group "%s"'), nicName, resourceGroupName));
    }

    var ruleId = null;

    var ipConfiguration = nic.ipConfigurations[0];

    if (!ipConfiguration.loadBalancerInboundNatRules) {
      ipConfiguration.loadBalancerInboundNatRules = [];
    }

    if (options.inboundNatRuleId) {
      if (options.lbName) {
        self.output.warn('--lb-name parameter will be ignored');
      }

      if (options.inboundNatRuleName) {
        self.output.warn('--inbound-nat-rule-name parameter will be ignored');
      }

      ruleId = options.inboundNatRuleId;
    } else if (options.lbName || options.inboundNatRuleName) {
      if (!options.lbName) {
        throw new Error($('You must specify --lb-name parameter if --inbound-nat-rule-name is specified'));
      }

      if (!options.inboundNatRuleName) {
        throw new Error($('You must specify --inbound-nat-rule-name parameter if --lb-name is specified'));
      }
      var lb = self.loadBalancerCrud.get(resourceGroupName, options.lbName, _);
      if (!lb) {
        throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s'), options.lbName, resourceGroupName));
      }

      var inboundNatRule = utils.findFirstCaseIgnore(lb.loadBalancer.inboundNatRules, {name: options.inboundNatRuleName});
      if (!inboundNatRule) {
        throw new Error(util.format($('An inbound NAT rule with name "%s" not found in the load balancer "%s"'), options.inboundNatRuleName, options.lbName));
      } else {
        ruleId = inboundNatRule.id;
      }
    } else {
      throw new Error($('You must specify --inbound-nat-rule-id or (--lb-name and --inbound-nat-rule-name) parameters'));
    }

    if (isAdding) {
      if (!utils.findFirstCaseIgnore(ipConfiguration.loadBalancerInboundNatRules, {id: ruleId})) {
        ipConfiguration.loadBalancerInboundNatRules.push({id: ruleId});
      } else {
        throw new Error(util.format($('Specified inbound NAT rule already attached to NIC "%s" in the resource group "%s"'), nicName, resourceGroupName));
      }
    } else {
      var index = utils.indexOfCaseIgnore(ipConfiguration.loadBalancerInboundNatRules, {id: ruleId});
      if (index !== -1) {
        ipConfiguration.loadBalancerInboundNatRules.splice(index, 1);
      } else {
        throw new Error(util.format($('Specified inbound NAT rule is not attached to NIC "%s" in the resource group "%s"'), nicName, resourceGroupName));
      }
    }

    self.update(resourceGroupName, nicName, nic, _);
  },

  _parseNic: function (resourceGroupName, nicName, options, _) {
    var self = this;

    var nicProfile = {
      ipConfigurations: [
        {
          name: 'NIC-config'
        }
      ]
    };

    if (options.privateIpAddress) {
      var ipValidationResult = self.vnetUtil.parseIPv4(options.privateIpAddress);
      if (ipValidationResult.error) {
        throw new Error($('public ip address parameter is in invalid format'));
      }
      nicProfile.ipConfigurations[0].privateIpAllocationMethod = 'Static';
      nicProfile.ipConfigurations[0].privateIpAddress = options.privateIpAddress;
    }

    if (options.subnetId) {
      if (options.subnetName || options.subnetVnetName) {
        self.output.warn($('--subnet-name, --subnet-vnet-name parameters will be ignored because --subnet-name, --subnet-vnet-name and --subnet-id are mutually exclusive'));
      }
      nicProfile.ipConfigurations[0].subnet = {
        id: options.subnetId
      };
    } else {
      if (options.subnetName && options.subnetVnetName) {
        var subnet = self.subnetCrud.get(resourceGroupName, options.subnetVnetName, options.subnetName, _);
        if (!subnet) {
          throw new Error(util.format($('A subnet with name "%s" not found in the resource group "%s"'), options.subnetName, resourceGroupName));
        }
        nicProfile.ipConfigurations[0].subnet = {
          id: subnet.id
        };
      }
    }

    if (options.networkSecurityGroupId) {
      if (options.networkSecurityGroupName) self.output.warn($('--network-security-group-name parameter will be ignored because --network-security-group-id and --network-security-group-name are mutually exclusive'));
      nicProfile.networkSecurityGroup = {
        id: options.networkSecurityGroupId
      };
    } else {
      if (options.networkSecurityGroupName) {
        var nsg = self.nsgCrud.get(resourceGroupName, options.networkSecurityGroupName, _);
        if (!nsg) {
          throw new Error(util.format($('A network security group with name "%s" not found in the resource group "%s"'), options.networkSecurityGroupName, resourceGroupName));
        }
        nicProfile.networkSecurityGroup = {
          id: nsg.id
        };
      }
    }

    if (options.publicIpId) {
      if (options.publicIpName) self.output.warn($('--public-ip-name parameter will be ignored because --public-ip-id and --public-ip-name are mutually exclusive'));
      nicProfile.ipConfigurations[0].publicIpAddress = {
        id: options.publicIpId
      };
    } else {
      if (options.publicIpName) {
        var publicip = self.publicIpCrud.get(resourceGroupName, options.publicIpName, _);
        if (!publicip) {
          throw new Error(util.format($('A public ip address  with name "%s" not found in the resource group "%s"'), options.publicIpName, resourceGroupName));
        }
        nicProfile.ipConfigurations[0].publicIpAddress = {
          id: publicip.id
        };
      }
    }

    var lbAddressPoolIdsOpt = utils.getOptionalArg(options.lbAddressPoolIds);
    if (lbAddressPoolIdsOpt.hasValue) {
      // In create or set - reset the collection
      nicProfile.ipConfigurations[0].loadBalancerBackendAddressPools = [];
      if (lbAddressPoolIdsOpt.value) {
        var lbAddressPoolIds = lbAddressPoolIdsOpt.value.split(',');
        lbAddressPoolIds.forEach(function (lbAddressPoolId) {
          lbAddressPoolId = lbAddressPoolId.replace(/'|''$/gm, '');
          var loadBalancerBackendAddressPool = {
            id: lbAddressPoolId
          };

          if (!utils.findFirstCaseIgnore(nicProfile.ipConfigurations[0].loadBalancerBackendAddressPools, loadBalancerBackendAddressPool)) {
            nicProfile.ipConfigurations[0].loadBalancerBackendAddressPools.push(loadBalancerBackendAddressPool);
          }
        });
      }
    }

    var lbInboundNatRuleIdsOpt = utils.getOptionalArg(options.lbInboundNatRuleIds);
    if (lbInboundNatRuleIdsOpt.hasValue) {
      // In create or set - reset the collection
      nicProfile.ipConfigurations[0].loadBalancerInboundNatRules = [];
      if (lbInboundNatRuleIdsOpt.value) {
        var lbInboundNatRuleIds = lbInboundNatRuleIdsOpt.value.split(',');
        lbInboundNatRuleIds.forEach(function (lbInboundNatRuleId) {
          lbInboundNatRuleId = lbInboundNatRuleId.replace(/'|''$/gm, '');
          var loadBalancerInboundNatRule = {
            id: lbInboundNatRuleId
          };

          if (!utils.findFirstCaseIgnore(nicProfile.ipConfigurations[0].loadBalancerInboundNatRules, loadBalancerInboundNatRule)) {
            nicProfile.ipConfigurations[0].loadBalancerInboundNatRules.push(loadBalancerInboundNatRule);
          }
        });
      }
    }

    if (options.internalDnsNameLabel) {
      nicProfile.dnsSettings = {};
      nicProfile.dnsSettings.internalDnsNameLabel = options.internalDnsNameLabel;
    }

    if (options.enableIpForwarding) {
      if (!utils.ignoreCaseEquals(options.enableIpForwarding, 'true') && !utils.ignoreCaseEquals(options.enableIpForwarding, 'false')) {
        throw new Error($('enable-ip-forwarding parameter must be boolean'));
      }
      nicProfile.enableIPForwarding = options.enableIpForwarding;
    }

    if (options.location) {
      nicProfile.location = options.location;
    }

    if (options.tags) {
      nicProfile.tags = tagUtils.buildTagsParameter(null, options);
    }

    return nicProfile;
  }
});

module.exports = Nic;