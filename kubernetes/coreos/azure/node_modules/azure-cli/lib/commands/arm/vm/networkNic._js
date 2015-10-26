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
var NetworkPublicIP = require('./networkPublicIP');
var NetworkVNet = require('./networkVNet');
var NetworkVNetSubnet = require('./networkVNetSubnet');

var $ = utils.getLocaleString;

function NetworkNic(cli, networkResourceProviderClient, resourceGroupName, params) {
  this.cli = cli;
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.resourceGroupName = resourceGroupName;
  this.params = params;
}

__.extend(NetworkNic.prototype, {
    createOrUpdateNICIfRequired: function(_) {
      var hasNicIdParam = !utils.stringIsNullOrEmpty(this.params.nicId);
      if (hasNicIdParam) {
        this.cli.output.info($('Found NIC Id parameter, NIC name if specified will be ignored'));
      } else {
        if (utils.stringIsNullOrEmpty(this.params.nicName)) {
          throw new Error($('Either NIC Id or NIC name is required'));
        }
      }

      var nicInfo = null;
      if (hasNicIdParam) {
        nicInfo = this.getNICInfoById(this.params.nicId, _);
      } else {
        if (utils.stringIsNullOrEmpty(this.params.location)) {
          this.params.location = this.cli.interaction.prompt($('Enter location: '), _);
        }

        nicInfo = this.getNICInfoByName(this.resourceGroupName, this.params.nicName, _);
      }

      if (nicInfo.profile) {
        this.cli.output.info(util.format($('Found an existing NIC "%s"'), nicInfo.nicName));

        var nicLocation = nicInfo.profile.location;
        if (!utils.ignoreCaseAndSpaceEquals(nicLocation, this.params.location)) {
          throw new Error(util.format($('Existing NIC with name "%s" is hosted in a different region "%s"'), nicInfo.nicName, nicLocation));
        }

        var nicAttachedVMRef = nicInfo.profile.virtualMachine;
        if ((nicAttachedVMRef !== undefined) && (nicAttachedVMRef.id !== undefined)) {
          var vmResourceInfo = utils.parseResourceReferenceUri(nicAttachedVMRef.id);
          throw new Error(util.format($('The nic "%s" already attached to a VM "%s"'), nicInfo.nicName, vmResourceInfo.resourceName));
        }

        // Note: Once ARM supports multiple ip configuration set allowNewIpConfig:true
        var updateInfo = this._updateNICIfRequired(nicInfo.resourceGroupName, nicInfo.profile, this.params, false, _);
        if (updateInfo.updated) {
          nicInfo = this.getNICInfoByName(nicInfo.resourceGroupName, nicInfo.nicName, _);
        }

        nicInfo.updated = updateInfo.updated;
        nicInfo.vnetInfo = updateInfo.vnetInfo;
        nicInfo.publicipInfo = updateInfo.publicipInfo;
      } else {
        if (hasNicIdParam) {
          throw new Error(util.format($('An NIC with Id "%s" not found'), this.params.nicId));
        }

        this.cli.output.info(util.format($('An nic with given name "%s" not found, creating a new one'), nicInfo.nicName));
        var createInfo = this._createNewNIC(nicInfo.resourceGroupName, this.params, _);
        // Once created, pull the NIC so we get it's resource ID
        nicInfo = this.getNICInfoByName(nicInfo.resourceGroupName, nicInfo.nicName, _);

        nicInfo.createRequestProfile = createInfo.createRequestProfile;
        nicInfo.createdNew = true;
        nicInfo.vnetInfo = createInfo.vnetInfo;
        nicInfo.publicipInfo = createInfo.publicipInfo;
      }

      return nicInfo;
    },

    getNICInfoById: function (referenceUri, _) {
      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      if (!utils.allParamsAreSet([resourceInfo.subscriptionId, resourceInfo.resourceGroupName, resourceInfo.provider, resourceInfo.parentResource, resourceInfo.resourceName])) {
        throw new Error(util.format($('"%s" is not a valid NIC ID, example: /subscriptions/<subscriptipn-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/networkInterfaces/<nic-name>'), referenceUri));
      }

      return this.getNICInfoByName(resourceInfo.resourceGroupName, resourceInfo.resourceName, _);
    },

    getNICInfoByName: function (resourceGroupName, nicName, _) {
      var nicInfo = {
        nicName: nicName,
        resourceGroupName: resourceGroupName,
        createdNew: false,
        updated: false,
        createRequestProfile: {},
        profile: null,
        vnetInfo: null,
        publicipInfo: null
      };

      var nic = this._getNIC(resourceGroupName, nicName, _);
      if (nic) {
        nicInfo.profile = nic.networkInterface;
      }

      return nicInfo;
    },

    getNICByIdExpanded: function (referenceUri, depth, memoize, dependencies, _) {
      referenceUri = referenceUri.toLowerCase();
      if (memoize[referenceUri]) {
        return memoize[referenceUri];
      }

      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      var expandedNIC = this.getNICByNameExpanded(resourceInfo.resourceGroupName, resourceInfo.resourceName, depth, memoize, dependencies, _);
      return expandedNIC;
    },

    getNICByNameExpanded: function (resourceGroupName, nicName, depth, memoize, dependencies, _) {
      var nic = this._getNIC(resourceGroupName, nicName, _);
      var expandedNIC = this._expandNIC(nic, depth, memoize, dependencies, _);
      return expandedNIC;
    },

    _getNIC: function (resourceGroupName, nicName, _) {
      var progress = this.cli.interaction.progress(util.format($('Looking up the NIC "%s"'), nicName));
      try {
        var nic = this.networkResourceProviderClient.networkInterfaces.get(resourceGroupName, nicName, _);
        return nic;
      } catch (e) {
        if (e.code === 'ResourceNotFound') {
          return null;
        }
        throw e;
      } finally {
        progress.end();
      }
    },

    _updateNICIfRequired: function (resourceGroupName, networkInterface, params, allowNewIpConfig,  _) {
      var nicUpdateInfo = {
        updated: false,
        vnetInfo: null,
        publicipInfo: null
      };

      var existingIpConfiguration;
      var nic = { networkInterface: networkInterface };
      var ipConfigInfo = null;
      if (allowNewIpConfig) {
        // User want to add a new IP config (Azure won't support this currently).
        var networkVNet = new NetworkVNet(this.cli, this.networkResourceProviderClient, this.resourceGroupName, this.params);
        if (!networkVNet.hasAnyVNetParameters(params)) {
          // To add new config VNet parameters are required. If there is just public ip param without vnet param we will
          // not proceed because we don't know under which ip config we want to add the public ip, we use vnet::subnetId
          // to identify the ip config.
          return nicUpdateInfo;
        }

        this.cli.output.info($('Found virtual network parameters, assuming user wants to configure NIC with a virtual network'));
        nicUpdateInfo.vnetInfo = networkVNet.createOrUpdateVNetIfRequired(_);

        var subnetId = nicUpdateInfo.vnetInfo.subnetInfo.profile.id;
        existingIpConfiguration = this._lookupIPConfiguration(networkInterface.ipConfigurations, subnetId);
        if (existingIpConfiguration) {
          this.cli.output.info(util.format($('Found an IP configuration with virtual network subnet name "%s" in the NIC "%s"'), this.params.vnetSubnetName, this.params.nicName));
        } else {
          this.cli.output.info(util.format($('NIC does not contain an ip configuration with virtual network subnet having ID "%s""'), subnetId));
          ipConfigInfo = this._createNewIPConfigurationTrySetPublicIP(subnetId, this.params.nicName, _);
          if (!ipConfigInfo.ipConfiguration.publicIpAddress) {
            this.cli.output.info($('public ip parameters is ignored or absent, a new ip configuration with only virtual network subnet will be added to NIC'));
          } else {
            nicUpdateInfo.publicipInfo = ipConfigInfo.publicipInfo;
          }

          networkInterface.ipConfigurations.push(ipConfigInfo.ipConfiguration);
          this._updateNIC(resourceGroupName, nic, _);
          nicUpdateInfo.updated = true;
          return nicUpdateInfo;
        }
      } else {
        // Currently Azure support having only one IP Config per NIC
        existingIpConfiguration = networkInterface.ipConfigurations[0];
        this.cli.output.info(util.format($('Found an IP configuration with virtual network subnet id "%s" in the NIC "%s"'), existingIpConfiguration.subnet.id, networkInterface.name));
      }

      var networkPublicIP = new NetworkPublicIP(this.cli, this.networkResourceProviderClient, this.resourceGroupName, this.params);
      if (utils.hasValidProperty(existingIpConfiguration.publicIpAddress, 'id')) {
        var publicipId = existingIpConfiguration.publicIpAddress.id.toLowerCase();
        if (utils.stringIsNullOrEmpty(this.params.publicipName)) {
          this.cli.output.info(util.format($('This NIC IP configuration has a public ip already configured "%s", any public ip parameters if provided, will be ignored.'), publicipId));
        } else {
          var partialPublicIdFromParams = networkPublicIP.buildIdFromParams();
          if (utils.stringEndsWith(publicipId, partialPublicIdFromParams)) {
            this.cli.output.info(util.format($('This NIC IP configuration is already configured with the provided public ip "%s"'), this.params.publicipName));
          } else {
            this.cli.output.info(util.format($('This NIC IP configuration already has a public ip configured "%s", using this public ip'), publicipId));
          }
        }

        return nicUpdateInfo;
      }

      if (!networkPublicIP.hasAnyPubIPParameters(this.params) && utils.stringIsNullOrEmpty(this.params.publicIpId)) {
        // User want to create a VM without publicIP (its a valid scenario)
        this.cli.output.info($('This is an NIC without publicIP configured'));
        return nicUpdateInfo;
      }

      ipConfigInfo = this._createNewIPConfigurationTrySetPublicIP(existingIpConfiguration.subnet.id, networkInterface.name, _);
      if (!ipConfigInfo.ipConfiguration.publicIpAddress) {
        this.cli.output.info($('public ip parameters is ignored or absent, using this NIC with subnet'));
        return nicUpdateInfo;
      } else {
        this.cli.output.info(util.format($('Configuring identified NIC IP configuration with PublicIP "%s"'), ipConfigInfo.publicipInfo.profile.name));
      }

      existingIpConfiguration.publicIpAddress = ipConfigInfo.ipConfiguration.publicIpAddress;
      this._updateNIC(resourceGroupName, nic, _);
      nicUpdateInfo.publicipInfo = ipConfigInfo.publicipInfo;
      nicUpdateInfo.updated = true;
      return nicUpdateInfo;
    },

    _createNewIPConfigurationTrySetSubnetPublicIP: function (nicName, _) {
      var vnetInfo = this._prepareSubnet(_);
      var ipConfigInfo = this._createNewIPConfigurationTrySetPublicIP(vnetInfo.subnetInfo.profile.id, nicName, _);
      ipConfigInfo.vnetInfo = vnetInfo;
      return ipConfigInfo;
    },

    _createNewIPConfigurationTrySetPublicIP: function (subnetId, nicName, _) {
      var newipConfiguration = {
        subnet: {
          id: subnetId
        },
        name: 'ipconfig' + (new Date()).getTime()
      };

      var ipConfigInfo = {
        publicipInfo: null,
        ipConfiguration: newipConfiguration
      };

      ipConfigInfo.publicipInfo = this._preparePublicIP(_);
      var publicipInfo = ipConfigInfo.publicipInfo;
      if (publicipInfo) {
        newipConfiguration.publicIpAddress = {
          id: publicipInfo.profile.id
        };

        if (utils.hasValidProperty(publicipInfo.profile.ipConfiguration, 'id')) {
          // This is not a new public ip and is already attached to an NIC
          var ipConfigResourceInfo = utils.parseResourceReferenceUri(publicipInfo.profile.ipConfiguration.id);
          var connectedNicName = ipConfigResourceInfo.parentResource.split('/')[1];
          if (utils.ignoreCaseEquals(connectedNicName, nicName) && utils.ignoreCaseEquals(ipConfigResourceInfo.resourceGroupName, this.resourceGroupName)) {
            this.cli.output.info($('The public ip is already attached to this NIC'));
          } else {
            this.cli.output.info(util.format($('The identified PublicIP will not be used since it is attached to a different NIC "%s" in the resource group "%s"'), connectedNicName, ipConfigResourceInfo.resourceGroupName));
            newipConfiguration.publicIpAddress = null;
          }
        }
      }

      return ipConfigInfo;
    },

    _preparePublicIP: function (_) {
      var publicipInfo = null;
      var networkPublicIP = new NetworkPublicIP(this.cli, this.networkResourceProviderClient, this.resourceGroupName, this.params);
      var anyPublicIpParams = networkPublicIP.hasAnyPubIPParameters(this.params);
      if (this.params.publicIpId) {
        this.cli.output.warn($('found publicIpId parameter, any other public-ip-* parameters will be ignored'));
        publicipInfo = networkPublicIP.getPublicIPInfoById(this.params.publicIpId, _);
        if (!publicipInfo.profile) {
          throw new Error(util.format($('a PublicIP with id "%s" not found'), this.params.publicIpId));
        }
      } else {
        if (anyPublicIpParams) {
          this.cli.output.info($('Found public ip parameters, trying to setup PublicIP profile'));
          publicipInfo = networkPublicIP.createPublicIPIfRequired(_);
        }
      }

      return publicipInfo;
    },

    _prepareSubnet: function (_) {
      var vnetInfo = null;
      if (this.params.subnetId) {
        this.cli.output.warn($('found subnetId parameter, any vnet parameters if specified will be ignored'));
        var networkVNetSubnet = new NetworkVNetSubnet(this.cli, this.networkResourceProviderClient, this.resourceGroupName, this.params);
        var subnetInfo = networkVNetSubnet.getSubnetInfoById(this.params.subnetId, _);
        if (!subnetInfo.profile) {
          throw new Error(util.format($('a virtual network subnet with id "%s" not found'), this.params.subnetId));
        }

        vnetInfo = {
          subnetInfo: subnetInfo
        };
      } else {
        var networkVNet = new NetworkVNet(this.cli, this.networkResourceProviderClient, this.resourceGroupName, this.params);
        vnetInfo = networkVNet.createOrUpdateVNetIfRequired(_);
      }

      return vnetInfo;
    },

    _lookupIPConfiguration: function (ipConfigurations, subnetId) {
      var foundIpConfiguration;
      if (ipConfigurations !== null && ipConfigurations.length > 0) {
        for (var i = 0; i < ipConfigurations.length; i++) {
          if (ipConfigurations[i].subnet) {
            // Observation is: there cannot be a nic network-config without subnet so
            // above check always succeeded
            if (ipConfigurations[i].subnet.id === subnetId) {
              foundIpConfiguration = ipConfigurations[i];
              break;
            }
          }
        }
      }

      return foundIpConfiguration ? foundIpConfiguration : null;
    },

    _updateNIC: function (resourceGroupName, nic, _) {
      var progress = this.cli.interaction.progress(util.format($('Updating NIC "%s"'), nic.networkInterface.name));
      try {
        this.networkResourceProviderClient.networkInterfaces.createOrUpdate(resourceGroupName, nic.networkInterface.name, nic.networkInterface, _);
      } finally {
        progress.end();
      }
    },

    _createNewNIC: function (resourceGroupName, params, _) {
      var createRequestProfile = {
        ipConfigurations: [],
        location: params.location,
        name: params.nicName
      };

      var ipConfigInfo = this._createNewIPConfigurationTrySetSubnetPublicIP(params.nicName, _);
      if (!ipConfigInfo.ipConfiguration.publicIpAddress) {
        this.cli.output.info($('No public ip parameters found, the ip configuration of new NIC will have only subnet configured'));
      }

      createRequestProfile.ipConfigurations.push(ipConfigInfo.ipConfiguration);
      var progress = this.cli.interaction.progress(util.format($('Creating NIC "%s"'), params.nicName));
      try {
        this.networkResourceProviderClient.networkInterfaces.createOrUpdate(this.resourceGroupName, params.nicName, createRequestProfile, _);
      } finally {
        progress.end();
      }

      return {
        createRequestProfile: createRequestProfile,
        vnetInfo: ipConfigInfo.vnetInfo,
        publicipInfo: ipConfigInfo.publicipInfo
      };
    },

    _expandNIC: function (nic, depth, memoize, dependencies, _) {
      if (depth === 0 || nic === null) {
        return nic;
      }

      if (depth !== -1) {
        depth--;
      }

      var networkInterface = nic.networkInterface;
      var referenceUri = networkInterface.id.toLowerCase();
      memoize[referenceUri] = nic;

      var ipConfigurations = networkInterface.ipConfigurations;
      if (ipConfigurations instanceof Array) {
        var networkVNetSubnet = new NetworkVNetSubnet(this.cli, this.networkResourceProviderClient, this.resourceGroupName, {});
        var networkPublicIP = new NetworkPublicIP(this.cli, this.networkResourceProviderClient, this.resourceGroupName, {});

        for (var i = 0; i < ipConfigurations.length; i++) {
          var ipConfiguration = ipConfigurations[i];

          if (utils.hasValidProperty(ipConfiguration, 'subnet')) {
            var subnetReferenceId = ipConfiguration.subnet.id.toLowerCase();
            if (!memoize[subnetReferenceId]) {
              ipConfiguration.subnet.expanded = networkVNetSubnet.getSubnetByIdExpanded(subnetReferenceId, depth, memoize, dependencies, _);
            }
          }

          if (utils.hasValidProperty(ipConfiguration, 'publicIpAddress')) {
            var publicIpReferenceId = ipConfiguration.publicIpAddress.id.toLowerCase();
            if (!memoize[publicIpReferenceId]) {
              ipConfiguration.publicIpAddress.expanded = networkPublicIP.getPublicIPByIdExpanded(publicIpReferenceId, depth, memoize, dependencies, _);
            }
          }
        }
      }

      return memoize[referenceUri];
    }
  }
);

module.exports = NetworkNic;