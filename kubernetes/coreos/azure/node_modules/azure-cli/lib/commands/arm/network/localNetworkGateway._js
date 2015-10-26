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
var VNetUtil = require('./../../../util/vnet.util');
var resourceUtils = require('../resource/resourceUtils');
var tagUtils = require('../tag/tagUtils');

function LocalNetworkGateway(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(LocalNetworkGateway.prototype, {
  create: function (resourceGroupName, name, options, _) {
    var self = this;
    self._validate(options);

    var parameters = self._parse(name, options);

    var gateway = self.get(resourceGroupName, name, _);
    if (gateway) {
      throw new Error(util.format($('A local network gateway with name "%s" already exists in the resource group "%s"'), name, resourceGroupName));
    }

    self._createOrUpdate(resourceGroupName, name, parameters, true, _);
    self.show(resourceGroupName, name, options, _);
  },

  set: function (resourceGroupName, name, options, _) {
    var self = this;
    self._validate(options);

    var gateway = self.get(resourceGroupName, name, _);
    if (!gateway) {
      throw new Error(util.format($('A local network gateway with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    var parameters = self._parse(name, options, gateway);

    self._createOrUpdate(resourceGroupName, name, parameters, false, _);
    self.show(resourceGroupName, name, options, _);
  },

  list: function (resourceGroupName, options, _) {
    var self = this;
    var networks = null;

    var progress = self.interaction.progress($('Looking up local networks'));
    try {
      networks = self.networkResourceProviderClient.localNetworkGateways.list(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(networks.localNetworkGateways, function (data) {
      if (data.length === 0) {
        self.output.warn($('No local network gateways found'));
      } else {
        self.output.table(data, function (row, gateway) {
          row.cell($('Name'), gateway.name);
          row.cell($('Location'), gateway.location);
          row.cell($('IP Address'), gateway.gatewayIpAddress);
          var addressPrefixes = gateway.localNetworkAddressSpace.addressPrefixes;
          var address = addressPrefixes[0];
          if (addressPrefixes.length > 1) address += ', ...';
          row.cell($('Address prefixes'), address);
        });
      }
    });
  },

  show: function (resourceGroupName, name, options, _) {
    var self = this;
    var gateway = self.get(resourceGroupName, name, _);

    self.interaction.formatOutput(gateway, function (gateway) {
      if (gateway === null) {
        self.output.warn(util.format($('A local network gateway with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
      } else {
        var resourceInfo = resourceUtils.getResourceInformation(gateway.id);
        self.output.nameValue($('Id'), gateway.id);
        self.output.nameValue($('Name'), gateway.name);
        self.output.nameValue($('Type'), resourceInfo.resourceType);
        self.output.nameValue($('Location'), gateway.location);
        self.output.nameValue($('Provisioning state'), gateway.provisioningState);
        self.output.nameValue($('Tags'), tagUtils.getTagsInfo(gateway.tags));
        self.output.nameValue($('IP Address'), gateway.gatewayIpAddress);
        self.output.header('Address prefixes');
        gateway.localNetworkAddressSpace.addressPrefixes.forEach(function (address) {
          self.output.listItem(address, 2);
        });
      }
    });
  },

  delete: function (resourceGroupName, name, options, _) {
    var self = this;
    var gateway = self.get(resourceGroupName, name, _);

    if (!gateway) {
      throw new Error(util.format($('A local network gateway with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete local network gateway "%s"? [y/n] '), name), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting local network gateway "%s"'), name));
    try {
      self.networkResourceProviderClient.localNetworkGateways.deleteMethod(resourceGroupName, name, _);
    } finally {
      progress.end();
    }
  },

  get: function (resourceGroupName, name, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up local network gateway "%s"'), name));

    try {
      var gateway = self.networkResourceProviderClient.localNetworkGateways.get(resourceGroupName, name, _);
      return gateway.localNetworkGateway;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  _createOrUpdate: function (resourceGroupName, name, parameters, isCreating, _) {
    var self = this;
    var action = isCreating ? 'Creating' : 'Updating';
    var progress = self.interaction.progress(util.format($('%s local network gateway "%s"'), action, name));

    try {
      self.networkResourceProviderClient.localNetworkGateways.createOrUpdate(resourceGroupName, name, parameters, _);
    } finally {
      progress.end();
    }
  },

  _validate: function (options) {
    var self = this;

    if (options.ipAddress) {
      var ipValidation = self.vnetUtil.parseIPv4(options.ipAddress, '--ip-address');
      if (ipValidation.error) {
        throw new Error(ipValidation.error);
      }
    }

    if (options.addressSpace) {
      options.addressSpace.split(',').forEach(function (addressPrefix) {
        var cidrValidation = self.vnetUtil.parseIPv4Cidr(addressPrefix, '--address-space');
        if (cidrValidation.error) {
          throw new Error(cidrValidation.error);
        }
      });
    }
  },

  _parse: function (name, options, gateway) {
    var parameters = {
      localNetworkAddressSpace: {
        addressPrefixes: []
      },
      gatewayIpAddress: '',
      location: '',
      tags: {}
    };

    if (gateway) parameters = gateway;

    if (options.addressSpace) {
      options.addressSpace.split(',').forEach(function (addressPrefix) {
        parameters.localNetworkAddressSpace.addressPrefixes.push(addressPrefix);
      });
    }

    if (options.ipAddress) {
      parameters.gatewayIpAddress = options.ipAddress;
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

    return parameters;
  }
});

module.exports = LocalNetworkGateway;