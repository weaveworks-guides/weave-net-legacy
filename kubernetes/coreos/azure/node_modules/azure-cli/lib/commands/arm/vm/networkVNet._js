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
var NetworkVNetSubnet = require('./networkVNetSubnet');

var $ = utils.getLocaleString;

function NetworkVNet(cli, networkResourceProviderClient, resourceGroupName, params) {
  this.cli = cli;
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.resourceGroupName = resourceGroupName;
  this.params = params;

}

__.extend(NetworkVNet.prototype, {
    _parseVNetCreateParams: function (params, parseSubnetParams, _) {
      if (utils.stringIsNullOrEmpty(params.vnetName)) {
        params.vnetName = this.cli.interaction.prompt($('Enter vnet name: '), _);
      }

      if (utils.stringIsNullOrEmpty(params.vnetAddressPrefix)) {
        params.vnetAddressPrefix = this.cli.interaction.prompt($('Enter vnet address prefix: '), _);
      }

      if (utils.stringIsNullOrEmpty(params.location)) {
        params.location = this.cli.interaction.prompt($('Enter location: '), _);
      }

      var createRequestProfile = {
        addressSpace: {
          addressPrefixes: [params.vnetAddressPrefix]
        },
        dhcpOptions: {
          dnsServers: []
        },
        ipConfigurations: [],
        subnets: [],
        location: params.location,
        name: params.vnetName
      };

      var subnetProfile = parseSubnetParams(params, _);
      createRequestProfile.subnets.push(subnetProfile);
      return createRequestProfile;
    },

    createOrUpdateVNetIfRequired: function (_) {
      if (utils.stringIsNullOrEmpty(this.params.vnetName)) {
        this.params.vnetName = this.cli.interaction.prompt($('Enter vnet name: '), _);
      }

      var networkVNetSubnet = new NetworkVNetSubnet(this.cli, this.networkResourceProviderClient, this.resourceGroupName, this.params);
      var vnetInfo = this.getVNetInfoByName(this.resourceGroupName, this.params.vnetName, _);
      if (vnetInfo.profile) {
        if (!utils.ignoreCaseAndSpaceEquals(vnetInfo.profile.location, this.params.location)) {
          throw new Error(util.format($('Found a virtual network with name "%s" but it exists in different region "%s"'), vnetInfo.vnetName, vnetInfo.profile.location));
        }

        this.cli.output.info((util.format($('Found an existing virtual network "%s"'), vnetInfo.vnetName)));
        this._printSubnets(vnetInfo.profile.subnets);
        this.cli.output.info($('Verifying subnet'));
        vnetInfo.subnetInfo = networkVNetSubnet.createSubnetIfRequired(_);
      } else {
        // Create new virtual network along with subnet
        var createRequestProfile = this._createNewVNet(vnetInfo.resourceGroupName, this.params, _);
        // Once created, pull the virtual network so we get it's resource ID
        vnetInfo = this.getVNetInfoByName(vnetInfo.resourceGroupName, vnetInfo.vnetName, _);
        vnetInfo.createdNew = true;
        vnetInfo.createRequestProfile = createRequestProfile;
        // Subnet created as a part of request to virtual network so we need to populate the subnetinfo
        vnetInfo.subnetInfo = networkVNetSubnet.getSubnetInfoByName(vnetInfo.resourceGroupName, vnetInfo.vnetName, this.params.vnetSubnetName, _);
        vnetInfo.subnetInfo.createdNew = true;
      }

      return vnetInfo;
    },

    getVNetInfoById: function (referenceUri, _) {
      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      return this.getVNetInfoByName(resourceInfo.resourceGroupName, resourceInfo.resourceName, _);
    },

    getVNetInfoByName: function (resourceGroupName, vnetName, _) {
      var vnetInfo = {
        vnetName: vnetName,
        resourceGroupName: resourceGroupName,
        createdNew: false,
        profile: null,
        createRequestProfile: {},
        subnetInfo: {}
      };

      var vnet = this._getVNet(resourceGroupName, vnetName, _);
      if (vnet) {
        vnetInfo.profile = vnet.virtualNetwork;
      }

      return vnetInfo;
    },

    _getVNet: function (resourceGroupName, vnetName, _) {
      var progress = this.cli.interaction.progress(util.format($('Looking up the virtual network "%s"'), vnetName));
      try {
        var vnet = this.networkResourceProviderClient.virtualNetworks.get(resourceGroupName, vnetName, _);
        return vnet;
      } catch (e) {
        if (e.code === 'ResourceNotFound') {
          return null;
        }
        throw e;
      } finally {
        progress.end();
      }
    },

    _createNewVNet: function (resourceGroupName, params, _) {
      var networkVNetSubnet = new NetworkVNetSubnet(this.cli, this.networkResourceProviderClient, resourceGroupName, params);
      this.cli.output.info($('Preparing to create new virtual network and subnet'));
      var getVNetSubnetProfile = __.bind(networkVNetSubnet.getVNetSubnetProfile, networkVNetSubnet);
      var createRequestProfile = this._parseVNetCreateParams(this.params, getVNetSubnetProfile, _);
      var progress = this.cli.interaction.progress(util.format($('Creating a new virtual network "%s" [address prefix: "%s"] with subnet "%s" [address prefix: "%s"]'), params.vnetName, params.vnetAddressPrefix, params.vnetSubnetName, params.vnetSubnetAddressprefix));
      try {
        this.networkResourceProviderClient.virtualNetworks.createOrUpdate(this.resourceGroupName, params.vnetName, createRequestProfile,  _);
        return createRequestProfile;
      } finally {
        progress.end();
      }
    },

    _printSubnets: function (subnets) {
      var info = this.cli.output.info;
      if (subnets instanceof Array) {
        info('Existing Subnets:');
        subnets.forEach(function (subnet) {
          info('  ' + subnet.name + ':' + subnet.addressPrefix);
        });
      }
    },

    hasAnyVNetParameters: function(params) {
      var allVNetParams = [
        params.vnetName,
        params.vnetDnsserver,
        params.vnetAddressPrefix,
        params.vnetSubnetName,
        params.vnetSubnetAddressprefix,
        params.vnetSubnetDnsserver
      ];

      return utils.atLeastOneParameIsSet(allVNetParams);
    }
  }
);


module.exports = NetworkVNet;