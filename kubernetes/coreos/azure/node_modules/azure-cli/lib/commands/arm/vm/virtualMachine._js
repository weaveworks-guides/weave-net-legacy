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

function VirtualMachine(cli, serviceClients, resourceGroupName, params) {
  this.cli = cli;
  this.serviceClients = serviceClients;
  this.resourceGroupName = resourceGroupName;
  this.params = params;
}

__.extend(VirtualMachine.prototype, {
  getVMByIdExpanded: function (referenceUri, depth, memoize, dependencies, _) {
    referenceUri = referenceUri.toLowerCase();
    if (memoize[referenceUri]) {
      return memoize[referenceUri];
    }

    var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
    var expandedVM = this.getVMByNameExpanded(resourceInfo.resourceGroupName, resourceInfo.resourceName, depth, memoize, dependencies, _);
    return expandedVM;
  },

  getVMByNameExpanded: function (resourceGroupName, vmName, depth, memoize, dependencies, _) {
    var vm = this.getVM(resourceGroupName, vmName, _);
    var expandedVM = this._expandVM(vm, depth, memoize, dependencies, _);
    return expandedVM;
  },

  getVMById: function (referenceUri, _) {
    var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
    return this.getVM(resourceInfo.resourceGroupName, resourceInfo.resourceName, _);
  },

  getVM: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Looking up the VM "%s"'), vmName));
    try {
      var virtualMachine = this.serviceClients.computeManagementClient.virtualMachines.get(resourceGroupName, vmName, _);
      return virtualMachine;
    } catch (e) {
      if (e.code === 'ResourceNotFound' || e.code === 'NotFound') {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  getVMList: function (resourceGroupName, _) {
    var vms;
    var progress = this.cli.interaction.progress($('Getting virtual machines'));
    try {
      vms = this.serviceClients.computeManagementClient.virtualMachines.list(resourceGroupName, _);
      for (var i = 0; i < vms.virtualMachines.length; i++) {
        var vm = vms.virtualMachines[i];
        vm.powerState = this._getVMPowerState(resourceGroupName, vm.name, _);
      }
    } finally {
      progress.end();
    }

    return vms;
  },

  deleteVM: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Deleting the virtual machine "%s"'), vmName));
    try {
      this.serviceClients.computeManagementClient.virtualMachines.deleteMethod(resourceGroupName, vmName, _);
    } finally {
      progress.end();
    }
  },

  stopVM: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Stopping the virtual machine "%s"'), vmName));
    try {
      this.serviceClients.computeManagementClient.virtualMachines.powerOff(resourceGroupName, vmName, _);
    } finally {
      progress.end();
    }
  },

  restartVM: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Restarting the virtual machine "%s"'), vmName));
    try {
      this.serviceClients.computeManagementClient.virtualMachines.restart(resourceGroupName, vmName, _);
    } finally {
      progress.end();
    }
  },

  startVM: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Starting the virtual machine "%s"'), vmName));
    try {
      this.serviceClients.computeManagementClient.virtualMachines.start(resourceGroupName, vmName, _);
    } finally {
      progress.end();
    }
  },

  deallocateVM: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Deallocating the virtual machine "%s"'), vmName));
    try {
      this.serviceClients.computeManagementClient.virtualMachines.deallocate(resourceGroupName, vmName, _);
    } finally {
      progress.end();
    }
  },

  captureVM: function (resourceGroupName, vmName, params, _) {
    var progress = this.cli.interaction.progress(util.format($('Capturing the virtual machine "%s"'), vmName));
    try {
      var result = this.serviceClients.computeManagementClient.virtualMachines.capture(resourceGroupName, vmName, params, _);
      if (result.error) {
        throw result.error;
      }
      return result;
    } finally {
      progress.end();
    }
  },

  generalizeVM: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Generalizing the virtual machine "%s"'), vmName));
    try {
      this.serviceClients.computeManagementClient.virtualMachines.generalize(resourceGroupName, vmName, _);
    } finally {
      progress.end();
    }
  },

  getInstanceView: function (resourceGroupName, vmName, _) {
    var progress = this.cli.interaction.progress(util.format($('Getting instance view of virtual machine "%s"'), vmName));
    try {
      var result = this.serviceClients.computeManagementClient.virtualMachines.getWithInstanceView(resourceGroupName, vmName, _);
      return result;
    } catch (e) {
      if (e.code === 'ResourceNotFound') {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  createOrUpdateVM: function (resourceGroupName, virtualMachine, isNewVM, _) {
    var progressMessage = util.format($('%s VM "%s"'), (isNewVM ? 'Creating' : 'Updating'), virtualMachine.name);
    var progress = this.cli.interaction.progress(progressMessage);
    try {
      if (!isNewVM) {
        // In it's current version Azure API throws an error if we try to update this fields.
        // They were not set by user, but returned using 'vm get' command.
        if (virtualMachine.resources) {
          delete virtualMachine.resources;
        }
        if (virtualMachine.oSProfile && virtualMachine.oSProfile.windowsConfiguration && virtualMachine.oSProfile.windowsConfiguration.additionalUnattendContents) {
          delete virtualMachine.oSProfile.windowsConfiguration.additionalUnattendContents;
        }
        if (virtualMachine.extensions) {
          delete virtualMachine.extensions;
        }
      }

      var vmResult = this.serviceClients.computeManagementClient.virtualMachines.createOrUpdate(resourceGroupName, virtualMachine, _);
      if (vmResult.error) {
        throw new Error(util.format($('VM has been %s, but there was an error during provisioning. Error: %s'), (isNewVM ? 'created' : 'updated'), vmResult.error.message));
      }
      return vmResult;
    } finally {
      progress.end();
    }
  },

  getVMSizesByVMName: function (resourceGroupName, vmName, _) {
    var sizeResult;
    var progress = this.cli.interaction.progress(util.format($('Getting virtual machine sizes available for the VM "%s"'), vmName));
    try {
      sizeResult = this.serviceClients.computeManagementClient.virtualMachines.listAvailableSizes(resourceGroupName, vmName, _);
    } finally {
      progress.end();
    }

    return sizeResult;
  },

  getVMSizesByLocationName: function (location, _) {
    var sizeResult;
    var progress = this.cli.interaction.progress(util.format($('Listing virtual machine sizes available in the location "%s"'), location));
    try {
      sizeResult = this.serviceClients.computeManagementClient.virtualMachineSizes.list(location, _);
    } finally {
      progress.end();
    }

    return sizeResult;
  },

  getVMExtension: function (resourceGroupName, vmName, extensionName, _) {
    var progress = this.cli.interaction.progress(util.format($('Looking up extension "%s", VM: "%s"'), extensionName, vmName));
    try {
      var result = this.serviceClients.computeManagementClient.virtualMachineExtensions.getWithInstanceView(resourceGroupName, vmName, extensionName, _);
      return result;
    } catch (e) {
      if (e.code === 'ResourceNotFound') {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  createOrUpdateVMExtension: function (resourceGroupName, vmName, vmExtension, isNewExtension, _) {
    var progressMessage = util.format($('%s extension "%s", VM: "%s"'), (isNewExtension ? 'Installing' : 'Updating'), vmExtension.name, vmName);
    var progress = this.cli.interaction.progress(progressMessage);
    try {
      var result = this.serviceClients.computeManagementClient.virtualMachineExtensions.createOrUpdate(resourceGroupName, vmName, vmExtension, _);
      return result;
    } finally {
      progress.end();
    }
  },

  deleteVMExtension: function (resourceGroupName, vmName, extensionName, _) {
   var progress = this.cli.interaction.progress(util.format($('Uninstalling extension "%s", VM: "%s"'), extensionName, vmName));
    try {
      var result = this.serviceClients.computeManagementClient.virtualMachineExtensions.deleteMethod(resourceGroupName, vmName, extensionName, _);
      return result;
    } finally {
      progress.end();
    }
  },

  _expandVM: function (vm, depth, memoize, dependencies, _) {
    if (depth === 0 || vm === null) {
      return vm;
    }

    if (depth !== -1) {
      depth--;
    }

    var virtualMachine = vm.virtualMachine;
    var referenceUri = virtualMachine.id.toLowerCase();
    memoize[referenceUri] = vm;

    if (utils.hasValidProperty(virtualMachine, 'networkProfile')) {
      var networkProfile = virtualMachine.networkProfile;
      if (networkProfile.networkInterfaces instanceof  Array) {
        for (var i = 0; i < networkProfile.networkInterfaces.length; i++) {
          var networkInterface = networkProfile.networkInterfaces[i];
          var netReferenceUri = networkInterface.referenceUri.toLocaleLowerCase();
          if (!memoize[netReferenceUri]) {
            // expand related resource only if it is not expanded before in the chain
            networkInterface.expanded = dependencies.networkNic.getNICByIdExpanded(netReferenceUri, depth, memoize, dependencies, _);
          }
        }
      }
    }

    if (utils.hasValidProperty(virtualMachine, 'availabilitySetReference')) {
      var availabilitySetRef = virtualMachine.availabilitySetReference;
      if (availabilitySetRef.referenceUri !== null && availabilitySetRef.referenceUri !== undefined) {
        var availReferenceUri = availabilitySetRef.referenceUri.toLocaleLowerCase();
        if (!memoize[availReferenceUri]) {
          // expand related resource only if it is not expanded before in the chain
          availabilitySetRef.expanded = dependencies.availabilitySet.getAvailSetByIdExpanded(availReferenceUri, depth, memoize, dependencies, _);
        }
      }
    }

    return memoize[referenceUri];
  },

  _getVMPowerState: function (resourceGroupName, vmName, _) {
    try {
      var intanceViewResult = this.serviceClients.computeManagementClient.virtualMachines.getWithInstanceView(resourceGroupName, vmName, _);
      var statuses = intanceViewResult.virtualMachine.instanceView.statuses;
      for (var i = 0; i < statuses.length; i++) {
        if (statuses[i].code.indexOf('PowerState') > -1) {
          return statuses[i].displayStatus;
        }
      }

      return null;
    } catch (e) {
      if (e.code === 'ResourceNotFound') {
        return null;
      }
      throw e;
    }
  }
});

module.exports = VirtualMachine;