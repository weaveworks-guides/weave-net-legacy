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

function DnsServer(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.networkConfig = new NetworkConfig(cli, networkManagementClient);
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(DnsServer.prototype, {
  list: function (options, _) {
    var self = this;

    var networkConfiguration = self.networkConfig.get(_);
    var vnetConfiguration = networkConfiguration.VirtualNetworkConfiguration;

    if (vnetConfiguration.Dns.DnsServers && vnetConfiguration.Dns.DnsServers.length > 0) {
      self.output.table(vnetConfiguration.Dns.DnsServers, function (row, dns) {
        row.cell($('DNS Server ID'), dns.Name);
        row.cell($('IP Address'), dns.IPAddress);
      });
    } else {
      if (self.output.format().json) {
        self.output.json([]);
      } else {
        self.output.warn($('No DNS servers found'));
      }
    }
  },

  register: function (dnsIp, options, _) {
    var self = this;

    var dnsServer = self._parseDnsServer(dnsIp, options);
    var networkConfig = self.networkConfig.get(_);

    if (!networkConfig.VirtualNetworkConfiguration) {
      networkConfig.VirtualNetworkConfiguration = {};
    }

    var vnetConfig = networkConfig.VirtualNetworkConfiguration;
    if (!vnetConfig.Dns) {
      vnetConfig.Dns = {};
    }

    if (!vnetConfig.Dns.DnsServers) {
      vnetConfig.Dns.DnsServers = [];
    }

    if (utils.findFirstCaseIgnore(vnetConfig.Dns.DnsServers, {Name: dnsServer.Name})) {
      throw new Error(util.format($('A DNS Server with name identifier "%s" already exists'), dnsServer.Name));
    }

    if (utils.findFirstCaseIgnore(vnetConfig.Dns.DnsServers, {IPAddress: dnsServer.IPAddress})) {
      throw new Error(util.format($('A DNS Server with ip address "%s" already exists'), dnsServer.IPAddress));
    }

    vnetConfig.Dns.DnsServers.push(dnsServer);
    self.networkConfig.set(networkConfig, _);
  },

  unregister: function (dnsIp, options, _) {
    var self = this;

    if (dnsIp && options.dnsId) {
      throw new Error($('Either --dns-id or --dns-ip must be present not both'));
    }

    if (!dnsIp && !options.dnsId) {
      dnsIp = self.interaction.promptIfNotGiven($('DNS IP: '), dnsIp, _);
    }

    var filter;
    if (dnsIp) {
      var ipValidationResult = self.vnetUtil.parseIPv4(dnsIp);
      if (ipValidationResult.error) {
        throw new Error(ipValidationResult.error);
      }
      filter = {IPAddress: dnsIp};
    } else {
      filter = {Name: options.dnsId};
    }

    var networkConfiguration = self.networkConfig.get(_);
    var vnetConfiguration = networkConfiguration.VirtualNetworkConfiguration;

    var dnsServer = utils.findFirstCaseIgnore(vnetConfiguration.Dns.DnsServers, filter);
    if (!dnsServer) {
      throw new Error(util.format($('A DNS Server with %s %s not found'), options.dnsId ? $('name identifier') : $('IP address'), dnsIp || options.dnsId));
    }

    vnetConfiguration.VirtualNetworkSites.forEach(function (site) {
      if (site.DnsServersRef) {
        if (utils.findFirstCaseIgnore(site.DnsServersRef, {Name: dnsServer.Name})) {
          throw new Error(util.format($('You cannot unregister DNS server "%s", because it is being referenced by the virtual network "%s"'), dnsServer.Name, site.Name));
        }
      }
    });

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete the DNS server "%s" (%s)? [y/n] '), dnsServer.Name, dnsServer.IPAddress), _)) {
      return;
    }

    var index = utils.indexOfCaseIgnore(vnetConfiguration.Dns.DnsServers, filter);
    vnetConfiguration.Dns.DnsServers.splice(index, 1);
    self.networkConfig.set(networkConfiguration, _);
  },

  _parseDnsServer: function (dnsIp, options) {
    var self = this;

    var dnsServer = {
      Name: '',
      IPAddress: ''
    };

    if (options.dnsId) {
      var dnsIdPattern = /^[a-z][a-z0-9\-]{0,19}$/i;
      if (dnsIdPattern.test(options.dnsId) === false) {
        throw new Error($('--dns-id can contain only letters, numbers and hyphens with no more than 20 characters. It must start with a letter'));
      }
      dnsServer.Name = options.dnsId;
    } else {
      dnsServer.Name = util.format($('DNS-%s'), crypto.randomBytes(8).toString('hex'));
      self.output.info(util.format($('The name identifier for this DNS server will be "%s"'), dnsServer.Name));
    }


    var ipValidationResult = self.vnetUtil.parseIPv4(dnsIp);
    if (ipValidationResult.error) {
      throw new Error(ipValidationResult.error);
    }
    dnsServer.IPAddress = self.vnetUtil.octectsToString(ipValidationResult.octects);

    return dnsServer;
  }
});

module.exports = DnsServer;
