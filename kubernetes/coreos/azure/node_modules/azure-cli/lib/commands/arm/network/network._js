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

'use strict';

var util = require('util');
var utils = require('../../../util/utils');
var profile = require('../../../util/profile/index');
var constants = require('./constants');
var $ = utils.getLocaleString;

var VirtualNetwork = require('./virtualNetwork');
var Subnet = require('./subnet');
var LoadBalancer = require('./loadBalancer');
var PublicIp = require('./publicIp');
var Nic = require('./nic');
var Nsg = require('./nsg');
var DnsZone = require('./dnsZone');
var DnsRecordSet = require('./dnsRecordSet');
var TrafficManager = require('./trafficManager');
var RouteTable = require('./routeTable');
var LocalNetworkGateway = require('./localNetworkGateway');
var VirtualNetworkGateway = require('./virtualNetworkGateway');

exports.init = function (cli) {
  var network = cli.category('network')
    .description($('Commands to manage network resources'));

  var vnet = network.category('vnet')
    .description($('Commands to manage virtual networks'));

  vnet.command('create [resource-group] [name] [location]')
    .description('Create a virtual network')
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network'))
    .option('-l, --location <location>', $('the location'))
    .option('-a, --address-prefixes <address-prefixes>', $('the comma separated list of address prefixes for this virtual network.' +
    '\n     For example -a 10.0.0.0/24,10.0.1.0/24.' +
    '\n     Default value is 10.0.0.0/8'))
    .option('-d, --dns-servers <dns-servers>', $('the comma separated list of DNS servers IP addresses'))
    .option('-t, --tags <tags>', $('the tags set on this virtual network.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var virtualNetwork = new VirtualNetwork(cli, networkResourceProviderClient);
      virtualNetwork.create(resourceGroup, name, location, options, _);
    });

  vnet.command('set [resource-group] [name]')
    .description('Set virtual network')
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network'))
    .option('-a, --address-prefixes <address-prefixes>', $('the comma separated list of address prefixes for this virtual network.' +
    '\n     For example -a 10.0.0.0/24,10.0.1.0/24.' +
    '\n     This list will be appended to the current list of address prefixes.' +
    '\n     The address prefixes in this list should not overlap between them.' +
    '\n     The address prefixes in this list should not overlap with existing address prefixes in the vnet.'))
    .option('-d, --dns-servers [dns-servers]', $('the comma separated list of DNS servers IP addresses.' +
    '\n     This list will be appended to the current list of DNS server IP addresses.'))
    .option('-t, --tags <tags>', $('the tags set on this virtual network.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional. For example, -t "tag1=value1;tag2".' +
    '\n     Existing tag values will be replaced by the values specified.'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var virtualNetwork = new VirtualNetwork(cli, networkResourceProviderClient);
      virtualNetwork.set(resourceGroup, name, options, _);
    });

  vnet.command('list [resource-group]')
    .description('Get all virtual networks')
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var virtualNetwork = new VirtualNetwork(cli, networkResourceProviderClient);
      virtualNetwork.list(resourceGroup, _);
    });

  vnet.command('show [resource-group] [name]')
    .description('Get a virtual network')
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var virtualNetwork = new VirtualNetwork(cli, networkResourceProviderClient);
      virtualNetwork.show(resourceGroup, name, null, _);
    });

  vnet.command('delete [resource-group] [name]')
    .description('Delete a virtual network')
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var virtualNetwork = new VirtualNetwork(cli, networkResourceProviderClient);
      virtualNetwork.delete(resourceGroup, name, options, _);
    });

  var subnet = vnet.category('subnet')
    .description($('Commands to manage virtual network subnets'));

  subnet.command('create [resource-group] [vnet-name] [name]')
    .description($('Create virtual network subnet'))
    .usage('[options] <resource-group> <vnet-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the name of the subnet'))
    .option('-a, --address-prefix <address-prefix>', $('the address prefix'))
    .option('-w, --network-security-group-id <network-security-group-id>', $('the network security group identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/networkSecurityGroups/<nsg-name>'))
    .option('-o, --network-security-group-name <network-security-group-name>', $('the network security group name'))
    .option('-i, --route-table-id <route-table-id>', $('the route table identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/routeTables/<route-table-name>'))
    .option('-r, --route-table-name <route-table-name>', $('the route table name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, vnetName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Subnet name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var subnet = new Subnet(cli, networkResourceProviderClient);
      subnet.create(resourceGroup, vnetName, name, options, _);
    });

  subnet.command('set [resource-group] [vnet-name] [name]')
    .description($('Set a virtual network subnet'))
    .usage('[options] <resource-group> <vnet-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the name of the subnet'))
    .option('-a, --address-prefix <address-prefix>', $('the address prefix'))
    .option('-w, --network-security-group-id [network-security-group-id]', $('the network security group identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/networkSecurityGroups/<nsg-name>'))
    .option('-o, --network-security-group-name <network-security-group-name>', $('the network security group name'))
    .option('-i, --route-table-id <route-table-id>', $('the route table identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/routeTables/<route-table-name>'))
    .option('-r, --route-table-name <route-table-name>', $('the route table name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, vnetName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Subnet name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var subnet = new Subnet(cli, networkResourceProviderClient);
      subnet.set(resourceGroup, vnetName, name, options, _);
    });

  subnet.command('list [resource-group] [vnet-name]')
    .description($('Get all virtual network subnets'))
    .usage('[options] <resource-group> <vnet-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, vnetName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var subnet = new Subnet(cli, networkResourceProviderClient);
      subnet.list(resourceGroup, vnetName, options, _);
    });

  subnet.command('show [resource-group] [vnet-name] [name]')
    .description($('Get a virtual network subnet'))
    .usage('[options] <resource-group> <vnet-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the name of the subnet'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, vnetName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Subnet name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var subnet = new Subnet(cli, networkResourceProviderClient);
      subnet.show(resourceGroup, vnetName, name, options, _);
    });

  subnet.command('delete [resource-group] [vnet-name] [name]')
    .description($('Delete a subnet of a virtual network'))
    .usage('[options] <resource-group> <vnet-name> <subnet-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the subnet name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, vnetName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Subnet name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var subnet = new Subnet(cli, networkResourceProviderClient);
      subnet.delete(resourceGroup, vnetName, name, options, _);
    });

  var lb = network.category('lb')
    .description($('Commands to manage load balancers'));

  lb.command('create [resource-group] [name] [location]')
    .description($('Create a load balancer'))
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the load balancer'))
    .option('-l, --location <location>', $('the location'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional. For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Load balancer name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.create(resourceGroup, name, location, options, _);
    });

  lb.command('list [resource-group]')
    .description($('Get all load balancers'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.list(resourceGroup, _);
    });

  lb.command('show [resource-group] [name]')
    .description($('Get a load balancer'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Load balancer name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.show(resourceGroup, name, options, _);
    });

  lb.command('delete [resource-group] [name]')
    .description($('Delete a load balancer'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the load balancer'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Load balancer name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.delete(resourceGroup, name, options, _);
    });

  var lbProbe = lb.category('probe')
    .description($('Commands to manage probes of a load balancer'));

  lbProbe.command('create [resource-group] [lb-name] [name]')
    .description($('Add a probe to the load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the probe'))
    .option('-p, --protocol <protocol>', $('the probe protocol'))
    .option('-o, --port <port>', $('the probe port'))
    .option('-f, --path <path>', $('the probe path'))
    .option('-i, --interval <interval>', $('the probe interval in seconds'))
    .option('-c, --count <count>', $('the number of probes'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Probe name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.createProbe(resourceGroup, lbName, name, options, _);
    });

  lbProbe.command('set [resource-group] [lb-name] [name]')
    .usage('[options] <resource-group> <lb-name> <name>')
    .description($('Set a probe of a load balancer'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the probe'))
    .option('-e, --new-probe-name <new-probe-name>', $('the new name of the probe'))
    .option('-p, --protocol <protocol>', $('the new value for probe protocol'))
    .option('-o, --port <port>', $('the new value for probe port'))
    .option('-f, --path <path>', $('the new value for probe path'))
    .option('-i, --interval <interval>', $('the new value for probe interval in seconds'))
    .option('-c, --count <count>', $('the new value for number of probes'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Probe name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.setProbe(resourceGroup, lbName, name, options, _);
    });

  lbProbe.command('list [resource-group] [lb-name]')
    .description($('Get all probes in a load balancer'))
    .usage('[options] <resource-group> <lb-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.listProbes(resourceGroup, lbName, options, _);
    });

  lbProbe.command('delete [resource-group] [lb-name] [name]')
    .description($('Delete a probe from a load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the probe name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Probe name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.deleteProbe(resourceGroup, lbName, name, options, _);
    });

  var lbFrontendIP = lb.category('frontend-ip')
    .description('Commands to manage frontend ip configurations of a load balancer');

  lbFrontendIP.command('create [resource-group] [lb-name] [name]')
    .description($('Add a frontend ip configuration to the load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the frontend ip configuration'))
    .option('-a, --private-ip-address <private-ip-address>', $('the private ip address'))
    .option('-u, --public-ip-id <public-ip-id>', $('the public ip identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/publicIPAddresses/<public-ip-name>'))
    .option('-i, --public-ip-name <public-ip-name>', $('the public ip name.' +
    '\n     This public ip must exist in the same resource group as the lb.' +
    '\n     Please use public-ip-id if that is not the case.'))
    .option('-b, --subnet-id <subnet-id>', $('the subnet id.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/VirtualNetworks/<vnet-name>/subnets/<subnet-name>'))
    .option('-e, --subnet-name <subnet-name>', $('the subnet name'))
    .option('-m, --vnet-name <vnet-name>', $('the virtual network name.' +
    '\n     This virtual network must exist in the same resource group as the lb.' +
    '\n     Please use subnet-id if that is not the case.'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend ip configuration name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.createFrontendIP(resourceGroup, lbName, name, options, _);
    });

  lbFrontendIP.command('set [resource-group] [lb-name] [name]')
    .description($('Set a frontend ip configuration of a load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the frontend ip configuration'))
    .option('-a, --private-ip-address <private-ip-address>', $('the private ip address'))
    .option('-u, --public-ip-id [public-ip-id]', $('the public ip identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/publicIPAddresses/<public-ip-name>'))
    .option('-i, --public-ip-name <public-ip-name>', $('the public ip name.' +
    '\n     This public ip must exist in the same resource group as the lb.' +
    '\n     Please use public-ip-id if that is not the case.'))
    .option('-b, --subnet-id [subnet-id]', $('the subnet id.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/VirtualNetworks/<vnet-name>/subnets/<subnet-name>'))
    .option('-e, --subnet-name <subnet-name>', $('the subnet name'))
    .option('-m, --vnet-name <vnet-name>', $('the virtual network name.' +
    '\n     This virtual network must exist in the same resource group as the lb.' +
    '\n     Please use subnet-id if that is not the case.'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend ip configuration name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.setFrontendIP(resourceGroup, lbName, name, options, _);
    });

  lbFrontendIP.command('list [resource-group] [lb-name]')
    .description($('Get all frontend ip configurations in the load balancer'))
    .usage('[options] <resource-group> <lb-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.listFrontendIPs(resourceGroup, lbName, options, _);
    });

  lbFrontendIP.command('delete [resource-group] [lb-name] [name]')
    .description($('Delete a frontend ip configuration from a load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the frontend ip configuration'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend ip configuration name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.deleteFrontendIP(resourceGroup, lbName, name, options, _);
    });

  var lbAddressPool = lb.category('address-pool')
    .description('Commands to manage backend address pools of a load balancer');

  lbAddressPool.command('create [resource-group] [lb-name] [name]')
    .description($('Add an address pool to the load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the backend address pool'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Backend address pool name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.createBackendAddressPool(resourceGroup, lbName, name, options, _);
    });

  lbAddressPool.command('list [resource-group] [lb-name]')
    .description($('Get all address pools in the load balancer'))
    .usage('[options] <resource-group> <lb-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.listBackendAddressPools(resourceGroup, lbName, options, _);
    });

  lbAddressPool.command('delete [resource-group] [lb-name] [name]')
    .description($('Delete an address pool from a load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the backend address pool'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Backend address pool name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.deleteBackendAddressPool(resourceGroup, lbName, name, options, _);
    });

  var lbRule = lb.category('rule')
    .description($('Commands to manage load balancer rules'));

  lbRule.command('create [resource-group] [lb-name] [name]')
    .description($('Add a load balancing rule to a load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-p, --protocol <protocol>', $('the rule protocol'))
    .option('-f, --frontend-port <frontend-port>', $('the frontend port'))
    .option('-b, --backend-port <backend-port>', $('the backend port'))
    .option('-e, --enable-floating-ip <enable-floating-ip>', $('enable floating point ip'))
    .option('-i, --idle-timeout <idle-timeout>', $('the idle timeout specified in minutes'))
    .option('-a, --probe-name <probe-name>', $('the name of the probe defined in the same load balancer'))
    .option('-t, --frontend-ip-name <frontend-ip-name>', $('the name of the frontend ip configuration in the same load balancer'))
    .option('-o, --backend-address-pool <backend-address-pool>', $('name of the backend address pool defined in the same load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.createRule(resourceGroup, lbName, name, options, _);
    });

  lbRule.command('set [resource-group] [lb-name] [name]')
    .description($('Set a load balancing rule of a load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-r, --new-rule-name <new-rule-name>', $('new rule name'))
    .option('-p, --protocol <protocol>', $('the rule protocol'))
    .option('-f, --frontend-port <frontend-port>', $('the frontend port'))
    .option('-b, --backend-port <backend-port>', $('the backend port'))
    .option('-e, --enable-floating-ip <enable-floating-ip>', $('enable floating point ip'))
    .option('-i, --idle-timeout <idle-timeout>', $('the idle timeout specified in minutes'))
    .option('-a, --probe-name [probe-name]', $('the name of the probe defined in the same load balancer'))
    .option('-t, --frontend-ip-name <frontend-ip-name>', $('the name of the frontend ip configuration in the same load balancer'))
    .option('-o, --backend-address-pool <backend-address-pool>', $('name of the backend address pool defined in the same load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.setRule(resourceGroup, lbName, name, options, _);
    });

  lbRule.command('list [resource-group] [lb-name]')
    .description($('Get all load balancing rules of a load balancer'))
    .usage('[options] <resource-group> <lb-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.listRules(resourceGroup, lbName, options, _);
    });

  lbRule.command('delete [resource-group] [lb-name] [name]')
    .description($('Delete a load balancing rule from a load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.deleteRule(resourceGroup, lbName, name, options, _);
    });

  var lbInboundNatRule = lb.category('inbound-nat-rule')
    .description($('Commands to manage load balancer inbound NAT rules'));

  lbInboundNatRule.command('create [resource-group] [lb-name] [name]')
    .description($('Add a load balancing inbound NAT rule to the load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the inbound NAT rule'))
    .option('-p, --protocol <protocol>', util.format($('the rule protocol [%s]'), constants.lb.protocols))
    .option('-f, --frontend-port <frontend-port>', util.format($('the frontend port %s'), utils.toRange(constants.portBounds)))
    .option('-b, --backend-port <backend-port>', util.format($('the backend port %s'), utils.toRange(constants.portBounds)))
    .option('-e, --enable-floating-ip <enable-floating-ip>', $('enable floating point ip [true,false]'))
    .option('-i, --frontend-ip <frontend-ip>', $('the name of the frontend ip configuration'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Inbound rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.createInboundNatRule(resourceGroup, lbName, name, options, _);
    });

  lbInboundNatRule.command('set [resource-group] [lb-name] [name]')
    .usage('[options] <resource-group> <lb-name> <name>')
    .description($('Set a load balancing inbound NAT rule of load balancer'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the inbound NAT rule'))
    .option('-p, --protocol <protocol>', util.format($('the rule protocol [%s]'), constants.lb.protocols))
    .option('-f, --frontend-port <frontend-port>', util.format($('the frontend port %s'), utils.toRange(constants.portBounds)))
    .option('-b, --backend-port <backend-port>', util.format($('the backend port %s'), utils.toRange(constants.portBounds)))
    .option('-e, --enable-floating-ip <enable-floating-ip>', $('enable floating point ip [true,false]'))
    .option('-i, --frontend-ip <frontend-ip>', $('the name of the frontend ip configuration'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Inbound rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.setInboundNatRule(resourceGroup, lbName, name, options, _);
    });

  lbInboundNatRule.command('list [resource-group] [lb-name]')
    .usage('[options] <resource-group> <lb-name>')
    .description($('Get all load balancing inbound NAT rules of load balancer'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.listInboundNatRules(resourceGroup, lbName, options, _);
    });

  lbInboundNatRule.command('delete [resource-group] [lb-name] [name]')
    .usage('[options] <resource-group> <lb-name> <name>')
    .description($('Delete a load balancing inbound NAT rule from a load balancer'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the inbound NAT rule'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Inbound rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.deleteInboundNatRule(resourceGroup, lbName, name, options, _);
    });

  var lbInboundNatPool = lb.category('inbound-nat-pool')
    .description($('Commands to manage load balancer inbound NAT pools'));

  lbInboundNatPool.command('create [resource-group] [lb-name] [name]')
    .description($('Add a load balancing inbound NAT pool to the load balancer'))
    .usage('[options] <resource-group> <lb-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the inbound NAT pool'))
    .option('-p, --protocol <protocol>', util.format($('the pool protocol [%s]'), constants.lb.protocols))
    .option('-f, --frontend-port-range-start  <frontend-port-range-start>', util.format($('the frontend port range start %s'), utils.toRange(constants.portBounds)))
    .option('-e, --frontend-port-range-end <frontend-port-range-end>', util.format($('the frontend port range end %s'), utils.toRange(constants.portBounds)))
    .option('-b, --backend-port <backend-port>', $('the backend port'))
    .option('-i, --frontend-ip <frontend-ip>', $('the name of the frontend ip configuration'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Inbound pool name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.createInboundNatPool(resourceGroup, lbName, name, options, _);
    });

  lbInboundNatPool.command('set [resource-group] [lb-name] [name]')
    .usage('[options] <resource-group> <lb-name> <name>')
    .description($('Set a load balancing inbound NAT pool of load balancer'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the inbound NAT pool'))
    .option('-p, --protocol <protocol>', util.format($('the pool protocol [%s]'), constants.lb.protocols))
    .option('-f, --frontend-port-range-start  <frontend-port-range-start>', util.format($('the frontend port range start %s'), utils.toRange(constants.portBounds)))
    .option('-e, --frontend-port-range-end <frontend-port-range-end>', util.format($('the frontend port range end %s'), utils.toRange(constants.portBounds)))
    .option('-b, --backend-port <backend-port>', $('the backend port'))
    .option('-i, --frontend-ip <frontend-ip>', $('the name of the frontend ip configuration'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Inbound pool name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.setInboundNatPool(resourceGroup, lbName, name, options, _);
    });

  lbInboundNatPool.command('list [resource-group] [lb-name]')
    .usage('[options] <resource-group> <lb-name>')
    .description($('Get all load balancing inbound NAT pools of load balancer'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.listInboundNatPools(resourceGroup, lbName, options, _);
    });

  lbInboundNatPool.command('delete [resource-group] [lb-name] [name]')
    .usage('[options] <resource-group> <lb-name> <name>')
    .description($('Delete a load balancing inbound NAT pool from a load balancer'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-l, --lb-name <lb-name>', $('the name of the load balancer'))
    .option('-n, --name <name>', $('the name of the inbound NAT pool'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, lbName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      lbName = cli.interaction.promptIfNotGiven($('Load balancer name: '), lbName, _);
      name = cli.interaction.promptIfNotGiven($('Inbound pool name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var loadBalancer = new LoadBalancer(cli, networkResourceProviderClient);
      loadBalancer.deleteInboundNatPool(resourceGroup, lbName, name, options, _);
    });

  var publicip = network.category('public-ip')
    .description($('Commands to manage public ip addresses'));

  publicip.command('create [resource-group] [name] [location]')
    .description($('Create a public ip'))
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the public ip'))
    .option('-l, --location <location>', $('the location'))
    .option('-d, --domain-name-label <domain-name-label>', $('the domain name label.' +
    '\n     This set DNS to <domain-name-label>.<location>.cloudapp.azure.com'))
    .option('-a, --allocation-method <allocation-method>', $('the allocation method [Static][Dynamic]'))
    .option('-i, --idletimeout <idletimeout>', $('the idle timeout specified in minutes'))
    .option('-f, --reverse-fqdn <reverse-fqdn>', $('the reverse fqdn'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Public IP name: '), name, _);
      options.location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var publicip = new PublicIp(cli, networkResourceProviderClient);
      publicip.create(resourceGroup, name, options, _);
    });

  publicip.command('set [resource-group] [name]')
    .description($('Set a public ip'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the public ip'))
    .option('-d, --domain-name-label [domain-name-label]', $('the domain name label.' +
    '\n     This set DNS to <domain-name-label>.<location>.cloudapp.azure.com'))
    .option('-a, --allocation-method <allocation-method>', $('the allocation method [Static][Dynamic]'))
    .option('-i, --idletimeout <idletimeout>', $('the idle timeout specified in minutes'))
    .option('-f, --reverse-fqdn [reverse-fqdn]', $('the reverse fqdn'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     Existing tag values will be replaced by the values specified.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Public ip address name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var publicip = new PublicIp(cli, networkResourceProviderClient);
      publicip.set(resourceGroup, name, options, _);
    });

  publicip.command('list [resource-group]')
    .description($('Get all public ips'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var publicip = new PublicIp(cli, networkResourceProviderClient);
      publicip.list(resourceGroup, options, _);
    });

  publicip.command('show [resource-group] [name]')
    .description($('Get a public ip'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the public IP'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Public IP name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var publicip = new PublicIp(cli, networkResourceProviderClient);
      publicip.show(resourceGroup, name, options, _);
    });

  publicip.command('delete [resource-group] [name]')
    .description($('Delete a public ip'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the public IP'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Public IP name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var publicip = new PublicIp(cli, networkResourceProviderClient);
      publicip.delete(resourceGroup, name, options, _);
    });

  var nic = network.category('nic')
    .description($('Commands to manage network interfaces'));

  nic.command('create [resource-group] [name] [location]')
    .description($('Create a network interface'))
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-l, --location <location>', $('the location'))
    .option('-w, --network-security-group-id <network-security-group-id>', $('the network security group identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/networkSecurityGroups/<nsg-name>'))
    .option('-o, --network-security-group-name <network-security-group-name>', $('the network security group name.' +
    '\n     This network security group must exist in the same resource group as the nic.' +
    '\n     Please use network-security-group-id if that is not the case.'))
    .option('-i, --public-ip-id <public-ip-id>', $('the public IP identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/publicIPAddresses/<public-ip-name>'))
    .option('-p, --public-ip-name <public-ip-name>', $('the public IP name.' +
    '\n     This public ip must exist in the same resource group as the nic.' +
    '\n     Please use public-ip-id if that is not the case.'))
    .option('-a, --private-ip-address <private-ip-address>', $('the private IP address'))
    .option('-u, --subnet-id <subnet-id>', $('the subnet identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>'))
    .option('-k, --subnet-name <subnet-name>', $('the subnet name'))
    .option('-m, --subnet-vnet-name <subnet-vnet-name>', $('the vnet name under which subnet-name exists'))
    .option('-d, --lb-address-pool-ids <lb-address-pool-ids>', $('the comma separated list of load balancer address pool identifiers' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/backendAddressPools/<address-pool-name>'))
    .option('-e, --lb-inbound-nat-rule-ids <lb-inbound-nat-rule-ids>', $('the comma separated list of load balancer inbound NAT rule identifiers' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/inboundNatRules/<nat-rule-name>'))
    .option('-r, --internal-dns-name-label <internal-dns-name-label>', $('the internal DNS name label'))
    .option('-f, --enable-ip-forwarding <enable-ip-forwarding>', $('the ip forwarding, valid values are [true, false]'))
    .option('-t, --tags <tags>', $('the comma seperated list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);
      options.location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.create(resourceGroup, name, options, _);
    });

  nic.command('set [resource-group] [name]')
    .description($('Set a network interface'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-w, --network-security-group-id [network-security-group-id]>', $('the network security group identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/networkSecurityGroups/<nsg-name>'))
    .option('-o, --network-security-group-name <network-security-group-name>', $('the network security group name.' +
    '\n     This network security group must exist in the same resource group as the nic.' +
    '\n     Please use network-security-group-id if that is not the case.'))
    .option('-i, --public-ip-id [public-ip-id]', $('the public IP identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/publicIPAddresses/<public-ip-name>'))
    .option('-p, --public-ip-name <public-ip-name>', $('the public IP name.' +
    '\n     This public ip must exist in the same resource group as the nic.' +
    '\n     Please use public-ip-id if that is not the case.'))
    .option('-a, --private-ip-address <private-ip-address>', $('the private IP address'))
    .option('-u, --subnet-id <subnet-id>', $('the subnet identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>'))
    .option('-k, --subnet-name <subnet-name>', $('the subnet name'))
    .option('-m, --subnet-vnet-name <subnet-vnet-name>', $('the vnet name under which subnet-name exists'))
    .option('-d, --lb-address-pool-ids [lb-address-pool-ids]', $('the comma separated list of load balancer address pool identifiers' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/backendAddressPools/<address-pool-name>'))
    .option('-e, --lb-inbound-nat-rule-ids [lb-inbound-nat-rule-ids]', $('the comma separated list of load balancer inbound NAT rule identifiers' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/inboundNatRules/<nat-rule-name>'))
    .option('-r, --internal-dns-name-label <internal-dns-name-label>', $('the internal DNS name label'))
    .option('-f, --enable-ip-forwarding <enable-ip-forwarding>', $('the ip forwarding, valid values are [true, false]'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     Existing tag values will be replaced by the values specified.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.set(resourceGroup, name, options, _);
    });

  nic.command('list [resource-group]')
    .description($('Get all network interfaces'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-m, --virtual-machine-scale-set <virtual-machine-scale-set>', $('the name of the virtual machine scale set'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.list(resourceGroup, options, _);
    });

  nic.command('show [resource-group] [name]')
    .description($('Get a network interface'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-m, --virtual-machine-scale-set <virtual-machine-scale-set>', $('the name of the virtual machine scale set'))
    .option('-i, --virtual-machine-index <virtual-machine-index>', $('the index of virtual machine in scale set'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.show(resourceGroup, name, options, _);
    });

  nic.command('delete [resource-group] [name]')
    .description($('Delete a network interface'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.delete(resourceGroup, name, options, _);
    });

  var nicAddressPool = nic.category('address-pool')
    .description($('Commands to manage backend address pools of the network interface'));

  nicAddressPool.command('add [resource-group] [name]')
    .description($('Add a backend address pool to a NIC'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-i, --lb-address-pool-id  <lb-address-pool-id>', $('the load balancer address pool identifier' +
    '\n   e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/backendAddressPools/<address-pool-name>'))
    .option('-l, --lb-name <lb-name>', $('the load balancer name.' +
    '\n   This load balancer must exists in the same resource group as the NIC.' +
    '\n   Please use --lb-address-pool-id if that is not the case.' +
    '\n   This parameter will be ignored if --lb-address-pool-id is specified'))
    .option('-a, --address-pool-name <address-pool-name>', $('the name of the address pool that exists in the load balancer identified by --lb-name' +
    '\n   This parameter will be ignored if --lb-address-pool-id is specified'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.addAddressPool(resourceGroup, name, options, _);
    });

  nicAddressPool.command('remove [resource-group] [name]')
    .description($('Remove a backend address pool from a NIC'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-i, --lb-address-pool-id  <lb-address-pool-id>', $('the load balancer address pool identifier' +
    '\n   e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/backendAddressPools/<address-pool-name>'))
    .option('-l, --lb-name <lb-name>', $('the load balancer name.' +
    '\n   This load balancer must exist in the same resource group as the NIC.' +
    '\n   Please use --lb-address-pool-id if that is not the case.' +
    '\n   This parameter will be ignored if --lb-address-pool-id is specified'))
    .option('-a, --address-pool-name <address-pool-name>', $('the name of the address pool that exists in the load balancer identified by --lb-name' +
    '\n   This parameter will be ignored if --lb-address-pool-id is specified'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.removeAddressPool(resourceGroup, name, options, _);
    });

  var nicInboundRule = nic.category('inbound-nat-rule')
    .description($('Commands to manage inbound rules of the network interface'));

  nicInboundRule.command('add [resource-group] [name]')
    .description($('Add an inbound NAT rule to a NIC'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-i, --inbound-nat-rule-id <inbound-nat-rule-id>', $('the inbound NAT rule identifier.' +
    '\n   e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/inboundNatRules/<nat-rule-name>'))
    .option('-l, --lb-name <lb-name>', $('the load balancer name.' +
    '\n   This load balancer must exists in the same resource group as the NIC.' +
    '\n   Please use --inbound-nat-rule-id if that is not the case.' +
    '\n   This parameter will be ignored if --inbound-nat-rule-id is specified'))
    .option('-r, --inbound-nat-rule-name <inbound-nat-rule-name>', $('the name of the NAT rule that exists in the load balancer identified by --lb-name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.addInboundRule(resourceGroup, name, options, _);
    });

  nicInboundRule.command('remove [resource-group] [name]')
    .description($('Remove an inbound NAT rule from a NIC'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network interface'))
    .option('-i, --inbound-nat-rule-id <inbound-nat-rule-id>', $('the inbound NAT rule identifier.' +
    '\n   e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/loadbalancers/<lb-name>/inboundNatRules/<nat-rule-name>'))
    .option('-l, --lb-name <lb-name>', $('the load balancer name.' +
    '\n   This load balancer must exists in the same resource group as the NIC.' +
    '\n   Please use --inbound-nat-rule-id if that is not the case.' +
    '\n   This parameter will be ignored if --inbound-nat-rule-id is specified'))
    .option('-r, --inbound-nat-rule-name <inbound-nat-rule-name>', $('the name of the NAT rule that exists in the load balancer identified by --lb-name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network interface name: '), name, _);

      var serviceClients = getServiceClients(options);
      var nic = new Nic(cli, serviceClients);
      nic.removeInboundRule(resourceGroup, name, options, _);
    });

  var nsg = network.category('nsg')
    .description($('Commands to manage network security groups'));

  nsg.command('create [resource-group] [name] [location]')
    .description($('Create a network security group'))
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network security group'))
    .option('-l, --location <location>', $('the location'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network security group name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.create(resourceGroup, name, location, options, _);
    });

  nsg.command('set [resource-group] [name]')
    .description($('Set a network security group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network security group'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     Existing tag values will be replaced by the values specified.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network security group name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.set(resourceGroup, name, options, _);
    });

  nsg.command('list [resource-group]')
    .description($('Get all network security groups'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.list(resourceGroup, options, _);
    });

  nsg.command('show [resource-group] [name]')
    .description($('Get a network security group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network security group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network security group name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.show(resourceGroup, name, options, _);
    });

  nsg.command('delete [resource-group] [name]')
    .description($('Delete a network security group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the network security group'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Network security group name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.delete(resourceGroup, name, options, _);
    });

  var nsgRules = nsg.category('rule')
    .description($('Commands to manage network security group rules'));

  nsgRules.command('create [resource-group] [nsg-name] [name]')
    .description($('Create a network security group rule'))
    .usage('[options] <resource-group> <nsg-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-d, --description <description>', $('the description'))
    .option('-p, --protocol <protocol>', util.format($('the protocol [%s]'), constants.protocols))
    .option('-f, --source-address-prefix <source-address-prefix>', $('the source address prefix'))
    .option('-o, --source-port-range <source-port-range>', util.format($('the source port range %s'), utils.toRange(constants.portBounds)))
    .option('-e, --destination-address-prefix <destination-address-prefix>', $('the destination address prefix'))
    .option('-u, --destination-port-range <destination-port-range>', util.format($('the destination port range %s'), utils.toRange(constants.portBounds)))
    .option('-c, --access <access>', util.format($('the access mode [%s]'), constants.accessModes))
    .option('-y, --priority <priority>', util.format($('the priority'), utils.toRange(constants.priorityBounds)))
    .option('-r, --direction <direction>', util.format($('the direction [%s]'), constants.directionModes))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, nsgName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      name = cli.interaction.promptIfNotGiven($('The name of the security rule: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.createRule(resourceGroup, nsgName, name, options, _);
    });

  nsgRules.command('set [resource-group] [nsg-name] [name]')
    .description($('Set a network security group rule'))
    .usage('[options] <resource-group> <nsg-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-d, --description [description]', $('the description'))
    .option('-p, --protocol <protocol>', util.format($('the protocol [%s]'), constants.protocols))
    .option('-f, --source-address-prefix <source-address-prefix>', $('the source address prefix'))
    .option('-o, --source-port-range <source-port-range>', util.format($('the source port range %s'), utils.toRange(constants.portBounds)))
    .option('-e, --destination-address-prefix <destination-address-prefix>', $('the destination address prefix'))
    .option('-u, --destination-port-range <destination-port-range>', util.format($('the destination port range %s'), utils.toRange(constants.portBounds)))
    .option('-c, --access <access>', util.format($('the access mode [%s]'), constants.accessModes))
    .option('-y, --priority <priority>', util.format($('the priority'), utils.toRange(constants.priorityBounds)))
    .option('-r, --direction <direction>', util.format($('the direction [%s]'), constants.directionModes))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, nsgName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      name = cli.interaction.promptIfNotGiven($('The name of the security rule: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.setRule(resourceGroup, nsgName, name, options, _);
    });

  nsgRules.command('list [resource-group] [nsg-name]')
    .description($('Get all rules in a network security group'))
    .usage('[options] <resource-group> <nsg-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, nsgName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.listRules(resourceGroup, nsgName, options, _);
    });

  nsgRules.command('show [resource-group] [nsg-name] [name]')
    .description($('Get a rule in a network security group'))
    .usage('[options] <resource-group> <nsg-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, nsgName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      name = cli.interaction.promptIfNotGiven($('Rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.showRule(resourceGroup, nsgName, name, options, _);
    });

  nsgRules.command('delete [resource-group] [nsg-name] [name]')
    .description($('Delete a rule in a network security group'))
    .usage('[options] <resource-group> <nsg-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, nsgName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      name = cli.interaction.promptIfNotGiven($('Rule name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var nsg = new Nsg(cli, networkResourceProviderClient);
      nsg.deleteRule(resourceGroup, nsgName, name, options, _);
    });

  var dns = network.category('dns')
    .description($('Commands to manage DNS'));

  var dnsZone = dns.category('zone')
    .description($('Commands to manage DNS zone'));

  dnsZone.command('create [resource-group] [name]')
    .description($('Create a DNS zone'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the DNS zone'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('DNS zone name: '), name, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsZone = new DnsZone(cli, dnsManagementClient);
      dnsZone.create(resourceGroup, name, options, _);
    });

  dnsZone.command('set [resource-group] [name]')
    .description($('Set a DNS zone'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the DNS zone'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     Existing tag values will be replaced by the values specified.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('DNS zone name: '), name, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsZone = new DnsZone(cli, dnsManagementClient);
      dnsZone.set(resourceGroup, name, options, _);
    });

  dnsZone.command('list [resource-group]')
    .description($('Get all DNS zones'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsZone = new DnsZone(cli, dnsManagementClient);
      dnsZone.list(resourceGroup, options, _);
    });

  dnsZone.command('show [resource-group] [name]')
    .description($('Get a DNS zone'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the DNS zone' +
    '\n   You can specify "*" (in quotes) for this parameter'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('DNS zone name: '), name, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsZone = new DnsZone(cli, dnsManagementClient);
      dnsZone.show(resourceGroup, name, options, _);
    });

  dnsZone.command('delete [resource-group] [name]')
    .description($('Delete a DNS zone'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the DNS zone'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('DNS zone name: '), name, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsZone = new DnsZone(cli, dnsManagementClient);
      dnsZone.delete(resourceGroup, name, options, _);
    });

  var dnsRecordSet = dns.category('record-set')
    .description($('Commands to manage record sets in DNS zone'));

  dnsRecordSet.command('create [resource-group] [dns-zone-name] [name] [type]')
    .description($('Create a DNS zone record set'))
    .usage('[options] <resource-group> <dns-zone-name> <name> <type>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-z, --dns-zone-name <dns-zone-name>', $('the name of the DNS zone'))
    .option('-n, --name <name>', $('the relative name of the record set within the DNS zone'))
    .option('-y, --type <type>', $('the type of the record set.' +
    '\n     Valid values are [A, AAAA, CNAME, MX, NS, SOA, SRV, TXT, PTR]'))
    .option('-l, --ttl <ttl>', $('time to live specified in seconds'))
    .option('-t, --tags <tags>', $('the tags set on this virtual network.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, dnsZoneName, name, type, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      dnsZoneName = cli.interaction.promptIfNotGiven($('DNS zone name: '), dnsZoneName, _);
      name = cli.interaction.promptIfNotGiven($('Record set name: '), name, _);
      options.type = cli.interaction.promptIfNotGiven($('Type: '), type, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsRecordSet = new DnsRecordSet(cli, dnsManagementClient);
      dnsRecordSet.create(resourceGroup, dnsZoneName, name, options, _);
    });

  dnsRecordSet.command('set [resource-group] [dns-zone-name] [name] [type]')
    .description($('Set a DNS zone record set'))
    .usage('[options] <resource-group> <dns-zone-name> <name> <type>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-z, --dns-zone-name <dns-zone-name>', $('the name of the DNS zone'))
    .option('-n, --name <name>', $('the relative name of the record set within the DNS zone'))
    .option('-y, --type <type>', $('the type of the record set.' +
    '\n     Valid values are [A, AAAA, CNAME, MX, NS, SOA, SRV, TXT, PTR]'))
    .option('-l, --ttl <ttl>', $('time to live specified in seconds'))
    .option('-t, --tags <tags>', $('the tags set on this virtual network.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional.' +
    '\n     Existing tag values will be replaced by the values specified.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, dnsZoneName, name, type, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      dnsZoneName = cli.interaction.promptIfNotGiven($('DNS zone name: '), dnsZoneName, _);
      name = cli.interaction.promptIfNotGiven($('Record set name: '), name, _);
      options.type = cli.interaction.promptIfNotGiven($('Type: '), type, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsRecordSet = new DnsRecordSet(cli, dnsManagementClient);
      dnsRecordSet.set(resourceGroup, dnsZoneName, name, options, _);
    });

  dnsRecordSet.command('list [resource-group] [dns-zone-name] [type]')
    .description($('Get all record sets in a DNS zone'))
    .usage('[options] <resource-group> <dns-zone-name> [type]')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-z, --dns-zone-name <dns-zone-name>', $('the name of the DNS zone'))
    .option('-y, --type <type>', $('the type of the record set.' +
    '\n     If specified only record sets of this type will be listed.' +
    '\n     Valid values are [A, AAAA, CNAME, MX, NS, SOA, SRV, TXT, PTR]'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, dnsZoneName, type, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      dnsZoneName = cli.interaction.promptIfNotGiven($('DNS zone name: '), dnsZoneName, _);
      options.type = type || options.type;

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsRecordSet = new DnsRecordSet(cli, dnsManagementClient);
      dnsRecordSet.list(resourceGroup, dnsZoneName, options, _);
    });

  dnsRecordSet.command('show [resource-group] [dns-zone-name] [name] [type]')
    .description($('Get a record set in a DNS zone'))
    .usage('[options] <resource-group> <dns-zone-name> <name> <type>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-z, --dns-zone-name <dns-zone-name>', $('the name of the DNS zone'))
    .option('-n, --name <name>', $('the relative name of the record set within the DNS zone'))
    .option('-y, --type <type>', $('the type of the record set.' +
    '\n     Valid values are [A, AAAA, CNAME, MX, NS, SOA, SRV, TXT, PTR]'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, dnsZoneName, name, type, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      dnsZoneName = cli.interaction.promptIfNotGiven($('DNS zone name: '), dnsZoneName, _);
      name = cli.interaction.promptIfNotGiven($('Record set name: '), name, _);
      options.type = cli.interaction.promptIfNotGiven($('Type: '), type, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsRecordSet = new DnsRecordSet(cli, dnsManagementClient);
      dnsRecordSet.show(resourceGroup, dnsZoneName, name, options, _);
    });

  dnsRecordSet.command('delete [resource-group] [dns-zone-name] [name] [type]')
    .description($('Delete a record set from a DNS zone'))
    .usage('[options] <resource-group> <dns-zone-name> <name> <type>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-z, --dns-zone-name <dns-zone-name>', $('the name of the DNS zone'))
    .option('-n, --name <name>', $('the relative name of the record set within the DNS zone'))
    .option('-y, --type <type>', $('the type of the record set.' +
    '\n     If specified only record sets of this type will be listed.' +
    '\n     Valid values are [A, AAAA, CNAME, MX, NS, SOA, SRV, TXT, PTR]'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, dnsZoneName, name, type, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      dnsZoneName = cli.interaction.promptIfNotGiven($('DNS zone name: '), dnsZoneName, _);
      name = cli.interaction.promptIfNotGiven($('Record set name: '), name, _);
      options.type = cli.interaction.promptIfNotGiven($('Type: '), type, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsRecordSet = new DnsRecordSet(cli, dnsManagementClient);
      dnsRecordSet.delete(resourceGroup, dnsZoneName, name, options, _);
    });

  dnsRecordSet.command('add-record [resource-group] [dns-zone-name] [record-set-name] [type]')
    .description($('Add a record in a record set under a DNS zone'))
    .usage('[options] <resource-group> <dns-zone-name> <record-set-name> <type>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-z, --dns-zone-name <dns-zone-name>', $('the name of the DNS zone'))
    .option('-n, --record-set-name <record-set-name>', $('the name of the record set'))
    .option('-y, --type <type>', $('the type of the record set.' +
    '\n     If specified only record sets of this type will be listed.' +
    '\n     Valid values are [A, AAAA, CNAME, MX, NS, SOA, SRV, TXT, PTR]' +
    '\n\nThe record type A \n\n'))
    .option('-a  --ipv4-address <ipv4-address>', $('the IPv4 address attribute\n\n' +
    'Record type AAAA \n\n'))
    .option('-b  --ipv6-address <ipv6-address>', $('the IPv6 address attribute\n\n' +
    'Record type CNAME\n\n'))
    .option('-c  --cname <cname>', $('the canonical name (target)\n\n' +
    'Record type NS\n\n'))
    .option('-d  --nsdname <nsdname>', $('the domain name attribute\n\n' +
    'Record type MX\n\n'))
    .option('-f, --preference <preference>', $('preference attribute'))
    .option('-e, --exchange <exchange>', $('exchange attribute\n\n' +
    'Record type SRV\n\n'))
    .option('-p, --priority <priority>', $('the priority attribute'))
    .option('-w, --weight <weight>', $('the weight attribute'))
    .option('-o, --port <port>', $('the port'))
    .option('-u, --target <target>', $('the target attribute\n\n' +
    'Record type TXT\n\n'))
    .option('-x, --text <text>', $('the text attribute\n\n' +
    'Record type SOA\n\n'))
    .option('-l, --email <email>', $('the email attribute'))
    .option('-i, --expire-time <expire-time>', $('the expire time specified in seconds'))
    .option('-S, --serial-number <serial-number>', $('the serial number'))
    .option('-k, --host <host>', $('the host name attribute'))
    .option('-m, --minimum-ttl <minimum-ttl>', $('the minimum time to live specified in seconds'))
    .option('-r, --refresh-time <refresh-time>', $('the refresh time specified in seconds'))
    .option('-j, --retry-time <retry-time>', $('the retry time specified in seconds' +
    '\n\nRecord type PTR \n\n'))
    .option('-P, --ptrd-name <ptrd-name>', $('ptr domain name\n\n'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, dnsZoneName, recordSetName, type, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      dnsZoneName = cli.interaction.promptIfNotGiven($('DNS zone name: '), dnsZoneName, _);
      recordSetName = cli.interaction.promptIfNotGiven($('Record set name: '), recordSetName, _);
      options.type = cli.interaction.promptIfNotGiven($('Type: '), type, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsRecordSet = new DnsRecordSet(cli, dnsManagementClient);
      dnsRecordSet.promptRecordParameters(options.type, options, _);
      dnsRecordSet.addRecord(resourceGroup, dnsZoneName, recordSetName, options, _);
    });

  dnsRecordSet.command('delete-record [resource-group] [dns-zone-name] [record-set-name] [type]')
    .description($('Delete a record from a record set under a DNS zone'))
    .usage('[options] <resource-group> <dns-zone> <record-set-name> <type>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-z, --dns-zone-name <dns-zone-name>', $('the name of the DNS zone'))
    .option('-n, --record-set-name <record-set-name>', $('the name of the record set'))
    .option('-y, --type <type>', $('the type of the record set.' +
    '\n     If specified only record sets of this type will be listed.' +
    '\n     Valid values are [A, AAAA, CNAME, MX, NS, SOA, SRV, TXT, PTR]' +
    '\n\nThe record type A \n\n'))
    .option('-a  --ipv4-address <ipv4-address>', $('the IPv4 address attribute\n\n' +
    'Record type AAAA \n\n'))
    .option('-b  --ipv6-address <ipv6-address>', $('the IPv6 address attribute\n\n' +
    'Record type CNAME\n\n'))
    .option('-c  --cname <cname>', $('the canonical name (target)\n\n' +
    'Record type NS\n\n'))
    .option('-d  --nsdname <nsdname>', $('the domain name attribute\n\n' +
    'Record type MX\n\n'))
    .option('-f, --preference <preference>', $('preference attribute'))
    .option('-e, --exchange <exchange>', $('exchange attribute\n\n' +
    'Record type SRV\n\n'))
    .option('-p, --priority <priority>', $('the priority attribute'))
    .option('-w, --weight <weight>', $('the weight attribute'))
    .option('-o, --port <port>', $('the port'))
    .option('-u, --target <target>', $('the target attribute\n\n' +
    'Record type TXT\n\n'))
    .option('-x, --text <text>', $('the text attribute' +
    '\n\nRecord type PTR \n\n'))
    .option('-P, --ptrd-name <ptrd-name>', $('ptr domain name\n\n'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, dnsZoneName, recordSetName, type, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      dnsZoneName = cli.interaction.promptIfNotGiven($('DNS zone name: '), dnsZoneName, _);
      recordSetName = cli.interaction.promptIfNotGiven($('Record set name: '), recordSetName, _);
      options.type = cli.interaction.promptIfNotGiven($('Type: '), type, _);

      var dnsManagementClient = getDnsManagementClient(options);
      var dnsRecordSet = new DnsRecordSet(cli, dnsManagementClient);
      dnsRecordSet.promptRecordParameters(options.type, options, _);
      dnsRecordSet.deleteRecord(resourceGroup, dnsZoneName, recordSetName, options, _);
    });

  var trafficManager = network.category('traffic-manager')
    .description($('Commands to manage Traffic Manager'));

  var trafficManagerProfile = trafficManager.category('profile')
    .description($('Commands to manage Traffic Manager profile'));

  trafficManagerProfile.command('create [resource-group] [name]')
    .description($('Create a Traffic Manager profile'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the profile'))
    .option('-u, --profile-status <profile-status> ', $('the profile status, valid values are' +
    '\n     [Enabled, Disabled], default is Enabled'))
    .option('-m, --traffic-routing-method <traffic-routing-method>', $('the traffic routing method for the profile,' +
    '\n     valid values are [Performance, Weighted, Priority]'))
    .option('-r, --relative-dns-name <relative-dns-name>', $('relative DNS name of the profile e.g. .trafficmanager.net'))
    .option('-l  --ttl <ttl>', $('time to live in specified in seconds'))
    .option('-p, --monitor-protocol <monitor-protocol>', $('the source address prefix, valid values are [http, https]'))
    .option('-o, --monitor-port <monitor-port>', $('the monitoring port'))
    .option('-a, --monitor-path <monitor-path>', $('the monitoring path'))
    .option('-t, --tags <tags>', $('the tags set on this profile. Can be ' +
    '\n     multiple, in the format of \'name=value\'.' +
    '\n     Name is required and value is optional. ' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Profile name: '), name, _);
      options.relativeDnsName = cli.interaction.promptIfNotGiven($('Relative DNS name of the profile, e.g. .trafficmanager.net: '), options.relativeDnsName, _);
      options.monitorPath = cli.interaction.promptIfNotGiven($('Monitor path: '), options.monitorPath, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.create(resourceGroup, name, options, _);
    });

  trafficManagerProfile.command('set [resource-group] [name]')
    .description($('Set a Traffic Manager profile'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the profile'))
    .option('-u, --profile-status <profile-status> ', $('the profile status, valid values are' +
    '\n     [Enabled, Disabled], default is Enabled'))
    .option('-m, --traffic-routing-method <traffic-routing-method>', $('the traffic routing method for the profile,' +
    '\n     valid values are [Performance, Weighted, Priority]'))
    .option('-l  --ttl <ttl>', $('time to live specified in seconds'))
    .option('-p, --monitor-protocol <monitor-protocol>', $('the source address prefix, valid values are [http, https]'))
    .option('-o, --monitor-port <monitor-port>', $('the monitoring port'))
    .option('-a, --monitor-path <monitor-path>', $('the monitoring path'))
    .option('-t, --tags <tags>', $('the tags set on this profile. Can be ' +
    '\n     multiple, in the format of \'name=value\'.' +
    '\n     Name is required and value is optional. ' +
    '\n     Existing tag values will be replaced by the values specified.' +
    '\n     For example, -t "tag1=value1;tag2"'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Profile name: '), name, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.set(resourceGroup, name, options, _);
    });

  trafficManagerProfile.command('list [resource-group]')
    .description($('Get all Traffic Manager profiles'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.list(resourceGroup, options, _);
    });

  trafficManagerProfile.command('show [resource-group] [name]')
    .description($('Get a Traffic Manager profile'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the profile'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Profile name: '), name, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.show(resourceGroup, name, options, _);
    });

  trafficManagerProfile.command('delete [resource-group] [name]')
    .description($('Delete a Traffic Manager profile'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the profile'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Profile name: '), name, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.delete(resourceGroup, name, options, _);
    });

  trafficManagerProfile.command('is-dns-available [resource-group] [relative-dns-name]')
    .description($('Checks whether the specified DNS prefix is available for creating a Traffic Manager profile'))
    .usage('[options] <resource-group> <relative-dns-name> ')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --relative-dns-name <relative-dns-name>', $('the relative DNS name to check for availability'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, relativeDnsName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      relativeDnsName = cli.interaction.promptIfNotGiven($('Relative DNS name: '), relativeDnsName, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.checkDnsAvailability(resourceGroup, relativeDnsName, options, _);
    });

  var trafficManagerEndpoint = trafficManagerProfile.category('endpoint')
    .description($('Commands to manage Traffic Manager endpoints'));

  trafficManagerEndpoint.command('create [resource-group] [profile-name] [name]')
    .description($('Create an endpoint in Traffic Manager profile'))
    .usage('[options] <resource-group> <profile-name> <name> <endpoint-location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-f, --profile-name <profile-name>', $('the profile name'))
    .option('-n, --name <name>', $('the name of the endpoint'))
    .option('-l, --endpoint-location <endpoint-location>', $('the location of the endpoint'))
    .option('-y, --type <type>', $('the endpoint type, valid values are:' +
    '\n       [externalEndpoint] externalEndpoint represents endpoint' +
    '\n       for a service with FQDN external to Azure' +
    '\n       e.g. foobar.contoso.com'))
    .option('-e, --target <target>', $('the domain name target of the endpoint,' +
    '\n       e.g. foobar.contoso.com'))
    .option('-u, --endpoint-status <endpoint-status>', util.format($('the endpoint status, valid values are:' +
    '\n       [%s] Default is %s'), constants.TM_VALID_ENDPOINT_STATUSES, constants.TM_VALID_ENDPOINT_STATUSES[0]))
    .option('-w, --weight <weight>', $('the endpoint weight used in the load balancing algorithm'))
    .option('-p, --priority <priority>', $('the endpoint priority used in the load balancing algorithm,' +
    '\n       valid range is [1, 1000]'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, profileName, name, endpointLocation, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      profileName = cli.interaction.promptIfNotGiven($('Profile name: '), profileName, _);
      name = cli.interaction.promptIfNotGiven($('Endpoint name: '), name, _);
      options.target = cli.interaction.promptIfNotGiven($('Endpoint target: '), options.target, _);
      options.location = endpointLocation;

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.createEndpoint(resourceGroup, profileName, name, options, _);
    });

  trafficManagerEndpoint.command('set [resource-group] [profile-name] [name]')
    .description($('Set an endpoint in a Traffic Manager profile'))
    .usage('[options] <resource-group> <profile-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-f, --profile-name <profile-name>', $('the profile name'))
    .option('-n, --name <name>', $('the name of the endpoint'))
    .option('-y, --type <type>', $('the endpoint type, valid values are:' +
    '\n       [externalEndpoint] externalEndpoint represents endpoint' +
    '\n       for a service with FQDN external to Azure' +
    '\n       e.g. foobar.contoso.com'))
    .option('-e, --target <target>', $('the domain name target of the endpoint,' +
    '\n       e.g. foobar.contoso.com'))
    .option('-u, --endpoint-status <endpoint-status>', util.format($('the endpoint status, valid values are:' +
    '\n       [%s] Default is %s'), constants.TM_VALID_ENDPOINT_STATUSES, constants.TM_VALID_ENDPOINT_STATUSES[0]))
    .option('-w, --weight <weight>', $('the endpoint weight used in the load balancing algorithm'))
    .option('-p, --priority <priority>', $('the endpoint priority used in the load balancing algorithm,' +
    '\n       valid range is [1, 1000]'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, profileName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      profileName = cli.interaction.promptIfNotGiven($('Profile name: '), profileName, _);
      name = cli.interaction.promptIfNotGiven($('Endpoint name: '), name, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.setEndpoint(resourceGroup, profileName, name, options, _);
    });

  trafficManagerEndpoint.command('delete [resource-group] [profile-name] [name]')
    .description($('Delete an endpoint from a Traffic Manager profile'))
    .usage('[options] <resource-group> <profile-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-f, --profile-name <profile-name>', $('the profile name'))
    .option('-n, --name <name>', $('the name of the endpoint'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, profileName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      profileName = cli.interaction.promptIfNotGiven($('Profile name: '), profileName, _);
      name = cli.interaction.promptIfNotGiven($('Endpoint name: '), name, _);

      var trafficManagerProviderClient = getTrafficManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerProviderClient);
      trafficManager.deleteEndpoint(resourceGroup, profileName, name, options, _);
    });

  var routeTable = network.category('route-table')
    .description($('Commands to manage Route Table'));

  routeTable.command('create [resource-group] [name] [location]')
    .description($('Create a Route Table'))
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the Route Table'))
    .option('-l, --location <location>', $('the location, this must be same as the location of the virtual network containing the subnet(s) on which this Route Table needs to be applied'))
    .option('-t, --tags <tags>', $('the list of tags.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional. For example, -t "tag1=value1;tag2"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Route Table name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.create(resourceGroup, name, location, options, _);
    });

  routeTable.command('show [resource-group] [name]')
    .description($('Get a Route Table'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the Route Table'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Route Table name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.show(resourceGroup, name, options, _);
    });

  routeTable.command('list [resource-group]')
    .description($('Get all Route Tables'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.list(resourceGroup, options, _);
    });

  routeTable.command('delete [resource-group] [name]')
    .description($('Delete a Route Table'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the Route Table'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Route Table name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.delete(resourceGroup, name, options, _);
    });

  var route = routeTable.category('route')
    .description($('Commands to manage Route Table routes'));

  route.command('create [resource-group] [route-table-name] [name] [address-prefix] [next-hop-type]')
    .description($('Create route in a Route Table'))
    .usage('[options] <resource-group> <route-table-name> <name> <address-prefix> <next-hop-type>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table'))
    .option('-n, --name <name>', $('the name of the route'))
    .option('-a, --address-prefix <address-prefix>', $('the route address prefix e.g. 0.0.0.0/0'))
    .option('-y, --next-hop-type <next-hop-type>', util.format($('the route next hop type, valid values are:' +
    '\n       [%s]'), constants.route.nextHopType))
    .option('-p, --next-hop-ip-address <next-hop-ip-address>', $('the route next hop ip addresses, this parameter is valid' +
    '\n       only for next hop type VirtualAppliance'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, routeTableName, name, addressPrefix, nextHopType, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);
      name = cli.interaction.promptIfNotGiven($('Route name: '), name, _);
      options.addressPrefix = cli.interaction.promptIfNotGiven($('Address prefix: '), addressPrefix, _);
      options.nextHopType = cli.interaction.promptIfNotGiven($('Next hop type: '), nextHopType, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.createRoute(resourceGroup, routeTableName, name, options, _);
    });

  route.command('set [resource-group] [route-table-name] [name]')
    .description($('Set route in a Route Table'))
    .usage('[options] <resource-group> <route-table-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table'))
    .option('-n, --name <name>', $('the name of the route'))
    .option('-a, --address-prefix <address-prefix>', $('the route address prefix e.g. 0.0.0.0/0'))
    .option('-y, --next-hop-type <next-hop-type>', util.format($('the route next hop type, valid values are:' +
    '\n       [%s]'), constants.route.nextHopType))
    .option('-p, --next-hop-ip-address <next-hop-ip-address>', $('the route next hop ip addresses, this parameter is valid' +
    '\n       only for next hop type VirualAppliance'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, routeTableName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);
      name = cli.interaction.promptIfNotGiven($('Route name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.setRoute(resourceGroup, routeTableName, name, options, _);
    });

  route.command('list [resource-group] [route-table-name]')
    .description($('List all routes in a Route Table'))
    .usage('[options] <resource-group> <route-table-name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, routeTableName, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.listRoutes(resourceGroup, routeTableName, options, _);
    });

  route.command('show [resource-group] [route-table-name] [name]')
    .description($('Show details about route in a Route Table'))
    .usage('[options] <resource-group> <route-table-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table'))
    .option('-n, --name <name>', $('the name of the route'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, routeTableName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);
      name = cli.interaction.promptIfNotGiven($('Route name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.showRoute(resourceGroup, routeTableName, name, options, _);
    });

  route.command('delete [resource-group] [route-table-name] [name]')
    .description($('Delete route from a Route Table'))
    .usage('[options] <resource-group> <route-table-name> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table'))
    .option('-n, --name <name>', $('the name of the route'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, routeTableName, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);
      name = cli.interaction.promptIfNotGiven($('Route name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var routeTable = new RouteTable(cli, networkResourceProviderClient);
      routeTable.deleteRoute(resourceGroup, routeTableName, name, options, _);
    });

  var gateway = network.category('gateway')
    .description($('Commands to manage Gateways'));

  var localGateway = gateway.category('local-network')
    .description($('Commands to manage Local Network Gateways'));

  localGateway.command('create [resource-group] [name] [location]')
    .description($('Create a local network gateway'))
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-a, --address-space <address-space>', $('the local network site address space'))
    .option('-i, --ip-address <ip-address>', $('the IP address of the local network site'))
    .option('-l, --location <location>', $('the location'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .option('-t, --tags <tags>', $('the tags set on this local network gateway.' +
    '\n   Can be multiple, in the format of "name=value".' +
    '\n   Name is required and value is optional.' +
    '\n   For example, -t tag1=value1;tag2'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);
      options.location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
      options.addressSpace = cli.interaction.promptIfNotGiven($('Address space: '), options.addressSpace, _);
      options.ipAddress = cli.interaction.promptIfNotGiven($('IP address: '), options.ipAddress, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var localNetwork = new LocalNetworkGateway(cli, networkResourceProviderClient);
      localNetwork.create(resourceGroup, name, options, _);
    });

  localGateway.command('set [resource-group] [name]')
    .description($('Set a local network gateway'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-a, --address-space <address-space>', $('the local network site address space'))
    .option('-t, --tags <tags>', $('the tags set on this local network gateway.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional. For example, -t "tag1=value1;tag2".' +
    '\n     Existing tag values will be replaced by the values specified.'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var localNetwork = new LocalNetworkGateway(cli, networkResourceProviderClient);
      localNetwork.set(resourceGroup, name, options, _);
    });

  localGateway.command('list [resource-group]')
    .usage('[options] <resource-group>')
    .description($('Get all local networks gateways'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var localNetwork = new LocalNetworkGateway(cli, networkResourceProviderClient);
      localNetwork.list(resourceGroup, options, _);
    });

  localGateway.command('show [resource-group] [name]')
    .usage('[options] <resource-group> <name>')
    .description($('Get a local network gateway'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var localNetwork = new LocalNetworkGateway(cli, networkResourceProviderClient);
      localNetwork.show(resourceGroup, name, options, _);
    });

  localGateway.command('delete [resource-group] [name]')
    .usage('[options] <resource-group> <name>')
    .description($('Delete a local network gateway'))
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var localNetwork = new LocalNetworkGateway(cli, networkResourceProviderClient);
      localNetwork.delete(resourceGroup, name, options, _);
    });

  var vnetGateway = gateway.category('vnet')
    .description($('Commands to manage Virtual Network Gateways'));

  vnetGateway.command('create [resource-group] [name] [location]')
    .description($('Create a virtual network gateway'))
    .usage('[options] <resource-group> <name> <location>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network gateway'))
    .option('-l, --location <location>', $('the location'))
    .option('-y, --type <type>', util.format($('the gateway type' +
    '\n   Valid values are [%s]' +
    '\n   Default is RouteBased'), constants.vpnGateway.type))
    .option('-u, --public-ip-id <public-ip-id>', $('the public ip identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/publicIPAddresses/<public-ip-name>'))
    .option('-p, --public-ip-name <public-ip-name>', $('the public ip name. This public ip must exists in the same resource group as the vnet gateway. Please use public-ip-id if that is not the case.'))
    .option('-f, --subnet-id <subnet-id>', $('the subnet identifier.' +
    '\n     e.g. /subscriptions/<subscription-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/virtualNetworks/MyTestNetwork/subnets/<subnet-name>'))
    .option('-m, --vnet-name <vnet-name>', $('the virtual network name. This virtual network must exists in the same resource group as the vnet gateway. Please use sunet-id if that is not the case.'))
    .option('-e, --subnet-name <subnet-name>', $('the subnet name'))
    .option('-a, --private-ip-address <private-ip-address>', $('the private ip address'))
    .option('-b, --enable-bgp <enable-bgp>', $('enables BGP flag' +
    '\n   Valid values are [True, False]' +
    '\n   Default is True'))
    .option('-t, --tags <tags>', $('the tags set on this virtual network gateway.' +
    '\n   Can be multiple, in the format of "name=value".' +
    '\n   Name is required and value is optional.' +
    '\n   For example, -t tag1=value1;tag2'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network gateway name: '), name, _);
      options.location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
      options.privateIpAddress = cli.interaction.promptIfNotGiven($('Private IP address: '), options.privateIpAddress, _);

      if (!options.publicIpId && !options.publicIpName) {
        options.publicIpName = cli.interaction.prompt($('Public IP name: '), _);
      }

      if (!options.subnetId && (!options.vnetName || !options.subnetName)) {
        options.vnetName = cli.interaction.prompt($('Virtual network name: '), _);
        options.subnetName = cli.interaction.prompt($('Subnet name: '), _);
      }

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var vnetGateway = new VirtualNetworkGateway(cli, networkResourceProviderClient);
      vnetGateway.create(resourceGroup, name, options, _);
    });

  vnetGateway.command('set [resource-group] [name]')
    .description($('Set a virtual network gateway'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network gateway'))
    .option('-t, --tags <tags>', $('the tags set on this virtual network gateway.' +
    '\n     Can be multiple. In the format of "name=value".' +
    '\n     Name is required and value is optional. For example, -t "tag1=value1;tag2".' +
    '\n     Existing tag values will be replaced by the values specified.'))
    .option('--no-tags', $('remove all existing tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network gateway name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var vnetGateway = new VirtualNetworkGateway(cli, networkResourceProviderClient);
      vnetGateway.set(resourceGroup, name, options, _);
    });

  vnetGateway.command('list [resource-group]')
    .description($('List virtual network gateways'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var vnetGateway = new VirtualNetworkGateway(cli, networkResourceProviderClient);
      vnetGateway.list(resourceGroup, options, _);
    });

  vnetGateway.command('show [resource-group] [name]')
    .description($('Get a virtual network gateway'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network gateway name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var vnetGateway = new VirtualNetworkGateway(cli, networkResourceProviderClient);
      vnetGateway.show(resourceGroup, name, options, _);
    });

  vnetGateway.command('delete [resource-group] [name]')
    .description($('Delete a virtual network gateway'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
    .option('-n, --name <name>', $('the name of the virtual network gateway'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network gateway name: '), name, _);

      var networkResourceProviderClient = getNetworkResourceProviderClient(options);
      var vnetGateway = new VirtualNetworkGateway(cli, networkResourceProviderClient);
      vnetGateway.delete(resourceGroup, name, options, _);
    });

  function getServiceClients(options) {
    return {
      computeManagementClient: getComputeManagementClient(options),
      networkResourceProviderClient: getNetworkResourceProviderClient(options),
      trafficManagerProviderClient: getTrafficManagementClient(options)
    };
  }

  function getNetworkResourceProviderClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    return utils.createNetworkResourceProviderClient(subscription);
  }

  function getComputeManagementClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    return utils.createComputeResourceProviderClient(subscription);
  }

  function getTrafficManagementClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    return utils.createTrafficManagerResourceProviderClient(subscription);
  }

  function getDnsManagementClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    return utils.createDnsResourceProviderClient(subscription);
  }
};