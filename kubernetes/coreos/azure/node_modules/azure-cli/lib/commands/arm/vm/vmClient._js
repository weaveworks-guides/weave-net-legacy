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

var fs = require('fs');
var readableStream = require('readable-stream');
var stream = require('stream');
var __ = require('underscore');
var url = require('url');
var util = require('util');

var azureStorage = require('azure-storage');

var AvailabilitySet = require('./../availabilityset/availabilitySet');
var NetworkNic = require('./networkNic');
var NetworkPublicIP = require('./networkPublicIP');
var profile = require('../../../util/profile');
var StorageUtil = require('../../../util/storage.util');
var utils = require('../../../util/utils');
var VirtualMachine = require('./virtualMachine');
var VMImage = require('./vmImage');
var VMExtensionProfile = require('./vmExtensionProfile');
var VMProfile = require('./vmProfile');
var vmShowUtil = require('./vmShowUtil');
var VMStorageProfile = require('./vmStorageProfile');

var $ = utils.getLocaleString;
var writable = stream.Writable || readableStream.Writable;

function WriteStream(options) {
  writable.call(this, options);
}

function VMClient(cli, subscription) {
  this.cli = cli;
  this.subscription = subscription;
}

__.extend(VMClient.prototype, {
  createVM: function (resourceGroupName, vmName, location, osType, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var params = {};
    // General
    params.subscriptionId = subscription.id;
    params.vmName = vmName;
    params.location = location;
    params.imageUrn = options.imageUrn;
    // hardwareProfile
    params.vmSize = options.vmSize;
    // osProfile
    params.computerName = params.vmName;
    params.adminUsername = options.adminUsername;
    params.adminPassword = options.adminPassword;
    params.osType = osType;
    params.sshPublickeyFile = options.sshPublickeyFile;
    params.generateSshKeys = options.generateSshKeys;
    params.customData = options.customData;
    // storageProfile - storage accountweb
    params.storageAccountName = options.storageAccountName;
    params.storageAccountContainerName = options.storageAccountContainerName || 'vhds';
    // storageProfile.osDiskProfile
    params.osDiskType = params.osType;
    params.osDiskCaching = options.osDiskCaching;
    params.osDiskVhd = options.osDiskVhd;
    // storageProfile.dataDiskProfile
    params.dataDiskCaching = options.dataDiskCaching;
    params.dataDiskVhd = options.dataDiskVhd;
    params.dataDiskSize = options.dataDiskSize;
    params.newDataDisk = !options.dataDiskExisting;
    params.dataDisks = [];
    // networkProfile - network interface
    params.nicName = options.nicName;
    params.nicId = options.nicId;
    params.nicIds = options.nicIds;
    params.nicNames = options.nicNames;
    // networkProfile - public IP
    params.publicipName = options.publicIpName;
    params.publicipDomainName = options.publicIpDomainName;
    params.publicipIdletimeout = options.publicIpIdletimeout;
    params.publicipAllocationmethod = options.publicIpAllocationMethod;
    // networkProfile - virtual network
    params.vnetName = options.vnetName;
    params.vnetAddressPrefix = options.vnetAddressPrefix;
    params.vnetSubnetName = options.vnetSubnetName;
    params.vnetSubnetAddressprefix = options.vnetSubnetAddressPrefix;
    // availabilitySetProfile
    params.availsetName = options.availsetName;
    // tags
    params.tags = options.tags;
    // boot diagnostics storage URI
    params.enableBootDiagnostics = options.enableBootDiagnostics ? options.enableBootDiagnostics : null;
    params.enableBootDiagnostics = options.bootDiagnosticsStorageUri ? true : params.enableBootDiagnostics;
    params.bootDiagnosticsStorageUri = options.bootDiagnosticsStorageUri ? options.bootDiagnosticsStorageUri : null;

    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroupName, params.vmName, _);
    if (vmResult) {
      throw new Error(util.format($('A virtual machine with name "%s" already exists in the resource group "%s"'), vmResult.virtualMachine.name, resourceGroupName));
    }

    var vmProfile = new VMProfile(this.cli, resourceGroupName, params, serviceClients);
    var vmCreateProfile = vmProfile.generateVMProfile(_);
    virtualMachine.createOrUpdateVM(resourceGroupName, vmCreateProfile.profile, true, _);
  },

  quickCreateVM: function (resourceGroupName, vmName, location, osType, imageUrn, adminUsername, adminPassword, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);

    var removeAllSpace = function (str) {
        return (str.replace(/[\(\)\{\}\[\]\.\,\;\:\"\ ']/g, '').toLowerCase());
    };

    var resourceNamePrefix = removeAllSpace(vmName).slice(0, 5) + '-' +
        removeAllSpace(location).slice(0, 5)  + '-' +
        (new Date()).getTime().toString();

    var resourceName = function (postFix) {
      return resourceNamePrefix + '-' + postFix;
    };

    var params = {};
    // General
    params.subscriptionId = subscription.id;
    params.vmName = vmName;
    params.location = location;
    params.imageUrn = imageUrn;
    // hardwareProfile
    // For quick create requirement is to have 'Standard_D1' as default
    params.vmSize = 'Standard_D1';
    // osProfile
    params.computerName = params.vmName;
    params.adminUsername = adminUsername;
    params.adminPassword = adminPassword;
    params.osType = osType;
    // storageProfile - storage accountweb
    params.storageAccountContainerName = 'vhds';
    // storageProfile.osDiskProfile
    params.osDiskType = osType;
    // storageProfile.dataDiskProfile
    params.dataDisks = [];
    // networkProfile - network interface
    params.nicName = resourceName('nic');
    // networkProfile - public IP
    params.publicipName = resourceName('pip');
    params.publicipDomainName = resourceName('pip');
    // networkProfile - virtual network
    params.vnetName = resourceName('vnet');
    params.vnetAddressPrefix = '10.0.0.0/16';
    params.vnetSubnetName = resourceName('snet');
    params.vnetSubnetAddressprefix = '10.0.1.0/24';
    // availabilitySetProfile
    // params.availsetName = resourceName('avset');

    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroupName, params.vmName, _);
    if (vmResult) {
      throw new Error(util.format($('A virtual machine with name "%s" already exists in the resource group "%s"'), vmResult.virtualMachine.name, resourceGroupName));
    }

    var vmProfile = new VMProfile(this.cli, resourceGroupName, params, serviceClients);
    var vmCreateProfile = vmProfile.generateVMProfile(_);
    virtualMachine.createOrUpdateVM(resourceGroupName, vmCreateProfile.profile, true, _);
    // Show created VM in case of Quick create
    this.showVM(resourceGroupName, params.vmName, {}, _);
  },

  showVM: function(resourceGroupName, name, options, _) {
    var output = this.cli.output;
    var isJson = output.format().json;
    var depth = 0; // 0 recurse
    if (isJson) {
      if (options.depth) {
        if (options.depth === 'full') {
          depth = -1; // full recurse
        } else {
          depth = utils.parseInt(options.depth);
          if (isNaN(depth)) {
            throw new Error($('--depth is an optional parameter but when specified it must be an integer (number of times to recurse) or text "full" (idefinite recursion)'));
          }
        }
      }
    } else {
      if (options.depth) {
        output.warn($('--depth paramater will be ignored when --json option is not specified'));
      }
    }

    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var dependencies = {
      virtualMachine: new VirtualMachine(this.cli, serviceClients),
      availabilitySet: new AvailabilitySet(this.cli, serviceClients),
      networkNic: new NetworkNic(this.cli, serviceClients.networkResourceProviderClient)
    };

    var vmResult = dependencies.virtualMachine.getVMByNameExpanded(resourceGroupName, name, depth, {}, dependencies, _);
    if (vmResult) {
      var virtualMachine = vmResult.virtualMachine;
      if (isJson) {
        output.json(virtualMachine);
      } else {
        virtualMachine = this._populateNics(virtualMachine, subscription, _);
        vmShowUtil.show(virtualMachine, output.data);
      }
    } else {
      if (isJson) {
        output.json({});
      } else {
        output.warn($('No VMs found'));
      }
    }
  },

  listVM: function(resourceGroupName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmsResult = virtualMachine.getVMList(resourceGroupName, _);
    var output = this.cli.output;
    this.cli.interaction.formatOutput(vmsResult.virtualMachines, function (outputData) {
      if (outputData.length === 0) {
        output.info($('No VMs found'));
      } else {
        output.table(outputData, function (row, item) {
          row.cell($('Name'), item.name);
          row.cell($('ProvisioningState'), item.provisioningState);
          row.cell($('PowerState'), item.powerState ? item.powerState : '');
          row.cell($('Location'), item.location);
          row.cell($('Size'), item.hardwareProfile.virtualMachineSize);
        });
      }
    });
  },

  deleteVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    if (!options.quiet && !this.cli.interaction.confirm(util.format($('Delete the virtual machine "%s"? [y/n] '), name), _)) {
      return;
    }

    virtualMachine.deleteVM(resourceGroupName, name, _);
  },

  stopVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    var output = this.cli.output;
    output.warn($('VM shutdown will not release the compute resources so you will be billed for the compute resources that this Virtual Machine uses.'));
    output.info($('To release the compute resources use "azure vm deallocate".'));
    virtualMachine.stopVM(resourceGroupName, name, _);
  },

  restartVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    virtualMachine.restartVM(resourceGroupName, name, _);
  },

  startVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    virtualMachine.startVM(resourceGroupName, name, _);
  },

  deallocateVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    virtualMachine.deallocateVM(resourceGroupName, name, _);
  },

  captureVM: function(resourceGroupName, name, vhdNamePrefix, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    params = {
      destinationContainerName: options.storageAccountContainerName || 'vhds',
      virtualHardDiskNamePrefix: vhdNamePrefix,
      overwrite: options.overwrite ? true : false
    };

    var result = virtualMachine.captureVM(resourceGroupName, name, params, _);
    if (result.output && options.templateFileName) {
      fs.writeFileSync(options.templateFileName, JSON.stringify(result.output));
      this.cli.output.info(util.format($('Saved template to file "%s"'), options.templateFileName));
    }
  },

  generalizeVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    virtualMachine.generalizeVM(resourceGroupName, name, _);
  },

  getInstanceView: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var output = this.cli.output;

    var instanceViewResult = virtualMachine.getInstanceView(resourceGroupName, name, _);
    if (!instanceViewResult) {
      if (output.format().json) {
        output.json({});
      } else {
        output.warn($('No VMs found'));
      }
    } else {
      var vmInstanceView = instanceViewResult.virtualMachine;
      this.cli.interaction.formatOutput(vmInstanceView, function () {
        utils.logLineFormat(vmInstanceView, output.data);
      });
    }
  },

  getSerialOutput: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var output = this.cli.output;

    var instanceViewResult = virtualMachine.getInstanceView(resourceGroupName, name, _);
    if (!instanceViewResult) {
      if (output.format().json) {
        output.json({});
      } else {
        output.warn($('No VMs found'));
      }
    } else {
      var vmResult = instanceViewResult.virtualMachine;
      if (vmResult) {
        var instanceView = vmResult.instanceView;
        if (instanceView && instanceView.bootDiagnostics && instanceView.bootDiagnostics.consoleScreenshotBlobUri)
        {
          var consoleScreenshotBlobUri = instanceView.bootDiagnostics.consoleScreenshotBlobUri;
          this.cli.output.info(util.format($('Console Screenshot Blob Uri:\n%s'), consoleScreenshotBlobUri));
        }

        if (instanceView && instanceView.bootDiagnostics && instanceView.bootDiagnostics.serialConsoleLogBlobUri)
        {
          var serialConsoleLogBlobUri = instanceView.bootDiagnostics.serialConsoleLogBlobUri;
          this.cli.output.info(util.format($('Serial Console Log Blob Uri:\n%s'), serialConsoleLogBlobUri));

          //Init StorageUtil
          StorageUtil.init(this.cli);

          var result = this._getStorageAccountContainerAndBlobFromUri(serialConsoleLogBlobUri);
          if (result.accountName && result.containerName && result.blobName) {
            var storageClient = serviceClients.storageManagementClient;
            var keys = storageClient.storageAccounts.listKeys(resourceGroupName, result.accountName, _);
            var blobService = azureStorage.createBlobService(result.accountName, keys.storageAccountKeys.key1);

            var content = '';
            util.inherits(WriteStream, writable);
            WriteStream.prototype._write = function (chunk, encoding, done) {
              content += chunk.toString();
              done();
            };
            var ws = new WriteStream();

            var performStorageOperation = StorageUtil.performStorageOperation;
            var operation = this._getStorageBlobOperation(blobService, 'getBlobToStream');
            var storageOptions = this._getStorageBlobOperationDefaultOption();

            try {
              performStorageOperation(operation, _, result.containerName, result.blobName, ws, storageOptions);
            } 
            catch (e) {
              if (StorageUtil.isNotFoundException(e)) {
                this.cli.output.warn(util.format($('Can not find blob \'%s\' in container \'%s\''), result.blobName, result.containerName));
              }
              else {
                throw e;
              }
            }
            
            var maxLen = options.maxLength === null ? 1000000 : parseInt(options.maxLength, 10);
            var startPos = 0;
            while (startPos < content.length) {
              if (startPos > 0 && !this.cli.interaction.confirm('Do you want to view more log?', _)) {
                break;
              }

              var strlen = startPos + maxLen < content.length ? maxLen : content.length - startPos;
              this.cli.output.info(content.substr(startPos, strlen));
              startPos += parseInt(strlen, 10);
            }
          }
        }
      }
    }
  },

  resetVMAccess: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    options.location = vmResult.virtualMachine.location;
    options.osType = vmResult.virtualMachine.storageProfile.oSDisk.operatingSystemType;
    options.version = options.extensionVersion;
    var vmExtensionProfile = new VMExtensionProfile(this.cli, options);
    var vmAccessExtension = vmExtensionProfile.generateVMAccessExtensionProfile();

    virtualMachine.createOrUpdateVMExtension(resourceGroupName, name, vmAccessExtension.profile, true, _);
  },

  enableDiagVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    var diagParams = {
      resourceGroupName: resourceGroupName,
      osType: vmResult.virtualMachine.storageProfile.oSDisk.operatingSystemType,
      location: vmResult.virtualMachine.location,
      version: options.extensionVersion,
      storageAccountName: options.storageAccountName,
      osDiskUri: vmResult.virtualMachine.storageProfile.oSDisk.virtualHardDisk.uri,
      configFile: options.configFile,
      vmID: vmResult.virtualMachine.id
    };

    var vmExtensionProfile = new VMExtensionProfile(this.cli, diagParams, serviceClients);
    var vmDiagExtension = vmExtensionProfile.generateVMDiagExtensionProfile(_);
    virtualMachine.createOrUpdateVMExtension(resourceGroupName, name, vmDiagExtension.profile, true, _);
  },

  setVM: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);

    var vmResult = virtualMachine.getVM(resourceGroupName, name, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), name, resourceGroupName));
    }

    // boot diagnostics storage URI
    options.disableBootDiagnostics = options.disableBootDiagnostics ? true : false;
    options.enableBootDiagnostics = options.enableBootDiagnostics ? true : (options.disableBootDiagnostics ? false : true);
    options.enableBootDiagnostics = options.bootDiagnosticsStorageUri ? true : options.enableBootDiagnostics;
    options.bootDiagnosticsStorageUri = options.disableBootDiagnostics ? '' : (options.bootDiagnosticsStorageUri ? options.bootDiagnosticsStorageUri : null);

    var vmProfile = new VMProfile(this.cli, resourceGroupName, options, serviceClients);
    vmResult.virtualMachine = vmProfile.updateVMProfile(vmResult.virtualMachine, _);

    virtualMachine.createOrUpdateVM(resourceGroupName, vmResult.virtualMachine, false, _);
  },

  listVMSizesOrLocationVMSizes: function(options, _) {
    if (options.location && options.vmName) {
      throw new Error($('Both --location and --vm-name parameters cannot be specified together.'));
    }

    if (options.vmName) {
      if (!options.resourceGroup) {
        options.resourceGroup = this.cli.interaction.promptIfNotGiven($('Resource group name: '), options.resourceGroup, _);
      }
    } else if (!options.location) {
      throw new Error($('One of the optional parameter --location or --vm-name is required.'));
    }

    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var sizeResult;

    if (options.vmName) {
      var vmResult = virtualMachine.getVM(options.resourceGroup, options.vmName, _);
      if (!vmResult) {
        throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), options.vmName, options.resourceGroup));
      }

      sizeResult = virtualMachine.getVMSizesByVMName(options.resourceGroup, options.vmName, _);
    } else {
      sizeResult = virtualMachine.getVMSizesByLocationName(options.location, _);
    }

    var output = this.cli.output;
    this.cli.interaction.formatOutput(sizeResult.virtualMachineSizes, function (outputData) {
      if (outputData.length === 0) {
        output.info($('No VM size details found'));
      } else {
        output.table(outputData, function (row, item) {
          row.cell($('Name'), item.name);
          row.cell($('CPU Cores'), item.numberOfCores);
          row.cell($('Memory (MB)'), item.memoryInMB);
          row.cell($('Max data-disks'), item.maxDataDiskCount);
          row.cell($('Max data-disk Size (MB)'), item.resourceDiskSizeInMB);
          row.cell($('Max OS-disk Size (MB)'), item.oSDiskSizeInMB);
        });
      }
    });
  },

  listComputeUsage: function(location, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var client = utils.createComputeResourceProviderClient(subscription);

    var usageResult = client.usage.list(location, _);
    var output = this.cli.output;
    if(!usageResult || !usageResult.usages || usageResult.usages.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn($('No compute usage information found'));
      }

      return;
    }

    var usages = usageResult.usages;
    this.cli.interaction.formatOutput(usages, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Name'), item.name.localizedValue);
        row.cell($('Unit'), item.unit);
        row.cell($('CurrentValue'), item.currentValue);
        row.cell($('Limit'), item.limit);
      });
    });
  },

  attachNewDataDisk: function(resourceGroup, vmName, size, vhdName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var params = {};
    params.dataDiskSize = size;
    params.dataDiskCaching = options.hostCaching;
    params.dataDiskVhd = vhdName;
    params.vmName = vmName;
    params.storageAccountName = options.storageAccountName;
    params.storageAccountContainerName = options.storageAccountContainerName || 'vhds';
    params.lun = options.lun;
    params.newDataDisk = true;

    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroup, vmName, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), vmName, resourceGroup));
    }

    if (!options.storageAccountName) {
      params.osDiskUri = vmResult.virtualMachine.storageProfile.oSDisk.virtualHardDisk.uri;
    } else {
      params.location = vmResult.virtualMachine.location;
    }

    params.dataDisks = vmResult.virtualMachine.storageProfile.dataDisks;
    var vmStorageProfile = new VMStorageProfile(this.cli, resourceGroup, params, serviceClients);
    var newDataDisk = vmStorageProfile.generateDataDiskProfile(_);
    this.cli.output.info(util.format($('New data disk location: %s '), newDataDisk.virtualHardDisk.uri));

    var dataDisks = vmResult.virtualMachine.storageProfile.dataDisks || [];
    dataDisks.push(newDataDisk);

    try {
      virtualMachine.createOrUpdateVM(resourceGroup, vmResult.virtualMachine, false, _);
    } catch (err) {
      if (err.code === 'InvalidParameter' && err.message === 'The value of parameter \'dataDisk.lun\' is invalid.') {
        throw new Error(util.format($('Exceeded the maximum number of data disks that can be attached to a VM with size "%s".'), vmResult.virtualMachine.hardwareProfile.virtualMachineSize));
      } else {
        throw err;
      }
    }
  },

  attachDataDisk: function(resourceGroup, vmName, vhdUrl, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var params = {};
    params.dataDiskCaching = options.hostCaching;
    params.dataDiskVhd = vhdUrl;
    params.vmName = vmName;
    params.lun = options.lun;
    params.newDataDisk = false;

    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroup, vmName, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), vmName, resourceGroup));
    }

    params.dataDisks = vmResult.virtualMachine.storageProfile.dataDisks;
    var vmStorageProfile = new VMStorageProfile(this.cli, resourceGroup, params, serviceClients);
    var newDataDisk = vmStorageProfile.generateDataDiskProfile(_);

    var dataDisks = vmResult.virtualMachine.storageProfile.dataDisks || [];
    dataDisks.push(newDataDisk);

    try {
      virtualMachine.createOrUpdateVM(resourceGroup, vmResult.virtualMachine, false, _);
    } catch (err) {
      if (err.code === 'InvalidParameter' && err.message === 'The value of parameter \'dataDisk.lun\' is invalid.') {
        throw new Error(util.format($('Exceeded the maximum number of data disks that can be attached to a VM with size "%s".'), vmResult.virtualMachine.hardwareProfile.virtualMachineSize));
      } else {
        throw err;
      }
    }
  },

  detachDataDisk: function(resourceGroup, vmName, lun, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var lunAsInt = utils.parseInt(lun);
    if (isNaN(lunAsInt)) {
      throw new Error($('lun must be an integer'));
    }

    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroup, vmName, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), vmName, resourceGroup));
    }

    var vmStorageProfile = new VMStorageProfile(this.cli, resourceGroup, {}, serviceClients);
    vmStorageProfile.removeDataDiskByLun(vmResult.virtualMachine, lunAsInt);

    virtualMachine.createOrUpdateVM(resourceGroup, vmResult.virtualMachine, false, _);
  },

  listDataDisks: function(resourceGroup, vmName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroup, vmName, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), vmName, resourceGroup));
    }

    var dataDisks = vmResult.virtualMachine.storageProfile.dataDisks;
    var output = this.cli.output;
    if(!dataDisks || dataDisks.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn($('No data disks found'));
      }

      return;
    }

    this.cli.interaction.formatOutput(dataDisks, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Name'), item.name);
        row.cell($('Lun'), item.lun);
        row.cell($('DiskSizeGB'), item.diskSizeGB ? item.diskSizeGB : '');
        row.cell($('Caching'), item.caching);
        row.cell($('URI'), item.virtualHardDisk.uri);
      });
    });
  },

  setExtension: function(resourceGroupName, vmName, extensionName, publisherName, version, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroupName, vmName, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), vmName, resourceGroupName));
    }

    virtualMachine = vmResult.virtualMachine;
    if (virtualMachine.storageProfile.oSDisk.operatingSystemType === 'Windows') {
      if (!virtualMachine.oSProfile.windowsConfiguration || !virtualMachine.oSProfile.windowsConfiguration.provisionVMAgent) {
        throw new Error($('Provision Guest Agent must be enabled on the VM before setting VM Extension.'));
      }
    }

    if (options.uninstall) {
      this._uninstallExtension(resourceGroupName, vmName, extensionName, serviceClients, options, _);
      return;
    }

    options.location = vmResult.virtualMachine.location;
    this._createOrUpdateExtension(resourceGroupName, vmName, extensionName, publisherName, version, options, serviceClients, _);
  },

  getExtensions: function(resourceGroup, vmName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var vmResult = virtualMachine.getVM(resourceGroup, vmName, _);
    if (!vmResult) {
      throw new Error(util.format($('Virtual machine "%s" not found under the resource group "%s"'), vmName, resourceGroup));
    }

    var output = this.cli.output;
    if(!vmResult.virtualMachine.extensions || vmResult.virtualMachine.extensions.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn($('No VM extensions found'));
      }

      return;
    }

    this.cli.interaction.formatOutput(vmResult.virtualMachine.extensions, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Publisher'), item.publisher);
        row.cell($('Name'), item.name);
        row.cell($('Version'), item.typeHandlerVersion);
        row.cell($('State'), item.provisioningState);
      });
    });
  },

  createDockerVM: function(resourceGroupName, vmName, location, osType, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var dockerExtensionParams = {
      dockerPort: options.dockerPort,
      dockerCertDir: options.dockerCertDir,
      version: options.dockerExtensionVersion,
      location: location,
      vmName: vmName,
      dockerCertCn: options.dockerCertCn
    };
    var vmExtensionProfile = new VMExtensionProfile(this.cli, dockerExtensionParams);
    var dockerExtension = vmExtensionProfile.generateDockerExtensionProfile(_);

    this.createVM(resourceGroupName, vmName, location, osType, options, _);
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    try {
      virtualMachine.createOrUpdateVMExtension(resourceGroupName, vmName, dockerExtension.profile, true, _);
    } catch (e) {
      virtualMachine.deleteVM(resourceGroupName, vmName, _);
      throw e;
    }
  },

  listVMImagePublishers: function (location, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var vmImage = new VMImage(this.cli, serviceClients);
    var publishersResult = vmImage.getVMImagePublisherList(location, _);

    var publishers = publishersResult.resources;
    var output = this.cli.output;
    if(!publishers || publishers.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn(util.format($('No virtual machine and/or extension image publishers found in the region "%s"'),location));
      }

      return;
    }

    this.cli.interaction.formatOutput(publishers, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Publisher'), item.name);
        row.cell($('Location'), item.location);
      });
    });
  },

  listVMImageOffers: function (location, publisherName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var vmImage = new VMImage(this.cli, serviceClients);
    var offersResult = vmImage.getVMImageOffersList(location, publisherName, _);

    var offers = offersResult.resources;
    var output = this.cli.output;
    if(!offers || offers.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn(util.format($('No virtual machine image offers found (publisher: "%s" location:"%s")'),publisherName, location));
      }

      return;
    }

    this.cli.interaction.formatOutput(offers, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Publisher'), item.publisher);
        row.cell($('Offer'), item.name);
        row.cell($('Location'), item.location);
      });
    });
  },

  listVMImageSkus: function (location, publisherName, offer, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var vmImage = new VMImage(this.cli, serviceClients);
    var skuResult = vmImage.getVMImageSkusList(location, publisherName, offer, _);

    var skus = skuResult.resources;
    var output = this.cli.output;
    if(!skus || skus.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn(util.format($('No virtual machine image skus found (publisher: "%s" location:"%s" offer:"%s")'),publisherName, location, offer));
      }

      return;
    }

    this.cli.interaction.formatOutput(skus, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Publisher'), item.publisher);
        row.cell($('Offer'), item.offer);
        row.cell($('sku'), item.name);
        row.cell($('Location'), item.location);
      });
    });
  },

  listVMImages: function (params, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var imageFilter = {
      location: params.location,
      publishername: params.publisher,
      offer: params.offer,
      skus: params.sku
    };

    var vmImage = new VMImage(this.cli, serviceClients);
    var imagesResult = vmImage.getVMImageList(imageFilter, _);
    var images = imagesResult.resources;
    var output = this.cli.output;
    if(!images || images.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn($('No virtual machine images found'));
      }

      return;
    }

    this.cli.interaction.formatOutput(images, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Publisher'), item.publisher);
        row.cell($('Offer'), item.offer);
        row.cell($('Sku'), item.skus);
        row.cell($('OS'), item.operatingSystem);
        row.cell($('Version'), item.name);
        row.cell($('Location'), item.location);
        row.cell($('Urn'), item.urn);
      });
    });
  },

  listVMExtensionImageTypes: function (location, publisherName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var vmImage = new VMImage(this.cli, serviceClients);
    var typesResult = vmImage.getVMExtensionImageTypeList(location, publisherName, _);

    var types = typesResult.resources;
    var output = this.cli.output;
    if(!types || types.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn(util.format($('No virtual machine extension image types found (publisher: "%s" location:"%s")'),publisherName, location));
      }

      return;
    }

    this.cli.interaction.formatOutput(types, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Publisher'), item.publisher);
        row.cell($('Type'), item.name);
        row.cell($('Location'), item.location);
      });
    });
  },

  listVMExtensionImageVersions: function (location, publisherName, typeName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var vmImage = new VMImage(this.cli, serviceClients);
    var versionsResult = vmImage.getVMExtensionImageVersionList(location, publisherName, typeName, _);

    var versions = versionsResult.resources;
    var output = this.cli.output;
    if(!versions || versions.length === 0) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn(util.format($('No virtual machine extension image versions found (publisher: "%s" type: "%s" location:"%s")'),publisherName, typeName, location));
      }

      return;
    }

    this.cli.interaction.formatOutput(versions, function (outputData) {
      output.table(outputData, function (row, item) {
        row.cell($('Publisher'), item.publisher);
        row.cell($('Type'), item.typeName);
        row.cell($('Version'), item.name);
        row.cell($('Location'), item.location);
      });
    });
  },

  getVMExtensionImage: function (location, publisherName, typeName, version, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var vmImage = new VMImage(this.cli, serviceClients);
    var imageResult = vmImage.getVMExtensionImage(location, publisherName, typeName, version, _);

    var output = this.cli.output;
    if(!imageResult) {
      if (output.format().json) {
        output.json([]);
      } else {
        output.warn(util.format($('No virtual machine extension images found (publisher: "%s" type: "%s" version: "%s" location:"%s")'),publisherName, typeName, version, location));
      }

      return;
    }
    else {
      output.json(imageResult);
    }
  },

  _createOrUpdateExtension: function(resourceGroupName, vmName, extensionName, publisherName, version, options, serviceClients, _) {
    options.extensionName = extensionName;
    options.publisherName = publisherName;
    options.version = version;

    var vMExtensionProfile = new VMExtensionProfile(this.cli, options);
    var vmExtension = vMExtensionProfile.generateExtensionProfile();

    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    virtualMachine.createOrUpdateVMExtension(resourceGroupName, vmName, vmExtension.profile, true, _);
  },

  _uninstallExtension: function(resourceGroupName, vmName, extensionName, serviceClients, options, _) {
    var virtualMachine = new VirtualMachine(this.cli, serviceClients);
    var extension = virtualMachine.getVMExtension(resourceGroupName, vmName, extensionName, _);
    if (!extension) {
      throw new Error(util.format($('Extension "%s" not found under the virtual machine "%s"'), extensionName, vmName));
    }

    if (!options.quiet && !this.cli.interaction.confirm(util.format($('Uninstall the virtual machine extension "%s"? [y/n] '), extensionName), _)) {
      return;
    }

    virtualMachine.deleteVMExtension(resourceGroupName, vmName, extensionName, _);
  },

  _populateNics: function (virtualMachine, subscription, _) {
    if (!virtualMachine || !virtualMachine.networkProfile || !virtualMachine.networkProfile.networkInterfaces) {
      return virtualMachine;
    }

    var networkInterfaces = virtualMachine.networkProfile.networkInterfaces;
    if (networkInterfaces.length > 0) {
      var networkResourceProviderClient = utils.createNetworkResourceProviderClient(subscription);
      var networkNic = new NetworkNic(this.cli, networkResourceProviderClient);
      var networkPublicIP = new NetworkPublicIP(this.cli, networkResourceProviderClient);

      for (var i = 0; i < networkInterfaces.length; i++) {
        var networkInterface = networkInterfaces[i];
        var nicInfo = networkNic.getNICInfoById(networkInterface.referenceUri, _);
        if (nicInfo.profile) {
          networkInterface.expanded = nicInfo.profile;
          var ipConfigurations = networkInterface.expanded.ipConfigurations;
          if (ipConfigurations && ipConfigurations.length > 0) {
            // Right now CRP supports only one IPConfiguration
            var ipConfiguration = ipConfigurations[0];
            if (ipConfiguration.publicIpAddress && ipConfiguration.publicIpAddress.id) {
              var pubIPInfo = networkPublicIP.getPublicIPInfoById(ipConfiguration.publicIpAddress.id, _);
              if (pubIPInfo.profile) {
                ipConfiguration.publicIpAddress.expanded = pubIPInfo.profile;
              }
            }
          }
        }
      }
    }

    return virtualMachine;
  },

  _getServiceClients: function(subscription) {
    return {
      computeManagementClient: utils.createComputeResourceProviderClient(subscription),
      storageManagementClient: utils.createStorageResourceProviderClient(subscription),
      networkResourceProviderClient: utils.createNetworkResourceProviderClient(subscription)
    };
  },
  
  _getStorageAccountContainerAndBlobFromUri : function(serialConsoleLogBlobUri) {
    var result = {
        accountName : null,
        containerName : null,
        blobName : null
    };

    var parsedResult = url.parse(serialConsoleLogBlobUri, true);
    var hostName = parsedResult.host || '';
    var hostSegments = hostName.split('.');
    var containerAndBlobPath = parsedResult.path || '';
    if (containerAndBlobPath.length > 0 && containerAndBlobPath.charAt(0) === '/') {
      containerAndBlobPath = containerAndBlobPath.substr(1, containerAndBlobPath.length - 1);
    }
    var pathSegments = containerAndBlobPath.split('/');

    if (hostSegments.length > 0 && pathSegments.length == 2) {
      result.accountName = hostSegments[0];
      result.containerName = pathSegments[0];
      result.blobName = pathSegments[1];
    }

    return result;
  },
  
  _getStorageBlobOperation : function(serviceClient, operationName) {
    return StorageUtil.getStorageOperation(serviceClient, StorageUtil.OperationType.Blob, operationName);
  },

  _getStorageBlobOperationDefaultOption : function() {
    var option = StorageUtil.getStorageOperationDefaultOption();

    // Add blob specific options here
    option.parallelOperationThreadCount = StorageUtil.threadsInOperation;

    return option;
  }
});

module.exports = VMClient;