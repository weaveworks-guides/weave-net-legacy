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
var tagUtils = require('../tag/tagUtils');
var VNetUtil = require('../../../util/vnet.util');

function VirtualNetwork(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(VirtualNetwork.prototype, {
  create: function (resourceGroupName, name, location, options, _) {
    var self = this;
    var vnet = self.get(resourceGroupName, name, null, _);

    if (vnet) {
      throw new Error(util.format($('Virtual network "%s" already exists in resource group "%s"'), name, resourceGroupName));
    }

    var requestBody = {
      name: name,
      location: location,
      addressSpace: {
        addressPrefixes: []
      },
      dhcpOptions: {
        dnsServers: []
      }
    };

    if (options.addressPrefixes) {
      self._addAddressPrefixes(options, requestBody);
    } else {
      var defaultAddressPrefix = self.vnetUtil.defaultAddressSpaceInfo().ipv4Cidr;
      self.output.verbose(util.format($('Using default address prefix: %s'), defaultAddressPrefix));
      requestBody.addressSpace.addressPrefixes.push(defaultAddressPrefix);
    }

    if (options.dnsServers) {
      self._addDnsServers(options, requestBody);
    } else {
      self.output.verbose($('No DNS server specified'));
    }

    if (options.tags) {
      var tags = tagUtils.buildTagsParameter(null, options);
      requestBody.tags = tags;
    } else {
      self.output.verbose($('No tags specified'));
    }

    var progress = self.interaction.progress(util.format($('Creating virtual network "%s"'), name));
    try {
      self.networkResourceProviderClient.virtualNetworks.createOrUpdate(resourceGroupName, name, requestBody, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, name, 'Loading virtual network state', _);
  },

  set: function (resourceGroupName, name, options, _) {
    var self = this;
    var vnet = self.get(resourceGroupName, name, null, _);

    if (!vnet) {
      throw new Error(util.format($('Virtual network "%s" not found in resource group "%s"'), name, resourceGroupName));
    }

    if (options.addressPrefixes) {
      vnet.addressSpace.addressPrefixes = [];
      self._addAddressPrefixes(options, vnet);
    }

    var optionalDnsServers = utils.getOptionalArg(options.dnsServers);
    if (optionalDnsServers.hasValue) {
      if (optionalDnsServers.value !== null) {
        self._addDnsServers(options, vnet);
      } else {
        self.output.verbose($('Clearing DNS servers'));
        vnet.dhcpOptions.dnsServers = [];
      }
    }

    if (options.tags === false) {
      vnet.tags = {};
    }

    if (options.tags) {
      var tags = tagUtils.buildTagsParameter(vnet.tags, options);
      for (var key in tags) {
        vnet.tags[key] = tags[key];
      }
    }

    var progress = self.interaction.progress(util.format($('Updating virtual network "%s"'), name));
    try {
      self.networkResourceProviderClient.virtualNetworks.createOrUpdate(resourceGroupName, name, vnet, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, name, 'Loading virtual network state', _);
  },

  list: function (resourceGroupName, _) {
    var self = this;
    var progress = self.interaction.progress('Listing virtual networks');

    var vnets = null;
    try {
      vnets = self.networkResourceProviderClient.virtualNetworks.list(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(vnets.virtualNetworks, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn($('No virtual networks found'));
      } else {
        self.output.table(outputData, function (row, vnet) {
          row.cell($('ID'), vnet.id);
          row.cell($('Name'), vnet.name);
          row.cell($('Location'), vnet.location);
          row.cell($('Address prefixes'), vnet.addressSpace.addressPrefixes);
          var dnsServers = '';
          if (vnet.dhcpOptions) {
            dnsServers = vnet.dhcpOptions.dnsServers;
          }
          row.cell($('DNS servers'), dnsServers);
        });
      }
    });
  },

  show: function (resourceGroupName, name, message, _) {
    var self = this;
    var vnet = self.get(resourceGroupName, name, message, _);

    self.interaction.formatOutput(vnet, function (vnet) {
      if (vnet === null) {
        self.output.warn(util.format($('Virtual network "%s" not found'), name));
      } else {
        vnetShowUtil.show(vnet, self.output);
      }
    });
  },

  delete: function (resourceGroupName, name, options, _) {
    var self = this;
    var vnet = self.get(resourceGroupName, name, null, _);

    if (!vnet) {
      self.output.error(util.format('Virtual network "%s" not found', name));
      return;
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete virtual network %s? [y/n] '), name), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting virtual network "%s"'), name));
    try {
      self.networkResourceProviderClient.virtualNetworks.deleteMethod(resourceGroupName, name, _);
    } finally {
      progress.end();
    }
  },

  get: function (resourceGroupName, name, message, _) {
    var self = this;

    message = message || util.format($('Looking up virtual network "%s"'), name);
    var progress = self.interaction.progress(message);

    var vnet = null;
    try {
      vnet = self.networkResourceProviderClient.virtualNetworks.get(resourceGroupName, name, _);
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }

    return vnet.virtualNetwork;
  },

  _addDnsServers: function (options, vnet) {
    var self = this;
    var dnsServers = options.dnsServers.split(',');

    for (var dnsNum in dnsServers) {
      var dnsServer = dnsServers[dnsNum];
      var dnsIndex = vnet.dhcpOptions.dnsServers.indexOf(dnsServer);
      if (dnsIndex >= 0) {
        continue;
      }

      var parsedDnsIp = self.vnetUtil.parseIPv4(dnsServer);
      if (parsedDnsIp.error) {
        throw new Error(parsedDnsIp.error);
      }

      vnet.dhcpOptions.dnsServers.push(dnsServer);
    }
  },

  _addAddressPrefixes: function (options, vnet) {
    var self = this;
    var addressPrefixes = options.addressPrefixes.split(',');

    for (var addNum in addressPrefixes) {
      var addressPrefix = addressPrefixes[addNum];
      var parsedAddressPrefix = self.vnetUtil.parseIPv4Cidr(addressPrefix);
      if (parsedAddressPrefix.error) {
        throw new Error(parsedAddressPrefix.error);
      }

      vnet.addressSpace.addressPrefixes.push(addressPrefix);
    }

    for (var i = 0; i < addressPrefixes.length; i++) {
      var addPrefixToCheck = addressPrefixes[i];
      for (var j = 0; j < addressPrefixes.length; j++) {
        var addPrefixToCompare = addressPrefixes[j];
        if (i === j) {
          continue;
        }

        var overlapped = self.vnetUtil.isCidrsOverlapping(addPrefixToCheck, addPrefixToCompare);
        if (overlapped) {
          throw new Error(util.format($('Address prefix "%s" overlaps address prefix "%s"'), addPrefixToCheck, addPrefixToCompare));
        }
      }
    }
  }
});

module.exports = VirtualNetwork;