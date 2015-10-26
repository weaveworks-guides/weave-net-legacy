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

function NetworkVNetSubnet (cli, networkResourceProviderClient, resourceGroupName, params) {
    this.cli = cli;
    this.networkResourceProviderClient = networkResourceProviderClient;
    this.resourceGroupName = resourceGroupName;
    this.params = params;

}

__.extend(NetworkVNetSubnet.prototype, {
    _parseSubnetCreateParams: function (params, _) {
      if (utils.stringIsNullOrEmpty(params.vnetName)) {
        params.vnetName = this.cli.interaction.prompt($('Enter vnet name: '), _);
      }

      if (utils.stringIsNullOrEmpty(params.vnetSubnetName)) {
        params.vnetSubnetName = this.cli.interaction.prompt($('Enter vnet subnet name: '), _);
      }

      if (utils.stringIsNullOrEmpty(params.vnetSubnetAddressprefix)) {
        params.vnetSubnetAddressprefix = this.cli.interaction.prompt($('Enter vnet subnet address prefix: '), _);
      }

      var createRequestProfile = {
        addressPrefix: params.vnetSubnetAddressprefix,
        dhcpOptions: {
          dnsServers: []
        },
        ipConfigurations: [],
        name: params.vnetSubnetName
      };

      if (!utils.stringIsNullOrEmpty(params.vnetSubnetDnsserver)) {
        createRequestProfile.dhcpOptions.dnsServers.push(params.vnetSubnetDnsserver);
      }

      return createRequestProfile;
    },

    getVNetSubnetProfile: function (params, _) {
      return this._parseSubnetCreateParams(params, _);
    },

    createSubnetIfRequired: function (_) {
      if (utils.stringIsNullOrEmpty(this.params.vnetName)) {
        this.params.vnetName = this.cli.interaction.prompt($('Enter vnet name: '), _);
      }

      if (utils.stringIsNullOrEmpty(this.params.vnetSubnetName)) {
        this.params.vnetSubnetName = this.cli.interaction.prompt($('Enter vnet subnet name: '), _);
      }

      var subnetInfo = this.getSubnetInfoByName(this.resourceGroupName, this.params.vnetName, this.params.vnetSubnetName, _);
      if (subnetInfo.profile) {
        this.cli.output.info(util.format($('Subnet with given name "%s" exists under the virtual network "%s", using this subnet'), subnetInfo.subnetName, subnetInfo.vnetName));
      } else {
        this.cli.output.info(util.format($('Subnet with given name not found "%s" under the virtual network "%s", creating a new one'), subnetInfo.subnetName, subnetInfo.vnetName));
        var createRequestProfile = this._createNewSubnet(subnetInfo.resourceGroupName, this.params, _);
        // Once created, pull the Subnet so we get it's resource ID
        subnetInfo = this.getSubnetInfoByName(subnetInfo.resourceGroupName, subnetInfo.vnetName, subnetInfo.subnetName, _);
        subnetInfo.createdNew = true;
        subnetInfo.createRequestProfile = createRequestProfile;
      }

      return subnetInfo;
    },

    getSubnetInfoById: function (referenceUri, _) {
      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      var parentVnetName = resourceInfo.parentResource.split('/')[1];
      return this.getSubnetInfoByName(resourceInfo.resourceGroupName, parentVnetName, resourceInfo.resourceName, _);
    },

    getSubnetInfoByName: function (resourceGroupName, vnetName, subnetName, _) {
      var subnetInfo = {
        vnetName: vnetName,
        subnetName: subnetName,
        resourceGroupName: resourceGroupName,
        createdNew: false,
        createRequestProfile: {},
        profile: null
      };

      var subnet = this._getSubnet(resourceGroupName, vnetName, subnetName, _);
      if (subnet) {
        subnetInfo.profile = subnet.subnet;
      }

      return subnetInfo;
    },

    getSubnetByIdExpanded: function (referenceUri, depth, memoize, dependencies, _) {
      referenceUri = referenceUri.toLowerCase();
      if (memoize[referenceUri]) {
        return memoize[referenceUri];
      }

      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      var parentVnetName = resourceInfo.parentResource.split('/')[1];
      var expandedSubnet = this.getSubnetByNameExpanded(resourceInfo.resourceGroupName, parentVnetName, resourceInfo.resourceName, depth, memoize, dependencies, _);
      return expandedSubnet;
    },

    getSubnetByNameExpanded: function (resourceGroupName, vnetName, subnetName, depth, memoize, dependencies, _) {
      var subnet = this._getSubnet(resourceGroupName, vnetName, subnetName, _);
      var expandedSubnet = this._expandSubnet(subnet, depth, memoize);
      return expandedSubnet;
    },

    _expandSubnet: function (subnet, depth, memoize) {
      if (depth === 0 || subnet === null) {
        return subnet;
      }

      if (depth !== -1) {
        depth--;
      }

      var snet = subnet.subnet;
      var referenceUri = snet.id.toLowerCase();

      memoize[referenceUri] = subnet;
      // Subnet is one of the leaf there is no more expandable connected resources references.
      return  memoize[referenceUri];
    },

    _getSubnet: function (resourceGroupName, vnetName, subnetName, _) {
      var progress = this.cli.interaction.progress(util.format($('Looking up the subnet "%s" under the virtual network "%s"'), subnetName, vnetName));
      try {
        var subnet = this.networkResourceProviderClient.subnets.get(resourceGroupName, vnetName, subnetName, _);
        return subnet;
      } catch (e) {
        // Note: Unlike other resources, if resources does not exists azure is not throws 'NotFound' instead of
        // 'ResourceNotFound'
        if (e.code === 'NotFound' || e.code === 'ResourceNotFound') {
          return null;
        }
        throw e;
      } finally {
        progress.end();
      }
    },

    _createNewSubnet: function (resourceGroupName, params, _) {
      var createRequestProfile = this._parseSubnetCreateParams(params, _);
      var progress = this.cli.interaction.progress(util.format($('Creating subnet "%s" [Address prefix "%s"] under the virtual network "%s"'), params.vnetSubnetName, params.vnetSubnetAddressprefix, params.vnetName));
      try {
        this.networkResourceProviderClient.subnets.createOrUpdate(resourceGroupName, params.vnetName, params.vnetSubnetName, createRequestProfile,  _);
        return createRequestProfile;
      } finally {
        progress.end();
      }
    },

    hasAnySubnetParameters: function(params) {
      var allSubnetParams = [
        params.vnetSubnetName,
        params.vnetSubnetAddressprefix,
        params.vnetSubnetDnsserver
      ];

      return utils.atLeastOneParameIsSet(allSubnetParams);
    }
  }
);

module.exports = NetworkVNetSubnet;