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
var util = require('util');
var utils = require('../../util/utils');
var vmConstants = require('../../util/vmConstants');
var image = require('./iaas/image');
var $ = utils.getLocaleString;

var VMClient = require('./vm/vmclient');

exports.init = function(cli) {
  var vm = cli.category('vm')
    .description($('Commands to manage your Virtual Machines'));

  var logger = cli.output;

  vm.command('create <dns-name> <image> [userName] [password]')
    .usage('[options] <dns-name> <image> [userName] [password]')
    .description($('Create a VM'))
    .option('-g, --userName <userName>', $('the user name'))
    .option('-p, --password <password>', $('the password'))
    .option('-o, --community', $('the <image> is a community image'))
    .option('-c, --connect', $('connect to an existing cloud service'))
    .option('-l, --location <name>', $('the location'))
    .option('-a, --affinity-group <name>', $('the affinity group'))
    .option('-u, --blob-url <url>', $('the blob url for OS disk'))
    .option('-z, --vm-size <size>', $('the virtual machine size [Small]'))
    .option('-n, --vm-name <name>', $('the virtual machine name'))
    .option('-e, --ssh [port]', $('the ssh port to enable [22]'))
    .option('-t, --ssh-cert <openssh-rsa-file|pem-file|fingerprint>', $('the SSH certificate'))
    .option('-P, --no-ssh-password', $('indicates that the password should be removed when using --ssh-cert'))
    .option('-E, --no-ssh-endpoint', $('indicates that no public SSH endpoint should be created'))
    .option('-G, --generate-ssh-keys', $('Auto generate SSH keys, will be ignored if --ssh-cert is specified.'))
    .option('-r, --rdp [port]', $('indicates that RDP should be enabled [3389]'))
    .option('-w, --virtual-network-name <name>', $('the virtual network name'))
    .option('-b, --subnet-names <list>', $('the comma-delimited subnet names'))
    .option('-i, --public-ip <name>', $('the name of the public IP address assigned to the virtual machine'))
    .option('-S, --static-ip <ip-address>', $('the static IP address assigned to the virtual machine'))
    .option('-R, --reserved-ip <name>', $('the name of the reserved IP address assigned to the virtual machine'))
    .option('-A, --availability-set <name>', $('the name of availability set to create or use'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .option('-d, --custom-data <custom-data-file>', $('CustomData file'))
    .option('-f, --nic-config <nic-config>', $('the NIC configuration, comma separated list of NIC definition' +
                 '      \n Each NIC definition will be in the form  "<nicName>:<subnetName>:[vnetStaticIP]:[nsgName]:[ipForwarding]"' +
                 '      \n The VM must be created in a virtual network using --virtual-network-name option' +
                 '      \n The subnetName in each NIC definition must be an existing subnet in this virtual network'))
    .execute(function(dnsName, imageName, userName, password, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.createVM(dnsName, imageName, userName, password, options, callback, logger);
    });

  vm.command('create-from <dns-name> <role-file>')
    .usage('[options] <dns-name> <role-file>')
    .description($('Create a VM from json role file'))
    .option('-c, --connect', $('connect to existing VMs'))
    .option('-l, --location <name>', $('the location'))
    .option('-a, --affinity-group <name>', $('the affinity group'))
    .option('-t, --ssh-cert <pem-file>', $('Upload SSH certificate'))
    .option('-w, --virtual-network-name <name>', $('the virtual network name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(dnsName, roleFile, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.createVMfromJson(dnsName, roleFile, options, callback, logger);
    });

  vm.command('list')
    .description($('List the VM'))
    .option('-d, --dns-name <name>', $('only show VMs for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listVMs(options, callback, logger);
    });

  vm.command('show <name>')
    .description($('Show details about the VM'))
    .option('-d, --dns-name <name>', $('only show VMs for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.showVM(name, options, callback, logger);
    });

  vm.command('delete <name>')
    .description($('Delete the VM'))
    .option('-d, --dns-name <name>', $('only show VMs for this DNS name'))
    .option('-b, --blob-delete', $('Remove image and disk blobs'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.deleteVM(vmName, options, callback, logger);
    });

  vm.command('start <name>')
    .description($('Start the VM'))
    .option('-d, --dns-name <name>', $('only show VMs for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.startVM(name, options, callback, logger);
    });

  vm.command('restart <name>')
    .description($('Restart the VM'))
    .option('-d, --dns-name <name>', $('only show VMs for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.restartVM(name, options, callback, logger);
    });

  vm.command('shutdown <name>')
    .description($('Shutdown the VM'))
    .option('-d, --dns-name <name>', $('only show VMs for this DNS name'))
    .option('-p, --stay-provisioned', $('if specified the compute resource will not be released on shutdown'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.shutdownVM(name, options, callback, logger);
    });

  vm.command('capture <vm-name> <target-image-name>')
    .description($('Capture the VM as OS Image or VM Image'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-e, --label <label>', $('the target image friendly name'))
    .option('-o, --os-state <osState>', $('the OS state [Specialized, Generalized], required for capturing VM as VM Image'))
    .option('-t, --delete', $('Delete virtual machine after successful capture, can be used only for capturing a VM as OS Image'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, targetImageName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.captureVM(vmName, targetImageName, options, callback, logger);
    });

  vm.command('export <vm-name> <file-path>')
    .description($('Export a VM to a file'))
    .option('-d, --dns-name <name>', $('Export the virtual machine for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, filePath, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.exportVM(vmName, filePath, options, callback, logger);
    });

  var extension = vm.category('extension')
    .description($('Commands to manage VM resource extensions'));

  extension.command('list')
    .description($('List available resource extensions for VMs'))
    .option('-n, --extension-name <name>', $('name of the extension'))
    .option('-p, --publisher-name <name>', $('name of the extension publisher'))
    .option('-e, --version <version>', $('version number of the extension to fetch'))
    .option('-a, --all-versions', $('list all versions of an extension'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listExtensions(options, callback, logger);
    });

  extension.command('set <vm-name> <extension-name> <publisher-name> <version>')
    .description($('Enable/disable resource extensions for VMs'))
    .option('-r, --reference-name <name>', $('extension\'s reference name'))
    .option('-i, --public-config <public-config>', $('public configuration text'))
    .option('-c, --public-config-path <public-config-path>', $('public configuration file path'))
    .option('-t, --private-config <private-config>', $('private configuration text'))
    .option('-e, --private-config-path <private-config-path>', $('private configuration file path'))
    .option('-b, --disable', $('disable extension'))
    .option('-u, --uninstall', $('uninstall extension'))
    .option('-d, --dns-name <name>', $('consider VM hosted in this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, extensionName, publisherName, version, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.setExtension(vmName, extensionName, publisherName, version, options, callback, logger);
    });

  extension.command('set-chef <vm-name>')
    .description($('Enable/disable Chef extensions for VMs'))
    .option('-V, --version <number>', $('extension\'s version number. Default is latest.'))
    .option('-r, --reference-name <name>', $('extension\'s reference name'))
    .option('-R, --run-list <run-list>', $('Runlist of roles/recipes to apply to VM'))
    .option('-O, --validation-pem <validation-pem>', $('chef validation pem file path'))
    .option('-c, --client-config <client-config>', $('chef client configuration file(i.e client.rb) path'))
    .option('-a, --auto-update-client', $('auto update chef client'))
    .option('-j, --bootstrap-options <bootstrap-json-attribute>', $('Bootstrap options in JSON format. Ex: -j \'{"chef_node_name":"test_node"}\''))
    .option('-D, --delete-chef-config', $('delete chef config files during update/uninstall extension'))
    .option('-b, --disable', $('disable extension'))
    .option('-u, --uninstall', $('uninstall extension'))
    .option('-d, --dns-name <name>', $('consider VM hosted in this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.setChefExtension(vmName, options, callback, logger);
    });

  extension.command('get <vm-name>')
    .description($('Gets resource extensions applied to a VM.'))
    .option('-n, --extension-name <name>', $('name of the extension'))
    .option('-p, --publisher-name <name>', $('name of the extension publisher'))
    .option('-r, --reference-name <name>', $('extension\'s reference name'))
    .option('-d, --dns-name <name>', $('consider only VM for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.getExtensions(vmName, options, callback, logger);
    });

  extension.command('get-chef <vm-name>')
    .description($('Gets Chef extension applied to a VM.'))
    .option('-r, --reference-name <name>', $('extension\'s reference name'))
    .option('-d, --dns-name <name>', $('consider only VM for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.getChefExtension(vmName, options, callback, logger);
    });

  var docker = vm.category('docker')
    .description($('Commands to manage your Docker Virtual Machine'));

  docker.command('create <dns-name> <image> <user-name> [password]')
    .usage('[options] <dns-name> <image> <user-name> [password]')
    .description($('Create a VM'))
    .option('-p, --docker-port [port]', util.format($('Port to use for docker [%s]'), vmConstants.EXTENSIONS.DOCKER_PORT))
    .option('-C, --docker-cert-dir [dir]', $('Directory containing docker certs [~/.docker/]'))
    .option('-N, --docker-cert-cn [CN]', $('Docker server certificate\'s CN. Can be set if you are using --tlsverify option for Docker connections. Default value is [*.cloudapp.net]'))
    .option('-o, --community', $('the <image> is a community image'))
    .option('-c, --connect', $('connect to existing VMs'))
    .option('-l, --location <name>', $('the location'))
    .option('-a, --affinity-group <name>', $('the affinity group'))
    .option('-u, --blob-url <url>', $('the blob url for OS disk'))
    .option('-z, --vm-size <size>', $('the virtual machine size [Small]'))
    .option('-n, --vm-name <name>', $('the virtual machine name'))
    .option('-e, --ssh [port]', $('the ssh port to enable [22]'))
    .option('-t, --ssh-cert <pem-file|fingerprint>', $('the SSH certificate'))
    .option('-P, --no-ssh-password', $('indicates that the password should be removed when using --ssh-cert'))
    .option('-E, --no-ssh-endpoint', $('indicates that no public SSH endpoint should be created'))
    .option('-G, --generate-ssh-keys', $('Auto generate SSH keys, will be ignored if --ssh-cert is specified.'))
    .option('-w, --virtual-network-name <name>', $('the virtual network name'))
    .option('-b, --subnet-names <list>', $('the comma-delimited subnet names'))
    .option('-S, --static-ip <ip-address>', $('the static IP address assigned to the virtual machine'))
    .option('-R, --reserved-ip <name>', $('the name of the reserved IP address assigned to the virtual machine'))
    .option('-A, --availability-set <name>', $('the name of availability set to create or use'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .option('-d, --custom-data <custom-data-file>', $('CustomData file'))
    .execute(function(dnsName, imageName, userName, password, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.createDockerVM(dnsName, imageName, userName, password, options, callback, logger);
    });

  var location = vm.category('location')
    .description($('Commands to manage your Virtual Machine locations'));

  location.command('list')
    .description($('List locations available for your account'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listLocations(options, callback, logger);
    });

  var staticIP = vm.category('static-ip')
    .description($('Commands to manage your Virtual Machine static IP address'));

  staticIP.command('show <vm-name>')
    .description($('Show a VM static IP address'))
    .option('-d, --dns-name <name>', $('consider VM hosted in this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.showStaticIP(vmName, options, callback, logger);
    });

  staticIP.command('set <vm-name> <ip-address>')
    .description($('Set a VM static IP address'))
    .option('-d, --dns-name <name>', $('consider VM hosted in this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, ipAddress, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.setStaticIP(vmName, ipAddress, options, callback, logger);
    });

  staticIP.command('remove <vm-name>')
    .description($('Remove a VM static IP address'))
    .option('-d, --dns-name <name>', $('consider VM hosted in this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.removeStaticIP(vmName, options, callback, logger);
    });

  var publicIP = vm.category('public-ip')
    .description($('Commands to manage your Virtual Machine public IP address'));

  publicIP.command('list [vm-name]')
    .description($('List public IP addresses for a VM'))
    .option('-n, --vm-name <name>', $('the VM name'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listPublicIPs(vmName, options, callback, logger);
    });

  publicIP.command('set [vm-name] [publicip-name]')
    .description($('Set public IP address for a VM'))
    .option('-n, --vm-name <name>', $('the VM name'))
    .option('-p, --publicip-name <name>', $('the public IP name'))
    .option('-t, --idle-timeoutInMinutes <timeout>', $('timeout for tcp idle connection'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, publicipName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.setPublicIP(vmName, publicipName, options, callback, logger);
    });

  publicIP.command('delete [vm-name] [publicip-name]')
    .description($('Delete public IP address for a VM'))
    .option('-n, --vm-name <name>', $('the VM name'))
    .option('-p, --publicip-name <name>', $('the public IP name'))
    .option('-q, --quiet', $('quiet mode, do not ask for remove confirmation'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, publicipName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.removePublicIP(vmName, publicipName, options, callback);
    });

  var endpoint = vm.category('endpoint')
    .description($('Commands to manage your Virtual Machine endpoints'));

  endpoint.command('create <vm-name> <public-port> [local-port]')
    .description($('Create a VM endpoint'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-n, --name <name>', $('the endpoint name'))
    .option('-k, --local-port <local-port>', $('the local port'))
    .option('-o, --protocol <protocol>', $('the transport layer protocol for the endpoint (tcp or udp)'))
    .option('-m, --idle-timeout <idle-timeout>', $('timeout for tcp idle connection specified in minutes'))
    .option('-t, --probe-port <port>', $('the virtual machine port to use to inspect the availability status'))
    .option('-r, --probe-protocol <protocol>', $('the protocol to use to inspect the availability status'))
    .option('-p, --probe-path <path>', $('the relative path to inspect the availability status'))
    .option('-e, --probe-interval <probe-interval>', $('the availability status check interval specified in seconds'))
    .option('-f, --probe-timeout <probe-timeout>', $('the availability status check timeout specified in seconds'))
    .option('-u, --direct-server-return <direct-server-return>', $('enable or disable direct server return on this endpoint, valid values are [Enabled, Disabled] Disabled by default'))
    .option('-b, --load-balanced-set-name <load-balanced-set-name>', $('the load-balancer set name'))
    .option('-i, --internal-load-balancer-name <name>', $('the internal load balancer name'))
    .option('-a, --load-balancer-distribution <load-balancer-distribution>', $('the load balancer distribution, valid values are [sourceIP, sourceIPProtocol, None]'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, publicPort, localPort, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.createEP(vmName, publicPort, localPort, options, callback, logger);
    });

  endpoint.command('create-multiple <vm-name> [endpoints-config]')
    .usage('[options] <vm-name> <endpoints-config>')
    .description($('Create multiple VM endpoints'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-c, --endpoints-config <endpoints-config>', $('comma seperated list of endpoint configurations, ' +
          'each configuration must have the format' +
          ' <public-port>:<local-port>:<protocol>:<idle-timeout>:<direct-server-return>:<probe-protocol>:<probe-port>:<probe-path>:<probe-interval>:<probe-timeout>:<load-balanced-set-name>:<internal-load-balancer-name>:<load-balancer-distribution>'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, endpointsConfig, options, callback) {
      if (!endpointsConfig) {
        return callback($('endpoints-config is a required'));
      }
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.createMultipleEP(vmName, endpointsConfig, options, callback, logger);
    });

  endpoint.command('delete <vm-name> <endpoint-name>')
    .description($('Delete a VM endpoint'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, endpointName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.deleteEP(vmName, endpointName, options, callback);
    });

  endpoint.command('set <vm-name> <endpoint-name>')
    .description($('Update a VM endpoint'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-n, --new-endpoint-name <new-endpoint-name>', $('the new name for the endpoint'))
    .option('-l, --public-port <public-port>', $('the public port'))
    .option('-k, --local-port <local-port>', $('the local port'))
    .option('-o, --protocol <protocol>', $('the transport layer protocol for the endpoint (tcp or udp)'))
    .option('-m, --idle-timeout <idle-timeout>', $('connection timeout for tcp idle connection, specified in minutes'))
    .option('-t, --probe-port <probe-port>', $('the virtual machine port to use to inspect the availability status'))
    .option('-r, --probe-protocol <probe-protocol>', $('the protocol to use to inspect the availability status'))
    .option('-p, --probe-path <probe-path>', $('the relative path to inspect the availability status'))
    .option('-e, --probe-interval <probe-interval>', $('the availability status check interval specified in seconds'))
    .option('-f, --probe-timeout <probe-timeout>', $('the availability status check timeout specified in seconds'))
    .option('-u, --direct-server-return <direct-server-return>', $('enable or disable direct server return on endpoint, valid values are [Enabled, Disabled] Disabled by default'))
    .option('-b, --load-balanced-set-name <load-balanced-set-name>', $('the load balanced set name'))
    .option('-i, --internal-load-balancer-name <internal-load-balancer-name>', $('the internal load balancer name'))
    .option('-a, --load-balancer-distribution <load-balancer-distribution>', $('the load balancer distribution, valid values are [sourceIP, sourceIPProtocol, None]'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, endpointName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.setEP(vmName, endpointName, options, callback);
    });

  endpoint.command('list <vm-name>')
    .description($('Get all endpoints in a VM'))
    .option('-d, --dns-name <name>', $('only consider VM for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listEPs(name, options, callback, logger);
    });

  endpoint.command('show <vm-name> <endpoint-name>')
    .description($('Get an endpoint in a VM'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(name, endpointName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.showEP(name, endpointName, options, callback, logger);
    });

  var aclRule = endpoint.category('acl-rule')
    .description($('Commands to manage your Virtual Machine endpoint\'s ACL rules'));

  aclRule.command('create [vm-name] [endpoint-name] [order] [action] [remote-subnet]')
    .description($('Create an ACL rule for a VM endpoint'))
    .option('-n, --vm-name <name>', $('the VM name'))
    .option('-e, --endpoint-name <name>', $('the ACL rule name'))
    .option('-o, --order <id>', $('the ACL rule order'))
    .option('-a, --action  <name>', $('the ACL rule action'))
    .option('-t, --remote-subnet  <subnet>', $('the ACL rule remote subnet'))
    .option('-r, --description <description>', $('the ACL rule rule description'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, endpointName, order, action, remoteSubnet, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.createEPAclRule(vmName, endpointName, order, action, remoteSubnet, options, callback, logger);
    });

  aclRule.command('list [vm-name] [endpoint-name]')
    .description($('List ACL rules defined for a VM endpoint'))
    .option('-n, --vm-name <name>', $('the VM name'))
    .option('-e, --endpoint-name <name>', $('the ACL rule name'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, endpointName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listEPAclRules(vmName, endpointName, options, callback, logger);
    });

  aclRule.command('delete [vm-name] [endpoint-name] [order]')
    .description($('Delete an ACL rule for a VM endpoint'))
    .option('-n, --vm-name <name>', $('the VM name'))
    .option('-e, --endpoint-name <name>', $('the ACL rule name'))
    .option('-o, --order <id>', $('the ACL rule order'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, endpointName, order, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.deleteEPAclRule(vmName, endpointName, order, options, callback, logger);
    });

  aclRule.command('set [vm-name] [endpoint-name] [order]')
    .description($('Update an ACL rule defined for a VM endpoint'))
    .option('-n, --vm-name <name>', $('the VM name'))
    .option('-e, --endpoint-name <name>', $('the ACL rule name'))
    .option('-o, --order <id>', $('the ACL rule order'))
    .option('-w, --new-order <id>', $('the new order for the ACL'))
    .option('-a, --action  <name>', $('the new action for the ACL'))
    .option('-t, --remote-subnet  <subnet>', $('the new remote subnet for the ACL rule'))
    .option('-r, --description  <name>', $('the new description for the ACL'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, endpointName, order, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.updateEPAclRule(vmName, endpointName, order, options, callback, logger);
    });

  var osImage = vm.category('image')
    .description($('Commands to manage your Virtual Machine images'));

  osImage.command('show <name>')
    .description($('Show details about a VM image'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.show(image.OSIMAGE, cli));

  osImage.command('list')
    .description($('List VM images'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.list(image.OSIMAGE, cli));

  osImage.command('delete <name>')
    .description($('Delete a VM image from a personal repository'))
    .option('-b, --blob-delete', $('delete the underlying blob from storage'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.delete(image.OSIMAGE, cli));

  osImage.command('create <name> [source-path]')
    .description($('Upload and register a VM image'))
    .option('-u, --blob-url <url>', $('the target image blob url'))
    .option('-l, --location <name>', $('the location'))
    .option('-a, --affinity-group <name>', $('the affinity group'))
    .option('-o, --os <type>', $('the operating system [linux|windows]'))
    .option('-p, --parallel <number>', $('the maximum number of parallel uploads [96]'), 96)
    .option('-m, --md5-skip', $('skip MD5 hash computation'))
    .option('-f, --force-overwrite', $('Force overwrite of prior uploads'))
    .option('-e, --label <about>', $('the image label'))
    .option('-d, --description <about>', $('the image description'))
    .option('-b, --base-vhd <blob>', $('the base vhd blob url'))
    .option('-k, --source-key <key>', $('the source storage key if source-path\n                         is a Microsoft Azure private blob url'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.create(image.OSIMAGE, cli));

  var disk = vm.category('disk')
    .description($('Commands to manage your Virtual Machine data disks'));

  disk.command('show <name>')
    .description($('Show details about a disk'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.show(image.DISK, cli));

  disk.command('list [vm-name]')
    .description($('List disk images, or disks attached to a specified VM'))
    .option('-d, --dns-name <name>', $('only show VMs for this DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.list(image.DISK, cli));

  disk.command('delete <name>')
    .description($('Delete a disk image from personal repository'))
    .option('-b, --blob-delete', $('Delete underlying blob from storage'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.delete(image.DISK, cli));

  disk.command('create <name> [source-path]')
    .description($('Upload and register a disk image'))
    .option('-u, --blob-url <url>', $('the target image blob url'))
    .option('-l, --location <name>', $('the location'))
    .option('-a, --affinity-group <name>', $('the affinity group'))
    .option('-o, --os [type]', $('the operating system if any [linux|windows|none]'))
    .option('-p, --parallel <number>', $('the maximum number of parallel uploads [96]', 96))
    .option('-m, --md5-skip', $('skip MD5 hash computation'))
    .option('-f, --force-overwrite', $('Force overwrite of prior uploads'))
    .option('-e, --label <about>', $('the image label'))
    .option('-d, --description <about>', $('the image description'))
    .option('-b, --base-vhd <blob>', $('the base vhd blob url'))
    .option('-k, --source-key <key>', $('the source storage key if source-path\n                         is a Microsoft Azure private blob url'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(image.create(image.DISK, cli));

  disk.command('upload <source-path> <blob-url> <storage-account-key>')
    .description($('Upload a VHD to a storage account'))
    .option('-p, --parallel <number>', $('the maximum number of parallel uploads [96]'), 96)
    .option('-m, --md5-skip', $('skip MD5 hash computation'))
    .option('-f, --force-overwrite', $('Force overwrite of prior uploads'))
    .option('-b, --base-vhd <blob>', $('the base vhd blob url'))
    .option('-k, --source-key <key>', $('the source storage key if source-path\n                         is a Microsoft Azure private blob url'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(sourcePath, blobUrl, storageAccountKey, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.uploadDataDisk(sourcePath, blobUrl, storageAccountKey, options, callback, logger);
    });

  disk.command('attach <vm-name> <disk-image-name>')
    .description($('Attach a data-disk to a VM'))
    .option('-c, --host-caching <name>', $('the caching behaviour of disk [None, ReadOnly, ReadWrite]'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, diskImageName, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.attachDataDisk(vmName, diskImageName, options, callback, logger);
    });

  disk.command('attach-new <vm-name> <size-in-gb> [blob-url]')
    .description($('Attach a new data-disk to a VM'))
    .option('-c, --host-caching <name>', $('the caching behaviour of disk [None, ReadOnly, ReadWrite]'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, size, blobUrl, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.attachNewDataDisk(vmName, size, blobUrl, options, callback, logger);
    });

  disk.command('detach <vm-name> <lun>')
    .description($('Detaches a data-disk attached to a VM'))
    .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(vmName, lun, options, callback) {
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.detachDataDisk(vmName, lun, options, callback, logger);
    });

    disk.command('update <vm-name> <lun>')
      .description($('Update properties of a data-disk attached to a VM'))
      .option('-c, --host-caching <name>', $('the caching behaviour of disk [None, ReadOnly, ReadWrite]'))
      .option('-d, --dns-name <name>', $('filter VMs for the specified DNS name'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function(vmName, lun, options, callback) {
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.updateDataDisk(vmName, lun, options, callback, logger);
      });
};
