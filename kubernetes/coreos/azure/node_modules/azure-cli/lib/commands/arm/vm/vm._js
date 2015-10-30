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
var VMClient = require('./vmClient');
var vmConstants = require('../../../util/vmConstants');

var $ = utils.getLocaleString;

exports.init = function (cli) {

  var vm = cli.category('vm')
    .description($('Commands to manage your virtual machines'));

  vm.command('create [resource-group] [name] [location] [os-type]')
    .description($('Create a virtual machine in a resource group'))
    .usage('[options] <resource-group> <name> <location> <os-type>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-D, --nic-id <nic-id>', $('the NIC identifier' +
                  '\n     e.g. /subscriptions/<subscriptipn-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/networkInterfaces/<nic-name>'))
    .option('-f, --nic-name <nic-name>', $('the NIC name' +
                  '\n     If this is an existing NIC then it must exists under the current resource group identified by resource-group' +
                  '\n     A new NIC will be created if no NIC exists with name nic-name in the current resource group' +
                  '\n     To create new NIC - subnet-id or vnet-name, vnet-address-prefix, subnet-name and vnet-subnet-address-prefix are required' +
                  '\n     Please use nic-id to refer an existing NIC in a different resource group' +
                  '\n     The parameter nic-name will be ignored when nic-id is specified'))
    .option('-I, --nic-ids <nic-ids>', $('the list of NIC identifiers separated by comma. In case of specifying multiple nics first one will be set as primary.'))
    .option('-N, --nic-names <nic-names>', $('the list of NIC names separated by comma. In case of specifying multiple nics first one will be set as primary.' +
            'These NICs must exists in the same resource group as the VM. Please use nic-ids if that not the case. ' +
            'This parameter will be ignored if --nic-ids is specified'))
    .option('-l, --location <location>', $('the location'))
    .option('-y, --os-type <os-type>', $('the operating system Type, valid values are Windows, Linux'))
    .option('-Q, --image-urn <image-urn>', $('the image URN in the form publisherName:offer:skus:version'))
    .option('-u, --admin-username <admin-username>', $('the user name' +
                  '\n      This parameter is valid for a VM created from an image (image-urn) and ignored when VM is based on an existing disk'))
    .option('-p, --admin-password <admin-password>', $('the password' +
                  '\n      This parameter is valid for a VM created from an image (image-urn) and ignored when VM is based on existing disk'))
    .option('-M, --ssh-publickey-file <openssh-rsa-file|pem-file>', $('path to public key PEM file or SSH Public key file for SSH authentication' +
                   '\n     This parameter is valid only when os-type is "Linux"'))
    .option('-G, --generate-ssh-keys', $('Auto generate SSH keys, will be ignored if --ssh-publickey-file is specified. This parameter is valid only when os-type is "Linux"'))
    .option('-z, --vm-size <vm-size>', $('the virtual machine size [Standard_A1]'))
    .option('-U, --public-ip-id <public-ip-id>', $('the public ip identifier' +
                   '\n     e.g. /subscriptions/<subscriptipn-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/publicIPAddresses/<public-ip-name>'))
    .option('-i, --public-ip-name <public-ip-name>', $('the public ip name' +
                   '\n     If this is an existing public IP then it must exists under the current resource group identified by resource-group' +
                   '\n     A new public IP will be created if no public IP exists with name public-ip-name in the current resource group' +
                   '\n     Please use public-ip-id to refer an existing public IP in a different resource group' +
                   '\n     The parameter public-ip-name will be ignored when public-ip-id is specified'))
    .option('-w, --public-ip-domain-name <public-ip-domain-name>', $('the public ip domain name' +
                   '\n     This sets the DNS to <publicip-domain-name>.<location>.cloudapp.azure.com' +
                   '\n     This parameter will be used only when creating new public IP'))
    .option('-m, --public-ip-allocation-method <public-ip-allocation-method>', $('the public ip allocation method, valid values are "Dynamic"' +
                   '\n     This parameter will be used only when creating new public IP'))
    .option('-t, --public-ip-idletimeout <public-ip-idletimeout>', $('the public ip idle timeout specified in minutes' +
                   '\n     This parameter will be used only when creating new public IP'))
    .option('-S, --subnet-id <subnet-id>', $('the subnet identifier' +
                   '\n     e.g. /subscriptions/<subscriptipn-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>'))
    .option('-F, --vnet-name <vnet-name>', $('the virtual network name' +
                   '\n     If this is an existing vnet then it must exists under the current resource group identified by resource-group' +
                   '\n     If this is an existing vnet then vnet-subnet-name is required' +
                   '\n          If no subnet exists with name vnet-subnet-name then a new subnet will be created' +
                   '\n          To create new subnet - vnet-subnet-address-prefix is required' +
                   '\n     A new vnet will be created if no vnet exists with name vnet-name in the current resource group' +
                   '\n     To create new vnet - vnet-address-prefix, vnet-subnet-name and vnet-subnet-address-prefix are required' +
                   '\n     Please use subnet-id to refer an existing subnet under a vnet in a different resource group' +
                   '\n     vnet-name, vnet-address-prefix, vnet-subnet-name and vnet-subnet-address-prefix will be ignored when subnet-id is specified'))
    .option('-P, --vnet-address-prefix <vnet-address-prefix>', $('the virtual network address prefix in IPv4/CIDR format'))
    .option('-j, --vnet-subnet-name <vnet-subnet-name>', $('the virtual network subnet name'))
    .option('-k, --vnet-subnet-address-prefix <vnet-subnet-address-prefix>', $('the virtual network subnet address prefix in IPv4/CIDR format'))
    .option('-r, --availset-name <availset-name>', $('the availability set name'))
    .option('-o, --storage-account-name <storage-account-name>', $('the storage account name'))
    .option('-R, --storage-account-container-name <storage-account-container-name>', $('the storage account container name [vhds]'))
    .option('-d, --os-disk-vhd <os-disk-vhd>', $('name or url of the OS disk Vhd' +
                   '\n     If this parameter is specified along with --image-urn parameter then OS disk created from the image will be stored in this vhd' +
                   '\n     If this parameter is specified without --image-urn parameter then this vhd must exists and will be used as OS Disk'))
    .option('-a, --data-disk-caching <data-disk-caching>', $('data disk caching, valid values are None, ReadOnly, ReadWrite'))
    .option('-x, --data-disk-vhd <data-disk-vhd>', $('name or url of the data disk Vhd'))
    .option('-e, --data-disk-size <data-disk-size>', $('data disk size in GB'))
    .option('-Y, --data-disk-existing', $('Will use existing VHD if specified. Don\'t specify this param if you are creating data disk from a new VHD.'))
    .option('-C, --custom-data <custom-data-file>', $('CustomData file'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .option('--tags <tags>', $('Tags to set to the virtual machine. Can be multiple. ' +
            'In the format of \'name=value\'. Name is required and value is optional. For example, --tags tag1=value1;tag2'))
    .option('--enable-boot-diagnostics', $('The switch parameter to enable the boot diagnostics for VM.'))
    .option('--boot-diagnostics-storage-uri <boot-diagnostics-storage-uri>', $('The storage account URL for boot diagnostics. ' +
            'In the format of \'https://your_stoage_account_name.blob.core.windows.net/\'.'))
    .execute(function (resourceGroup, name, location, osType, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location name: '), location, _);
      osType = cli.interaction.promptIfNotGiven($('Operating system Type: '), osType, _);
      location = utils.toLowerCaseAndRemoveSpace(location);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.createVM(resourceGroup, name, location, osType, options, _);
    });

  vm.command('quick-create [resource-group] [name] [location] [os-type] [image-urn] [admin-username] [admin-password]')
    .description($('Create a virtual machine with default resources in a resource group'))
    .usage('[options] <resource-group> <name> <location> <os-type> <image-urn> <admin-username> <admin-password>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-l, --location <location>', $('the location'))
    .option('-y, --os-type <os-type>', $('the operating system Type, valid values are Windows, Linux'))
    .option('-Q, --image-urn <image-urn>', $('the image URN in the form "publisherName:offer:skus:version"'))
    .option('-u, --admin-username <admin-username>', $('the user name'))
    .option('-p, --admin-password <admin-password>', $('the password'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, osType, imageUrn, adminUsername, adminPassword, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location name: '), location, _);
      osType = cli.interaction.promptIfNotGiven($('Operating system Type [Windows, Linux]: '), osType, _);
      imageUrn = cli.interaction.promptIfNotGiven($('ImageURN (format: "publisherName:offer:skus:version"): '), imageUrn, _);
      adminUsername = cli.interaction.promptIfNotGiven($('User name: '), adminUsername, _);
      adminPassword = cli.interaction.promptPasswordIfNotGiven($('Password: '), adminPassword, _);
      location = utils.toLowerCaseAndRemoveSpace(location);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.quickCreateVM(resourceGroup, name, location, osType, imageUrn, adminUsername, adminPassword, options, _);
    });

  vm.command('list [resourceGroup]')
    .description($('Get all virtual machines in a resource group'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listVM(resourceGroup, options, _);
    });

  vm.command('show [resource-group] [name]')
    .description($('Get a virtual machine in a resource group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-d, --depth <depth>', $('the number of times to recurse, to recurse indefinitely pass "full". (valid only with --json option)'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.showVM(resourceGroup, name, options, _);
    });

  vm.command('delete [resource-group] [name]')
    .description($('Delete a virtual machine in a resource group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.deleteVM(resourceGroup, name, options, _);
    });

  vm.command('stop [resource-group] [name]')
    .description($('Shutdown a virtual machine in a resource group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.stopVM(resourceGroup, name, options, _);
    });

  vm.command('restart [resource-group] [name]')
    .description($('Restart a virtual machine in a resource group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.restartVM(resourceGroup, name, options, _);
    });

  vm.command('start [resource-group] [name]')
    .description($('Start a virtual machine in a resource group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.startVM(resourceGroup, name, options, _);
    });

  vm.command('deallocate [resource-group] [name]')
    .description($('Shutdown a virtual machine in a resource group and release the compute resources'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.deallocateVM(resourceGroup, name, options, _);
    });

  vm.command('sizes')
    .description($('Get all available virtual machine sizes'))
    .usage('[options]')
    .option('-l, --location <location>', $('the location name, use this to get the list of VM sizes available in a location'))
    .option('-n, --vm-name <vm-name>', $('the virtual machine name, use this to get the list of VM sizes available for a specific VM'))
    .option('-g, --resource-group <resourceGroup>', $('the resource group name, required when --vm-name is specified'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (options, _) {
      options.location = utils.toLowerCaseAndRemoveSpace(options.location);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.listVMSizesOrLocationVMSizes(options, _);
  });

  vm.command('capture [resource-group] [name] [vhd-name-prefix]')
    .description($('Capture a VM in a resource group as an OS Image or VM Image'))
    .usage('[options] <resource-group> <name> <vhd-name-prefix>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-p, --vhd-name-prefix <vhd-name-prefix>', $('Captured virtual hard disk\'s name prefix'))
    .option('-R, --storage-account-container-name <storage-account-container-name>', $('the storage account container name [vhds]'))
    .option('-o, --overwrite', $('In case of conflict overwrite the target virtual hard disk if set to true.'))
    .option('-t, --template-file-name <template-file-name>', $('Name of the file that will contain a template that can be used to create similar VMs.'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(resourceGroup, name, vhdNamePrefix, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      vhdNamePrefix = cli.interaction.promptIfNotGiven($('Virtual hard disk\'s name prefix: '), vhdNamePrefix, _);

      var vmClient = new VMClient(cli, options.subscription);
      vmClient.captureVM(resourceGroup, name, vhdNamePrefix, options, _);
    });

  vm.command('generalize [resource-group] [name]')
    .description($('Set the state of a VM in a resource group to Generalized.'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);

      var vmClient = new VMClient(cli, options.subscription);
      vmClient.generalizeVM(resourceGroup, name, options, _);
    });

  vm.command('get-instance-view [resource-group] [name]')
    .description($('Get instance view of a VM in a resource group.'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);

      var vmClient = new VMClient(cli, options.subscription);
      vmClient.getInstanceView(resourceGroup, name, options, _);
    });

  vm.command('get-serial-output [resource-group] [name]')
    .description($('Get serial output of a VM in a resource group.'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .option('--max-length <max-length>', $('the max number of characters shown in one page of log output'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);

      var vmClient = new VMClient(cli, options.subscription);
      vmClient.getSerialOutput(resourceGroup, name, options, _);
    });

  vm.command('reset-access [resource-group] [name]')
    .description($('Enables you to reset Remote Desktop Access or SSH settings on a Virtual Machine and to reset the password for the account that has administrator or sudo authority.'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-u, --user-name <user-name>', $('the user name'))
    .option('-p, --password <password>', $('the password'))
    .option('-M, --ssh-key-file <ssh-key-file>', $('path to public key PEM file for SSH authentication (valid only when os-type is "Linux")'))
    .option('-r, --reset-ssh', $('Reset the SSH configuration to default'))
    .option('-E, --extension-version <version>', $('Version of VM Access extension [1.1]'))
    .option('-e, --expiration <expiration>', $('password expiration'))
    .option('-R, --remove-user <remove-user-name>', $('Remove a user account with specified name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);

      var vmClient = new VMClient(cli, options.subscription);
      vmClient.resetVMAccess(resourceGroup, name, options, _);
    });

  vm.command('set [resource-group] [name]')
    .description($('Update a VM in a resource group.'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-I, --nic-ids <nic-ids>', $('the list of NIC identifiers separated by comma. In case of specifying multiple nics first one will be set as primary.'))
    .option('-N, --nic-names <nic-names>', $('the list of NIC names separated by comma. In case of specifying multiple nics first one will be set as primary.' +
            'These NICs must exists in the same resource group as the VM. Please use nic-ids if that not the case. ' +
            'This parameter will be ignored if --nic-ids is specified'))
    .option('-z, --vm-size <vm-size>', $('the virtual machine size'))
    .option('-t, --tags <tags>', $('Tags to set to the resource group. Can be multiple. ' +
            'In the format of \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
    .option('-T, --no-tags', $('Remove all tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .option('--disable-boot-diagnostics', $('The switch parameter to disable the boot diagnostics for VM.'))
    .option('--enable-boot-diagnostics', $('The switch parameter to enable the boot diagnostics for VM.'))
    .option('--boot-diagnostics-storage-uri <boot-diagnostics-storage-uri>', $('The storage account URL for boot diagnostics. ' +
            'In the format of \'https://your_stoage_account_name.blob.core.windows.net/\'.'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.setVM(resourceGroup, name, options, _);
    });

  vm.command('list-usage [location]')
      .description($('Get usage of compute resources.'))
      .usage('[options] <location>')
      .option('-l, --location <location>', $('the location'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listComputeUsage(location, options, _);
      });

  vm.command('enable-diag [resource-group] [name]')
    .description($('Enable diagnostics extension on a VM in a resource group.'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-a, --storage-account-name <name>', $('the storage account name'))
    .option('-c, --config-file <path>', $('path for WadCfg config file'))
    .option('-e, --extension-version <version>', util.format($('Version of Diagnostics extension. Default values are [%s] for Windows and [%s] for Linux.'), vmConstants.EXTENSIONS.IAAS_DIAG_VERSION, vmConstants.EXTENSIONS.LINUX_DIAG_VERSION))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
      var vmClient = new VMClient(cli, options.subscription);
      vmClient.enableDiagVM(resourceGroup, name, options, _);
    });

    var disk = vm.category('disk')
        .description($('Commands to manage your Virtual Machine data disks'));

    disk.command('attach-new [resource-group] [vm-name] [size-in-gb] [vhd-name]')
      .description($('Attach a new data-disk to a VM in a resource group'))
      .usage('[options] <resource-group> <vm-name> <size-in-gb> [vhd-name]')
      .option('-g, --resource-group <resource-group>', $('the resource group name'))
      .option('-n, --vm-name <vm-name>', $('the virtual machine name'))
      .option('-z, --size-in-gb <size-in-gb>', $('the disk size in GB'))
      .option('-d, --vhd-name <vhd-name>', $('the name for the new VHD'))
      .option('-c, --host-caching <name>', $('the caching behaviour of disk [None, ReadOnly, ReadWrite]'))
      .option('-o, --storage-account-name <storageAccountName>', $('the storage account name'))
      .option('-r, --storage-account-container-name <storageAccountContainerName>', $('the storage account container name [vhds]'))
      .option('-l, --lun <lun>', $('zero based logical unit number of the data disk'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function(resourceGroup, vmName, size, vhdName, options, _) {
        resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
        vmName = cli.interaction.promptIfNotGiven($('Virtual machine name: '), vmName, _);
        size = cli.interaction.promptIfNotGiven($('Disk size in gb: '), size, _);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.attachNewDataDisk(resourceGroup, vmName, size, vhdName, options, _);
    });

    disk.command('detach [resource-group] [vm-name] [lun]')
      .description($('Detach a data-disk attached to a VM in a resource group'))
      .usage('[options] <resource-group> <vm-name> <lun>')
      .option('-g, --resource-group <resource-group>', $('the resource group name'))
      .option('-n, --vm-name <vm-name>', $('the virtual machine name'))
      .option('-l, --lun <lun>', $('the data disk lun'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function(resourceGroup, vmName, lun, options, _) {
        resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
        vmName = cli.interaction.promptIfNotGiven($('Virtual machine name: '), vmName, _);
        lun = cli.interaction.promptIfNotGiven($('Data disk lun: '), lun, _);

        var vmClient = new VMClient(cli, options.subscription);
        vmClient.detachDataDisk(resourceGroup, vmName, lun, options, _);
    });

    disk.command('attach [resource-group] [vm-name] [vhd-url]')
      .description($('Attach a new data-disk to a VM in a resource group'))
      .usage('[options] <resource-group> <vm-name> [vhd-url]')
      .option('-g, --resource-group <resource-group>', $('the resource group name'))
      .option('-n, --vm-name <vm-name>', $('the virtual machine name'))
      .option('-d, --vhd-url <vhd-url>', $('the URL of existing VHD'))
      .option('-c, --host-caching <name>', $('the caching behaviour of disk [None, ReadOnly, ReadWrite]'))
      .option('-l, --lun <lun>', $('zero based logical unit number of the data disk'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function(resourceGroup, vmName, vhdUrl, options, _) {
        resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
        vmName = cli.interaction.promptIfNotGiven($('Virtual machine name: '), vmName, _);
        vhdUrl = cli.interaction.promptIfNotGiven($('URL of existing VHD: '), vhdUrl, _);

        var vmClient = new VMClient(cli, options.subscription);
        vmClient.attachDataDisk(resourceGroup, vmName, vhdUrl, options, _);
    });

    disk.command('list [resource-group] [vm-name]')
      .description($('Get all data disks of a VM in a resource group'))
      .usage('[options] <resource-group> <vm-name>')
      .option('-g, --resource-group <resource-group>', $('the resource group name'))
      .option('-n, --vm-name <vm-name>', $('the virtual machine name'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function(resourceGroup, vmName, vhdUrl, options, _) {
        resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
        vmName = cli.interaction.promptIfNotGiven($('Virtual machine name: '), vmName, _);

        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listDataDisks(resourceGroup, vmName, options, _);
    });

    var extension = vm.category('extension')
      .description($('Commands to manage VM resource extensions'));

    extension.command('set [resource-group] [vm-name] [name] [publisher-name] [version]')
      .description($('Enable/disable resource extensions for a VM in a resource group'))
      .usage('[options] <resource-group> <vm-name> <name> <publisher-name> <version>')
      .option('-g, --resource-group <resource-group>', $('the resource group name'))
      .option('-m, --vm-name <vm-name>', $('the virtual machine name'))
      .option('-n, --name <name>', $('the extension name'))
      .option('-p, --publisher-name <publisher-name>', $('the publisher name'))
      .option('-o, --version <version>', $('the extension version'))
      .option('-r, --reference-name <reference-name>', $('extension\'s reference name'))
      .option('-i, --public-config <public-config>', $('public configuration text'))
      .option('-c, --public-config-path <public-config-path>', $('public configuration file path'))
      .option('-f, --private-config <private-config>', $('private configuration text'))
      .option('-e, --private-config-path <private-config-path>', $('private configuration file path'))
      .option('-u, --uninstall', $('uninstall extension'))
      .option('-t, --tags <tags>', $('Tags to set to the resource group. Can be mutliple. ' +
              'In the format of \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
      .option('-q, --quiet', $('quiet mode, do not ask for uninstall confirmation'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function(resourceGroup, vmName, name, publisherName, version, options, _) {
        resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
        vmName = cli.interaction.promptIfNotGiven($('Virtual machine name: '), vmName, _);
        name = cli.interaction.promptIfNotGiven($('VM Extension name: '), name, _);
        publisherName = cli.interaction.promptIfNotGiven($('VM Extension publisher name: '), publisherName, _);
        version = cli.interaction.promptIfNotGiven($('VM Extension version: '), version, _);

        var vmClient = new VMClient(cli, options.subscription);
        vmClient.setExtension(resourceGroup, vmName, name, publisherName, version, options, _);
    });

    extension.command('get [resource-group] [vm-name]')
      .description($('Get extensions installed on a virtual machine in a resource group'))
      .usage('[options] <resource-group> <vm-name>')
      .option('-g, --resource-group <resource-group>', $('the resource group name'))
      .option('-m, --vm-name <vm-name>', $('the virtual machine name'))
      .option('-s, --subscription <id>', $('the subscription id'))
      .execute(function(resourceGroup, vmName, options, _) {
        resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
        vmName = cli.interaction.promptIfNotGiven($('Virtual machine name: '), vmName, _);

        var vmClient = new VMClient(cli, options.subscription);
        vmClient.getExtensions(resourceGroup, vmName, options, _);
    });

  extension.command('list-image-publishers [location]')
      .description($('Lists virtual machine/extension image publishers'))
      .usage('[options] <location>')
      .option('-l, --location <location>', $('the location'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listVMImagePublishers(location, options, _);
      });

  extension.command('list-image-types [location] [publisher]')
      .description($('Lists virtual machine extension image types by a publisher'))
      .usage('[options] <location> <publisher>')
      .option('-l, --location <location>', $('the location'))
      .option('-p, --publisher <publisher>', $('the publisher name'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, publisher, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        publisher = cli.interaction.promptIfNotGiven($('Publisher: '), publisher, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listVMExtensionImageTypes(location, publisher, options, _);
      });

  extension.command('list-image-versions [location] [publisher] [typeName]')
      .description($('Lists virtual machine extension image versions by publisher and type input'))
      .usage('[options] <location> <publisher> <typeName>')
      .option('-l, --location <location>', $('the location'))
      .option('-p, --publisher <publisher>', $('the publisher name'))
      .option('-t, --typeName <typeName>', $('the type name'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, publisher, typeName, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        publisher = cli.interaction.promptIfNotGiven($('Publisher: '), publisher, _);
        typeName = cli.interaction.promptIfNotGiven($('TypeName: '), typeName, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listVMExtensionImageVersions(location, publisher, typeName, options, _);
      });

  extension.command('get-image [location] [publisher] [typeName] [version]')
      .description($('Lists virtual machine extension image versions by publisher, type and version input'))
      .usage('[options] <location> <publisher> <typeName> <version>')
      .option('-l, --location <location>', $('the location'))
      .option('-p, --publisher <publisher>', $('the publisher name'))
      .option('-t, --typeName <typeName>', $('the type name'))
      .option('-v, --version <version>', $('the version'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, publisher, typeName, version, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        publisher = cli.interaction.promptIfNotGiven($('Publisher: '), publisher, _);
        typeName = cli.interaction.promptIfNotGiven($('typeName: '), typeName, _);
        version = cli.interaction.promptIfNotGiven($('version: '), version, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.getVMExtensionImage(location, publisher, typeName, version, options, _);
      });

    var docker = vm.category('docker')
      .description($('Commands to manage your Docker Virtual Machine'));

    docker.command('create [resource-group] [name] [location] [os-type]')
      .description($('Create a Docker virtual machine in a resource group'))
      .usage('[options] <resource-group> <name> <location> <os-type>')
      .option('-g, --resource-group <resource-group>', $('the name of the resource group'))
      .option('-n, --name <name>', $('the virtual machine name'))
      .option('-T, --docker-port <port>', util.format($('Port to use for docker [%s]'), vmConstants.EXTENSIONS.DOCKER_PORT))
      .option('-O, --docker-cert-dir <dir>', $('Directory containing docker certs [~/.docker/]'))
      .option('-E, --docker-extension-version <version>', util.format($('Version of Docker Azure extension [%s]'), vmConstants.EXTENSIONS.DOCKER_VERSION_ARM))
      .option('-c, --docker-cert-cn [CN]', $('Docker server certificate\'s CN. Can be set if you are using --tlsverify option for Docker connections. Default value is [*]'))
      .option('-D, --nic-id <nic-id>', $('the NIC identifier' +
                     '\n     e.g. /subscriptions/<subscriptipn-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/networkInterfaces/<nic-name>'))
      .option('-f, --nic-name <nic-name>', $('the NIC name' +
                  '\n     If this is an existing NIC then it must exists under the current resource group identified by resource-group' +
                  '\n     A new NIC will be created if no NIC exists with name nic-name in the current resource group' +
                  '\n     To create new NIC - subnet-id or vnet-name, vnet-address-prefix, subnet-name and vnet-subnet-address-prefix are required' +
                  '\n     Please use nic-id to refer an existing NIC in a different resource group' +
                  '\n     The parameter nic-name will be ignored when nic-id is specified'))
      .option('-I, --nic-ids <nic-ids>', $('the list of NIC identifiers separated by comma. In case of specifying multiple nics first one will be set as primary.'))
      .option('-N, --nic-names <nic-names>', $('the list of NIC names separated by comma. In case of specifying multiple nics first one will be set as primary.' +
              'These NICs must exists in the same resource group as the VM. Please use nic-ids if that not the case. ' +
              'This parameter will be ignored if --nic-ids is specified'))
      .option('-l, --location <location>', $('the location'))
      .option('-y, --os-type <os-type>', $('the operating system Type, valid values are Windows, Linux'))
      .option('-Q, --image-urn <image-urn>', $('the image URN in the form publisherName:offer:skus:version'))
      .option('-u, --admin-username <admin-username>', $('the user name' +
                   '\n      This parameter is valid for a VM created from an image (image-urn) and ignored when VM is based on disk (os-disk-*)'))
      .option('-p, --admin-password <admin-password>', $('the password' +
                   '\n      This parameter is valid for a VM created from an image (image-urn) and ignored when VM is based on disk (os-disk-*)'))
      .option('-M, --ssh-publickey-file <openssh-rsa-file|pem-file>', $('path to public key PEM file or SSH Public key file for SSH authentication' +
            '\n     This parameter is valid only when os-type is "Linux"'))
      .option('-G, --generate-ssh-keys', $('Auto generate SSH keys, --ssh-publickey-file will be ignored. This parameter is valid only when os-type is "Linux"'))
      .option('-z, --vm-size <vm-size>', $('the virtual machine size [Standard_A1]'))
      .option('-U, --public-ip-id <public-ip-id>', $('the public ip identifier' +
                   '\n     e.g. /subscriptions/<subscriptipn-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/publicIPAddresses/<public-ip-name>'))
      .option('-i, --public-ip-name <public-ip-name>', $('the public ip name' +
                   '\n     If this is an existing public IP then it must exists under the current resource group identified by resource-group' +
                   '\n     A new public IP will be created if no public IP exists with name public-ip-name in the current resource group' +
                   '\n     Please use public-ip-id to refer an existing public IP in a different resource group' +
                   '\n     The parameter public-ip-name will be ignored when public-ip-id is specified'))
      .option('-w, --public-ip-domain-name <public-ip-domain-name>', $('the public ip domain name' +
                   '\n     This sets the DNS to <publicip-domain-name>.<location>.cloudapp.azure.com' +
                   '\n     This parameter will be used only when creating new public IP'))
      .option('-m, --public-ip-allocationmethod <public-ip-allocationmethod>', $('the public ip allocation method, valid values are "Dynamic"' +
                   '\n     This parameter will be used only when creating new public IP'))
      .option('-t, --public-ip-idletimeout <public-ip-idletimeout>', $('the public ip idle timeout specified in minutes' +
                   '\n     This parameter will be used only when creating new public IP'))
      .option('-S, --subnet-id <subnet-id>', $('the subnet identifier' +
                   '\n     e.g. /subscriptions/<subscriptipn-id>/resourceGroups/<resource-group-name>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>'))
      .option('-F, --vnet-name <vnet-name>', $('the virtual network name' +
                   '\n     If this is an existing vnet then it must exists under the current resource group identified by resource-group' +
                   '\n     If this is an existing vnet then vnet-subnet-name is required' +
                   '\n          If no subnet exists with name vnet-subnet-name then a new subnet will be created' +
                   '\n          To create new subnet vnet-subnet-address-prefix is required' +
                   '\n     A new vnet will be created if no vnet exists with name vnet-name in the current resource group' +
                   '\n     To create new vnet, vnet-address-prefix, vnet-subnet-name and vnet-subnet-address-prefix are required' +
                   '\n     Please use subnet-id to refer an existing subnet under a vnet in a different resource group' +
                   '\n     vnet-name, vnet-address-prefix, vnet-subnet-name and vnet-subnet-address-prefix will be ignored when subnet-id is specified'))
      .option('-P, --vnet-address-prefix <vnet-address-prefix>', $('the virtual network address prefix in IPv4/CIDR format'))
      .option('-j, --vnet-subnet-name <vnet-subnet-name>', $('the virtual network subnet name'))
      .option('-k, --vnet-subnet-address-prefix <vnet-subnet-address-prefix>', $('the virtual network subnet address prefix in IPv4/CIDR format'))
      .option('-r, --availset-name <availset-name>', $('the availability set name'))
      .option('-o, --storage-account-name <storage-account-name>', $('the storage account name'))
      .option('-R, --storage-account-container-name <storage-account-container-name>', $('the storage account container name [vhds]'))
      .option('-d, --os-disk-vhd <os-disk-vhd>', $('name or url of the OS disk Vhd' +
                   '\n     If this parameter is specified along with --image-urn parameter then OS disk created from the image will be stored in this vhd' +
                   '\n     If this parameter is specified without --image-urn parameter then this vhd must exists and will be used as OS Disk'))
      .option('-a, --data-disk-caching <data-disk-caching>', $('data disk caching, valid values are None, ReadOnly, ReadWrite'))
      .option('-x, --data-disk-vhd <data-disk-vhd>', $('name or url of the data disk Vhd'))
      .option('-e, --data-disk-size <data-disk-size>', $('data disk size in GB'))
      .option('-Y, --data-disk-existing', $('Will use existing VHD if specified. Don\'t specify this param if you are creating data disk from a new VHD.'))
      .option('-C, --custom-data <custom-data-file>', $('CustomData file'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function(resourceGroup, name, location, osType, options, _) {
        resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
        name = cli.interaction.promptIfNotGiven($('Virtual machine name: '), name, _);
        location = cli.interaction.promptIfNotGiven($('Location name: '), location, _);
        osType = cli.interaction.promptIfNotGiven($('Operating system Type: '), osType, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.createDockerVM(resourceGroup, name, location, osType, options, _);
      });

    var image = vm.category('image')
      .description($('Commands to manage VM images'));

  image.command('list-publishers [location]')
      .description($('Lists virtual machines image publishers'))
      .usage('[options] <location>')
      .option('-l, --location <location>', $('the location'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listVMImagePublishers(location, options, _);
      });

  image.command('list-offers [location] [publisher]')
      .description($('Lists virtual machines image offers by a publisher'))
      .usage('[options] <location> <publisher>')
      .option('-l, --location <location>', $('the location'))
      .option('-p, --publisher <publisher>', $('the publisher name'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, publisher, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        publisher = cli.interaction.promptIfNotGiven($('Publisher: '), publisher, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listVMImageOffers(location, publisher, options, _);
      });

  image.command('list-skus [location] [publisher] [offer]')
      .description($('Lists virtual machines image skus for a specific offer from a publisher'))
      .usage('[options] <location> <publisher> <offer>')
      .option('-l, --location <location>', $('the location'))
      .option('-p, --publisher <publisher>', $('the publisher name'))
      .option('-o, --offer <offer>', $('the offer'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, publisher, offer, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        publisher = cli.interaction.promptIfNotGiven($('Publisher: '), publisher, _);
        offer = cli.interaction.promptIfNotGiven($('Offer: '), offer, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        vmClient.listVMImageSkus(location, publisher, offer, options, _);
      });

  image.command('list [location] [publisher] [offer] [sku]')
      .description($('Lists the virtual machines images'))
      .usage('[options] <location> <publisher> [offer] [sku]')
      .option('-l, --location <location>', $('the location'))
      .option('-p, --publisher <publisher>', $('the publisher name'))
      .option('-o, --offer <offer>', $('the offer'))
      .option('-k, --sku <sku>', $('the sku'))
      .option('-s, --subscription <subscription>', $('the subscription identifier'))
      .execute(function (location, publisher, offer, sku, options, _) {
        location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
        publisher = cli.interaction.promptIfNotGiven($('Publisher: '), publisher, _);
        location = utils.toLowerCaseAndRemoveSpace(location);
        var vmClient = new VMClient(cli, options.subscription);
        var params = {
          location: location,
          publisher: publisher,
          offer: offer,
          sku: sku
        };

        vmClient.listVMImages(params, options, _);
      });
};