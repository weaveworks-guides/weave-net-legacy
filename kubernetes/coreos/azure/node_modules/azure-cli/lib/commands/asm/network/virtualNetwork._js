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
var crypto = require('crypto');
var util = require('util');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var VNetUtil = require('./../../../util/vnet.util');
var NetworkConfig = require('./networkConfig');

function VirtualNetwork(cli, managementClient, networkManagementClient) {
  this.managementClient = managementClient;
  this.networkManagementClient = networkManagementClient;
  this.networkConfig = new NetworkConfig(cli, networkManagementClient);
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(VirtualNetwork.prototype, {
  create: function (vnetName, options, _) {
    var self = this;
    var vnetProfile = self._parseVirtualNetwork(vnetName, options);

    var networkConfig = self.networkConfig.get(_);
    if (!networkConfig.VirtualNetworkConfiguration) {
      networkConfig.VirtualNetworkConfiguration = {};
    }
    var vnetConfig = networkConfig.VirtualNetworkConfiguration;

    if (utils.findFirstCaseIgnore(vnetConfig.VirtualNetworkSites, {Name: vnetProfile.name})) {
      throw new Error(util.format($('A virtual network with name "%s" already exists'), vnetProfile.name));
    }

    if (options.dnsServerId) {
      var dnsServerNameIps = [];
      for (var j = 0; j < vnetConfig.Dns.DnsServers.length; j++) {
        var dnsServer = vnetConfig.Dns.DnsServers[j];
        if (utils.ignoreCaseEquals(dnsServer.Name, options.dnsServerId)) {
          vnetProfile.dnsServerId = dnsServer.Name;
          self.output.info(util.format($('Using DNS server %s (%s)'), dnsServer.Name, dnsServer.IPAddress));
          break;
        }
        dnsServerNameIps.push(util.format($('%s (%s)'), dnsServer.Name, dnsServer.IPAddress));
      }

      if (!vnetProfile.dnsServerId) {
        self.output.error(util.format($('A DNS server with name identifier "%s" not found'), options.dnsServerId));
        if (dnsServerNameIps.length > 0) {
          self.output.help($('You have following DNS servers registered:'));
          for (var k = 0; k < dnsServerNameIps.length; k++) {
            self.output.help(dnsServerNameIps[k]);
          }
        }

        self.output.help($('To register a new DNS server please use command "azure network dns-server register"'));
        throw new Error($('DNS server with the name identifier not found'));
      }
    }

    var groupResult = self._getOrCreateAffinityGroup(options, _);
    if (groupResult.affinityGroup) {
      self.output.info(util.format($('Using affinity group %s'), groupResult.affinityGroup));
      vnetProfile.affinityGroup = groupResult.affinityGroup;
    } else {
      vnetProfile.location = groupResult.location;
    }

    var vnetSite = self._convertProfileToSite(vnetProfile);
    if (!vnetConfig.VirtualNetworkSites) {
      vnetConfig.VirtualNetworkSites = [];
    }

    vnetConfig.VirtualNetworkSites.push(vnetSite);
    self.networkConfig.set(networkConfig, _);
  },

  list: function (options, _) {
    var self = this;

    var vnetSites = self._getSites(_);
    self.interaction.formatOutput(vnetSites, function (data) {
      if (data.length === 0) {
        self.output.warn($('No virtual networks found'));
      } else {
        self.output.table(data, function (row, vnet) {
          row.cell($('Name'), vnet.name);
          row.cell($('Location'), vnet.location || '');
          row.cell($('Affinity group'), vnet.affinityGroup || '');
          row.cell($('State'), vnet.state);
          row.cell($('Address space'), vnet.addressSpace.addressPrefixes[0]);
          row.cell($('Subnets count'), vnet.subnets.length);
          var vpnGatewayAddress = '';
          if (vnet.gateway && vnet.gateway.sites.length > 0) {
            vpnGatewayAddress = vnet.gateway.sites[0].vpnGatewayAddress;
            if (vnet.gateway.sites.length > 1)vpnGatewayAddress += ', ...';
          }
          row.cell($('VPN Gateway address'), vpnGatewayAddress);
        });
      }
    });
  },

  show: function (vnetName, options, _) {
    var self = this;

    var vnetSites = self._getSites(_);
    if (vnetSites) {
      var vnet = utils.findFirstCaseIgnore(vnetSites, {name: vnetName});
      if (vnet) {
        self.interaction.formatOutput(vnet, function (vnet) {
          self.output.nameValue($('Name'), vnet.name);
          self.output.nameValue($('Location'), vnet.location);
          self.output.nameValue($('Affinity group'), vnet.affinityGroup);
          self.output.nameValue($('State'), vnet.state);
          self.output.nameValue($('Address space'), vnet.addressSpace.addressPrefixes[0]);

          self.output.header('Subnets');
          vnet.subnets.forEach(function (subnet) {
            self.output.nameValue($('Name'), subnet.name, 2);
            self.output.nameValue($('Address prefix'), subnet.addressPrefix, 2);
            self.output.data('');
          });

          if (vnet.dnsServers.length > 0) {
            self.output.header('DNS Servers');
            vnet.dnsServers.forEach(function (dns) {
              self.output.nameValue($('Name'), dns.name, 2);
              self.output.nameValue($('Address'), dns.address, 2);
              self.output.data('');
            });
          }

          if (vnet.gateway) {
            self.output.header('Gateway');
            self.output.nameValue($('Profile'), vnet.gateway.profile, 2);
            self.output.header('Sites', 2);
            vnet.gateway.sites.forEach(function (site) {
              self.output.nameValue($('Name'), site.name, 4);
              self.output.nameValue($('VPN Gateway address'), site.vpnGatewayAddress, 4);
              self.output.nameValue($('Connection'), site.connections[0].type, 4);
              self.output.nameValue($('Address space'), site.addressSpace.addressPrefixes[0], 4);
              self.output.data('');
            });
          }
        });
      } else {
        if (self.output.format().json) {
          self.output.json({});
        } else {
          self.output.warn(util.format($('A virtual network with name "%s" not found'), vnetName));
        }
      }
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A virtual network with name "%s" not found'), vnetName));
      }
    }
  },

  delete: function (vnetName, options, _) {
    var self = this;

    var networkConfig = self.networkConfig.get(_);
    var vnetConfig = networkConfig.VirtualNetworkConfiguration;

    var index = utils.indexOfCaseIgnore(vnetConfig.VirtualNetworkSites, {Name: vnetName});
    if (index !== -1) {
      if (!options.quiet && !self.interaction.confirm(util.format($('Delete a virtual network "%s"? [y/n] '), vnetName), _)) {
        return;
      }
      vnetConfig.VirtualNetworkSites.splice(index, 1);
      self.networkConfig.set(networkConfig, _);
    } else {
      self.output.error(util.format($('A virtual network with name "%s" not found'), vnetName));
    }
  },

  _getSites: function (_) {
    var self = this;
    var progress = self.interaction.progress($('Looking up the virtual network sites'));
    try {
      var response = self.networkManagementClient.networks.list(_);
      return response.virtualNetworkSites;
    } finally {
      progress.end();
    }
  },

  _getLocations: function (_) {
    var self = this;
    var progress = self.interaction.progress($('Looking up locations'));
    try {
      var response = self.managementClient.locations.list(_);
      return response.locations;
    } catch (e) {
      return null;
    } finally {
      progress.end();
    }
  },

  _getAffinityGroups: function (_) {
    var self = this;
    var progress = self.interaction.progress($('Looking up affinity groups'));
    try {
      var response = self.managementClient.affinityGroups.list(_);
      return response.affinityGroups;
    } finally {
      progress.end();
    }
  },

  _isAffinityGroupSupportsPersistentVMRole: function (affinityGroup) {
    if (affinityGroup.capabilities.length === 0) {
      return false;
    }
    for (var i = 0; i < affinityGroup.capabilities.length; i++) {
      if (affinityGroup.capabilities[i] === 'PersistentVMRole') {
        return true;
      }
    }
    return false;
  },

  _isLocationSupportsPersistentVMRole: function (location) {
    if (location.availableServices.length === 0) {
      return false;
    }
    for (var i = 0; i < location.availableServices.length; i++) {
      if (location.availableServices[i] === 'PersistentVMRole') {
        return true;
      }
    }
    return false;
  },

  _showVNetHostHelp: function () {
    self.output.help($('You can either create a "regional VNet" using --location (recommended) or "affinity group specific VNet" using --location and --create-new-affinity-group (deprecated)'));
  },

  _convertProfileToSite: function (vnetProfile) {
    var site = {
      Name: vnetProfile.name,
      AddressSpace: [],
      Subnets: [],
      DnsServersRef: []
    };

    if (vnetProfile.affinityGroup) {
      site.AffinityGroup = vnetProfile.affinityGroup;
    } else {
      site.Location = vnetProfile.location;
    }

    site.AddressSpace.push(vnetProfile.addressSpaceStartIP + '/' + vnetProfile.cidr);
    site.Subnets.push({
      AddressPrefix: vnetProfile.subnetStartIP + '/' + vnetProfile.subnetCidr,
      Name: vnetProfile.subnetName
    });

    if (vnetProfile.dnsServerId) {
      site.DnsServersRef.push({
        Name: vnetProfile.dnsServerId
      });
    }

    return site;
  },

  _parseVirtualNetwork: function (vnetName, options) {
    var self = this;

    if (!options.location && !options.affinityGroup) {
      throw new Error($('Either --location or --affinity-group must be present'));
    } else if (options.location && options.affinityGroup) {
      throw new Error($('Either --location or --affinity-group must be present not both'));
    }

    if (options.createNewAffinityGroup && options.affinityGroup) {
      throw new Error($('--create-new-affinity-group can be used only with --location'));
    }

    if (options.cidr && options.maxVmCount) {
      throw new Error($('Both optional parameters --cidr and --max-vm-count cannot be specified together'));
    }

    if (options.subnetCidr && options.subnetVmCount) {
      throw new Error($('Both optional parameters --subnet-cidr and --subnet-vm-count cannot be specified together'));
    }

    // Ensure --address-space is present if user provided --cidr
    var requiredOptCheckResult = self.vnetUtil.ensureRequiredParams(
      options.cidr,
      'cidr', {
        'address-space': options.addressSpace
      });

    if (requiredOptCheckResult.error) {
      throw new Error(requiredOptCheckResult.error);
    }

    // Ensure --address-space is present if user provided --max-vm-count
    requiredOptCheckResult = self.vnetUtil.ensureRequiredParams(
      options.maxVmCount,
      'max-vm-count', {
        'address-space': options.addressSpace
      });

    if (requiredOptCheckResult.error) {
      throw new Error(requiredOptCheckResult.error);
    }

    // Ensure --address-space and --cidr or --max-vm-count is present if user
    // provided --subnet-start-ip
    requiredOptCheckResult = self.vnetUtil.ensureRequiredParams(
      options.subnetStartIp,
      'subnet-start-ip', {
        'address-space': options.addressSpace,
        'mvccidr': {
          'max-vm-count': options.maxVmCount,
          'cidr': options.cidr
        }
      });

    if (requiredOptCheckResult.error) {
      throw new Error(requiredOptCheckResult.error);
    }

    // Ensure --address-space, subnet-start-ip and --cidr or --max-vm-count
    // is present if user provided --subnet-cidr
    requiredOptCheckResult = self.vnetUtil.ensureRequiredParams(
      options.subnetCidr,
      'subnet-cidr', {
        'address-space': options.addressSpace,
        'mvccidr': {
          'max-vm-count': options.maxVmCount,
          'cidr': options.cidr
        },
        'subnet-start-ip': options.subnetStartIp
      });

    if (requiredOptCheckResult.error) {
      throw new Error(requiredOptCheckResult.error);
    }

    // Ensure --address-space, subnet-start-ip and --cidr or --max-vm-count
    // is present if user provided --subnet-vm-count
    requiredOptCheckResult = self.vnetUtil.ensureRequiredParams(
      options.subnetVmCount,
      'subnet-vm-count', {
        'address-space': options.addressSpace,
        'mvccidr': {
          'max-vm-count': options.maxVmCount,
          'cidr': options.cidr
        },
        'subnet-start-ip': options.subnetStartIp
      });

    if (requiredOptCheckResult.error) {
      throw new Error(requiredOptCheckResult.error);
    }

    var vnetProfile = {
      // The name of the VNet
      name: null,
      // The affinity group for VNet
      affinityGroup: null,
      // The VNet's address space start IP
      addressSpaceStartIP: null,
      addressSpaceStartIPOctects: null,
      // Info about the private address space that address space belongs to
      addressSpaceInfo: null,
      // CIDR for the address space
      cidr: null,
      // The network mask for the address space calculated from CIDR
      addressSpaceNetworkMask: null,
      // The address space range calculated from address space start ip and CIDR
      addressSpaceRange: null,
      // The name for the first subnet in the address space
      subnetName: null,
      // The start ip address of the subnet
      subnetStartIPOctects: null,
      subnetStartIP: null,
      // The subnet cidr
      subnetCidr: null,
      // dns server id identifying DNS server for this VNet
      dnsServerId: null
    };

    var namePattern = /^[a-z0-9][a-z0-9\-]{0,62}$/i;
    if (options.subnetName) {
      if (namePattern.test(options.subnetName) === false) {
        throw new Error($('The --subnet-name can contain only letters, numbers and hyphens with no more than 63 characters. It must start with a letter or number'));
      }
      vnetProfile.subnetName = options.subnetName;
    } else {
      vnetProfile.subnetName = 'Subnet-1';
    }

    if (namePattern.test(vnetName) === false) {
      throw new Error($('The name can contain only letters, numbers and hyphens with no more than 63 characters. It must start with a letter or number'));
    }
    vnetProfile.name = vnetName;

    // Set the start IP address of the address space.
    var addressSpaceStartIP = null;
    if (!options.addressSpace) {
      // If user not provided --address-space default to '10.0.0.0'.
      addressSpaceStartIP = self.vnetUtil.defaultAddressSpaceInfo().ipv4Start;
      self.output.info(util.format($('Using default address space start IP: %s'), addressSpaceStartIP));
    } else {
      addressSpaceStartIP = options.addressSpace;
    }

    // Parse address space start ip and get the octect representation.
    var parsedAddressSpaceStartIP =
      self.vnetUtil.parseIPv4(addressSpaceStartIP, '--address-space');
    if (parsedAddressSpaceStartIP.error) {
      throw new Error(parsedAddressSpaceStartIP.error);
    }

    // Ensure to remove any leading zeros in the IP for e.g. '01.002.0.1'.
    addressSpaceStartIP =
      self.vnetUtil.octectsToString(parsedAddressSpaceStartIP.octects);

    // Get the private address space info for the given address space.
    // Hint user if the address space does not fall in the allowed
    // private address space ranges.
    var addressSpaceInfoForAddressSpace =
      self.vnetUtil.getPrivateAddressSpaceInfo(parsedAddressSpaceStartIP.octects);
    if (!addressSpaceInfoForAddressSpace) {
      self.output.error(util.format($('The given --address-space %s is not a valid private address'), addressSpaceStartIP));
      self.output.help($('The valid address space ranges are:'));
      for (var key in self.vnetUtil.privateAddressSpacesInfo) {
        var addressSpaceInfo = self.vnetUtil.privateAddressSpacesInfo[key];
        self.output.help(addressSpaceInfo.ipv4Cidr +
        '  [' + addressSpaceInfo.ipv4Start + ', ' + addressSpaceInfo.ipv4End + ']');
      }

      throw new Error($('Invalid --address-space value'));
    }

    vnetProfile.addressSpaceStartIP = addressSpaceStartIP;
    vnetProfile.addressSpaceStartIPOctects = parsedAddressSpaceStartIP.octects;
    vnetProfile.addressSpaceInfo = addressSpaceInfoForAddressSpace;

    // Set the address space cidr
    var cidr = null;
    if (options.maxVmCount) {
      var maxVmCount = parseInt(options.maxVmCount, 10);
      if (isNaN(maxVmCount)) {
        throw new Error($('--vm-count should be an integer value'));
      }

      cidr = self.vnetUtil.getCIDRFromHostsCount(maxVmCount);
      self.output.info(util.format($('The cidr calculated for the given --max-vm-count %s is %s'), maxVmCount, cidr));
    } else if (options.cidr) {
      cidr = parseInt(options.cidr, 10);
    } else {
      cidr = vnetProfile.addressSpaceInfo.startCidr;
      self.output.info(util.format($('Using default address space cidr: %s'), cidr));
    }

    // Check the given address space cidr fall in the cidr range for the private
    // address space the given address space belongs to.
    var verifyCidrResult = self.vnetUtil.verfiyCIDR(cidr, {
        start: vnetProfile.addressSpaceInfo.startCidr,
        end: vnetProfile.addressSpaceInfo.endCidr
      },
      options.cidr ? '--cidr' : null
    );

    if (verifyCidrResult.error) {
      throw new Error(verifyCidrResult.error);
    }

    vnetProfile.cidr = cidr;
    vnetProfile.addressSpaceNetworkMask =
      self.vnetUtil.getNetworkMaskFromCIDR(vnetProfile.cidr).octects;
    // From the address space and cidr calculate the ip range, we use this to
    // set the default subnet start ip and to validate that the subnet start
    // ip fall within the range defined for the address space.
    vnetProfile.addressSpaceRange =
      self.vnetUtil.getIPRange(vnetProfile.addressSpaceStartIPOctects, vnetProfile.addressSpaceNetworkMask);

    // Set the subnet start ip
    if (!options.subnetStartIp) {
      vnetProfile.subnetStartIPOctects = vnetProfile.addressSpaceRange.start;
      vnetProfile.subnetStartIP =
        self.vnetUtil.octectsToString(vnetProfile.subnetStartIPOctects);
      self.output.info(util.format($('Using default subnet start IP: %s'), vnetProfile.subnetStartIP));
    } else {
      var parsedSubnetStartIP = self.vnetUtil.parseIPv4(options.subnetStartIp, '--subnet-start-ip');
      if (parsedSubnetStartIP.error) {
        throw new Error(parsedSubnetStartIP.error);
      }

      vnetProfile.subnetStartIPOctects = parsedSubnetStartIP.octects;
      vnetProfile.subnetStartIP = self.vnetUtil.octectsToString(vnetProfile.subnetStartIPOctects);
    }

    // Checks the given subnet start ip falls in the address space range.
    var isSubnetInRange = self.vnetUtil.isIPInRange(
      vnetProfile.addressSpaceRange.start,
      vnetProfile.addressSpaceRange.end,
      vnetProfile.subnetStartIPOctects
    );

    if (!isSubnetInRange) {
      var addressSpaceRange = vnetProfile.addressSpaceStartIP + '/' + vnetProfile.cidr + ' [' +
        self.vnetUtil.octectsToString(vnetProfile.addressSpaceRange.start) +
        ', ' +
        self.vnetUtil.octectsToString(vnetProfile.addressSpaceRange.end) + ']';
      self.output.help(util.format($('The given subnet (--subnet-start-ip) should belongs to the address space %s'),
        addressSpaceRange));
      throw new Error($('The subnet is not in the address space'));
    }

    // Set the subnet cidr
    var subnetCidr = null;
    if (options.subnetVmCount) {
      var subnetVmCount = parseInt(options.subnetVmCount, 10);
      if (isNaN(subnetVmCount)) {
        throw new Error($('--subnet-vm-count should be an integer value'));
      }

      subnetCidr = self.vnetUtil.getCIDRFromHostsCount(subnetVmCount);
      self.output.info(util.format($('The cidr calculated for the given --subnet-vm-count %s is %s'),
        subnetVmCount,
        subnetCidr));
    } else if (options.subnetCidr) {
      subnetCidr = parseInt(options.subnetCidr, 10);
    } else {
      subnetCidr = self.vnetUtil.getDefaultSubnetCIDRFromAddressSpaceCIDR(vnetProfile.cidr);
      self.output.info(util.format($('Using default subnet cidr: %s'), subnetCidr));
    }

    verifyCidrResult = self.vnetUtil.verfiyCIDR(subnetCidr, {
        start: vnetProfile.cidr,
        end: vnetProfile.addressSpaceInfo.endCidr
      },
      options.subnetCidr ? '--subnet-cidr' : 'calculated from --subnet-vm-count'
    );

    if (verifyCidrResult.error) {
      throw new Error(verifyCidrResult.error);
    }

    vnetProfile.subnetCidr = subnetCidr;

    self.output.verbose(util.format($('Address Space [Starting IP/CIDR (Max VM Count)]: %s/%s (%s)'),
      vnetProfile.addressSpaceStartIP,
      vnetProfile.cidr,
      self.vnetUtil.getHostsCountForCIDR(vnetProfile.cidr).hostsCount));

    self.output.verbose(util.format($('Subnet [Starting IP/CIDR (Max VM Count)]: %s/%s (%s)'),
      vnetProfile.subnetStartIP,
      vnetProfile.subnetCidr,
      self.vnetUtil.getHostsCountForCIDR(vnetProfile.subnetCidr).hostsCount));

    return vnetProfile;
  },

  _getOrCreateAffinityGroup: function (options, _) {
    var self = this;
    var result = {
      affinityGroup: '',
      location: ''
    };

    var supportsVmRole = false;
    if (options.affinityGroup) {
      var affinityGroups = self._getAffinityGroups(_);
      var group = utils.findFirstCaseIgnore(affinityGroups, {name: options.affinityGroup});
      if (group) {
        supportsVmRole = self._isAffinityGroupSupportsPersistentVMRole(group);
        if (supportsVmRole) {
          result = {
            affinityGroup: group.name,
            location: group.location
          };
          return result;
        } else {
          self.output.error(util.format($('The given affinity group "%s" does not support PersistentVMRole service'), options.affinityGroup));
          self.output.help($('You should create virtual network in an affinity group that support PersistentVMRole service'));
          self._showVNetHostHelp();

          var vmroleSupportedAffinityGroupNames = [];
          for (var i = 0; i < affinityGroups.length; i++) {
            if (self._isAffinityGroupSupportsPersistentVMRole(affinityGroups[i])) {
              vmroleSupportedAffinityGroupNames.push(affinityGroups[i].name + ' (' + affinityGroups[i].location + ')');
            }
          }

          if (vmroleSupportedAffinityGroupNames.length > 0) {
            self.output.help($('Following affinity groups in your subscription supports PersistentVMRole service:'));
            vmroleSupportedAffinityGroupNames.forEach(function (groupName) {
              self.output.help(groupName);
            });
          } else {
            self.output.help($('There is no affinity groups in your subscription that supports PersistentVMRole service'));
          }

          self._showVNetHostHelp();
          throw new Error(util.format($('Affinity group with name "%s" does not support PersistentVMRole service'), options.affinityGroup));
        }
      } else {
        self._showVNetHostHelp();
        throw new Error($(util.format($('Affinity group with name "%s" not found'), options.affinityGroup)));
      }
    } else {
      var locations = self._getLocations(_);
      var location = utils.findFirstCaseIgnore(locations, {name: options.location});
      if (location) {
        supportsVmRole = self._isLocationSupportsPersistentVMRole(location);
        if (supportsVmRole) {
          if (options.createNewAffinityGroup) {
            var groupName = self._createAffinityGroup(location, _);
            result = {
              affinityGroup: groupName,
              location: location.name
            };
            return result;
          } else {
            result = {
              affinityGroup: null,
              location: location.name
            };
            return result;
          }
        } else {
          self.output.error(util.format($('The given location "%s" does not support PersistentVMRole service'), options.location));
          self.output.help($('You should create virtual network in a location that supports PersistentVMRole service'));

          var vmroleSupportedLocationNames = [];
          for (var j = 0; j < locations.length; j++) {
            if (self._isLocationSupportsPersistentVMRole(locations[j])) {
              vmroleSupportedLocationNames.push(locations[j].name);
            }
          }

          if (vmroleSupportedLocationNames.length > 0) {
            self.output.help($('Following locations supports PersistentVMRole service:'));
            vmroleSupportedLocationNames.forEach(function (locationName) {
              self.output.help(locationName);
            });
          }
          throw new Error($(util.format($('Location "%s" does not support PersistentVMRole service'), options.location)));
        }
      } else {
        throw new Error($(util.format($('Location group with name "%s" not found'), options.location)));
      }
    }
  },

  _createAffinityGroup: function (location, _) {
    var self = this;

    var groupName = 'AG-CLI-' + crypto.randomBytes(8).toString('hex');
    var groupProfile = {
      name: groupName,
      location: location.name,
      label: groupName + '_' + location.name
    };

    var progress = self.interaction.progress(util.format($('Creating new affinity group with name "%s"'), groupName));
    try {
      self.managementClient.affinityGroups.create(groupProfile, _);
    } finally {
      progress.end();
    }
    return groupName;
  }

});

module.exports = VirtualNetwork;
