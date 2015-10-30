//
// Copyright (c) Microsoft and contributors.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

var profile = require('../../../util/profile/index');
var util = require('util');
var utils = require('../../../util/utils');
var constants = require('./constants');
var $ = utils.getLocaleString;

var NetworkConfig = require('./networkConfig');
var VirtualNetwork = require('./virtualNetwork');
var DnsServer = require('./dnsServer');
var StaticIp = require('./staticIp');
var ReservedIp = require('./reservedIp');
var Nsg = require('./nsg');
var RouteTable = require('./routeTable');
var Subnet = require('./subnet');
var LocalNetwork = require('./localNetwork');
var VpnGateway = require('./vpnGateway');
var AppGateway = require('./appGateway');
var TrafficManager = require('./trafficManager');

exports.init = function (cli) {
  var network = cli.category('network')
    .description($('Commands to manage your networks'));

  network.command('export <file-path>')
    .usage('[options] <file-path>')
    .description($('Export the current network configuration to a file'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (filePath, options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var networkConfig = new NetworkConfig(cli, networkManagementClient);
      networkConfig.export(filePath, options, _);
    });

  network.command('import <file-path>')
    .usage('[options] <file-path>')
    .description($('Set the network configuration from a file'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (filePath, options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var networkConfig = new NetworkConfig(cli, networkManagementClient);
      networkConfig.import(filePath, options, _);
    });

  var dnsServer = network.category('dns-server')
    .description($('Commands to manage your DNS servers'));

  dnsServer.command('list')
    .usage('[options]')
    .description($('List DNS servers registered in network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var dnsServer = new DnsServer(cli, networkManagementClient);
      dnsServer.list(options, _);
    });

  dnsServer.command('register [dns-ip]')
    .usage('[options] <dns-ip>')
    .description($('Register a DNS server with network'))
    .option('-p, --dns-ip <dns-ip>', $('the IP address of the DNS server'))
    .option('-i, --dns-id <dns-id>', $('the name identifier of the DNS server'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (dnsIp, options, _) {
      dnsIp = cli.interaction.promptIfNotGiven($('DNS IP: '), dnsIp, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var dnsServer = new DnsServer(cli, networkManagementClient);
      dnsServer.register(dnsIp, options, _);
    });

  dnsServer.command('unregister [dns-ip]')
    .usage('[options] <dns-ip>')
    .description($('Unregister a DNS server registered in the current network'))
    .option('-p, --dns-ip <dns-ip>', $('the IP address of the DNS server'))
    .option('-i, --dns-id <dns-id>', $('the name identifier of the DNS server'))
    .option('-q, --quiet', $('quiet mode, do not ask for unregister confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (dnsIp, options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var dnsServer = new DnsServer(cli, networkManagementClient);
      dnsServer.unregister(dnsIp, options, _);
    });

  var vnet = network.category('vnet')
    .description($('Commands to manage your virtual networks'));

  vnet.command('create [vnet]')
    .usage('[options] <vnet>')
    .description($('Create a virtual network'))
    .option('--vnet <vnet>', $('the name of the virtual network'))
    .option('-e, --address-space <ipv4>', $('the address space for the virtual network'))
    .option('-m, --max-vm-count <number>', $('the maximum number of VMs in the address space'))
    .option('-i, --cidr <number>', $('the address space network mask in CIDR format'))
    .option('-p, --subnet-start-ip <ipv4>', $('the start IP address of subnet'))
    .option('-n, --subnet-name <name>', $('the name for the subnet'))
    .option('-c, --subnet-vm-count <number>', $('the maximum number of VMs in the subnet'))
    .option('-r, --subnet-cidr <number>', $('the subnet network mask in CIDR format'))
    .option('-l, --location <name>', $('the location'))
    .option('-f, --create-new-affinity-group', $('creates a new affinity group at the location specified in --location'))
    .option('-a, --affinity-group <name>', $('the affinity group'))
    .option('-d, --dns-server-id <dns-id>', $('the name identifier of the DNS server'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnet, options, _) {
      vnet = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnet, _);

      var managementClient = createManagementClient(options);
      var networkManagementClient = createNetworkManagementClient(options);
      var virtualNetwork = new VirtualNetwork(cli, managementClient, networkManagementClient);
      virtualNetwork.create(vnet, options, _);
    });

  vnet.command('list')
    .usage('[options]')
    .description($('List your virtual networks'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var managementClient = createManagementClient(options);
      var networkManagementClient = createNetworkManagementClient(options);
      var virtualNetwork = new VirtualNetwork(cli, managementClient, networkManagementClient);
      virtualNetwork.list(options, _);
    });

  vnet.command('show [vnet]')
    .usage('<vnet> [options]')
    .description($('Show details about a virtual network'))
    .option('--vnet <vnet>', $('the name of the virtual network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnet, options, _) {
      vnet = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnet, _);

      var managementClient = createManagementClient(options);
      var networkManagementClient = createNetworkManagementClient(options);
      var virtualNetwork = new VirtualNetwork(cli, managementClient, networkManagementClient);
      virtualNetwork.show(vnet, options, _);
    });

  vnet.command('delete [vnet]')
    .usage('[options] <vnet>')
    .description($('Delete a virtual network'))
    .option('--vnet <vnet>', $('the name of the virtual network'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnet, options, _) {
      vnet = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnet, _);

      var managementClient = createManagementClient(options);
      var networkManagementClient = createNetworkManagementClient(options);
      var virtualNetwork = new VirtualNetwork(cli, managementClient, networkManagementClient);
      virtualNetwork.delete(vnet, options, _);
    });

  var vnetLocalNetwork = vnet.category('local-network')
    .description($('Commands to manage association between virtual network and local network'));

  vnetLocalNetwork.command('add [name] [local-network-name]')
    .usage('[options] <name> <local-network-name>')
    .description($('Associate a local network with a virtual network'))
    .option('-n, --name <name>', $('the name of the virtual network'))
    .option('-l, --local-network-name <local-network-name>', $('the name of the local network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (virtualNetworkName, localNetworkName, options, _) {
      virtualNetworkName = cli.interaction.promptIfNotGiven($('Virtual network name: '), virtualNetworkName, _);
      localNetworkName = cli.interaction.promptIfNotGiven($('Local network name: '), localNetworkName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var localNetwork = new LocalNetwork(cli, networkManagementClient);
      localNetwork.addAssociation(virtualNetworkName, localNetworkName, options, _);
    });

  vnetLocalNetwork.command('remove [name] [local-network-name]')
    .usage('[options] <name> <local-network-name>')
    .description($('Remove association between a local network and a virtual network'))
    .option('-n, --name <name>', $('the name of the virtual network'))
    .option('-l, --local-network-name <local-network-name>', $('the name of the local network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (virtualNetworkName, localNetworkName, options, _) {
      virtualNetworkName = cli.interaction.promptIfNotGiven($('Virtual network name: '), virtualNetworkName, _);
      localNetworkName = cli.interaction.promptIfNotGiven($('Local network name: '), localNetworkName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var localNetwork = new LocalNetwork(cli, networkManagementClient);
      localNetwork.removeAssociation(virtualNetworkName, localNetworkName, options, _);
    });

  var staticIP = vnet.category('static-ip')
    .description($('Commands to manage your virtual network static IP addresses'));

  staticIP.command('check [vnet] [ip-address]')
    .usage('[options] <vnet> <ip-address>')
    .description($('Check the availability of a static IP address'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnet, ipAddress, options, _) {
      vnet = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnet, _);
      ipAddress = cli.interaction.promptIfNotGiven($('Static IP address: '), ipAddress, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var staticIP = new StaticIp(cli, networkManagementClient);
      staticIP.check(vnet, ipAddress, options, _);
    });

  var reservedIP = network.category('reserved-ip')
    .description($('Commands to manage your reserved public virtual IP addresses'));

  reservedIP.command('create <name> <location>')
    .usage('[options] <name> <location>')
    .description($('Create a reserved IP address'))
    .option('-e, --label <label>', $('the reserved IP address label'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, location, options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var reservedIp = new ReservedIp(cli, networkManagementClient);
      reservedIp.create(name, location, options, _);
    });

  reservedIP.command('list')
    .usage('[options]')
    .description($('List your reserved IP addresses'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var reservedIp = new ReservedIp(cli, networkManagementClient);
      reservedIp.list(options, _);
    });

  reservedIP.command('show <name>')
    .usage('[options] <name>')
    .description($('Show details about a reserved IP address'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var reservedIp = new ReservedIp(cli, networkManagementClient);
      reservedIp.show(name, options, _);
    });

  reservedIP.command('delete <name>')
    .usage('[options] <name>')
    .description($('Delete a reserved IP address'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var reservedIp = new ReservedIp(cli, networkManagementClient);
      reservedIp.delete(name, options, _);
    });

  var nsg = network.category('nsg')
    .description($('Commands to manage network security groups'));

  nsg.command('create [name] [location]')
    .description($('Create a network security group'))
    .usage('[options] <name> <location>')
    .option('-n, --name <name>', $('the name of the network security group'))
    .option('-l, --location <location>', $('the location'))
    .option('-b, --label <label>', $('the label of the network security group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, location, options, _) {
      name = cli.interaction.promptIfNotGiven($('Network security group name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.create(name, location, options, _);
    });

  nsg.command('list')
    .usage('[options]')
    .description($('List network security groups'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.list(options, _);
    });

  nsg.command('show [name]')
    .description($('Show the details about a network security group'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the network security group'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Network security group name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.show(name, options, _);
    });

  nsg.command('delete [name]')
    .description($('Delete a network security group'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the network security group'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Network security group name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.delete(name, options, _);
    });

  var nsgRule = nsg.category('rule')
    .description($('Commands to manage network security group rules'));

  nsgRule.command('create [nsg-name] [name]')
    .usage('[options] <nsg-name> <name>')
    .description($('Create a network security group rule'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-p, --protocol <protocol>', $('the protocol'))
    .option('-f, --source-address-prefix <source-address-prefix>', $('the source address prefix'))
    .option('-o, --source-port-range <source-port-range>', $('the source port range'))
    .option('-e, --destination-address-prefix <destination-address-prefix>', $('the destination address prefix'))
    .option('-u, --destination-port-range <destination-port-range>', $('the destination port range'))
    .option('-c, --action <action>', $('the action mode [Allow, Deny]'))
    .option('-y, --priority <priority>', $('the priority'))
    .option('-r, --type <type>', $('the type'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (nsgName, ruleName, options, _) {
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      ruleName = cli.interaction.promptIfNotGiven($('Rule name: '), ruleName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.createRule(nsgName, ruleName, options, _);
    });

  nsgRule.command('set [nsg-name] [name]')
    .usage('[options] <nsg-name> <name>')
    .description($('Set a network security group rule'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-p, --protocol <protocol>', $('the protocol'))
    .option('-f, --source-address-prefix <source-address-prefix>', $('the source address prefix'))
    .option('-o, --source-port-range <source-port-range>', $('the source port range'))
    .option('-e, --destination-address-prefix <destination-address-prefix>', $('the destination address prefix'))
    .option('-u, --destination-port-range <destination-port-range>', $('the destination port range'))
    .option('-c, --action <action>', $('the action mode [Allow, Deny]'))
    .option('-y, --priority <priority>', $('the priority'))
    .option('-r, --type <type>', $('the type'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (nsgName, ruleName, options, _) {
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      ruleName = cli.interaction.promptIfNotGiven($('Rule name: '), ruleName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.setRule(nsgName, ruleName, options, _);
    });

  nsgRule.command('list [nsg-name]')
    .usage('[options] <nsg-name>')
    .description($('List rules in a network security group'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (nsgName, options, _) {
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.listRules(nsgName, options, _);
    });

  nsgRule.command('show [nsg-name] [name]')
    .usage('[options] <nsg-name> <name>')
    .description($('Show rule in a network security group'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (nsgName, ruleName, options, _) {
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      ruleName = cli.interaction.promptIfNotGiven($('Rule name: '), ruleName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.showRule(nsgName, ruleName, options, _);
    });

  nsgRule.command('delete [nsg-name] [name]')
    .usage('[options] <nsg-name> <name>')
    .description($('Delete a network security group rule'))
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --name <name>', $('the name of the rule'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (nsgName, ruleName, options, _) {
      nsgName = cli.interaction.promptIfNotGiven($('Network security group name: '), nsgName, _);
      ruleName = cli.interaction.promptIfNotGiven($('Rule name: '), ruleName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var nsg = new Nsg(cli, networkManagementClient);
      nsg.deleteRule(nsgName, ruleName, options, _);
    });

  var nsgSubnet = nsg.category('subnet')
    .description('Commands to manage network security group of subnet');

  nsgSubnet.command('add [nsg-name] [vnet-name] [subnet-name]')
    .usage('[options] <nsg-name> <vnet-name> <subnet-name>')
    .description('Associate a network security group with a subnet')
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --subnet-name <subnet-name>', $('the name of the virtual network subnet'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (nsgName, vnetName, subnetName, options, _) {
      nsgName = cli.interaction.promptIfNotGiven($('Network Security group name: '), nsgName, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      subnetName = cli.interaction.promptIfNotGiven($('Virtual network subnet name: '), subnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var subnet = new Subnet(cli, networkManagementClient);
      subnet.addNsg(nsgName, vnetName, subnetName, options, _);
    });

  nsgSubnet.command('remove [nsg-name] [vnet-name] [subnet-name]')
    .usage('[options] <nsg-name> <vnet-name> <subnet-name>')
    .description('Remove association between a network security group and subnet')
    .option('-a, --nsg-name <nsg-name>', $('the name of the network security group'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --subnet-name <subnet-name>', $('the name of the virtual network subnet'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (nsgName, vnetName, subnetName, options, _) {
      nsgName = cli.interaction.promptIfNotGiven($('Network Security group name: '), nsgName, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      subnetName = cli.interaction.promptIfNotGiven($('Virtual network subnet name: '), subnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var subnet = new Subnet(cli, networkManagementClient);
      subnet.removeNsg(nsgName, vnetName, subnetName, options, _);
    });

  var subnet = vnet.category('subnet')
    .description($('Commands to manage your virtual network subnets'));

  subnet.command('create [vnet-name] [name]')
    .usage('[options] <vnet-name> <name>')
    .description($('Create a virtual network subnet'))
    .option('-t, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the name of the subnet'))
    .option('-a, --address-prefix <address-prefix>', $('the address prefix'))
    .option('-o, --network-security-group-name <network-security-group-name>', $('the network security group name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, name, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Subnet name: '), name, _);
      options.addressPrefix = cli.interaction.promptIfNotGiven($('Address prefix: '), options.addressPrefix, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var subnet = new Subnet(cli, networkManagementClient);
      subnet.create(vnetName, name, options, _);
    });

  subnet.command('set [vnet-name] [name]')
    .usage('[options] <vnet-name> <name>')
    .description($('Set a virtual network subnet'))
    .option('-t, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the name of the subnet'))
    .option('-a, --address-prefix <address-prefix>', $('the address prefix'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, name, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Subnet name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var subnet = new Subnet(cli, networkManagementClient);
      subnet.set(vnetName, name, options, _);
    });

  subnet.command('list [vnet-name]')
    .usage('[options] <vnet-name>')
    .description($('Get all subnets in a virtual network'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var subnet = new Subnet(cli, networkManagementClient);
      subnet.list(vnetName, options, _);
    });

  subnet.command('show [vnet-name] [name]')
    .usage('[options] <vnet-name>')
    .description($('Show a details about subnet in a virtual network'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the name of the subnet'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, name, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Virtual network subnet name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var subnet = new Subnet(cli, networkManagementClient);
      subnet.show(vnetName, name, options, _);
    });

  subnet.command('delete [vnet-name] [name]')
    .usage('[options] <vnet-name> <name>')
    .description($('Delete a virtual network subnet'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --name <name>', $('the name of the subnet'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, name, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      name = cli.interaction.promptIfNotGiven($('Subnet name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var subnet = new Subnet(cli, networkManagementClient);
      subnet.delete(vnetName, name, options, _);
    });

  var subnetRouteTable = subnet.category('route-table')
    .description($('Commands to manage subnet Route Tables'));

  subnetRouteTable.command('add [vnet-name] [subnet-name] [route-table-name]')
    .usage('[options] <vnet-name> <subnet-name> <route-table-name>')
    .description($('Add Route Table to a subnet'))
    .option('-t, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --subnet-name <subnet-name>', $('the name of the subnet'))
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table that needs to be applied to the subnet'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, subnetName, routeTableName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      subnetName = cli.interaction.promptIfNotGiven($('Subnet name: '), subnetName, _);
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.addRouteTableToSubnet(vnetName, subnetName, routeTableName, options, _);
    });

  subnetRouteTable.command('delete [vnet-name] [subnet-name] [route-table-name]')
    .usage('[options] <vnet-name> <subnet-name> <route-table-name>')
    .description($('Remove Route Table from a subnet'))
    .option('-t, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --subnet-name <subnet-name>', $('the name of the subnet'))
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table that needs to be applied to the subnet'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, subnetName, routeTableName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      subnetName = cli.interaction.promptIfNotGiven($('Subnet name: '), subnetName, _);
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.deleteRouteTableFromSubnet(vnetName, subnetName, routeTableName, options, _);
    });

  subnetRouteTable.command('show [vnet-name] [subnet-name]')
    .usage('[options] <vnet-name> <subnet-name>')
    .description($('Get Route Table for a subnet'))
    .option('-t, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-n, --subnet-name <subnet-name>', $('the name of the subnet'))
    .option('-d, --detailed', util.format($('get full details of the Route Table, without this flag only' +
    '\n     Route Table name will be shown')))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, subnetName, routeTableName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      subnetName = cli.interaction.promptIfNotGiven($('Subnet name: '), subnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.showRouteTableForSubnet(vnetName, subnetName, options, _);
    });

  var localNetwork = network.category('local-network')
    .description($('Commands to manage local network'));

  localNetwork.command('create [name] [address-prefixes]')
    .description($('Create a local network'))
    .usage('[options] <name> <address-prefixes>')
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-a, --address-prefixes <address-prefixes>', $('the comma separated list of address prefixes'))
    .option('-w, --vpn-gateway-address <vpn-gateway-address>', $('the  VPN Gateway address'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, addressPrefixes, options, _) {
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);
      addressPrefixes = cli.interaction.promptIfNotGiven($('Address prefixes: '), addressPrefixes, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var localNetwork = new LocalNetwork(cli, networkManagementClient);
      localNetwork.create(name, addressPrefixes, options, _);
    });

  localNetwork.command('set [name]')
    .description($('Set a local network'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-a, --address-prefixes <address-prefixes>', $('the comma separated list of address prefixes'))
    .option('-w, --vpn-gateway-address <vpn-gateway-address>', $('the  VPN Gateway address'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var localNetwork = new LocalNetwork(cli, networkManagementClient);
      localNetwork.set(name, options, _);
    });

  localNetwork.command('list')
    .usage('[options]')
    .description($('Get all local networks'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var localNetwork = new LocalNetwork(cli, networkManagementClient);
      localNetwork.list(options, _);
    });

  localNetwork.command('show [name]')
    .usage('[options]')
    .description($('Get a local network'))
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var localNetwork = new LocalNetwork(cli, networkManagementClient);
      localNetwork.show(name, options, _);
    });

  localNetwork.command('delete [name]')
    .usage('[options] <name>')
    .description($('Delete a local network'))
    .option('-n, --name <name>', $('the name of the local network'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Local network name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var localNetwork = new LocalNetwork(cli, networkManagementClient);
      localNetwork.delete(name, options, _);
    });

  var vpnGateway = network.category('vpn-gateway')
    .description($('Commands to manage VPN Gateways'));

  vpnGateway.command('create [vnet-name]')
    .description($('Create a virtual network gateway'))
    .usage('[options] <vnet-name>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-t, --type <type>', util.format($('the gateway type, valid values are:' +
    '\n       [%s],' +
    '\n       default is StaticRouting'), constants.vpnGateway.type))
    .option('-k, --sku <sku>', util.format($('the gateway SKU, valid values are:' +
    '\n       [%s],' +
    '\n       default is Default'), constants.vpnGateway.sku))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.create(vnetName, options, _);
    });

  vpnGateway.command('show [vnet-name]')
    .description($('Get a virtual network gateway'))
    .usage('[options] <vnet-name>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.show(vnetName, options, _);
    });

  vpnGateway.command('delete [vnet-name]')
    .description($('Delete a virtual network gateway'))
    .usage('[options] <vnet-name>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.delete(vnetName, options, _);
    });

  vpnGateway.command('resize [vnet-name] [sku]')
    .description($('Resize a virtual network gateway'))
    .usage('[options] <vnet-name> <sku>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-k, --sku <sku>', $('the SKU that the existing gateway will be resized to,' +
    '\n       valid values are [Default or HighPerformance]'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, sku, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      sku = cli.interaction.promptIfNotGiven($('SKU: '), sku, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.resize(vnetName, sku, options, _);
    });

  vpnGateway.command('reset [vnet-name]')
    .description($('Reset a virtual network gateway'))
    .usage('[options] <vnet-name>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.reset(vnetName, options, _);
    });

  var vpnDefaultSite = vpnGateway.category('default-site')
    .description($('Commands to manage VPN Gateway default site'));

  vpnDefaultSite.command('set [vnet-name] [site-name]')
    .description($('Set local network default site for a virtual network gateway'))
    .usage('[options] <vnet-name> <site-name>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-k, --site-name <site-name>', $('the local network default site for this virtual network gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, siteName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      siteName = cli.interaction.promptIfNotGiven($('Site name: '), siteName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.setDefaultSite(vnetName, siteName, options, _);
    });

  vpnDefaultSite.command('remove [vnet-name]')
    .description($('Remove local network default site configured in a virtual network gateway'))
    .usage('[options] <vnet-name>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.removeDefaultSite(vnetName, options, _);
    });

  var vpnSharedKey = vpnGateway.category('shared-key')
    .description($('Commands to manage VPN Gateway shared key'));

  vpnSharedKey.command('set [vnet-name] [key-value]')
    .usage('[options] <vnet-name> <key-value>')
    .description($('Set shared key used by virtual network gateway to connect to local network site'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-t, --site-name <site-name>', $('the name of the local network site, if not specified then default local network site will be used.'))
    .option('-k, --key-value <key-value>', $('the shared key value'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, keyValue, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      keyValue = cli.interaction.promptIfNotGiven($('Shared key value: '), keyValue, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.setSharedKey(vnetName, keyValue, options, _);
    });

  vpnSharedKey.command('reset [vnet-name] [key-length]')
    .usage('[options] <vnet-name> <key-length>')
    .description($('Reset shared key used by virtual network gateway to connect to local network site'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-t, --site-name <site-name>', $('the name of the local network site, if not specified then default local network site will be used.'))
    .option('-l, --key-length <key-length>', $('the number of characters in the shared key, the key length must be between 1 and 128 characters.'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, keyLength, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      keyLength = cli.interaction.promptIfNotGiven($('Key length: '), keyLength, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.resetSharedKey(vnetName, keyLength, options, _);
    });

  var vpnConnection = vpnGateway.category('connection')
    .description($('Commands to manage VPN Gateway connection'));

  vpnConnection.command('list [vnet-name]')
    .description($('Get all local network connections that can be accessed through a virtual network gateway'))
    .usage('[options] <vnet-name>')
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.listConnections(vnetName, options, _);
    });

  var vpnDevice = vpnGateway.category('device')
    .description($('Commands to manage VPN Gateway device'));

  vpnDevice.command('list')
    .usage('[options]')
    .description($('Get all supported `on premise network devices` that can connect to the gateway'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.listDevices(options, _);
    });

  vpnDevice.command('get-script [vnet-name]')
    .usage('[options] <vnet-name>')
    .description($('Get script to configure local VPN device to connect to the virtual network gateway'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-o, --vendor <vendor>', $('the vendor of the VPN device'))
    .option('-p, --platform <platform>', $('the platform of the VPN device'))
    .option('-f, --os-family <os-family>', $('the OS family of the VPN device'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      options.vendor = cli.interaction.promptIfNotGiven($('Vendor: '), options.vendor, _);
      options.platform = cli.interaction.promptIfNotGiven($('Platform: '), options.platform, _);
      options.osFaimily = cli.interaction.promptIfNotGiven($('OS family: '), options.osFamily, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.getDeviceScript(vnetName, options, _);
    });

  var vpnDiagnostics = vpnGateway.category('diagnostics')
    .description($('Commands to manage VPN Gateway diagnostics session'));

  vpnDiagnostics.command('start [vnet-name]')
    .usage('[options] <vnet-name>')
    .description($('Start a new diagnostics session in a virtual network gateway'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-d, --duration <duration>', $('duration in seconds to perform the diagnostics capture, possible values are between 1 and 300'))
    .option('-a, --storage-account-name <storage-account-name>', $('the name of the storage account where the captured diagnostics data is to be stored.'))
    .option('-k, --storage-account-key <storage-account-key>', $('the key of the storage account that is specified through --storage-account-name parameter'))
    .option('-c, --container-name <container-name>', $('the name of the container in the storage account where the captured diagnostics data is stored, default is gatewaypublicdiagnostics'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      options.duration = cli.interaction.promptIfNotGiven($('Capture duration in seconds: '), options.duration, _);
      options.storageAccountName = cli.interaction.promptIfNotGiven($('Storage account name: '), options.storageAccountName, _);
      options.storageAccountKey = cli.interaction.promptIfNotGiven($('Storage account key: '), options.storageAccountKey, _);
      options.containerName = cli.interaction.promptIfNotGiven($('Storage container name: '), options.containerName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.startDiagnosticsSession(vnetName, options, _);
    });

  vpnDiagnostics.command('stop [vnet-name]')
    .usage('[options] <vnet-name>')
    .description($('Stop current diagnostics session in a virtual network gateway'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.stopDiagnosticsSession(vnetName, options, _);
    });

  vpnDiagnostics.command('get [vnet-name]')
    .usage('[options] <vnet-name>')
    .description($('Get current diagnostics session in a virtual network gateway'))
    .option('-n, --vnet-name <vnet-name>', $('the name of the virtual network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (vnetName, options, _) {
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var vpnGateway = new VpnGateway(cli, networkManagementClient);
      vpnGateway.getDiagnosticsSession(vnetName, options, _);
    });

  var routeTable = network.category('route-table')
    .description($('Commands to manage Route Table'));

  routeTable.command('create [name] [location]')
    .description($('Create a Route Table'))
    .usage('[options] <name> <location>')
    .option('-n, --name <name>', $('the name of the Route Table'))
    .option('-l, --location <location>', $('the location, this must be same as the location of the virtual network containing the subnet(s) on which this Route Table needs to be applied'))
    .option('-b, --label <label>', $('the label for the Route Table'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, location, options, _) {
      name = cli.interaction.promptIfNotGiven($('Route Table name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location: '), location, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.create(name, location, options, _);
    });

  routeTable.command('show [name]')
    .description($('Get a Route Table'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Route Table'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Route Table name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.show(name, options, _);
    });

  routeTable.command('list')
    .description($('Get all Route Tables'))
    .usage('[options]')
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.list(options, _);
    });

  routeTable.command('delete [name]')
    .description($('Delete a Route Table'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Route Table'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Route Table name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.delete(name, options, _);
    });

  var route = routeTable.category('route')
    .description($('Commands to manage Route Table routes'));

  route.command('set [route-table-name] [name] [address-prefix] [next-hop-type]')
    .description($('Set route in a Route Table'))
    .usage('[options] <route-table-name> <name> <address-prefix> <next-hop-type>')
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table'))
    .option('-n, --name <name>', $('the name of the route'))
    .option('-a, --address-prefix <address-prefix>', $('the route address prefix e.g. 0.0.0.0/0'))
    .option('-t, --next-hop-type <next-hop-type>', util.format($('the route next hop type, valid values are:' +
    '\n       [%s]'), constants.route.nextHopType))
    .option('-p, --next-hop-ip-address <next-hop-ip-address>', $('the route next hop ip addresses, this parameter is valid' +
    '\n       only for next hop type VirtualAppliance'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (routeTableName, name, addressPrefix, nextHopType, options, _) {
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);
      name = cli.interaction.promptIfNotGiven($('Route name: '), name, _);
      addressPrefix = cli.interaction.promptIfNotGiven($('Address prefix: '), addressPrefix, _);
      nextHopType = cli.interaction.promptIfNotGiven($('Next hop type: '), nextHopType, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.setRoute(routeTableName, name, addressPrefix, nextHopType, options, _);
    });

  route.command('delete [route-table-name] [name]')
    .description($('Delete route from a Route Table'))
    .usage('[options] <route-table-name> <name>')
    .option('-r, --route-table-name <route-table-name>', $('the name of the Route Table'))
    .option('-n, --name <name>', $('the name of the route'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (routeTableName, name, options, _) {
      routeTableName = cli.interaction.promptIfNotGiven($('Route Table name: '), routeTableName, _);
      name = cli.interaction.promptIfNotGiven($('Route name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var routeTable = new RouteTable(cli, networkManagementClient);
      routeTable.deleteRoute(routeTableName, name, options, _);
    });

  var appGateway = network.category('application-gateway')
    .description('Commands to manage Application Gateway');

  appGateway.command('create [name] [vnet-name] [subnet-names]')
    .description($('Create an Application Gateway'))
    .usage('[options] <name> <vnet-name> <subnet-names>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network Application Gateway should be deployed in'))
    .option('-t, --subnet-names <subnet-names>', $('comma separated list of subnet names exists in the virtual network identified by --vnet-name'))
    .option('-c, --instance-count <instance-count>', $('the number of instances'))
    .option('-z, --gateway-size <gateway-size>', util.format($('size of the Application Gateway, valid values are [%s]'), constants.appGateway.sizes))
    .option('-d, --description <description>', $('the description for the Application Gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, vnetName, subnetNames, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);
      subnetNames = cli.interaction.promptIfNotGiven($('Comma separated subnet names: '), subnetNames, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.create(name, vnetName, subnetNames, options, _);
    });

  appGateway.command('set [name] [vnet-name]')
    .description($('Set an Application Gateway'))
    .usage('[options] <name> <vnet-name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-e, --vnet-name <vnet-name>', $('the name of the virtual network Application Gateway should be deployed in'))
    .option('-t, --subnet-names <subnet-names>', $('comma separated list of subnet names exists in the virtual network identified by --vnet-name'))
    .option('-c, --instance-count <instance-count>', $('the number of instances'))
    .option('-z, --gateway-size <gateway-size>', util.format($('size of the Application Gateway, valid values are [%s]'), constants.appGateway.sizes))
    .option('-d, --description <description>', $('the description for the Application Gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, vnetName, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);
      vnetName = cli.interaction.promptIfNotGiven($('Virtual network name: '), vnetName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.set(name, vnetName, options, _);
    });

  appGateway.command('list')
    .description($('Get all Application Gateways'))
    .usage('[options]')
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (options, _) {
      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.list(options, _);
    });

  appGateway.command('show [name]')
    .description($('Get an Application Gateway'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.show(name, options, _);
    });

  appGateway.command('delete [name]')
    .description($('Delete an Application Gateway'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.delete(name, options, _);
    });

  appGateway.command('start [name]')
    .description($('Start an Application Gateway'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.start(name, options, _);
    });

  appGateway.command('stop [name]')
    .description($('Stop an Application Gateway'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.stop(name, options, _);
    });

  var appGatewayConfig = appGateway.category('config')
    .description('Commands to manage Application Gateway configuration');

  appGatewayConfig.command('show [name]')
    .description($('Get an Application Gateway configuration'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.showConfig(name, options, _);
    });

  appGatewayConfig.command('export [name] [export-to-file]')
    .description($('Export Application Gateway configuration to a file'))
    .usage('[options] <name> <file-path>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-t, --export-to-file <export-to-file>', $('the path to the file where configuration needs to be exported'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, exportToFile, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);
      exportToFile = cli.interaction.promptIfNotGiven($('File path: '), exportToFile, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.exportConfig(name, exportToFile, options, _);
    });

  appGatewayConfig.command('import [name] [import-from-file]')
    .description($('Import Application Gateway configuration from a file'))
    .usage('[options] <name> <import-from-file>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-t, --import-from-file <import-from-file>', $('the path to the configuration file'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, importFromFile, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);
      importFromFile = cli.interaction.promptIfNotGiven($('Import from file: '), importFromFile, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.importConfig(name, importFromFile, options, _);
    });

  var appGatewayAddressPool = appGateway.category('address-pool')
    .description($('Commands to manage Application Gateway backend address pool'));

  appGatewayAddressPool.command('add [gateway-name] [name]')
    .description($('Add a backend address pool to an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the backend address pool'))
    .option('-r, --servers <servers>', $('comma separated list of IP addresses or DNS names' +
    '\n     corresponding to backend servers'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Backend address pool name: '), name, _);
      options.servers = cli.interaction.promptIfNotGiven($('List of IP addresses or DNS names: '), options.servers, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.addBackendAddressPool(gatewayName, name, options, _);
    });

  appGatewayAddressPool.command('remove [gateway-name] [name]')
    .description($('Remove a backend address pool from an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the backend address pool'))
    .option('-q, --quiet', $('quiet mode, do not ask for unregister confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Backend address pool name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.removeBackendAddressPool(gatewayName, name, options, _);
    });

  var appGatewayHttpSettings = appGateway.category('http-settings')
    .description($('Commands to manage Application Gateway http settings'));

  appGatewayHttpSettings.command('add [gateway-name] [name]')
    .description($('Add a backend address pool to an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the HTTP settings'))
    .option('-p, --protocol <protocol>', util.format($('the protocol, valid value is [%s]'),
      constants.appGateway.settings.protocol))
    .option('-o, --port <port>', util.format($('the port, valid range is'),
      utils.toRange(constants.appGateway.settings.port)))
    .option('-c, --cookie-based-affinity <cookie-based-affinity>', util.format($('Enable or disable cookie based affinity, valid values are' +
    '\n     [%s],' +
    '\n     default value is Disabled'), constants.appGateway.settings.affinity))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Http settings name: '), name, _);
      options.port = cli.interaction.promptIfNotGiven($('Port: '), options.port, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.addHttpSettings(gatewayName, name, options, _);
    });

  appGatewayHttpSettings.command('remove [gateway-name] [name]')
    .description($('Remove a backend address pool to an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the HTTP settings'))
    .option('-q, --quiet', $('quiet mode, do not ask for unregister confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Http settings name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.removeHttpSettings(gatewayName, name, options, _);
    });

  var appGatewayFrontendIp = appGateway.category('frontend-ip')
    .description($('Commands to manage Application Gateway frontend ip'));

  appGatewayFrontendIp.command('add [gateway-name] [name]')
    .description($('Add a frontend ip configuration to an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the frontend IP configuration'))
    .option('-t, --type <type>', util.format($('the type, supported values are [%s], default value is Private'),
      constants.appGateway.ip.type))
    .option('-i, --static-ip-address <static-ip-address>', $('the static IP address'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend IP name: '), name, _);
      options.staticIpAddress = cli.interaction.promptIfNotGiven($('Static IP address: '), options.staticIpAddress, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.addFrontendIp(gatewayName, name, options, _);
    });

  appGatewayFrontendIp.command('remove [gateway-name] [name]')
    .description($('Remove a frontend ip configuration from an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the frontend IP configuration'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend IP name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.removeFrontendIp(gatewayName, name, options, _);
    });

  var appGatewayFrontendPort = appGateway.category('frontend-port')
    .description('Commands to manage Application Gateway frontend port');

  appGatewayFrontendPort.command('add [gateway-name] [name] [port]')
    .description($('Add a frontend port to an Application Gateway'))
    .usage('[options] <gateway-name> <name> <port>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the frontend port'))
    .option('-o, --port <port>', $('the port'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, port, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend port name: '), name, _);
      port = cli.interaction.promptIfNotGiven($('Frontend port: '), port, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.addFrontendPort(gatewayName, name, port, options, _);
    });

  appGatewayFrontendPort.command('remove [gateway-name] [name]')
    .description($('Remove a frontend port from an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the frontend port'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend port name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.removeFrontendPort(gatewayName, name, options, _);
    });

  var appGatewayHttpListener = appGateway.category('http-listener')
    .description('Commands to manage Application Gateway http listener');

  appGatewayHttpListener.command('add [gateway-name] [name] [frontend-port-name]')
    .description($('Add a http listener to an Application Gateway'))
    .usage('[options] <gateway-name> <name> <frontend-port-name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the HTTP listener'))
    .option('-i, --frontend-ip-name <frontend-ip-name>', $('the name of an existing frontend ip configuration'))
    .option('-p, --frontend-port-name <frontend-port-name>', $('the name of an existing frontend port'))
    .option('-t, --protocol <protocol>', $('the protocol, supported values are \[Http, Https\], default is Http'))
    .option('-c, --ssl-cert <ssl-cert>', $('the name of an existing SSL certificate, this parameter is required when --protocol is Https'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, frontendPortName, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('The HTTP listener name: '), name, _);
      frontendPortName = cli.interaction.promptIfNotGiven($('Frontend port name: '), frontendPortName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.addHttpListener(gatewayName, name, frontendPortName, options, _);
    });

  appGatewayHttpListener.command('remove [gateway-name] [name]')
    .description($('Remove a http listener from an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the HTTP listener'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend port name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.removeHttpListener(gatewayName, name, options, _);
    });

  var appGatewayBalancingRule = appGateway.category('lb-rule')
    .description('Commands to manage Application Gateway load balancing rule');

  appGatewayBalancingRule.command('add [gateway-name] [name] [http-settings] [http-listener] [address-pool]')
    .description($('Add a load balancing rule to an Application Gateway'))
    .usage('[options] <gateway-name> <name> <http-settings> <http-listener> <address-pool>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the load balancing rule'))
    .option('-i, --http-settings <http-settings>', $('the name of an existing backend HTTP settings'))
    .option('-l, --http-listener <http-listener>', $('the name of an existing HTTP listener'))
    .option('-p, --address-pool <address-pool>', $('the name of an existing backend address pool'))
    .option('-t, --type <type>', $('the type, default is "Basic"'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, httpSettings, httpListener, addressPool, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend port name: '), name, _);
      httpSettings = cli.interaction.promptIfNotGiven($('HTTP settings name: '), httpSettings, _);
      httpListener = cli.interaction.promptIfNotGiven($('HTTP listener name: '), httpListener, _);
      addressPool = cli.interaction.promptIfNotGiven($('The address pool name: '), addressPool, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.addLoadBalancingRule(gatewayName, name, httpSettings, httpListener, addressPool, options, _);
    });

  appGatewayBalancingRule.command('remove [gateway-name] [name]')
    .description($('Remove a load balancing rule from an Application Gateway'))
    .usage('[options] <gateway-name> <name>')
    .option('-w, --gateway-name <gateway-name>', $('the name of the Application Gateway'))
    .option('-n, --name <name>', $('the name of the load balancing rule'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (gatewayName, name, options, _) {
      gatewayName = cli.interaction.promptIfNotGiven($('Application Gateway name: '), gatewayName, _);
      name = cli.interaction.promptIfNotGiven($('Frontend port name: '), name, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.removeLoadBalancingRule(gatewayName, name, options, _);
    });

  var appGatewaySslCert = appGateway.category('ssl-cert')
    .description($('Commands to manage Application Gateway SSL certificates'));

  appGatewaySslCert.command('add [name] [cert-name]')
    .description($('Add Application Gateway SSL certificate'))
    .usage('[options] <name> <cert-name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-c, --cert-name <cert-name>', $('the name of the certificate'))
    .option('-t, --cert-file <cert-file>', $('the path to the certificate'))
    .option('-p, --password <password>', $('the certificate password'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, certName, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);
      certName = cli.interaction.promptIfNotGiven($('Certificate name: '), certName, _);
      options.certFile = cli.interaction.promptIfNotGiven($('Certificate file path: '), options.certFile, _);
      options.password = cli.interaction.promptIfNotGiven($('Certificate password: '), options.password, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.addSsl(name, certName, options, _);
    });

  appGatewaySslCert.command('remove [name] [cert-name]')
    .description($('Remove Application Gateway SSL certificate'))
    .usage('[options] <name> <cert-name>')
    .option('-n, --name <name>', $('the name of the Application Gateway'))
    .option('-c, --cert-name <cert-name>', $('the name of the certificate'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, certName, options, _) {
      name = cli.interaction.promptIfNotGiven($('Application Gateway name: '), name, _);
      certName = cli.interaction.promptIfNotGiven($('Certificate name: '), certName, _);

      var networkManagementClient = createNetworkManagementClient(options);
      var appGateway = new AppGateway(cli, networkManagementClient);
      appGateway.removeSsl(name, certName, options, _);
    });

  var trafficManager = network.category('traffic-manager')
    .description($('Commands to manage Traffic Manager'));

  var tmProfile = trafficManager.category('profile')
    .description($('Commands to manage Traffic Manager profile'));

  tmProfile.command('create [name]')
    .usage('[options] <name>')
    .description($('Create a Traffic Manager profile'))
    .option('-n, --name <name>', $('the name of the Traffic Manager profile'))
    .option('-d, --domain-name <domain-name>', $('profile DNS name' + '\n   Example: foobar.trafficmanager.net'))
    .option('-m, --load-balancing-method <load-balancing-method>', util.format($('the load balancing method to use to distribute connection.' +
    '\n   Valid values are [%s]'), constants.trafficManager.loadBalancingMethods))
    .option('-o, --monitor-port <monitor-port>', util.format($('the port used to monitor endpoint health.' +
    '\n   Valid range is %s inclusive'), utils.toRange(constants.trafficManager.ports)))
    .option('-p, --monitor-protocol <monitor-protocol>', util.format($('the protocol to use to monitor endpoint health.' +
    '\n   Valid values are [%s]'), constants.trafficManager.protocols))
    .option('-r, --monitor-relative-path <monitor-relative-path>', $('the path relative to the endpoint domain name to probe for health state. Must start with a forward slash "/".'))
    .option('-t, --ttl <ttl>', $('the DNS Time-to-Live (TTL) that informs the Local DNS resolvers how long to cache DNS entries'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Traffic Manager name: '), name, _);
      options.domainName = cli.interaction.promptIfNotGiven($('Endpoint domain name: '), options.domainName, _);
      options.monitorRelativePath = cli.interaction.promptIfNotGiven($('Path relative to the endpoint domain name to probe for health state: '), options.monitorRelativePath, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.create(name, options, _);
    });

  tmProfile.command('set [name]')
    .usage('[options] <name>')
    .description($('Set a Traffic Manager profile'))
    .option('-n, --name <name>', $('the name of the Traffic Manager profile'))
    .option('-m, --load-balancing-method <load-balancing-method>', util.format($('the load balancing method to use to distribute connection.' +
    '\n   Valid values are [%s]'), constants.trafficManager.loadBalancingMethods))
    .option('-o, --monitor-port <monitor-port>', util.format($('the port used to monitor endpoint health.' +
    '\n   Valid range is %s inclusive'), utils.toRange(constants.trafficManager.ports)))
    .option('-p, --monitor-protocol <monitor-protocol>', util.format($('the protocol to use to monitor endpoint health.' +
    '\n   Valid values are [%s]'), constants.trafficManager.protocols))
    .option('-r, --monitor-relative-path <monitor-relative-path>', $('the path relative to the endpoint domain name to probe for health state. Must start with a forward slash "/".'))
    .option('-t, --ttl <ttl>', $('the DNS Time-to-Live (TTL) that informs the Local DNS resolvers how long to cache DNS entries'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Traffic Manager name: '), name, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.set(name, options, _);
    });

  tmProfile.command('show [name]')
    .usage('[options] <name>')
    .description($('Get a Traffic Manager profile'))
    .option('-n, --name <name>', $('the name of the Traffic Manager profile'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Traffic Manager name: '), name, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.show(name, options, _);
    });

  tmProfile.command('list')
    .usage('[options]')
    .description($('Get all Traffic Manager profiles'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (options, _) {
      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.list(options, _);
    });

  tmProfile.command('delete [name]')
    .description($('Delete a Traffic Manager profile'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Traffic Manager'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Traffic Manager profile name: '), name, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.delete(name, options, _);
    });

  tmProfile.command('enable [name]')
    .description($('Enable a Traffic Manager profile'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Traffic Manager'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Traffic Manager profile name: '), name, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.enable(name, options, _);
    });

  tmProfile.command('disable [name]')
    .description($('Disable a Traffic Manager profile'))
    .usage('[options] <name>')
    .option('-n, --name <name>', $('the name of the Traffic Manager'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (name, options, _) {
      name = cli.interaction.promptIfNotGiven($('Traffic Manager profile name: '), name, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.disable(name, options, _);
    });

  var profileEndpoint = tmProfile.category('endpoint')
    .description($('Commands to manage Traffic Manager profile endpoint'));

  profileEndpoint.command('create [profile-name] [name] [type]')
    .description($('Create an endpoint in a Traffic Manager profile'))
    .usage('[options] <profile-name> <name> <type>')
    .option('-p, --profile-name <profile-name>', $('the name of the profile'))
    .option('-n, --name <name>', $('the endpoint domain name'))
    .option('-y, --type <type>', util.format($('the endpoint type, valid values are: %s'),
      constants.trafficManager.endpoints.types))
    .option('-l, --endpoint-location <endpoint-location>', $('the location of the endpoint. Required when profile load-balancing' +
    '\n     method is set to Performance and endpoint type is set to ' +
    '\n     Any or TrafficManager. Specifies the name of the Azure region'))
    .option('-u, --endpoint-status <endpoint-status>', util.format($('the endpoint status, valid values are: %s Default is Enabled'),
      constants.trafficManager.endpoints.statuses))
    .option('-w, --weight <weight>', $('the endpoint weight used in the load balancing algorithm'))
    .option('-e, --min-child-endpoint <min-child-endpoint>', $('the minimum number of child endpoints, can be specified when Type is set to TrafficManager'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (profileName, name, type, options, _) {
      profileName = cli.interaction.promptIfNotGiven($('Traffic Manager profile name: '), profileName, _);
      name = cli.interaction.promptIfNotGiven($('The endpoint domain name: '), name, _);
      type = cli.interaction.promptIfNotGiven($('The endpoint type: '), type, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.createEndpoint(profileName, name, type, options, _);
    });

  profileEndpoint.command('set [profile-name] [name]')
    .description($('Set an endpoint in a Traffic Manager profile'))
    .usage('[options] <profile-name> <name>')
    .option('-p, --profile-name <profile-name>', $('the name of the profile'))
    .option('-n, --name <name>', $('the endpoint domain name'))
    .option('-y, --type <type>', util.format($('the endpoint type, valid values are: %s'),
      constants.trafficManager.endpoints.types))
    .option('-l, --endpoint-location <endpoint-location>', $('the location of the endpoint. Required when profile load-balancing' +
    '\n     method is set to Performance and endpoint type is set to ' +
    '\n     Any or TrafficManager. Specifies the name of the Azure region'))
    .option('-u, --endpoint-status <endpoint-status>', util.format($('the endpoint status, valid values are: %s Default is Enabled'),
      constants.trafficManager.endpoints.statuses))
    .option('-w, --weight <weight>', $('the endpoint weight used in the load balancing algorithm'))
    .option('-e, --min-child-endpoint <min-child-endpoint>', $('the minimum number of child endpoints, can be specified when Type is set to TrafficManager'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (profileName, name, options, _) {
      profileName = cli.interaction.promptIfNotGiven($('Traffic Manager profile name: '), profileName, _);
      name = cli.interaction.promptIfNotGiven($('The endpoint domain name: '), name, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.setEndpoint(profileName, name, options, _);
    });

  profileEndpoint.command('delete [profile-name] [name]')
    .description($('Delete an endpoint from a Traffic Manager profile'))
    .usage('[options] <profile-name> <name>')
    .option('-p, --profile-name <profile-name>', $('the name of the profile'))
    .option('-n, --name <name>', $('the endpoint domain name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (profileName, name, options, _) {
      profileName = cli.interaction.promptIfNotGiven($('Traffic Manager profile name: '), profileName, _);
      name = cli.interaction.promptIfNotGiven($('The endpoint domain name: '), name, _);

      var trafficManagerManagementClient = createTrafficManagerManagementClient(options);
      var trafficManager = new TrafficManager(cli, trafficManagerManagementClient);
      trafficManager.deleteEndpoint(profileName, name, options, _);
    });

  function createNetworkManagementClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    return utils.createNetworkClient(subscription);
  }

  function createTrafficManagerManagementClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    return utils.createTrafficManagerClient(subscription);
  }

  function createManagementClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    return utils.createManagementClient(subscription);
  }
};
