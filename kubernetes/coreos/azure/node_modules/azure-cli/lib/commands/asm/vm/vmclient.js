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
var _ = require('underscore');
var fs = require('fs');
var url = require('url');
var async = require('async');
var util = require('util');
var utils = require('../../../util/utils');
var blobUtils = require('../../../util/blobUtils');
var vmConstants = require('../../../util/vmConstants');
var pageBlob = require('../iaas/upload/pageBlob');
var CommunityUtil = require('../../../util/communityUtil');
var crypto = require('crypto');
var VNetUtil = require('../../../util/vnet.util');
var EndPointUtil = require('../../../util/endpointUtil');
var underscore = require('underscore');
var $ = utils.getLocaleString;
var profile = require('../../../util/profile');
var path = require('path');
var openssl = require('openssl-wrapper');
var exec = require('child_process').exec;
var vmUtils = require('./vmUtils');
var certUtils = require('../../../util/certUtils');
var CHEFPUBLISHER = 'Chef.Bootstrap.WindowsAzure';

function VMClient(cli, subscription) {
  this.cli = cli;
  this.subscription = subscription;
}

_.extend(VMClient.prototype, {

  createVM: function(dnsName, imageName, userName, password, options, callback, logger) {
    var self = this;
    var dnsPrefix = utils.getDnsPrefix(dnsName);
    var vmSize = getVMSize(options, logger);

    if (options.rdp) {
      if (typeof options.rdp === 'boolean') {
        options.rdp = 3389;
      } else if ((options.rdp != parseInt(options.rdp, 10)) || (options.rdp > 65535)) {
        return callback(new Error($('--rdp [port] must be an integer less than or equal to 65535')));
      }
    }

    // Note: The optional argument --no-ssh-password maps to options.sshPassword.
    // if --no-ssh-password is specified in the command line then options.sshPassword
    // will be set to 'false' by commander. If --no-ssh-password is not specified as
    // an option then options.sshPassword will be set to true by commander.
    if (options.ssh) {
      if (typeof options.ssh === 'boolean') {
        options.ssh = 22;
      } else if ((options.ssh != parseInt(options.ssh, 10)) || (options.ssh > 65535)) {
        return callback(new Error($('--ssh [port] must be an integer less than or equal to 65535')));
      }
    } else if ((!options.sshPassword || options.sshCert || options.generateSshKeys) && options.sshEndpoint) {
      return callback(new Error($('--no-ssh-password, --ssh-cert and --generate-ssh-keys can only be used with --ssh or --no-ssh-endpoint parameter')));
    }

    if (!options.sshPassword && (!options.sshCert && !options.generateSshKeys)) {
      return callback(new Error($('--no-ssh-password can only be used with the --ssh-cert or --generate-ssh-keys parameter')));
    }

    if (options.customData) {
      // Size of customData file should be less then 64 KB
      var stats = fs.statSync(options.customData);
      var maxSize = 65535; // 64 KB

      if (stats['size'] > maxSize) {
        return callback(new Error($('--custom-data must be less than 64 KB')));
      }
    }

    if (options.staticIp) {
      var vnetUtil = new VNetUtil();
      var parsedIp = vnetUtil.parseIPv4(options.staticIp);
      if (parsedIp.error) {
        return callback(parsedIp.error);
      }
      if (!options.virtualNetworkName) {
        return callback(new Error($('--virtual-network-name must be specified when the --static-ip option is given')));
      }
      if (options.subnetNames) {
        logger.warn('--static-ip, --subnet-names will be ignored and the static ip subnet will be used');
        options.subnetNames = null;
      }
    } else if (options.subnetNames) {
      if (!options.virtualNetworkName) {
        return callback(new Error($('--virtual-network-name must be specified when the --subnet-names option is given')));
      }
    }

    var nicConfiguration = parseNICParams(options.nicConfig);
    if (nicConfiguration.error) {
      return callback(new Error(nicConfiguration.error));
    }

    if (nicConfiguration.networkInterfaces.length !== 0) {
      if (!options.staticIp) {
        if (!options.subnetNames || !options.virtualNetworkName) {
          return callback(new Error($('--virtual-network-name and --subnet-names must be specified when the --nic-config option is given')));
        }
      }
    }

    var computeManagementClient = self.createComputeManagementClient();
    var managementClient = self.createManagementClient();
    var storageClient = self.createStorageClient();
    var networkClient = self.createNetworkClient();

    createVM({
      dnsPrefix: dnsPrefix,
      imageName: imageName,
      password: password,
      userName: userName,
      subscription: options.subscription,
      size: vmSize,
      location: options.location,
      affinityGroup: options.affinityGroup,
      imageTarget: options.blobUrl,
      ssh: options.ssh,
      sshCert: options.sshCert,
      sshEndpoint: options.sshEndpoint,
      generateSshKeys: options.generateSshKeys,
      logger: logger,
      noSshPassword: options.sshPassword === false,
      noSshEndpoint: options.sshEndpoint === false,
      rdp: options.rdp,
      connect: options.connect,
      community: options.community,
      vmName: options.vmName,
      virtualNetworkName: options.virtualNetworkName,
      subnetNames: options.subnetNames,
      staticIp: options.staticIp,
      reservedIp: options.reservedIp,
      publicIp: options.publicIp,
      availabilitySet: options.availabilitySet,
      customData: options.customData,
      networkInterfaces: nicConfiguration.networkInterfaces,
      computeManagementClient: computeManagementClient,
      managementClient: managementClient,
      storageClient: storageClient,
      networkClient: networkClient
    }, callback, logger, self.cli);
  },

  createVMfromJson: function(dnsName, roleFile, options, callback, logger) {
    var self = this;

    function stripBOM(content) {
      // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
      // because the buffer-to-string conversion in `fs.readFileSync()`
      // translates it to FEFF, the UTF-16 BOM.
      if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
        content = content.slice(1);
      }
      return content;
    }

    var dnsPrefix = utils.getDnsPrefix(dnsName);
    logger.verbose(util.format($('Loading role file: %s'), roleFile));
    var jsonFile = fs.readFileSync(roleFile, 'utf8');
    var role = JSON.parse(stripBOM(jsonFile));

    // remove resourceExtensionReferences if empty
    if (role.resourceExtensionReferences.length === 0) {
      delete role.resourceExtensionReferences;
    }

    var computeManagementClient = self.createComputeManagementClient();
    var managementClient = self.createManagementClient();
    var storageClient = self.createStorageClient();
    var networkClient = self.createNetworkClient();

    createVM({
      subscription: options.subscription,
      location: options.location,
      affinityGroup: options.affinityGroup,
      dnsPrefix: dnsPrefix,
      connect: options.connect,
      role: role,
      sshCert: options.sshCert,
      virtualNetworkName: options.virtualNetworkName,
      computeManagementClient: computeManagementClient,
      managementClient: managementClient,
      storageClient: storageClient,
      networkClient: networkClient
    }, callback, logger, self.cli);

  },

  listVMs: function(options, callback, logger) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var vms = [];
        if (deployments.length > 0) {
          for (var i = 0; i < deployments.length; i++) {
            var roles = deployments[i].deploy.roles;
            if (roles) {
              for (var j = 0; j < roles.length; j++) {
                if (roles[j].roleType === 'PersistentVMRole') {
                  vms.push(createVMView(roles[j], deployments[i]));
                }
              }
            }
          }
        }

        self.cli.interaction.formatOutput(vms, function(outputData) {
          if (outputData.length === 0) {
            logger.info($('No VMs found'));
          } else {
            logger.table(outputData, function(row, item) {
              row.cell($('Name'), item.VMName);
              row.cell($('Status'), item.InstanceStatus);
              row.cell($('Location'), item.Location ? item.Location : item.AffinityGroup);
              row.cell($('DNS Name'), item.DNSName);
              row.cell($('IP Address'), item.IPAddress);
            });
          }
        });

        return callback();
      }
    });
  },

  showVM: function(name, options, callback, logger) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var vms = [];
        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                roles[j].roleName === name) {
                vms.push(createVMView(roles[j], deployments[i]));
              }
            }
          }
        }

        // got vms, show detailed info about it
        if (vms.length > 0) {
          var vmOut = vms.length === 1 ? vms[0] : vms;
          if (logger.format().json) {
            logger.json(vmOut);
          } else {
            utils.logLineFormat(vmOut, logger.data);
          }
        } else {
          logger.warn($('No VMs found'));
        }

        return callback();
      }
    });
  },

  deleteVM: function(vmName, options, callback, logger) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        options.dnsPrefix = options.dnsName;
        var found = null;
        var role = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                  utils.ignoreCaseEquals(roles[j].roleName, vmName)) {
                if (found) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }

                found = deployments[i];
                role = roles[j];
              }
            }
          }
        }

        // got unique vm, delete it
        if (found) {
          var deleteVMInternal = function() {
            var progress = self.cli.interaction.progress($('Deleting VM'));
            deleteRoleOrDeployment(computeManagementClient, found.svc, found.deploy, vmName, options, self.cli, callback, progress);
          };

          // confirm deleting if required
          if (options.quiet)
            deleteVMInternal();
          else self.cli.interaction.confirm(util.format($('Delete the VM %s ? [y/n] '), vmName), function(dummy, shouldDelete) {
            if (shouldDelete) {
              deleteVMInternal();
            } else {
              return callback();
            }
          });
        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  startVM: function(name, options, callback, logger) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var found = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                  utils.ignoreCaseEquals(roles[j].roleName, name)) {
                if (found) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                found = deployments[i];
                found.roleInstance = getRoleInstance(roles[j].roleName, deployments[i].deploy);
              }
            }
          }
        }

        // got unique vm, start it
        if (found) {
          var progress = self.cli.interaction.progress($('Starting VM'));
          computeManagementClient.virtualMachines.start(found.svc, found.deploy.name,
            found.roleInstance.instanceName,
            function(error) {
              progress.end();
              return callback(error);
            });
        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  restartVM: function(name, options, callback, logger) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var found = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                  utils.ignoreCaseEquals(roles[j].roleName, name)) {
                if (found) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                found = deployments[i];
                found.roleInstance = getRoleInstance(roles[j].roleName, deployments[i].deploy);
              }
            }
          }
        }

        // got unique vm, restart it
        if (found) {
          var progress = self.cli.interaction.progress($('Restarting VM'));
          computeManagementClient.virtualMachines.restart(found.svc, found.deploy.name,
            found.roleInstance.instanceName,
            function(error) {
              progress.end();
              return callback(error);
            });
        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  shutdownVM: function(name, options, callback, logger) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var found = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                  utils.ignoreCaseEquals(roles[j].roleName, name)) {
                if (found) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                found = deployments[i];
                found.roleInstance = getRoleInstance(roles[j].roleName, deployments[i].deploy);
              }
            }
          }
        }

        // got unique vm, shutting down it
        if (found) {
          var parameters = {
            postShutdownAction: 'StoppedDeallocated'
          };

          // if --stay-provisioned argument is provided shutdown vm to "Stopped" state
          if (options.stayProvisioned) {
            parameters.postShutdownAction = 'Stopped';
          }

          var progress = self.cli.interaction.progress($('Shutting down VM'));
          computeManagementClient.virtualMachines.shutdown(found.svc, found.deploy.name,
            found.roleInstance.instanceName, parameters,
            function(error) {
              progress.end();
              return callback(error);
            });
        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  captureVM: function(vmName, targetImageName, options, callback, logger) {
    var self = this;
    var vmImageTypes = ['Generalized', 'Specialized'];
    var result = validateVMCaptureParams(vmImageTypes, options.osState, options['delete']);
    if (result.error) {
      return callback(new Error(result.error));
    }

    var computeManagementClient = self.createComputeManagementClient();

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var found = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                roles[j].roleName === vmName) {
                if (found) {
                  // found duplicates, emit error
                  return callback($('VM name is not unique'));
                }

                found = deployments[i];
                found.roleInstance = getRoleInstance(roles[j].roleName, deployments[i].deploy);
              }
            }
          }
        }

        if (found) {
          progress = self.cli.interaction.progress(util.format($('Checking image with name %s exists'), targetImageName));
          vmUtils.getImageInfo(computeManagementClient, targetImageName, function(error, response) {
            progress.end();
            if (!error) {
              var image = response.vmImage || response.osImage;
              if (image) {
                var imageType = 'OS Image';
                if (response.vmImage) {
                  if (response.vmImage.oSDiskConfiguration.oSState === 'Specialized') {
                    imageType = 'Specialized VM Image';
                  } else {
                    imageType = 'Generalized VM Image';
                  }
                  return callback(new Error(util.format($('Another image of type "%s" exists with the same name. Image capture is being aborted to avoid duplicates and potential conflicts. Please use another name for the image'), imageType)));
                }
              }
              return captureVMIntern();
            } else {
              return callback(error);
            }
          });

          var captureVMIntern = function() {
            if (!options.osState) {
              var osImageCaptureOptions = {
                postCaptureAction: 'Delete',
                targetImageName: targetImageName,
                targetImageLabel: options.label || targetImageName // does not work without label
              };

              progress = self.cli.interaction.progress($('Capturing VM'));

              computeManagementClient.virtualMachines.captureOSImage(found.svc, found.deploy.name, found.roleInstance.instanceName, osImageCaptureOptions, function(error) {
                progress.end();
                return callback(error);
              });
            } else {
              if (found.roleInstance.instanceStatus === 'ReadyRole') {
                logger.warn($('The VM image capture operation has been started while the VM is still running. This may cause data corruption while creating VMs from this image. Please shutdown the VM using the "azure vm shutdown" command before capturing the image'));
              }

              var vmImageCaptureOptions = {
                oSState: result.vmImageType,
                vMImageName: targetImageName,
                vMImageLabel: options.label || targetImageName // does not work without label
              };

              var progress = self.cli.interaction.progress($('Capturing VM'));

              computeManagementClient.virtualMachines.captureVMImage(found.svc, found.deploy.name, found.roleInstance.instanceName, vmImageCaptureOptions, function(error) {
                progress.end();
                return callback(error);
              });
            }
          };
        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  exportVM: function(vmName, filePath, options, callback, logger) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var found = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                roles[j].roleName === vmName) {
                if (found) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                found = roles[j];
              }
            }
          }
        }

        // got unique role, export to file
        if (found) {
          var progress = self.cli.interaction.progress('Exporting the VM');

          var prepareForExport = function(role) {
            for (var key in role) {
              // Remove namespace @ node
              if (key === '@' || key === 'OsVersion') {
                delete role[key];
              } else if (key === 'dataVirtualHardDisks') {
                // Remove Links of all DataVirtualHardDisks since
                // while importing we need to pass only DiskName
                // which will be already linked with a vhd
                for (var i = 0; i < role[key].length; i++) {
                  delete role[key][i].mediaLink;
                  //IOType is impicitly determined from the media link hence it is not required
                  //when a vm is created from the exported json file
                  if (role[key][i].iOType) {
                    delete role[key][i].iOType;
                  }
                }
              } else if (key === 'oSVirtualHardDisk') {
                delete role[key].mediaLink;
                delete role[key].sourceImageName;
                //IOType is impicitly determined from the media link hence it is not required
                //when a vm is created from the exported json file
                if (role[key].iOType) {
                  delete role[key].iOType;
                }
              }

              // Remove namespace in inner objects
              if (typeof role[key] === 'object') {
                prepareForExport(role[key]);
              }
            }
          };

          prepareForExport(found);

          if (found.dataVirtualHardDisks.length && !found.dataVirtualHardDisks[0].logicalUnitNumber) {
            found.dataVirtualHardDisks[0].logicalUnitNumber = '0';
          }

          progress.end();
          var roleAsString = JSON.stringify(found);
          fs.writeFile(filePath, roleAsString, function(err) {
            if (err) {
              return callback(err);
            } else {
              logger.info(util.format($('VM %s exported to %s'), vmName, filePath));
              return callback();
            }
          });

        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  /*
   * Server does not support changing nic collection, addNic can be used once server start
   * support it, (can be used to enable PS Set-AzureNetworkInterfaceConfig equivalent)
   */
  addNic: function (vmName, nicName, options, callback) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      }

      var computeManagementClient = self.createComputeManagementClient();
      getVMDeploymentExtended(deployments, vmName, self.cli, computeManagementClient, function (error, vmDeployment) {
        if (error) {
          return callback(error);
        }

        var persistentVMRole = vmDeployment.persistentVMRole;
        var networkConfiguration = getNetworkConfigSet(persistentVMRole);
        if (!networkConfiguration) {
          return callback($('Network configuration not found on the VM'));
        }

        if (!networkConfiguration.networkInterfaces) {
          networkConfiguration.networkInterfaces = [];
        }

        var networkInterface = utils.findFirstCaseIgnore(networkConfiguration.networkInterfaces, { name: nicName });
        if (networkInterface) {
          return callback(util.format($('NIC with name "%s" already exists'), nicName));
        }


        networkInterface = {
          name: nicName,
          iPConfigurations: [
            {
              subnetName: options.subnetName,
              staticVirtualNetworkIPAddress: options.staticIp
            }
          ]
        };

        networkConfiguration.networkInterfaces.push(networkInterface);
        var progress = self.cli.interaction.progress($('Updating network configuration'));
        computeManagementClient.virtualMachines.update(vmDeployment.deployment.svc, vmDeployment.deployment.deploy.name, vmName, persistentVMRole, function(error) {
          progress.end();
          return callback(error);
        });
      });
    });
  },

  listLocations: function(options, callback, logger) {
    var self = this;
    var managementClient = self.createManagementClient();
    var progress = self.cli.interaction.progress($('Getting locations'));

    managementClient.locations.list(function(error, response) {
      progress.end();
      if (error) {
        return callback(error);
      } else {
        var locations = response.locations;

        if (locations.length === 0) {
          logger.info($('No locations found'));
        } else {
          self.cli.interaction.formatOutput(locations, function(outputData) {
            if (outputData.length === 0) {
              logger.info($('No locations'));
            } else {
              logger.table(outputData, function(row, item) {
                row.cell($('Name'), item.name);
              });
            }
          });
        }

        return callback();
      }
    });

  },

  createEP: function(vmName, publicPort, localPort, options, callback, logger) {
    var self = this;
    var endPointUtil = new EndPointUtil();
    var epInput = {};
    epInput.publicPort = {
      'value': publicPort,
      'argName': 'public-port'
    };

    if (localPort) {
      epInput.localPort = {
        'value': localPort,
        'argName': 'local-port'
      };
    }

    if (options.name) {
      epInput.name = {
        'value': options.name,
        'argName': '--name'
      };
    }

    if (options.protocol) {
      epInput.protocol = {
        'value': options.protocol,
        'argName': '--protocol'
      };
    }

    if (options.loadBalancedSetName) {
      epInput.loadBalancedSetName = {
        'value': options.loadBalancedSetName,
        'argName': '--load-balanced-set-name'
      };
    }

    if (options.probePort) {
      epInput.probePort = {
        'value': options.probePort,
        'argName': '--probe-port'
      };
    }

    if (options.probeProtocol) {
      epInput.probeProtocol = {
        'value': options.probeProtocol,
        'argName': '--probe-protocol'
      };
    }

    if (options.probePath) {
      epInput.probePath = {
        'value': options.probePath,
        'argName': '--probe-path'
      };
    }

    if (options.directServerReturn) {
      epInput.directServerReturn = {
        'value': options.directServerReturn,
        'argName': '--direct-server-return'
      };
    }

    if (options.internalLoadBalancerName) {
      epInput.internalLoadBalancerName = {
        'value': options.internalLoadBalancerName,
        'argName': '--internal-load-balancer-name'
      };
    }

    if (options.loadBalancerDistribution) {
      epInput.loadBalancerDistribution = {
        'value': options.loadBalancerDistribution,
        'argName': '--load-balancer-distribution'
      };
    }

    if (options.idleTimeout) {
      epInput.idleTimeout = {
        'value': options.idleTimeout,
        'argName': '--idle-timeout'
      };
    }

    if (options.probeInterval) {
      epInput.probeInterval = {
        'value': options.probeInterval,
        'argName': '--probe-interval'
      };
    }

    if (options.probeTimeout) {
      epInput.probeTimeout = {
        'value': options.probeTimeout,
        'argName': '--probe-timeout'
      };
    }

    var result = endPointUtil.verifyAndGetEndPointObj(epInput, [], false); // endpoint parameters validation
    if (result.error) {
      return callback(new Error(result.error));
    }

    var newEndPoints = [result.endPoint];

    var newEndPointsResult = endPointUtil.verifyEndPoints(newEndPoints);
    if (newEndPointsResult.error) {
      return callback(new Error(newEndPointsResult.error));
    }

    var computeManagementClient = self.createComputeManagementClient();

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          // Get all LB settings defined in this hosted service
          var lbsetConfigs = endPointUtil.getAllLBSettings(result.deployment.deploy.roles);
          // If any of the new endpoint has lb set name, if same lb settings is
          // defined for this hosted service then overwrite user provided lb
          // settings with this.
          for (var l = 0; l < newEndPoints.length; l++) {
            var lbSetName = newEndPoints[l].loadBalancedEndpointSetName;
            if (lbSetName) {
              lbSetName = lbSetName.toLowerCase();
              if (lbSetName in lbsetConfigs) {
                if (underscore.contains(lbsetConfigs[lbSetName].VmNames, vmName)) {
                  return callback(new Error(
                    util.format($('this VM already has an endpoint with lb set name %s. lb set name should be unique'),
                      lbSetName)));
                }

                logger.info(util.format($('cloud service already has an lb set defined with name %s, using this existing lb settings configuration'),
                  lbSetName));

                newEndPoints[l].loadBalancerProbe =
                  lbsetConfigs[lbSetName].ProbSettings;
                newEndPoints[l].enableDirectServerReturn =
                  lbsetConfigs[lbSetName].enableDirectServerReturn;
              }
            }

            if (newEndPoints[l].loadBalancerName) {
              var err = checkInternalLoadBalancerExists(result.deployment.deploy.loadBalancers, newEndPoints[l].loadBalancerName);
              if (err) {
                return callback(new Error(err));
              }
            }
          }

          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var configurationSets = persistentVMRole.configurationSets;
              var m = 0;
              for (; m < configurationSets.length; m++) {
                if (configurationSets[m].configurationSetType === 'NetworkConfiguration') {
                  break;
                }
              }

              if (!configurationSets[m].inputEndpoints) {
                configurationSets[m].inputEndpoints = [];
              }

              var endpoints = configurationSets[m].inputEndpoints;
              var endpointCount = endpoints.length;

              for (var n = 0; n < endpointCount; n++) {
                var key = endpoints[n].port + ':' + endpoints[n].protocol;
                if (key in newEndPointsResult.protocolPorts) {
                  return callback(new Error(
                    util.format($('this VM already has a %s load balancer port %s. lb port and protocol together should be unique'),
                      endpoints[n].protocol, endpoints[n].port)));
                }

                key = endpoints[n].name.toLowerCase();
                if (key in newEndPointsResult.endPointNames) {
                  return callback(new Error(
                    util.format($('this VM already has an endpoint with name %s, endpoint name should unique'),
                      key)));
                }
              }

              configurationSets[m].inputEndpoints = configurationSets[m].inputEndpoints.concat(newEndPoints);
              progress = self.cli.interaction.progress($('Updating network configuration'));
              computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                progress.end();
                return callback(error);
              });
            }
          });
        }
      }
    });
  },

  createMultipleEP: function(vmName, endpointsConfig, options, callback, logger) {
    var self = this;
    var message = 'each endpoint configuration in the endpoints configuration should be of the form \r\n       <public-port>:<local-port>:<protocol>:<idle-timeout>:<direct-server-return>:<probe-protocol>:<probe-port>:<probe-path>:<probe-interval>:<probe-timeout>:<load-balanced-set-name>:<internal-load-balancer-name>:<load-balancer-distribution>';
    var endpointPropMap = {
      0: {
       propName: 'publicPort',
       argName: 'public-port'
      },

      1: {
        propName: 'localPort',
        argName: 'local-port'
      },

      2: {
        propName: 'protocol',
        argName: 'protocol'
      },

      3: {
        propName: 'idleTimeout',
        argName: 'idle-timeout'
      },

      4: {
        propName: 'directServerReturn',
        argName: 'direct-server-return'
      },

      5: {
        propName: 'probeProtocol',
        argName: 'probe-protocol'
      },

      6: {
        propName: 'probePort',
        argName: 'probe-port'
      },

      7: {
        propName: 'probePath',
        argName: 'probe-path'
      },

      8: {
        propName: 'probeInterval',
        argName: 'probe-interval'
      },

      9: {
        propName: 'probeTimeout',
        argName: 'probe-timeout'
      },

      10: {
        propName: 'loadBalancedSetName',
        argName: 'load-balanced-set-name'
      },

      11: {
        propName: 'internalLoadBalancerName',
        argName: 'internal-load-balancer-name'
      },

      12: {
        propName: 'loadBalancerDistribution',
        argName: 'load-balancer-distribution'
      }
    };

    var newEndPoints = [];
    var count = 1;
    var endPointUtil = new EndPointUtil();
    var endpointsConfigAsList = endpointsConfig.split(',');
    endpointsConfigAsList.forEach(function(endpointConfig) {
      // skip any empty entries
      endpointConfig = endpointConfig.trim();
      if (endpointConfig) {
        var endpointConfigAsList = endpointConfig.split(':');
        if (endpointConfigAsList.length !== Object.keys(endpointPropMap).length) {
          return callback(new Error(message));
        }

        var intputEndpoint = {};
        for (var key in endpointPropMap) {
          if (endpointPropMap.hasOwnProperty(key)) {
            var endpointProperty = (endpointConfigAsList[key]).trim();
            if (endpointProperty) {
              intputEndpoint[(endpointPropMap[key]).propName] = {
                value: endpointProperty,
                argName: (endpointPropMap[key]).argName
              };
            }
          }
        }

        if (!_.isEmpty(intputEndpoint)) {
          var result = endPointUtil.verifyAndGetEndPointObj(intputEndpoint, [], false);
          if (result.error) {
            return callback(new Error(util.format('%s (endpoint %s)', result.error, count)));
          }

          newEndPoints.push(result.endPoint);
        }
      }

      count++;
    });

    var newEndPointsResult = endPointUtil.verifyEndPoints(newEndPoints);
    if (newEndPointsResult.error) {
      return callback(new Error(newEndPointsResult.error));
    }

    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {

          // Get all LB settings defined in this hosted service
          var lbsetConfigs = endPointUtil.getAllLBSettings(result.deployment.deploy.roles);
          // If any of the new endpoint has lb set name, if same lb settings is
          // defined for this hosted service then overwrite user provided lb
          // settings with this.
          for (var l = 0; l < newEndPoints.length; l++) {
            var lbSetName = newEndPoints[l].loadBalancedEndpointSetName;
            if (lbSetName) {
              lbSetName = lbSetName.toLowerCase();
              if (lbSetName in lbsetConfigs) {
                if (underscore.contains(lbsetConfigs[lbSetName].VmNames, vmName)) {
                  return callback(new Error(
                    util.format($('this VM already has an endpoint with load balanced set %s. load balanced set name should be unique'),
                      lbSetName)));
                }

                logger.info(util.format($('cloud service already has an load balanced set defined with name %s, using this existing load balanced set configuration'),
                  lbSetName));

                newEndPoints[l].loadBalancerProbe =
                  lbsetConfigs[lbSetName].ProbSettings;
                newEndPoints[l].enableDirectServerReturn =
                  lbsetConfigs[lbSetName].EnableDirectServerReturn;
              }
            }

            if (newEndPoints[l].loadBalancerName) {
              var err = checkInternalLoadBalancerExists(result.deployment.deploy.loadBalancers, newEndPoints[l].loadBalancerName);
              if (err) {
                return callback(new Error(err));
              }
            }
          }

          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var configurationSets = persistentVMRole.configurationSets;
              var m = 0;
              for (; m < configurationSets.length; m++) {
                if (configurationSets[m].configurationSetType === 'NetworkConfiguration') {
                  break;
                }
              }

              if (!configurationSets[m].inputEndpoints) {
                configurationSets[m].inputEndpoints = [];
              }

              var endpoints = configurationSets[m].inputEndpoints;
              var endpointCount = endpoints.length;

              for (var n = 0; n < endpointCount; n++) {
                var key = endpoints[n].port + ':' + endpoints[n].protocol;
                if (key in newEndPointsResult.protocolPorts) {
                  return callback(new Error(
                    util.format($('this VM already has a %s load balancer port %s. public port and protocol together should be unique'),
                      endpoints[n].protocol, endpoints[n].port)));
                }

                key = endpoints[n].name.toLowerCase();
                if (key in newEndPointsResult.endPointNames) {
                  return callback(new Error(
                    util.format($('this VM already has an endpoint with name %s, endpoint name should unique'),
                      key)));
                }
              }

              configurationSets[m].inputEndpoints = configurationSets[m].inputEndpoints.concat(newEndPoints);
              progress = self.cli.interaction.progress($('Updating network configuration'));
              computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                progress.end();
                return callback(error);
              });
            }
          });
        }
      }
    });
  },

  listEPs: function(name, options, callback, logger) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var role = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                utils.ignoreCaseEquals(roles[j].roleName, name)) {
                if (role) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                role = roles[j];
              }
            }
          }
        }

        var endpointName = options.endpointName;

        if (role) {
          var networkConfigSet = getNetworkConfigSet(role, endpointName);
          if (_.isEmpty(networkConfigSet.inputEndpoints)) {
            if (logger.format().json) {
              logger.json([]);
            } else {
              logger.warn($('No endpoints found'));
            }
            return callback();
          } else {
            logger.table(networkConfigSet.inputEndpoints, function(row, item) {
              row.cell('Name', item.name);
              row.cell('Protocol', item.protocol);
              row.cell('Public Port', item.port);
              row.cell('Private Port', item.localPort);
              row.cell('Virtual IP', item.virtualIPAddress || '');
              row.cell('EnableDirectServerReturn', item.enableDirectServerReturn);
              row.cell('Load Balanced', item.loadBalancedEndpointSetName ? 'Yes' : 'No');
            });
            return callback();
          }
        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  showStaticIP: function(vmName, options, callback, logger) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var role = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                roles[j].roleName === vmName) {
                if (role) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                role = roles[j];
              }
            }
          }
        }

        if (role) {
          var networkConfigSet = getNetworkConfigSet(role);

          var ipAddress = networkConfigSet.staticVirtualNetworkIPAddress;

          if (ipAddress) {
            var staticIPConfig = {
              Network: {
                StaticIP: ipAddress
              }
            };
            if (logger.format().json) {
              logger.json(staticIPConfig);
            } else {
              utils.logLineFormat(staticIPConfig, logger.data);
            }
          } else {
            logger.info(util.format($('No static IP address set for VM %s'), vmName));
          }
          return callback();
        } else {
          logger.warn($('No VMs found'));
        }
      }
    });
  },

  setStaticIP: function(vmName, ipAddress, options, callback) {
    var self = this;
    var progress;
    var vnetUtil = new VNetUtil();
    var parsedIp = vnetUtil.parseIPv4(ipAddress);
    if (parsedIp.error) {
      return callback(parsedIp.error);
    }

    var computeManagementClient = self.createComputeManagementClient(options);
    var networkClient = self.createNetworkClient();

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var virtualNetworkName = result.deployment.deploy.virtualNetworkName;
          if (!virtualNetworkName) {
            return callback(new Error($('The VM does not belong to any virtual networks.')));
          }

          progress = self.cli.interaction.progress($('Looking up virtual network'));

          getNetworkInfo(networkClient, virtualNetworkName, function(error, networkInfo) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var subnetResult = getIPAddressSubnet(networkInfo, ipAddress);
              if (subnetResult.error) {
                return callback(subnetResult.error);
              }
              if (!subnetResult.subnetName) {
                return callback(new Error(util.format($('The static address %s doesn\'t belong to the address space defined by the role\'s subnets.'), ipAddress)));
              }

              progress = self.cli.interaction.progress($('Reading network configuration'));

              computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
                progress.end();
                if (error) {
                  return callback(error);
                } else {
                  var role = response;
                  var networkConfigSet = getNetworkConfigSet(role);

                  networkConfigSet.staticVirtualNetworkIPAddress = ipAddress;
                  networkConfigSet.subnetNames = [
                    subnetResult.subnetName
                  ];

                  progress = self.cli.interaction.progress($('Updating network configuration'));

                  computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, role, function(error) {
                    progress.end();
                    return callback(error);
                  });
                }
              });
            }
          });
        }
      }
    });
  },

  removeStaticIP: function(vmName, options, callback) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient(options);

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var role = response;
              var networkConfigSet = getNetworkConfigSet(role);

              if (!networkConfigSet.staticVirtualNetworkIPAddress) {
                // Nothing to do
                return callback();
              }

              networkConfigSet.staticVirtualNetworkIPAddress = null;

              progress = self.cli.interaction.progress($('Updating network configuration'));

              computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, role, function(error) {
                progress.end();
                return callback(error);
              });
            }
          });
        }
      }
    });
  },

  listPublicIPs: function(vmName, options, callback, logger) {
    var self = this;
    if (!vmName) {
      return callback($('vm-name is required'));
    }

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMRole(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        }

        if (result.vmRole) {
          var persistentVMRole = result.vmRole;
          var networkConfigIndex = findConfigurationSet(persistentVMRole.configurationSets, 'NetworkConfiguration');
          if (networkConfigIndex === -1) {
            return callback(new Error($('Network configuration not found on the VM.')));
          }

          var networkConfiguration = persistentVMRole.configurationSets[networkConfigIndex];
          self.cli.interaction.formatOutput(networkConfiguration.publicIPs, function(outputData) {
            if (outputData.length === 0) {
              logger.info($('No public IP addresses found'));
            } else {
              logger.table(outputData, function(row, publicIP) {
                row.cell($('Name'), publicIP.name);
                row.cell($('IdleTimeoutInMinutes'), publicIP.IdleTimeoutInMinutes ? publicIP.IdleTimeoutInMinutes : '');
              });
            }
          });
        } else {
          logger.warn($('No VMs found'));
        }
        return callback();
      }
    });
  },

  setPublicIP: function(vmName, publicipName, options, callback, logger) {
    if (!vmName) {
      return callback($('vm-name is required'));
    }

    if (!publicipName) {
      return callback($('publicip-name is required'));
    }

    if (options.idleTimeoutInMinutes) {
      if ((options.idleTimeoutInMinutes != parseInt(options.idleTimeoutInMinutes, 10)) || (options.idleTimeoutInMinutes < 4) || (options.idleTimeoutInMinutes > 30)) {
        return callback(new Error($('--idle-timeoutInMinutes must be an integer in the range [4 - 30]')));
      }
    }

    var self = this;
    var computeManagementClient = self.createComputeManagementClient();

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));
          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var networkConfigIndex = findConfigurationSet(persistentVMRole.configurationSets, 'NetworkConfiguration');
              if (networkConfigIndex === -1) {
                return callback(new Error($('Network configuration not found on the VM.')));
              }

              var networkConfiguration = persistentVMRole.configurationSets[networkConfigIndex];
              if (!networkConfiguration.publicIPs) {
                networkConfiguration.publicIPs = [];
              }

              publicIPIndex = _.indexOf(_.map(networkConfiguration.publicIPs, function(p) {
                return p.name.toLowerCase();
              }), publicipName.toLowerCase());
              var needNetworkConfigUpdate = false;
              if (publicIPIndex !== -1) {
                logger.info(util.format($('Found PublicIP with name %s'), publicipName));
                if (options.idleTimeoutInMinutes) {
                  if (networkConfiguration.publicIPs[publicIPIndex].idleTimeoutInMinutes !== options.idleTimeoutInMinutes) {
                    needNetworkConfigUpdate = true;
                    networkConfiguration.publicIPs[publicIPIndex].idleTimeoutInMinutes = options.idleTimeoutInMinutes;
                  }
                } else {
                  logger.info($('To update existing public IP\'s  idle timeout, use --idle-timeoutInMinutes parameter'));
                }
              } else {
                needNetworkConfigUpdate = true;
                networkConfiguration.publicIPs.push({
                  name: publicipName,
                  idleTimeoutInMinutes: options.idleTimeoutInMinutes
                });
              }

              if (needNetworkConfigUpdate) {
                progress = self.cli.interaction.progress($('Updating network configuration'));

                computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                  progress.end();
                  return callback(error);
                });
              } else {
                logger.info($('There is nothing to update'));
                return callback();
              }
            }
          });
        }
      }
    });
  },

  removePublicIP: function(vmName, publicipName, options, callback) {
    var self = this;
    if (!vmName) {
      return callback($('vm-name is required'));
    }

    if (!publicipName) {
      return callback($('publicip-name is required'));
    }

    var computeManagementClient = self.createComputeManagementClient();

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));
          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var networkConfigIndex = findConfigurationSet(persistentVMRole.configurationSets, 'NetworkConfiguration');
              if (networkConfigIndex === -1) {
                return callback(new Error($('Network configuration not found on the VM.')));
              }

              var networkConfiguration = persistentVMRole.configurationSets[networkConfigIndex];
              var publicIPIndex = -1;
              if (networkConfiguration.publicIPs) {
                publicIPIndex = _.indexOf(_.map(networkConfiguration.publicIPs, function(p) {
                  return p.name.toLowerCase();
                }), publicipName.toLowerCase());
              }

              if (publicIPIndex === -1) {
                return callback(new Error(util.format($('No PublicIP with name %s found in the VM Network configuration'), publicipName)));
              }

              var removePublicIPInternal = function() {
                networkConfiguration.publicIPs.splice(publicIPIndex, 1); // remove public IP
                progress = self.cli.interaction.progress($('Updating network configuration'));
                computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                  progress.end();
                  return callback(error);
                });
              };

              if (options.quiet) {
                removePublicIPInternal();
              } else self.cli.interaction.confirm(util.format($('Remove the PublicIP %s ? [y/n] '), publicipName), function(dummy, shouldRemove) {
                if (shouldRemove) {
                  removePublicIPInternal();
                } else {
                  return callback();
                }
              });
            }
          });
        }
      }
    });
  },

  showEP: function(vmName, endpointName, options, callback, logger) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var role = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                utils.ignoreCaseEquals(roles[j].roleName, vmName)) {
                if (role) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                role = roles[j];
              }
            }
          }
        }

        var output = logger;
        if (role) {
          var networkConfigSet = getNetworkConfigSet(role);
          var endPoint = utils.findFirstCaseIgnore(networkConfigSet.inputEndpoints, { name: endpointName });
          if (!endPoint) {
            if (logger.format().json) {
              logger.json({});
            } else {
              logger.warn(util.format($('An endpoint with name "%s" not found'), endpointName));
            }
            return callback();
          } else {
            if (logger.format().json) {
              logger.json(endPoint);
            } else {
              output.nameValue($('Name'), endPoint.name, 2);
              output.nameValue($('VM name'), endPoint.vmName, 2);
              output.nameValue($('Local port'), endPoint.localPort, 2);
              output.nameValue($('Protcol'), endPoint.protocol, 2);
              output.nameValue($('Virtual IP Address'), endPoint.virtualIPAddress, 2);
              output.nameValue($('Direct server return'), endPoint.enableDirectServerReturn ? 'Enabled' : 'Disabled', 2);
              output.nameValue($('Connection timeout (minutes)'), endPoint.idleTimeoutInMinutes, 2);
              output.nameValue($('Load balanced set name'), endPoint.loadBalancedEndpointSetName, 2);
              output.nameValue($('Internal load balancer name'), endPoint.internalLoadBalancerName, 2);
              output.nameValue($('Load balancer distribution'), endPoint.loadBalancerDistribution, 2);
              if (endPoint.loadBalancerProbe) {
                output.header('Probe settings', 2);
                output.nameValue($('Port'), endPoint.loadBalancerProbe.port, 4);
                output.nameValue($('Protocol'), endPoint.loadBalancerProbe.protocol, 4);
                output.nameValue($('Path'), endPoint.loadBalancerProbe.path, 4);
                output.nameValue($('Interval (seconds)'), endPoint.loadBalancerProbe.intervalInSeconds, 4);
                output.nameValue($('Timeout (seconds)'), endPoint.loadBalancerProbe.timeoutInSeconds, 4);
              }
            }

            return callback();
          }
        } else {
          logger.warn($('No VMs found'));
          return callback();
        }
      }
    });
  },

  deleteEP: function(vmName, endpointName, options, callback) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var configurationSets = persistentVMRole.configurationSets;
              var m = 0;
              for (; m < configurationSets.length; m++) {
                if (configurationSets[m].configurationSetType === 'NetworkConfiguration') {
                  break;
                }
              }

              var endpoints = configurationSets[m].inputEndpoints;
              var i = -1;
              if (underscore.isArray(endpoints)) {
                i = 0;
                for (; i < endpoints.length; i++) {
                  if (utils.ignoreCaseEquals(endpoints[i].name, endpointName)) {
                    break;
                  }
                }
              }

              if ((i == -1) || (i == endpoints.length)) {
                return callback(util.format($('Endpoint %s not found in the network configuration'), endpointName));
              }

              configurationSets[m].inputEndpoints.splice(i, 1); // remove endpoint
              progress = self.cli.interaction.progress($('Updating network configuration'));

              // persistentVMRole contains vm role without specified endpoint, let's update role
              computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                progress.end();
                return callback(error);
              });
            }
          });
        }
      }
    });
  },

  setEP: function(vmName, endpointName, options, callback) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var configurationSets = persistentVMRole.configurationSets;
              var m = 0;
              for (; m < configurationSets.length; m++) {
                if (configurationSets[m].configurationSetType === 'NetworkConfiguration') {
                  break;
                }
              }

              var endpoints = configurationSets[m].inputEndpoints;
              var i = -1;
              if (underscore.isArray(endpoints)) {
                i = 0;
                for (; i < endpoints.length; i++) {
                  if (utils.ignoreCaseEquals(endpoints[i].name, endpointName)) {
                    break;
                  }
                }
              }

              if ((i == -1) || (i == endpoints.length)) {
                return callback(util.format($('Endpoint %s not found in the network configuration'), endpointName));
              }

              var endPointToSet = configurationSets[m].inputEndpoints[i];
              if (options.newEndpointName) {
                endPointToSet.name = options.newEndpointName;
              }

              var endpointUtil = new EndPointUtil();
              endPointToSet = endpointUtil.setEndpointProperties(endPointToSet, options);
              var message = null;
              for (var j = 0; j < endpoints.length; j++) {
                if (i != j) {
                  if (utils.ignoreCaseEquals(endpoints[j].name, endPointToSet.name)) {
                    message = util.format($('An endpoint with name %s already exists'), endPointToSet.name);
                    break;
                  }

                  var portAsInt = parseInt(endpoints[j].port, 10);
                  if ((portAsInt == endPointToSet.port) && (utils.ignoreCaseEquals(endpoints[j].protocol, endPointToSet.protocol))) {
                    message = util.format($('this VM already has an %s load balancer port %s, lb port and protocol together should be unique'),
                        endPointToSet.protocol, endPointToSet.port);
                    break;
                  }
                }
              }

              if (message) {
                return callback(message);
              }

              configurationSets[m].inputEndpoints[i] = endPointToSet;
              progress = self.cli.interaction.progress($('Updating network configuration'));

              computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                progress.end();
                return callback(error);
              });
            }
          });
        }
      }
    });

  },

  createEPAclRule: function(vmName, endpointName, order, action, remoteSubnet, options, callback) {
    var self = this;
    var endPointUtil = new EndPointUtil();

    if (!vmName) {
      return callback($('vm-name is required'));
    }

    if (!endpointName) {
      return callback($('endpoint-name is required'));
    }

    if (!order) {
      return callback($('order is required'));
    }

    if (!remoteSubnet) {
      return callback($('remote-subnet is required'));
    }

    var aclOrderIDRes = endPointUtil.validateACLOrderID(order, '<order>');
    if (aclOrderIDRes.error) {
      return callback(aclOrderIDRes.error);
    }

    order = aclOrderIDRes.orderID;
    var aclActionRes = endPointUtil.validateACLAction(action, '<action>');
    if (aclActionRes.error) {
      return callback(aclActionRes.error);
    }

    action = aclActionRes.action;
    var aclRemoteSubnetRes = endPointUtil.validateACLRemoteSubnet(remoteSubnet, '<remote-subnet>');
    if (aclRemoteSubnetRes.error) {
      return callback(aclRemoteSubnetRes.error);
    }

    if (options.description) {
      var aclDesRes = endPointUtil.validateACLDescription(options.description, '--description');
      if (aclDesRes.error) {
        return callback(aclDesRes.error);
      }
    }

    var computeManagementClient = self.createComputeManagementClient();

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var networkEPResult = findNewtworkConfigAndEndpoint(persistentVMRole.configurationSets, endpointName);
              if (networkEPResult.error) {
                return callback(new Error(networkEPResult.error));
              }

              var networkConfiguration = persistentVMRole.configurationSets[networkEPResult.networkConfigIndex];
              var epToAddAclRule = networkConfiguration.inputEndpoints[networkEPResult.endpointIndex];
              if (!epToAddAclRule.endpointAcl) {
                epToAddAclRule.endpointAcl = {};
              }

              if (!epToAddAclRule.endpointAcl.rules) {
                epToAddAclRule.endpointAcl.rules = [];
              }

              var aclRuleIndex = findAclRule(epToAddAclRule, order);
              if (aclRuleIndex !== -1) {
                return callback(new Error(util.format($('An ACL rule with order %s already exists'), order)));
              }

              epToAddAclRule.endpointAcl.rules.push({
                order: order,
                action: action,
                remoteSubnet: remoteSubnet,
                description: options.description
              });

              networkConfiguration.inputEndpoints[networkEPResult.endpointIndex] = epToAddAclRule;
              progress = self.cli.interaction.progress($('Updating network configuration'));
              computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                progress.end();
                return callback(error);
              });
            }
          });
        }
      }
    });
  },

  listEPAclRules: function(vmName, endpointName, options, callback, logger) {
    var self = this;
    if (!vmName) {
      return callback($('vm-name is required'));
    }

    if (!endpointName) {
      return callback($('endpoint-name is required'));
    }

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMRole(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        }

        if (result.vmRole) {
          var persistentVMRole = result.vmRole;
          var networkEPResult = findNewtworkConfigAndEndpoint(persistentVMRole.configurationSets, endpointName);
          if (networkEPResult.error) {
            return callback(new Error(networkEPResult.error));
          }

          var endpoint = persistentVMRole.configurationSets[networkEPResult.networkConfigIndex].inputEndpoints[networkEPResult.endpointIndex];
          var getAclRules = function() {
            return !endpoint.endpointAcl || !endpoint.endpointAcl.rules ? [] : endpoint.endpointAcl.rules;
          };

          var aclRules = getAclRules();
          self.cli.interaction.formatOutput(aclRules, function(outputData) {
            if (outputData.length === 0) {
              logger.info($('No ACL rules found'));
            } else {
              logger.table(outputData, function(row, rule) {
                row.cell($('Order'), rule.order);
                row.cell($('Action'), rule.action);
                row.cell($('RemoteSubnet'), rule.remoteSubnet);
                row.cell($('Description'), rule.description ? rule.description : '');
              });
            }
          });
        } else {
          logger.warn($('No VMs found'));
        }

        return callback();
      }
    });
  },

  deleteEPAclRule: function(vmName, endpointName, order, options, callback) {
    var self = this;
    if (!vmName) {
      return callback($('vm-name is required'));
    }

    if (!endpointName) {
      return callback($('endpoint-name is required'));
    }

    if (!order) {
      return callback($('order is required'));
    }

    var endPointUtil = new EndPointUtil();

    var aclOrderIDRes = endPointUtil.validateACLOrderID(order, '<order>');
    if (aclOrderIDRes.error) {
      return callback(aclOrderIDRes.error);
    }

    order = aclOrderIDRes.orderID;
    var computeManagementClient = self.createComputeManagementClient();
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var networkEPResult = findNewtworkConfigAndEndpoint(persistentVMRole.configurationSets, endpointName);
              if (networkEPResult.error) {
                return callback(new Error(networkEPResult.error));
              }

              var networkConfiguration = persistentVMRole.configurationSets[networkEPResult.networkConfigIndex];
              var epToRemoveAclRule = networkConfiguration.inputEndpoints[networkEPResult.endpointIndex];
              var aclRuleIndex = findAclRule(epToRemoveAclRule, order);
              if (aclRuleIndex === -1) {
                return callback(new Error(util.format($('An ACL rule with order %s not found for this endpoint'), order)));
              }

              var removeEnpointACLRuleInternal = function() {
                epToRemoveAclRule.endpointAcl.rules.splice(aclRuleIndex, 1); // remove the ACL rule
                networkConfiguration.inputEndpoints[networkEPResult.endpointIndex] = epToRemoveAclRule;
                progress = self.cli.interaction.progress($('Updating network configuration'));
                computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                  progress.end();
                  return callback(error);
                });
              };

              if (options.quiet) {
                return removeEnpointACLRuleInternal();
              } else self.cli.interaction.confirm(util.format($('Remove the ACL Rule with orderID %s ? [y/n] '), order), function(dummy, shouldRemove) {
                if (shouldRemove) {
                  return removeEnpointACLRuleInternal();
                } else {
                  return callback();
                }
              });
            }
          });
        }
      }
    });
  },

  updateEPAclRule: function(vmName, endpointName, order, options, callback) {
    var self = this;
    if (!vmName) {
      return callback($('vm-name is required'));
    }

    if (!endpointName) {
      return callback($('endpoint-name is required'));
    }

    if (!order) {
      return callback($('order is required'));
    }

    var endPointUtil = new EndPointUtil();
    var aclRuleInput = {};

    var aclOrderIDRes = endPointUtil.validateACLOrderID(order, '<order>');
    if (aclOrderIDRes.error) {
      return callback(aclOrderIDRes.error);
    }

    order = aclOrderIDRes.orderID;
    if (options.newOrder) {
      aclOrderIDRes = endPointUtil.validateACLOrderID(options.newOrder, '<new-order>');
      if (aclOrderIDRes.error) {
        return callback(aclOrderIDRes.error);
      }

      aclRuleInput.newOrder = aclOrderIDRes.orderID;
    }

    if (options.action) {
      var aclActionRes = endPointUtil.validateACLAction(options.action, '<action>');
      if (aclActionRes.error) {
        return callback(aclActionRes.error);
      }

      aclRuleInput.action = aclActionRes.action;
    }

    if (options.remoteSubnet) {
      var aclRemoteSubnetRes = endPointUtil.validateACLRemoteSubnet(options.remoteSubnet, '<remote-subnet>');
      if (aclRemoteSubnetRes.error) {
        return callback(aclRemoteSubnetRes.error);
      }

      aclRuleInput.remoteSubnet = aclRemoteSubnetRes.remoteSubnet;
    }

    if (options.description) {
      var aclDesRes = endPointUtil.validateACLDescription(options.description, '--description');
      if (aclDesRes.error) {
        return callback(aclDesRes.error);
      }

      aclRuleInput.description = aclDesRes.description;
    }

    if (underscore.isEmpty(aclRuleInput)) {
      return callback($('one of the optional parameter --new-order, --action, --remote-subnet or --description is required'));
    }

    var computeManagementClient = self.createComputeManagementClient();

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var result = getVMDeployment(deployments, vmName);
        if (result.error) {
          return callback(result.error);
        } else {
          var progress = self.cli.interaction.progress($('Reading network configuration'));

          computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function(error, response) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              var persistentVMRole = response;
              var networkEPResult = findNewtworkConfigAndEndpoint(persistentVMRole.configurationSets, endpointName);
              if (networkEPResult.error) {
                return callback(new Error(networkEPResult.error));
              }

              var epToUpdateAclRule = persistentVMRole.configurationSets[networkEPResult.networkConfigIndex].inputEndpoints[networkEPResult.endpointIndex];
              var aclRuleIndex = findAclRule(epToUpdateAclRule, order);
              if (aclRuleIndex === -1) {
                return callback(new Error(util.format($('An ACL rule with order %s not found for this endpoint'), order)));
              }

              var foundRuleWithSameOrder = false;
              for (var j = 0; j < epToUpdateAclRule.endpointAcl.rules.length; j++) {
                if (j != aclRuleIndex && epToUpdateAclRule.endpointAcl.rules[j].order === aclRuleInput.newOrder) {
                  foundRuleWithSameOrder = true;
                  break;
                }
              }

              if (foundRuleWithSameOrder) {
                return callback(new Error(util.format($('An ACL rule with order %s is already defined in this endpoint'), aclRuleInput.newOrder)));
              }

              var ruleToUpdate = epToUpdateAclRule.endpointAcl.rules[aclRuleIndex];
              if (aclRuleInput.newOrder) {
                ruleToUpdate.order = aclRuleInput.newOrder;
              }

              if (aclRuleInput.action) {
                ruleToUpdate.action = aclRuleInput.action;
              }

              if (aclRuleInput.remoteSubnet) {
                ruleToUpdate.remoteSubnet = aclRuleInput.remoteSubnet;
              }

              if (aclRuleInput.description) {
                ruleToUpdate.description = aclRuleInput.description;
              }

              epToUpdateAclRule.endpointAcl.rules[aclRuleIndex] = ruleToUpdate;
              progress = self.cli.interaction.progress($('Updating network configuration'));
              computeManagementClient.virtualMachines.update(result.deployment.svc, result.deployment.deploy.name, vmName, persistentVMRole, function(error) {
                progress.end();
                return callback(error);
              });
            }
          });
        }
      }
    });
  },

  uploadDataDisk: function(sourcePath, blobUrl, storageAccountKey, options, callback, logger) {
    var self = this;
    if (/^https?\:\/\//i.test(sourcePath)) {
      logger.verbose('Copying blob from ' + sourcePath);
      if (options.md5Skip || options.parallel !== 96 || options.baseVhd) {
        logger.warn('--md5-skip, --parallel and/or --base-vhd options will be ignored');
      }
      if (!options.forceOverwrite) {
        logger.warn('Any existing blob will be overwritten' + (blobUrl ? ' at ' + blobUrl : ''));
      }
      var progress = self.cli.interaction.progress('Copying blob');
      pageBlob.copyBlob(sourcePath, options.sourceKey, blobUrl, storageAccountKey, function(error, blob, response) {
        progress.end();
        logger.silly(util.inspect(response, null, null, true));
        if (!error) {
          logger.silly('Status : ' + response.copyStatus);
        }

        return callback(error);
      });
    } else {
      var uploadOptions = {
        verbose: self.cli.verbose ||
          logger.format().level === 'verbose' ||
          logger.format().level === 'silly',
        skipMd5: options.md5Skip,
        force: options.forceOverwrite,
        vhd: true,
        threads: options.parallel,
        parentBlob: options.baseVhd,
        exitWithError: callback,
        logger: logger
      };

      pageBlob.uploadPageBlob(blobUrl, storageAccountKey, sourcePath, uploadOptions, callback);
    }

  },

  attachDataDisk: function(vmName, diskImageName, options, callback, logger) {
    var self = this;

    self.diskAttachDetach({
      subscription: options.subscription,
      name: vmName,
      dnsName: options.dnsName,
      size: null,
      hostCaching: options.hostCaching,
      isDiskImage: true,
      url: diskImageName,
      attach: true,
      logger: logger
    }, callback);

  },

  attachNewDataDisk: function(vmName, size, blobUrl, options, callback, logger) {
    var self = this;

    var sizeAsInt = utils.parseInt(size);
    if (isNaN(sizeAsInt)) {
      return callback('size-in-gb must be an integer');
    }

    self.diskAttachDetach({
      subscription: options.subscription,
      name: vmName,
      dnsName: options.dnsName,
      size: sizeAsInt,
      hostCaching: options.hostCaching,
      isDiskImage: false,
      url: blobUrl,
      attach: true,
      logger: logger
    }, callback);

  },

  detachDataDisk: function(vmName, lun, options, callback, logger) {
    var self = this;

    var lunAsInt = utils.parseInt(lun);
    if (isNaN(lunAsInt)) {
      return callback('lun must be an integer');
    }

    self.diskAttachDetach({
      subscription: options.subscription,
      name: vmName,
      dnsName: options.dnsName,
      lun: lunAsInt,
      attach: false,
      logger: logger
    }, callback);

  },

  getDeployments: function(options, callback) {
    var self = this;
    var computeManagementClient = self.createComputeManagementClient();
    var deployments = [];

    var progress = self.cli.interaction.progress($('Getting virtual machines'));

    var getDeploymentSlot = function(hostedServices) {
      async.each(hostedServices, function(hostedService, cb) {
        computeManagementClient.deployments.getBySlot(hostedService.serviceName, 'Production', function(error, response) {
          if (error) {
            if (error.code === 'ResourceNotFound') {
              return cb(null);
            } else {
              return cb(error);
            }
          }

          var deployment = {
            svc: hostedService.serviceName,
            deploy: response
          };

          if (hostedService && hostedService.properties) {
            deployment.Location = hostedService.properties.location;
            deployment.AffinityGroup = hostedService.properties.affinityGroup;
          }

          deployments.push(deployment);

          cb(null);
        });
      }, function(err) {
        progress.end();
        return callback(err, deployments);
      });
    };

    // get deployment by slot. Checks which slots to query.
    options.dnsPrefix = options.dnsPrefix || utils.getDnsPrefix(options.dnsName, true);
    if (options.dnsPrefix) {
      getDeploymentSlot([{
        serviceName: options.dnsPrefix
      }]);
    } else {
      computeManagementClient.hostedServices.list(function(error, response) {
        if (error) {
          return callback(error);
        }

        return getDeploymentSlot(response.hostedServices);
      });
    }
  },

  updateDataDisk: function(vmName, lun, options, callback) {
    var lunAsInt = utils.parseInt(lun);
    if (isNaN(lunAsInt)) {
      return callback('lun must be an integer');
    }

    if (!options.hostCaching) {
      return callback(new Error($('--host-caching is required')));
    }

    var self = this;
    var supportedHostCaching = ['None', 'ReadOnly', 'ReadWrite'];
    var diskInfo = {};
    var computeManagementClient = self.createComputeManagementClient();

    var hostCaching = supportedHostCaching[0];
    if (options.hostCaching) {
      var i = _.indexOf(_.map(supportedHostCaching, function(s) {
        return s.toLowerCase();
      }), options.hostCaching.toLowerCase());
      if (i === -1) {
        return callback(new Error(util.format($('Given --host-caching is invalid, supported values are %s'), supportedHostCaching.join(', '))));
      }

      hostCaching = supportedHostCaching[i];
    }

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var found = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                roles[j].roleName === vmName) { //TODO case insensitive comparison
                if (found) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                found = deployments[i];
                found.dataVirtualHardDisks = roles[j].dataVirtualHardDisks;
                found.osDisk = roles[j].oSVirtualHardDisk;
              }
            }
          }
        }
        // got unique role under a deployment and service, add disk
        if (found) {
          var progress;
          if (!found.dataVirtualHardDisks || found.dataVirtualHardDisks.length === 0) {
            return callback(new Error($('There is no data disk attached to this VM')));
          }

          var dataVirtualHardDisk = null;
          for (var k = 0; k < found.dataVirtualHardDisks.length; k++) {
            if (found.dataVirtualHardDisks[k].logicalUnitNumber === undefined) {
              // Temp fix: SDK is setting '0' in xml response as undefined in json object
              found.dataVirtualHardDisks[k].logicalUnitNumber = 0;
            }

            var l = parseInt(found.dataVirtualHardDisks[k].logicalUnitNumber, 10);
            if (l === lunAsInt) {
              dataVirtualHardDisk = found.dataVirtualHardDisks[k];
              break;
            }
          }

          if (!dataVirtualHardDisk) {
            return callback(new Error($('Could not find a data disk with the given lun, make sure lun is associated with a data disk not os disk')));
          }

          // 2/19/2015: Currently azure supports only updating hostCaching changing other properties don't have any effect
          diskInfo.mediaLinkUri = dataVirtualHardDisk.mediaLink;
          diskInfo.name = dataVirtualHardDisk.name;
          diskInfo.logicalUnitNumber = dataVirtualHardDisk.logicalUnitNumber;
          diskInfo.hostCaching = hostCaching;
          diskInfo.logicalDiskSizeInGB = dataVirtualHardDisk.logicalDiskSizeInGB;
          diskInfo.label = dataVirtualHardDisk.label;

          progress = self.cli.interaction.progress('Updating Data-Disk');
          computeManagementClient.virtualMachineDisks.updateDataDisk(found.svc, found.deploy.name, vmName, lunAsInt, diskInfo, function(error) {
            progress.end();
            // TODO: azure sdk returns empty 'Error' object if operation completed successfully
            if (error && error.message === '') {
              return callback(null);
            }
            return callback(error);
          });
        } else {
          options.logger.warn('No VMs found');
          return callback();
        }
      }
    });
  },

  diskAttachDetach: function(options, callback) {
    var self = this;
    var lookupOsDiskUrl = false;
    var supportedHostCaching = ['None', 'ReadOnly', 'ReadWrite'];
    var diskInfo = {};
    var computeManagementClient = self.createComputeManagementClient();

    var hostCaching = supportedHostCaching[0];
    if (options.hostCaching) {
      var i = _.indexOf(_.map(supportedHostCaching, function(s) {
        return s.toLowerCase();
      }), options.hostCaching.toLowerCase());
      if (i === -1) {
        return callback(new Error(util.format($('Given --host-caching is invalid, supported values are %s'), supportedHostCaching.join(', '))));
      }

      hostCaching = supportedHostCaching[i];
    }


    if (!options.isDiskImage) {
      if (!options.url || !url.parse(options.url).protocol) {
        // If the blob url is not provide or partially provided, we need see
        // what storage account is used by VM's OS disk.
        lookupOsDiskUrl = true;
      } else {
        diskInfo.mediaLinkUri = options.url;
      }
    } else {
      diskInfo.name = options.url;
    }

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      } else {
        var found = null;

        for (var i = 0; i < deployments.length; i++) {
          var roles = deployments[i].deploy.roles;
          if (roles) {
            for (var j = 0; j < roles.length; j++) {
              if (roles[j].roleType === 'PersistentVMRole' &&
                roles[j].roleName === options.name) {
                if (found) {
                  // found duplicates, emit error
                  return callback(new Error($('VM name is not unique')));
                }
                found = deployments[i];
                found.dataVirtualHardDisks = roles[j].dataVirtualHardDisks;
                found.osDisk = roles[j].oSVirtualHardDisk;
              }
            }
          }
        }

        // got unique role under a deployment and service, add disk
        if (found) {
          var progress;
          if (options.attach) {
            // Check if we need to set the disk url based on the VM OS disk
            if (lookupOsDiskUrl) {
              if (options.url) {
                var parsed = url.parse(found.osDisk.mediaLink);
                diskInfo.mediaLinkUri = parsed.protocol + '//' + parsed.host + '/' + options.url;
              } else {
                diskInfo.mediaLinkUri = found.osDisk.mediaLink.slice(0, found.osDisk.mediaLink.lastIndexOf('/')) +
                  '/' + options.name + '-' + crypto.randomBytes(8).toString('hex') + '.vhd';
              }

              options.logger.verbose('Disk MediaLink: ' + diskInfo.mediaLinkUri);
            }

            var maxLun = -1;
            for (var k = 0; k < found.dataVirtualHardDisks.length; k++) {
              var lun = found.dataVirtualHardDisks[k].logicalUnitNumber ? parseInt(found.dataVirtualHardDisks[k].logicalUnitNumber, 10) : 0;
              maxLun = Math.max(maxLun, lun);
            }

            var nextLun = maxLun + 1;
            diskInfo.logicalUnitNumber = nextLun;

            if (options.size) {
              diskInfo.logicalDiskSizeInGB = options.size;
            } else {
              // computeManagementClient.virtualMachineDisks.createDataDisk
              // requires logicalDiskSizeInGB and mediaLinkUri parameters,
              // let's init it with dummy values (will be ignored by azure sdk)
              diskInfo.logicalDiskSizeInGB = 5;
              diskInfo.mediaLinkUri = 'http://dummy';
            }

            diskInfo.hostCaching = hostCaching;
            diskInfo.label = found.svc + '-' + found.deploy.name + '-' + options.name + '-' + nextLun;
            options.logger.verbose('Disk Lun: ' + nextLun);
            options.logger.verbose('Disk Label: ' + diskInfo.label);

            progress = self.cli.interaction.progress('Adding Data-Disk');

            computeManagementClient.virtualMachineDisks.createDataDisk(found.svc, found.deploy.name, options.name, diskInfo, function(error) {
              progress.end();
              // TODO: azure sdk returns empty 'Error' object if operation completed successfully
              if (error && error.message === '') {
                return callback(null);
              }
              return callback(error);
            });
          } else {
            progress = self.cli.interaction.progress('Removing Data-Disk');

            computeManagementClient.virtualMachineDisks.deleteDataDisk(found.svc, found.deploy.name, options.name, options.lun, {}, function(error) {
              progress.end();
              return callback(error);
            });
          }
        } else {
          options.logger.warn('No VMs found');
          return callback();
        }
      }
    });
  },

  createServiceManagementService: function() {
    var self = this;
    return utils.createServiceManagementService(profile.current.getSubscription(self.subscription));
  },

  createComputeManagementClient: function() {
    var self = this;
    return utils.createComputeClient(profile.current.getSubscription(self.subscription));
  },

  createManagementClient: function() {
    var self = this;
    return utils.createManagementClient(profile.current.getSubscription(self.subscription));
  },

  createStorageClient: function() {
    var self = this;
    return utils.createStorageClient(profile.current.getSubscription(self.subscription));
  },

  createNetworkClient: function() {
    var self = this;
    return utils.createNetworkClient(profile.current.getSubscription(self.subscription));
  },

  createDockerVM: function(dnsName, imageName, userName, password, options, callback, logger) {
    var self = this;
    if (userName.toLowerCase() === 'docker') {
      return callback(new Error($('docker is not valid username for docker vm. Please specify another username.')));
    }

    var dnsPrefix = utils.getDnsPrefix(dnsName);
    var vmSize = getVMSize(options, logger);

    if (options.ssh) {
      if (typeof options.ssh === 'boolean') {
        options.ssh = 22;
      } else if ((options.ssh != parseInt(options.ssh, 10)) || (options.ssh > 65535)) {
        return callback(new Error($('--ssh [port] must be an integer less than or equal to 65535')));
      }
    } else if ((!options.sshPassword || options.sshCert || options.generateSshKeys) && options.sshEndpoint) {
      return callback(new Error($('--no-ssh-password, --ssh-cert and --generate-ssh-keys can only be used with --ssh or --no-ssh-endpoint parameter')));
    }

    if (!options.sshPassword && (!options.sshCert && !options.generateSshKeys)) {
      return callback(new Error($('--no-ssh-password can only be used with the --ssh-cert or --generate-ssh-keys parameter')));
    }

    if (options.staticIp) {
      var vnetUtil = new VNetUtil();
      var parsedIp = vnetUtil.parseIPv4(options.staticIp);
      if (parsedIp.error) {
        return callback(parsedIp.error);
      }
      if (!options.virtualNetworkName) {
        return callback(new Error($('--virtual-network-name must be specified when the --static-ip option is given')));
      }
      if (options.subnetNames) {
        logger.warn($('--static-ip, --subnet-names will be ignored and the static ip subnet will be used'));
        options.subnetNames = null;
      }
    } else if (options.subnetNames) {
      if (!options.virtualNetworkName) {
        return callback(new Error($('--virtual-network-name must be specified when the --subnet-names option is given')));
      }
    }

    var nicConfiguration = parseNICParams(options.nicConfig);
    if (nicConfiguration.error) {
      return callback(new Error(nicConfiguration.error));
    }

    if (nicConfiguration.networkInterfaces.length !== 0) {
      if (!options.staticIp) {
        if (!options.subnetNames || !options.virtualNetworkName) {
          return callback(new Error($('--virtual-network-name and --subnet-names must be specified when the --nic-config option is given')));
        }
      }
    }

    if ((options.dockerPort && typeof options.dockerPort === 'boolean') || !options.dockerPort) {
      options.dockerPort = vmConstants.EXTENSIONS.DOCKER_PORT;
    }

    if ((options.dockerCertDir && typeof options.dockerCertDir === 'boolean') || !options.dockerCertDir) {
      var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
      options.dockerCertDir = path.join(homePath, '.docker');
    }

    var computeManagementClient = self.createComputeManagementClient();
    var managementClient = self.createManagementClient();
    var storageClient = self.createStorageClient();
    var networkClient = self.createNetworkClient();

    options.userName = userName;
    options.password = password;
    options.size = vmSize;
    options.dnsPrefix = dnsPrefix;
    options.imageName = imageName;
    options.noSshPassword = options.sshPassword === false;
    options.noSshEndpoint = options.sshEndpoint === false;
    options.networkInterfaces = nicConfiguration.networkInterfaces;
    options.logger = logger;
    options.computeManagementClient = computeManagementClient;
    options.managementClient = managementClient;
    options.storageClient = storageClient;
    options.networkClient = networkClient;

    return createDockerVM(dnsName, options, logger, self.cli, callback);
  },

  listExtensions: function(options, callback, logger) {
    var self = this;
    var context = {
      options: options,
      cli: self.cli,
      computeManagementClient: self.createComputeManagementClient(),
      logger: logger
    };

    async.series([
      _.bind(validateExtNamePublisher, context),
      _.bind(runListExtensionCommand, context)
    ], function(err) {
      return callback(err);
    });

    // if version or all-versions is given then publisher and
    // extension name are mandatory
    function validateExtNamePublisher(cb) {
      var self = this;

      if (self.options.version || self.options.allVersions) {
        async.series([
          _.bind(self.cli.interaction.promptIfNotGiven,
            self.cli.interaction,
            $('Extension name: '),
            self.options.extensionName),
          _.bind(self.cli.interaction.promptIfNotGiven,
            self.cli.interaction,
            $('Publisher name: '),
            self.options.publisherName)
        ], function(err, results) {
          if (!results || !results.length || results.length < 2 ||
            !results[0] || !results[1]) {
            cb(new Error($('--name and --publisher must be specified when --version or --all-versions options are used')));
            return;
          }

          self.options.extensionName = results[0];
          self.options.publisherName = results[1];
          cb();
        });
      } else {
        cb();
      }
    }

    function runListExtensionCommand(cb) {
      var self = this;
      var context = _.defaults(self, {
        progress: self.cli.interaction.progress($('Getting extensions'))
      });

      // if options.version or options.allVersions is set invoke the "listVersions" api
      // else call the "list" api
      if (self.options.version || self.options.allVersions) {
        runListExtensionListVersionsCommand.call(context, cb);
      } else {
        runListExtensionListCommand.call(context, cb);
      }
    }

    function runListExtensionListVersionsCommand(cb) {
      var self = this;

      self.computeManagementClient.virtualMachineExtensions.listVersions(
        self.options.publisherName,
        self.options.extensionName,
        function(err, result) {
          self.progress.end();

          if (err) {
            cb(err);
            return;
          }

          // filter for given version number if one has been provided
          if (result.resourceExtensions.length && self.options.version) {
            var version = self.options.version;

            result.resourceExtensions = _.filter(result.resourceExtensions, function(ext) {
              return version === ext.version;
            });
          }

          printExtensionList.call(self, result.resourceExtensions);
          cb();
        });
    }

    function runListExtensionListCommand(cb) {
      var self = this;

      self.computeManagementClient.virtualMachineExtensions.list(function(err, result) {
        self.progress.end();

        if (err) {
          cb(err);
          return;
        }

        // filter for extension or publisher name if provided; note that if both
        // extension *and* publisher name are given we still do an OR match which
        // means that all extensions where either of the 2 attributes that match
        // will be returned
        if (result.resourceExtensions.length &&
          (self.options.extensionName || self.options.publisherName)) {
          var extName = self.options.extensionName;
          var pubName = self.options.publisherName;

          result.resourceExtensions = _.filter(result.resourceExtensions, function(ext) {
            return utils.ignoreCaseEquals(extName, ext.name) ||
              utils.ignoreCaseEquals(pubName, ext.publisher);
          });
        }

        printExtensionList.call(self, result.resourceExtensions);
        cb();
      });
    }

    function printExtensionList(resourceExtensions) {
      var self = this;

      self.cli.interaction.formatOutput(resourceExtensions, function(extensions) {
        if (extensions.length === 0) {
          if (self.logger.format().json) {
            self.logger.json([]);
          } else {
            self.logger.info($('No extensions found'));
          }
        } else {
          self.logger.table(extensions, function(row, item) {
            row.cell($('Publisher'), item.publisher, null, 20);
            row.cell($('Extension name'), item.name, null, 15);
            row.cell($('Description'), item.description, null, 25);
            row.cell($('Version'), item.version);
          });
        }
      });
    }
  },

  setExtension: function(vmName, extensionName, publisherName, version, options, callback) {
    var self = this;

    // if there's no extension and publisher name are mandatory
    if (!extensionName || !publisherName || !version) {
      return callback(
        new Error($('Extension name, publisher name and version are required.')));
    }

    // get list of vms
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      }

      // find the vm we're interested in
      var result = getVMDeployment(deployments, vmName);
      if (result.error) {
        return callback(result.error);
      }

      // check if guest agent is enabled on the VM
      var role = _.find(result.deployment.deploy.roles, function(r) {
        return utils.ignoreCaseEquals(r.roleName, vmName);
      });
      if (!role.provisionGuestAgent) {
        return callback(
          new Error($('Provision Guest Agent must be enabled on the VM before setting VM Extension.')));
      }

      // if the extension being set is already set on the vm then
      // reuse the reference name from that if there's no reference
      // name set
      var extension = lookupExtension(role.resourceExtensionReferences, extensionName, publisherName, options);
      if (!options.referenceName && extension && extension.referenceName) {
        options.referenceName = extension.referenceName;
      }

      // assign this extension configuration to the role
      var isLegacy = isLegacyExtension(extensionName, publisherName, version);
      async.series([
        _.bind(loadConfig, self, options, 'publicConfigPath', 'publicConfig'),
        _.bind(loadConfig, self, options, 'privateConfigPath', 'privateConfig'),
        function configureExtension(cb) {
          // add this extension to the role if this is a new extension
          if (!extension) {
            extension = {};
            role.resourceExtensionReferences.push(extension);
          }

          extension = _.extend(extension, {
            referenceName: options.referenceName ? options.referenceName : extensionName,
            publisher: publisherName,
            name: extensionName,
            version: version,
            state: isLegacy ? null : options.uninstall ? 'Uninstall' : options.disable ? 'Disable' : 'Enable',
            resourceExtensionParameterValues: []
          });

          if (options.publicConfig) {
            extension.resourceExtensionParameterValues.push({
              key: extension.name + (isLegacy ? '' : 'Public') + 'ConfigParameter',
              value: options.publicConfig,
              type: isLegacy ? null : 'Public'
            });
          }

          if (options.privateConfig) {
            extension.resourceExtensionParameterValues.push({
              key: extension.name + (isLegacy ? '' : 'Private') + 'ConfigParameter',
              value: options.privateConfig,
              type: isLegacy ? null : 'Private'
            });
          }

          // update the vm
          var progress = self.cli.interaction.progress(getProgressMsg(extension));
          var computeManagementClient = self.createComputeManagementClient(options);
          computeManagementClient.virtualMachines.update(
            result.deployment.svc,
            result.deployment.deploy.name,
            vmName, role,
            function(error) {
              progress.end();
              return cb(error);
            });
        }
      ], function(err) {
        return callback(err);
      });
    });

    function loadConfig(options, propFrom, propTo, cb) {
      if (options[propFrom]) {
        fs.readFile(options[propFrom], function(err, data) {
          if (!err) {
            options[propTo] = data.toString();
          }

          cb(err);
        });
      } else {
        cb();
      }
    }
  },

  setChefExtension: function(vmName, options, callback) {
    var self = this;
    var log = self.cli.output;
    // if there's no validation.pem and client-config are mandatory
    if (!options.validationPem || !options.clientConfig) {
      return callback(
        new Error($('Required --validation-pem and --client-config options.')));
    }

    // Set extension version to latest (i.e major.*) if its not given by user.
    // Its recommended for clients to request the version as (majorversion.*).
    // This allows clients to auto update between minor versions without changing the version numbers in the client
    if (!options.version) {
      var computeManagementClient = self.createComputeManagementClient();
      computeManagementClient.virtualMachineExtensions.list(function(err, result) {

        if (err) {
          cb(err);
          return;
        }

        if (result.resourceExtensions.length) {
          result.resourceExtensions = _.filter(result.resourceExtensions, function(ext) {
            return utils.ignoreCaseEquals(CHEFPUBLISHER, ext.publisher);
          });
        }
        var version = _.max(result.resourceExtensions, function(stooge){return stooge.version;}).version;
        options.version = version.split('.')[0] + '.*';
      });
    }

    // get list of vms
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      }

      // find the vm we're interested in
      var result = getVMDeployment(deployments, vmName);
      if (result.error) {
        return callback(result.error);
      }

      // check if guest agent is enabled on the VM
      var role = _.find(result.deployment.deploy.roles, function(r) {
        return utils.ignoreCaseEquals(r.roleName, vmName);
      });
      if (!role.provisionGuestAgent) {
        return callback(
          new Error($('Provision Guest Agent must be enabled on the VM before setting VM Extension.')));
      }

      // Set defaults
      var extensionName = '';
      if (role.oSVirtualHardDisk.operatingSystem == 'Windows') {
        extensionName = 'ChefClient';
      } else {
        extensionName = 'LinuxChefClient';
      }

      // if the extension being set is already set on the vm then
      // reuse the reference name from that if there's no reference
      // name set

      var extension = lookupExtension(role.resourceExtensionReferences, extensionName, CHEFPUBLISHER,  options);

      if (!options.referenceName && extension && extension.referenceName) {
        options.referenceName = extension.referenceName;
      }

      // assign this extension configuration to the role
      var isLegacy = isLegacyExtension(extensionName, CHEFPUBLISHER, options.version);
      async.series([
        _.bind(loadConfig, self, options, 'clientConfig', 'publicConfig'),
        _.bind(loadConfig, self, options, 'validationPem', 'privateConfig'),
        function configureExtension(cb) {
          // add this extension to the role if this is a new extension
          if (!extension) {
            extension = {};
            role.resourceExtensionReferences.push(extension);
          }

          extension = _.extend(extension, {
            referenceName: options.referenceName ? options.referenceName : extensionName,
            publisher: CHEFPUBLISHER,
            name: extensionName,
            version: options.version,
            state: isLegacy ? null : options.uninstall ? 'Uninstall' : options.disable ? 'Disable' : 'Enable',
            resourceExtensionParameterValues: []
          });

          if (options.publicConfig) {
            extension.resourceExtensionParameterValues.push({
              key: extension.name + (isLegacy ? '' : 'Public') + 'ConfigParameter',
              value: options.publicConfig,
              type: isLegacy ? null : 'Public'
            });
          }

          if (options.privateConfig) {
            extension.resourceExtensionParameterValues.push({
              key: extension.name + (isLegacy ? '' : 'Private') + 'ConfigParameter',
              value: options.privateConfig,
              type: isLegacy ? null : 'Private'
            });
          }

          // update the vm
          var progress = self.cli.interaction.progress(getProgressMsg(extension));
          var computeManagementClient = self.createComputeManagementClient(options);
          computeManagementClient.virtualMachines.update(
            result.deployment.svc,
            result.deployment.deploy.name,
            vmName, role,
            function(error) {
              progress.end();
              return cb(error);
            });
        }
      ], function(err) {
        return callback(err);
      });
    });

    function loadConfig(options, propFrom, propTo, cb) {
      if (options[propFrom]) {
        fs.readFile(options[propFrom], function(err, data) {
          if (!err) {
            config = {};
            if (propTo == 'publicConfig') {
              config['client_rb'] = data.toString();
              config['runlist'] = options.runList;
              config['autoUpdateClient'] = options.autoUpdateClient ? 'true' : 'false';
              config['deleteChefConfig'] = options.deleteChefConfig ? 'true' : 'false';
              if (options.bootstrapOptions) {
                try {
                  config['bootstrap_options'] = JSON.parse(options.bootstrapOptions);
                } catch (er) {
                  log.error('Bad user input for -j or --bootstrap-options option', er);
                  return cb(er);
                }
              }
              options[propTo] = JSON.stringify(config);
            } else if (propTo == 'privateConfig') {
              config['validation_key'] = data.toString();
              options[propTo] = JSON.stringify(config);
            }
          }
          cb(err);
        });
      }
    }
  },

  getExtensions: function(vmName, options, callback, logger) {
    var self = this;
    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      }

      var result = getVMDeployment(deployments, vmName);
      if (result.error) {
        return callback(result.error);
      }

      var role = _.find(result.deployment.deploy.roles, function(r) {
        return utils.ignoreCaseEquals(r.roleName, vmName);
      });

      showExtensionDetails(role, options, logger, self.cli);

      return callback();
    });
  },

  getChefExtension: function(vmName, options, callback, logger) {
    var self = this;

    options.publisherName = CHEFPUBLISHER;

    self.getDeployments(options, function(error, deployments) {
      if (error) {
        return callback(error);
      }

      var result = getVMDeployment(deployments, vmName);
      if (result.error) {
        return callback(result.error);
      }

      var role = _.find(result.deployment.deploy.roles, function(r) {
        return utils.ignoreCaseEquals(r.roleName, vmName);
      });

      if (role.oSVirtualHardDisk.operatingSystem == 'Windows') {
        options.extensionName = 'ChefClient';
      } else {
        options.extensionName = 'LinuxChefClient';
      }

      showExtensionDetails(role, options, logger, self.cli);

      return callback();
    });
  }
});

// default service options
var svcParams = {
  label: '',
  description: 'Implicitly created hosted service'
};

// helpers methods
function createVMView(role, deployment) {
  var roleInstance = getRoleInstance(role.roleName, deployment.deploy);
  var networkConfigSet = getNetworkConfigSet(role);

  return {
    DNSName: url.parse(deployment.deploy.uri).host,
    Location: deployment.Location,
    AffinityGroup: deployment.AffinityGroup,
    VMName: role.roleName,
    IPAddress: roleInstance.iPAddress || '',
    InstanceStatus: roleInstance.instanceStatus,
    InstanceSize: roleInstance.instanceSize,
    /* InstanceStateDetails: roleInstance.InstanceStateDetails,  this property is deprecated */
    /* AvailabilitySetName: role.AvailabilitySetName, this property is deprecated */
    /* OSVersion: role.OsVersion, this property is deprecated */
    Image: role.oSVirtualHardDisk.sourceImageName,
    OSDisk: role.oSVirtualHardDisk,
    DataDisks: role.dataVirtualHardDisks,
    ReservedIPName: deployment.deploy.reservedIPName || '',
    VirtualIPAddresses: deployment.deploy.virtualIPAddresses ? deployment.deploy.virtualIPAddresses : [],
    PublicIPs: roleInstance.publicIPs ? roleInstance.publicIPs : [],
    Network: {
      Endpoints: (networkConfigSet ? networkConfigSet.inputEndpoints : {}),
      PublicIPs: (networkConfigSet ? networkConfigSet.publicIPs : {}),
      NetworkInterfaces: (networkConfigSet ? networkConfigSet.networkInterfaces : {})
    }
  };
}

function getRoleInstance(roleName, deployment) {
  for (var i = 0; i < deployment.roleInstances.length; i++) {
    if (deployment.roleInstances[i].roleName === roleName) {
      return deployment.roleInstances[i];
    }
  }
}

function checkInternalLoadBalancerExists(loadBalancers, loadBalancerName) {
  var loadBalancerIndex = -1;
  if (loadBalancers) {
    for (var i = 0; i < loadBalancers.length; i++) {
      if (utils.ignoreCaseEquals(loadBalancers[i].name, loadBalancerName)) {
        loadBalancerIndex = i;
        break;
      }
    }
  }

  if (loadBalancerIndex == -1) {
    return util.format($('An internal load balancer (ILB) with name %s not found for this deployment, refer \'azure service internal-load-balancer\' commands to manage ILB'), loadBalancerName);
  }

  return null;
}

function getNetworkConfigSet(role, endpointName) {
  if (!role || !role.configurationSets) {
    return;
  }

  var configSet;
  for (var i = 0; i < role.configurationSets.length; i++) {
    configSet = role.configurationSets[i];
    if (configSet.configurationSetType === 'NetworkConfiguration') {
      if (endpointName) {
        var endpointSet;
        for (var j = 0; j < configSet.inputEndpoints.length; j++) {
          if (configSet.inputEndpoints[j].name === endpointName) {
            endpointSet = {
              LocalPort: configSet.inputEndpoints[j].localPort,
              Name: configSet.inputEndpoints[j].name,
              Port: configSet.inputEndpoints[j].port,
              Protocol: configSet.inputEndpoints[j].protocol,
              Vip: configSet.inputEndpoints[j].virtualIPAddress,
              EnableDirectServerReturn: configSet.inputEndpoints[j].enableDirectServerReturn
            };
            break;
          }
        }
        configSet.inputEndpoints = [endpointSet];
      }
      return configSet;
    }
  }
}

function loadCustomData(udfile, logger) {
  if (udfile) {
    logger.verbose('loading customdata from:' + udfile);
    return fs.readFileSync(udfile).toString('base64');
  } else {
    logger.verbose('no customData option');
    return null;
  }
}

function getNetworkInfo(networkManagementClient, vnet, callback) {
  networkManagementClient.networks.list(function(error, response) {
    if (error) {
      return callback(error);
    } else {
      var virtualNetworkSites = response.virtualNetworkSites;
      var virtualNetworkSite = null;
      for (var i = 0; i < virtualNetworkSites.length; i++) {
        if (utils.ignoreCaseEquals(virtualNetworkSites[i].name, vnet)) {
          virtualNetworkSite = virtualNetworkSites[i];
          break;
        }
      }

      if (virtualNetworkSite) {
        callback(null, virtualNetworkSite);
      } else {
        callback(new Error(util.format($('Virtual network with name %s not found'), vnet)));
      }
    }
  });
}

function getIPAddressSubnet(networkInfo, ipAddress) {
  // Figure out which subnet the given ip address belongs to
  var vnetUtil = new VNetUtil();
  var parsedIp = vnetUtil.parseIPv4(ipAddress);
  if (parsedIp.error) {
    return {
      error: parsedIp.error
    };
  }

  var subnetResult = {
    subnetName: null,
    error: null
  };

  for (var i = 0; i < networkInfo.subnets.length; i++) {
    var checkResult = checkIPBelongsToAddressPrefix(networkInfo.subnets[i].addressPrefix, parsedIp, networkInfo.subnets[i].name);
    if (checkResult.error) {
      subnetResult.error = checkResult.error;
      break;
    }

    if (checkResult.inRange) {
      subnetResult.subnetName = networkInfo.subnets[i].name;
      break;
    }
  }

  return subnetResult;
}

function checkIPBelongsToAddressPrefix(addressPrefx, ipAddress, name) {
  var vnetUtil = new VNetUtil();
  var parsedAddressPrefix = vnetUtil.parseIPv4Cidr(addressPrefx, name);
  if (parsedAddressPrefix.error) {
    return {
      error: parsedAddressPrefix.error
    };
  }

  var mask = vnetUtil.getNetworkMaskFromCIDR(parsedAddressPrefix.cidr);
  if (mask.error) {
    return {
      error: mask.error
    };
  }

  var ipRange = vnetUtil.getIPRange(parsedAddressPrefix.octects, mask.octects);
  if (vnetUtil.isIPInRange(ipRange.start, ipRange.end, ipAddress.octects)) {
    return {
      error: null,
      inRange: true
    };
  }

  return {
    error: null,
    inRange: false
  };
}

function validateNicSubnets(networkInfo, networkInterfaces) {
  var vnetUtil = new VNetUtil();
  for (var m = 0; m < networkInterfaces.length; m++) {
    var nic = networkInterfaces[m];
    var nicIPConfig = nic.iPConfigurations[0];
    var nicSubnet = utils.findFirstCaseIgnore(networkInfo.subnets, { name: nicIPConfig.subnetName });
    if (!nicSubnet) {
      return {
        error: util.format($('The subnet "%s" does not exists in the virtual network.'), nicIPConfig.subnetName)
      };
    }

    if (nicIPConfig.staticVirtualNetworkIPAddress) {
      // validate NIC VNet Static IP Address
      var parsedIp = vnetUtil.parseIPv4(nicIPConfig.staticVirtualNetworkIPAddress);
      if (parsedIp.error) {
        return {
          error: util.format($('Invalid IP address "%s". "%s"'), nicIPConfig.staticVirtualNetworkIPAddress, parsedIp.error)
        };
      }

      var checkResult = checkIPBelongsToAddressPrefix(nicSubnet.addressPrefix, parsedIp, nicSubnet.name);
      if (checkResult.error) {
        return {
          error: checkResult.error
        };
      }

      if (!checkResult.inRange) {
        return {
          error: util.format($('The IP address "%s" does not belongs to the subnet "%s".'), nicIPConfig.staticVirtualNetworkIPAddress, nicIPConfig.subnetName)
        };
      }
    }

    nicIPConfig.subnetName = nicSubnet.name;
  }

  return {
    error: null
  };
}

function createVM(options, callback, logger, cli) {
  var deploymentParams = {
    name: options.dnsPrefix,
    label: options.dnsPrefix,
    deploymentSlot: 'Production',
    virtualNetworkName: options.virtualNetworkName
  };

  if (options.reservedIp)
    deploymentParams.reservedIPName = options.reservedIp;

  var role;
  var image;
  var provisioningConfig;
  var progress;
  var dnsPrefix;
  var hostedServiceCreated = false;
  var communityImgInfo = {
    created: false,
    name: null,
    blobUrl: null
  };

  dnsPrefix = options.dnsPrefix;

  function cmdCallbackHook(error) {
    if (communityImgInfo.created) {
      // cleanup community image
      var imageHelper = require('../iaas/image');
      var imageDelete = imageHelper.delete(imageHelper.OSIMAGE, cli);
      var deleteOptions = {
        blobDelete: true,
        subscription: options.subscription
      };

      imageDelete(communityImgInfo.name, deleteOptions, function(imgDelErr) {
        if (imgDelErr) {
          // Show message to user that image clean up failed but vm creation
          // succeeded
          if (!error) {
            logger.error(util.format($('though VM creation succeeded failed to cleanup the image'), communityImgInfo.name));
          } else {
            logger.error($('failed to cleanup the image'));
          }
        }

        if (error) {
          return cleanupHostedServiceAndExit(error);
        } else {
          return callback();
        }
      });
    } else {
      if (error) {
        return cleanupHostedServiceAndExit(error);
      } else {
        return callback();
      }
    }
  }

  function copyAndRegCommunityImgIfRequired(callback) {
    if (options.community) {
      var imageHelper = require('../iaas/image');
      var imageCreate = imageHelper.create(imageHelper.OSIMAGE, cli);
      var imageCreateOptions = {
        os: 'Linux',
        blobUrl: options.imageTarget,
        location: options.location,
        affinityGroup: options.affinityGroup,
        subscription: options.subscription
      };

      imageCreate(communityImgInfo.name, communityImgInfo.blobUrl, imageCreateOptions, function(error) {
        if (error) {
          return cmdCallbackHook(error);
        }

        communityImgInfo.created = true;

        lookupImage(options.computeManagementClient, communityImgInfo.name, options.logger, cli, function(error, comImage) {
          if (error) {
            return cmdCallbackHook(error);
          }

          // set the global image reference
          image = comImage;
          options.imageName = communityImgInfo.name;
          return callback();
        });
      });
    } else {
      return callback();
    }
  }

  // Load the roleFile if provided
  if (options.role) {
    role = options.role;
    logger.silly('role', role);
    // verify that the pem file exists and is valid before creating anything
    createOrLoadSshCert(options, logger, function(loadSshErr, newPemSshCert, newSshFingerprint) {
      if (loadSshErr) {
        return callback(loadSshErr);
      }

      options.pemSshCert = newPemSshCert;
      options.sshFingerprint = newSshFingerprint;
      createHostedService(dnsPrefix, options, logger, cli, function(hostedServiceError, alreadyExists) {
        if (hostedServiceError) {
          return callback(hostedServiceError);
        }

        if (alreadyExists) {
          return createDeploymentInExistingHostedService();
        }

        hostedServiceCreated = true;
        createDeployment(options.computeManagementClient);
      });
    });
  } else {
    if (options.community) {
      progress = cli.interaction.progress($('Looking up community image'));
      var managementEndPoint = profile.current.getSubscription(options.subscription).managementEndpointUrl;
      var communityUtil = new CommunityUtil(managementEndPoint);
      communityUtil.resolveUid(options.imageName, function(error, response) {
        progress.end();

        if (!error) {
          var comResult = (response.body.d || response.body.value)[0];
          communityImgInfo.name = options.imageName + '-' + crypto.randomBytes(4).toString('hex');
          communityImgInfo.blobUrl = comResult.BlobUrl;

          verifyUserNameAndPwd('linux', options, logger, cli, function(error) {
            if (error) {
              return callback(error);
            }

            verifyCertFingerPrint('linux', options, logger, function(certErr, newPemSshCert, newSshFingerprint) {
              if (certErr) {
                return callback(certErr);
              }

              options.pemSshCert = newPemSshCert;
              options.sshFingerprint = newSshFingerprint;
              // Note: at this point we have verified that the community image exists in the remote
              // image repository, copying this image to user's subscription will happen before
              // creating the deployment.

              createHostedService(dnsPrefix, options, logger, cli, function(hostedServiceError, alreadyExists) {
                if (hostedServiceError) {
                  return callback(hostedServiceError);
                }

                if (alreadyExists) {
                  return createDeploymentInExistingHostedService();
                }

                hostedServiceCreated = true;
                createDeployment(options.computeManagementClient);
              });
            });
          });
        } else {
          return callback(new Error($('Failed to validate Community image')));
        }
      });
    } else {
      lookupImage(options.computeManagementClient, options.imageName, logger, cli, function(imgErr, foundImage) {
        if (imgErr) {
          return callback(imgErr);
        }

        options.imageInfo = foundImage;
        image = foundImage;
        if (image.isSpecializedVMImage) {
          if (options.userName || options.password) {
            logger.warn($('user-name and password will be ignored for specialized VM image'));
          }

          if (options.sshCert) {
            logger.warn($('--ssh-cert will be ignored for specialized VM image'));
          }

          createHostedService(dnsPrefix, options, logger, cli, function(hostedServiceError, alreadyExists) {
            if (hostedServiceError) {
              return callback(hostedServiceError);
            }

            if (alreadyExists) {
              return createDeploymentInExistingHostedService();
            }

            hostedServiceCreated = true;
            createDeployment(options.computeManagementClient);
          });
        } else {
          verifyUserNameAndPwd(image.operatingSystemType, options, logger, cli, function(error) {
            if (error) {
              return callback(error);
            }

            verifyCertFingerPrint(image.operatingSystemType, options, logger, function(certErr, newPemSshCert, newSshFingerprint) {
              if (certErr) {
                return callback(certErr);
              }


              options.pemSshCert = newPemSshCert;
              options.sshFingerprint = newSshFingerprint;
              createHostedService(dnsPrefix, options, logger, cli, function(hostedServiceError, alreadyExists) {
                if (hostedServiceError) {
                  return callback(hostedServiceError);
                }

                if (alreadyExists) {
                  return createDeploymentInExistingHostedService();
                }

                hostedServiceCreated = true;
                createDeployment(options.computeManagementClient);
              });
            });
          });
        }
      });
    }
  }

  function createDeploymentInExistingHostedService() {
    if (options.location) {
      logger.warn($('--location option will be ignored'));
      options.location = null;
    }
    if (options.affinityGroup) {
      logger.warn($('--affinity-group option will be ignored'));
      options.affinityGroup = null;
    }

    var computeManagementClient = options.computeManagementClient;
    // get cloud service properties
    progress = cli.interaction.progress($('Getting cloud service properties'));

    computeManagementClient.hostedServices.get(dnsPrefix, function(error, response) {
      progress.end();
      if (error) {
        return callback(error);
      } else {
        logger.verbose($('Cloud service properties:'));
        logger.json('verbose', response);
        options.location = response.properties.location;
        options.affinityGroup = response.properties.affinityGroup;

        // check for existing production deployment
        progress = cli.interaction.progress($('Looking up deployment'));
        computeManagementClient.deployments.getBySlot(dnsPrefix, 'Production', function(error, response) {
          progress.end();
          if (error) {
            if (error.statusCode === 404) {
              // There's no production deployment.  Create a new deployment.
              /*jshint camelcase:false*/
              var createDeployment_ = function() {
                progress = cli.interaction.progress($('Creating VM'));

                deploymentParams.roles = [role];
                deploymentParams.deploymentSlot = 'Production';

                computeManagementClient.virtualMachines.createDeployment(dnsPrefix, deploymentParams, function(error) {
                  progress.end();
                  if (!error) {
                    logger.info('OK');
                    return cmdCallbackHook(null);
                  } else {
                    return cmdCallbackHook(error);
                  }
                });
              };

              copyAndRegCommunityImgIfRequired(function() {
                if (!role) {
                  createRole(null, dnsPrefix, image, options, logger, cli, function(createRoleError, newRole) {
                    if (createRoleError) {
                      callback(new Error(createRoleError));
                    }

                    role = newRole;
                    createDeployment_();
                  });
                } else {
                  createDeployment_();
                }
              });
            } else {
              return callback(error);
            }
          } else {
            // There's existing production deployment.  Add a new role if --connect was specified.
            var hookEx = false;
            if (!options.connect) {
              logger.help($('Specify --connect option to connect the new VM to an existing VM'));
              hookEx = true;
              return callback(util.format($('A VM with dns prefix "%s" already exists'), dnsPrefix));
            }

            if (options.virtualNetworkName) {
              // We are connecting to an existing deployment. Ensure the given --virtual-network-name
              // matches the existing deployment's virtual network.
              if (!utils.ignoreCaseEquals(options.virtualNetworkName, response.virtualNetworkName)) {
                return callback(new Error(util.format(
                  $('The existing deployment does not belong to virtual network %s'),
                  options.virtualNetworkName)));
              }
            }

            var addRoleInternal = function() {
              logger.verbose($('Adding a VM to existing deployment'));
              progress = cli.interaction.progress('Creating VM');

              computeManagementClient.virtualMachines.create(dnsPrefix, response.name, role, function(error) {
                progress.end();
                return cmdCallbackHook(error);
              });
            };

            var roleList = response.roles;
            var maxNum = 0;
            if (roleList) {
              maxNum = 1;
              for (var i = 0; i < roleList.length; i++) {
                var numSplit = roleList[i].roleName.split('-');
                if (numSplit.length > 1) {
                  // did it start with dnsPrefix? If not, ignore.
                  var leftSplit = numSplit.slice(0, -1).join('-');
                  if (leftSplit === dnsPrefix.slice(0, leftSplit.length)) {
                    var num = parseInt(numSplit[numSplit.length - 1], 10);
                    if (!isNaN(num) && num !== num + 1 && num > maxNum) { // number that is not too big
                      maxNum = num;
                    }
                  }
                }
              }
            }

            copyAndRegCommunityImgIfRequired(function() {
              if (!hookEx) {
                if (!role) {
                  var tag = '-' + (maxNum + 1);
                  var vmName = image.operatingSystemType.toLowerCase() === 'linux' ? dnsPrefix : dnsPrefix.slice(0, 15 - tag.length);
                  vmName += tag;
                  createRole(vmName, dnsPrefix, image, options, logger, cli, function(createRoleError, newRole) {
                    if (createRoleError) {
                      callback(new Error(createRoleError));
                    }

                    role = newRole;
                    addRoleInternal();
                  });
                } else {
                  addRoleInternal();
                }
              }
            });

          }
        });
      }
    });
  }

  function createDeployment(computeManagementClient) {
    /*jshint camelcase:false*/

    function createDeploymentInternal() {
      progress = cli.interaction.progress($('Creating VM'));

      deploymentParams.roles = [role];
      deploymentParams.deploymentSlot = 'Production';

      computeManagementClient.virtualMachines.createDeployment(dnsPrefix, deploymentParams, function(error) {
        progress.end();
        if (error) {
          return cmdCallbackHook(error);
        } else {
          return cmdCallbackHook(error);
        }
      });

    }

    // At this point we have a valid cloud service (existing or new one)
    // copy the community image if required.
    copyAndRegCommunityImgIfRequired(function() {
      if (!role) {
        createRole(null, dnsPrefix, image, options, logger, cli, function(createRoleError, newRole) {
          if (createRoleError) {
            callback(new Error(createRoleError));
          }

          role = newRole;
          createDeploymentInternal();
        });
      } else {
        if (options.sshCert && options.pemSshCert) {
          progress = cli.interaction.progress($('Configuring certificate'));
          configureCert(dnsPrefix, provisioningConfig, options.pemSshCert, options.sshFingerprint, options, logger, function(error) {
            progress.end();
            if (error) {
              return callback(error);
            }
            createDeploymentInternal();
          });
        } else {
          createDeploymentInternal();
        }
      }
    });
  }

  function cleanupHostedServiceAndExit(error) {
    var computeManagementClient = options.computeManagementClient;
    if (hostedServiceCreated) {
      logger.verbose(util.format($('Error occurred. Deleting %s cloud service'), options.dnsPrefix));

      progress = cli.interaction.progress($('Deleting cloud service'));

      computeManagementClient.hostedServices.deleteMethod(options.dnsPrefix, function(err) {
        progress.end();
        if (err) {
          logger.warn(util.format($('Error deleting %s cloud service'), options.dnsPrefix));
          logger.json('verbose', err);
        } else {
          logger.verbose(util.format($('Cloud service %s deleted'), options.dnsPrefix));
        }
        return callback(error);
      });
    } else {
      return callback(error);
    }
  }
}

function deleteHostedServiceIfEmpty(computeManagementClient, dnsPrefix, cli, callback) {
  // delete cloud service if it has no deployments
  computeManagementClient.hostedServices.getDetailed(dnsPrefix, function(error, response) {
    if (error) {
      return callback(error);
    } else {
      if (response.deployments.length === 0) {
        var progress = cli.interaction.progress($('Deleting Cloud Service'));
        computeManagementClient.hostedServices.deleteMethod(dnsPrefix, function(error) {
          progress.end();
          if (error) {
            return callback(error);
          } else {
            return callback();
          }
        });
      } else {
        return callback();
      }
    }
  });
}

function deleteRoleOrDeployment(computeManagementClient, svcname, deployment, vmName, options, cli, callback, progress) {
  // if more than 1 role in deployment - then delete role, else delete deployment
  var deleteFromStorage = options.blobDelete || false;

  if (deployment.roles.length > 1) {
    computeManagementClient.virtualMachines.deleteMethod(svcname, deployment.name, vmName, deleteFromStorage, function(error) {
      progress.end();
      return callback(error);
    });
  } else {
    computeManagementClient.deployments.deleteByName(svcname, deployment.name, deleteFromStorage, function(error) {
      progress.end();
      if (error) {
        return callback(error);
      } else {
        deleteHostedServiceIfEmpty(computeManagementClient, svcname, cli, callback);
      }
    });
  }
}

function getVMDeploymentExtended(deployments, vmName, cli, computeManagementClient, callBack) {
  var result = getVMDeployment(deployments, vmName);
  if (result.error) {
    return callBack(result.error);
  }

  var progress = cli.interaction.progress($('Getting PersistentVMRole'));
  computeManagementClient.virtualMachines.get(result.deployment.svc, result.deployment.deploy.name, vmName, function (error, response) {
    progress.end();
    if (error) {
      return callback(error);
    }

    // result.role and result.persistentVMRole will contain almost same information.
    // result.role is retrieved form the role collection associated with the deployment.
    // The ability to get role information directly via 'computeManagementClient.virtualMachines.get'
    // is enabled later, result.persistentVMRole contains this information. Going forward we should
    // get rid of using result.role
    result.persistentVMRole = response;
    return callBack(null, result);
  });
}

function getVMDeployment(deployments, vmName) {
  var found = {};

  var result = function(error) {
    return (error ? {
      error: error
    } : {
      error: null,
      deployment: found.deployment,
      roleInstance: found.roleInstance,
      role: found.role
    });
  };

  var vmRoleResult = getVMRole(deployments, vmName);
  if (vmRoleResult.error) {
    return result(vmRoleResult.error);
  }

  if (!vmRoleResult.vmRole) {
    return result($(util.format('No VM with name "%s" found', vmName)));
  }

  // Virtual network name, load balancers and virtual IP addresses are defined in deployment level
  found.deployment = vmRoleResult.deployment;
  // Contains properties defined in PersistentVMRole level https://msdn.microsoft.com/en-us/library/azure/jj157187.aspx
  found.role = vmRoleResult.vmRole;
  // Power state, IP Address, Guest agent status are defined in role instance level
  found.roleInstance = getRoleInstance(found.role.roleName, found.deployment.deploy);

  return result();
}

function getVMRole(deployments, vmRoleName) {
  var deployment = null;
  var role = null;

  var result = function(error) {
    return (error ? {
      error: error
    } : {
      error: null,
      'deployment': deployment,
      'vmRole': role
    });
  };

  for (var i = 0; i < deployments.length; i++) {
    var roles = deployments[i].deploy.roles;
    if (roles) {
      for (var j = 0; j < roles.length; j++) {
        if (roles[j].roleType === 'PersistentVMRole' && utils.ignoreCaseEquals(roles[j].roleName, vmRoleName)) {
          if (role) {
            // found duplicates, emit error
            return result($('VM name is not unique'));
          }
          role = roles[j];
          deployment = deployments[i];
        }
      }
    }
  }

  // Found or not found VM Role
  return result(null);
}

function setVMExtension(role, name, publisher, version, referenceName, state, privateConfigurationValue, publicConfigurationValue, callback) {

  if (!role) {
    return callback($('Specify role param'));
  }

  if (!role.resourceExtensionReferences) {
    role.resourceExtensionReferences = [];
  }

  var extension = {
    name: name,
    publisher: publisher,
    version: version,
    referenceName: referenceName,
    state: state
  };

  if (privateConfigurationValue) {
    var privateConfiguration = {
      //key: referenceName + "PrivateConfigParameter",
      key: 'ignored',
      value: privateConfigurationValue,
      type: 'Private'
    };

    extension.resourceExtensionParameterValues = [privateConfiguration];
  }

  if (publicConfigurationValue) {
    var publicConfiguration = {
      //key: referenceName + "PublicConfigParameter",
      key: 'ignored',
      value: publicConfigurationValue,
      type: 'Public'
    };

    if (extension.resourceExtensionParameterValues) {
      extension.resourceExtensionParameterValues.push(publicConfiguration);
    } else {
      extension.resourceExtensionParameterValues = [publicConfiguration];
    }
  }

  role.resourceExtensionReferences.push(extension);
  return callback();
}

function getVMSize(options, logger) {
  if (!options.vmSize) {
    logger.warn($('--vm-size has not been specified. Defaulting to "Small".'));
  }
  return options.vmSize || 'Small';
}

function findNewtworkConfigAndEndpoint(configurationSets, endpointName) {
  var result = {
    networkConfigIndex: -1,
    endpointIndex: -1,
    error: null
  };

  result.networkConfigIndex = findConfigurationSet(configurationSets, 'NetworkConfiguration');
  if (result.networkConfigIndex === -1) {
    result.error = $('Network configuration not found on the VM.');
    return result;
  }

  result.endpointIndex = findEndpoint(configurationSets[result.networkConfigIndex].inputEndpoints, endpointName);
  if (result.endpointIndex === -1) {
    result.error = util.format($('Endpoint %s not found in the network configuration'), endpointName);
  }

  return result;
}

function findConfigurationSet(configurationSets, configurationSetName) {
  return _.indexOf(_.map(configurationSets, function(p) {
    return p.configurationSetType;
  }), configurationSetName);
}

function findEndpoint(endpoints, endpointName) {
  var endpointIndex = -1;

  if (underscore.isArray(endpoints)) {
    endpointIndex = 0;
    for (; endpointIndex < endpoints.length; endpointIndex++) {
      if (utils.ignoreCaseEquals(endpoints[endpointIndex].name, endpointName)) {
        break;
      }
    }
  }

  if (endpointIndex == endpoints.length) {
    endpointIndex = -1;
  }

  return endpointIndex;
}

function findAclRule(endpoint, order) {
  if (!endpoint.endpointAcl || !endpoint.endpointAcl.rules) {
    return -1;
  }

  var aclRuleIndex = -1;
  var fixedOrderZero = false;
  for (var j = 0; j < endpoint.endpointAcl.rules.length; j++) {
    if (endpoint.endpointAcl.rules[j].order === order) {
      aclRuleIndex = j;
    }

    if (endpoint.endpointAcl.rules[j].order === 0) {
      // We have a problem with SDK, for order zero rule SDK returns integer zero
      // but 'virtualMachines.update' function will not serialize integer zero so
      // server throws error 'Order property missing', fix is to make 0 string
      fixedOrderZero = true;
      endpoint.endpointAcl.rules[j].order = '0';
    }

    if (aclRuleIndex !== -1 && fixedOrderZero) {
      break;
    }
  }

  return aclRuleIndex;
}

function validateVMCaptureParams(vmImageTypes, osState, deleteAfterCapture) {
  var result = {
    error: null,
    vmImageType: null
  };

  if (osState) {
    var i = _.indexOf(_.map(vmImageTypes, function(s) {
      return s.toLowerCase();
    }), osState.toLowerCase());
    if (i === -1) {
      result.error = util.format($('Given --os-state is invalid, supported values are %s'), vmImageTypes.join(', '));
      return result;
    }

    result.vmImageType = vmImageTypes[i];
    if (deleteAfterCapture) {
      result.error = $('--delete option cannot be used with --os-state');
    }
  } else if (!deleteAfterCapture) {
    result.error = $('To capture VM as OS Image --delete option must be specified');
  }
  return result;
}

function createDockerVM(dnsName, options, logger, cli, callback) {

  options.dockerCerts = {
    caKey: path.join(options.dockerCertDir, 'ca-key.pem'),
    ca: path.join(options.dockerCertDir, 'ca.pem'),
    serverKey: path.join(options.dockerCertDir, dnsName + '-server-key.pem'),
    server: path.join(options.dockerCertDir, dnsName + '-server.csr'),
    serverCert: path.join(options.dockerCertDir, dnsName + '-server-cert.pem'),
    clientKey: path.join(options.dockerCertDir, 'key.pem'),
    client: path.join(options.dockerCertDir, 'client.csr'),
    clientCert: path.join(options.dockerCertDir, 'cert.pem')
  };

  checkAndGenerateCertificatesIfNeeded(function(certificateError) {
    if (certificateError) {
      return callback(certificateError);
    }

    createVM({
      dnsPrefix: options.dnsPrefix,
      imageName: options.imageName,
      password: options.password,
      userName: options.userName,
      subscription: options.subscription,
      size: options.size,
      location: options.location,
      affinityGroup: options.affinityGroup,
      imageTarget: options.blobUrl,
      ssh: options.ssh,
      sshCert: options.sshCert,
      generateSshKeys: options.generateSshKeys,
      logger: logger,
      noSshPassword: options.noSshPassword,
      noSshEndpoint: options.noSshEndpoint,
      connect: options.connect,
      community: options.community,
      vmName: options.vmName,
      virtualNetworkName: options.virtualNetworkName,
      subnetNames: options.subnetNames,
      staticIp: options.staticIp,
      reservedIp: options.reservedIp,
      availabilitySet: options.availabilitySet,
      customData: options.customData,
      networkInterfaces: options.networkInterfaces,
      dockerPort: options.dockerPort,
      dockerCerts: options.dockerCerts,
      computeManagementClient: options.computeManagementClient,
      managementClient: options.managementClient,
      storageClient: options.storageClient,
      networkClient : options.networkClient
    }, function (error) {
      if (error) {
        return callback(error);
      }

      return callback();
    }, logger, cli);
  });

  function checkAndGenerateCertificatesIfNeeded(cb) {
    var password = 'Docker123';
    utils.fileExists(options.dockerCertDir, function(certDirError, exists) {
      if (certDirError) {
        return cb(certDirError);
      }

      if (!exists) {
        logger.verbose($('Certificates were not found.'));
        fs.mkdir(options.dockerCertDir, function(mkdirErr) {
          if (mkdirErr) {
            return cb(mkdirErr);
          }

          var progress = cli.interaction.progress($('Generating docker certificates.'));
          generateDockerCertificates(password, function(err) {
            progress.end();
            if (err) {
              return cb(err);
            }

            return cb();
          });
        });
      } else {
        // We need to check if all certificates are in place.
        // If not, generate them from scratch
        checkExistingClientCertificates(function(missingClientCertificates) {
          if (missingClientCertificates.length === 0) {
            logger.info($('Found docker client certificates.'));
            checkExistingServerCertificates(function(missingServerCertificates) {
              if (missingServerCertificates.length === 0) {
                logger.info($('Found docker server certificates.'));
                return cb();
              } else {
                generateDockerServerCertificates(password, function(){
                  return cb();
                });
              }
            });
          } else {
            for (i = 0; i < missingClientCertificates.length; i++) {
              logger.verbose(missingClientCertificates[i]);
            }

            var progress = cli.interaction.progress($('Generating docker certificates.'));
            generateDockerCertificates(password, function(err) {
              progress.end();
              if (err) {
                return cb(err);
              }

              return cb();
            });
          }
        });
      }
    });
  }

  function checkExistingServerCertificates(cb) {
    var missingCertificates = [];
    checkIfCertificateExist(missingCertificates, options.dockerCerts.serverKey, function() {
      checkIfCertificateExist(missingCertificates, options.dockerCerts.serverCert, function() {
        return cb(missingCertificates);
      });
    });
  }

  function checkExistingClientCertificates(cb) {
    var missingCertificates = [];
    checkIfCertificateExist(missingCertificates, options.dockerCerts.caKey, function() {
      checkIfCertificateExist(missingCertificates, options.dockerCerts.ca, function() {
        checkIfCertificateExist(missingCertificates, options.dockerCerts.clientKey, function() {
          checkIfCertificateExist(missingCertificates, options.dockerCerts.clientCert, function() {
            return cb(missingCertificates);
          });
        });
      });
    });
  }

  function generateDockerCertificates(password, cb) {
    /*jshint camelcase: false */
    logger.verbose(util.format($('Password for docker certificates is "%s"'), password));
    exec('openssl version', function(error, stdout, stderr) {
      if (stderr) {
        return cb(util.format($('Please install OpenSSL client. Error: %s'), stderr));
      }

      openssl.exec('genrsa', {
        des3: true,
        passout: 'pass:' + password,
        out: options.dockerCerts.caKey
      }, function(err) {
        if (err) {
          // This is not an actual error, 'openssl.exec' command throws log messages.
		  // So we will just output them to verbose log without interrupting the command.
          logger.verbose(err);
        }

        openssl.exec('req', {
          new: true,
          x509: true,
          days: 365,
          passin: 'pass:' + password,
          subj: '/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=\\*',
          key: options.dockerCerts.caKey,
          out: options.dockerCerts.ca
        }, function(err) {
          if (err) {
            // This is not an actual error, 'openssl.exec' command throws log messages.
            // So we will just output them to verbose log without interrupting the command.
            logger.verbose(err);
          }

          generateDockerServerCertificates(password, function(){
            generateDockerClientCertificates(password, function() {
              fs.chmodSync(options.dockerCerts.caKey, 0600);
              fs.chmodSync(options.dockerCerts.ca, 0600);
              return cb();
            });
          });
        });
      });
    });
  }

  function generateDockerServerCertificates(password, cb) {
    /*jshint camelcase: false */
    openssl.exec('genrsa', {
      des3: true,
      passout: 'pass:' + password,
      out: options.dockerCerts.serverKey
    }, function(err) {
      if (err) {
        // This is not an actual error, 'openssl.exec' command throws log messages.
        // So we will just output them to verbose log without interrupting the command.
        logger.verbose(err);
      }

      if (utils.stringIsNullOrEmpty(options.dockerCertCn)) {
        options.dockerCertCn = '*.cloudapp.net';
      }
      openssl.exec('req', {
        new: true,
        passin: 'pass:' + password,
        subj: '/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=' + options.dockerCertCn,
        key: options.dockerCerts.serverKey,
        out: options.dockerCerts.server
      }, function(err) {
        if (err) {
          // This is not an actual error, 'openssl.exec' command throws log messages.
          // So we will just output them to verbose log without interrupting the command.
          logger.verbose(err);
        }

        openssl.exec('x509', {
          req: true,
          days: 365,
          in : options.dockerCerts.server,
          passin: 'pass:' + password,
          set_serial: 01,
          CA: options.dockerCerts.ca,
          CAkey: options.dockerCerts.caKey,
          out: options.dockerCerts.serverCert
        }, function(err) {
          if (err) {
            // This is not an actual error, 'openssl.exec' command throws log messages.
            // So we will just output them to verbose log without interrupting the command.
            logger.verbose(err.toString());
          }

          openssl.exec('rsa', {
            passin: 'pass:' + password,
            in : options.dockerCerts.serverKey,
            passout: 'pass:' + password,
            out: options.dockerCerts.serverKey
          }, function(err) {
            if (err) {
              // This is not an actual error, 'openssl.exec' command throws log messages.
              // So we will just output them to verbose log without interrupting the command.
              logger.verbose(err.toString());
            }

            fs.chmodSync(options.dockerCerts.serverKey, 0600);
            fs.chmodSync(options.dockerCerts.server, 0600);
            fs.chmodSync(options.dockerCerts.serverCert, 0600);
            return cb();
          });
        });
      });
    });
  }

  function generateDockerClientCertificates(password, cb) {
    /*jshint camelcase: false */
    openssl.exec('genrsa', {
      des3: true,
      passout: 'pass:' + password,
      out: options.dockerCerts.clientKey
    }, function(err) {
      if (err) {
        // This is not an actual error, 'openssl.exec' command throws log messages.
        // So we will just output them to verbose log without interrupting the command.
        logger.verbose(err);
      }
      openssl.exec('req', {
        new: true,
        passin: 'pass:' + password,
        subj: '/C=AU/ST=Some-State/O=Internet Widgits Pty Ltd/CN=\\*',
        key: options.dockerCerts.clientKey,
        out: options.dockerCerts.client
      }, function(err) {
        if (err) {
          // This is not an actual error, 'openssl.exec' command throws log messages.
          // So we will just output them to verbose log without interrupting the command.
          logger.verbose(err.toString());
        }
        var configPath = path.join(options.dockerCertDir, 'extfile.cnf');
        fs.writeFile(configPath, 'extendedKeyUsage = clientAuth', function(err) {
          if (err) {
            logger.verbose(err);
          }
          openssl.exec('x509', {
            req: true,
            days: 365,
            in : options.dockerCerts.client,
            passin: 'pass:' + password,
            set_serial: 01,
            extfile: configPath,
            CA: options.dockerCerts.ca,
            CAkey: options.dockerCerts.caKey,
            out: options.dockerCerts.clientCert
          }, function(err) {
            if (err) {
              // This is not an actual error, 'openssl.exec' command throws log messages.
              // So we will just output them to verbose log without interrupting the command.
              logger.verbose(err.toString());
            }

            openssl.exec('rsa', {
              passin: 'pass:' + password,
              in : options.dockerCerts.clientKey,
              passout: 'pass:' + password,
              out: options.dockerCerts.clientKey
            }, function(err) {
              if (err) {
                // This is not an actual error, 'openssl.exec' command throws log messages.
                // So we will just output them to verbose log without interrupting the command.
                logger.verbose(err.toString());
              }

              fs.chmodSync(options.dockerCerts.clientKey, 0600);
              fs.chmodSync(options.dockerCerts.client, 0600);
              fs.chmodSync(configPath, 0600);
              fs.chmodSync(options.dockerCerts.clientCert, 0600);
              return cb();
            });
          });
        });
      });
    });
  }

  function checkIfCertificateExist(missingCertificates, filepath, cb) {
    utils.fileExists(filepath, function(error, exists) {
      if (error) {
        return cb(error);
      }

      if (!exists) {
        missingCertificates.push(util.format($('%s file was not found'), filepath));
        return cb();
      }

      return cb();
    });
  }
}

function setDockerVMExtension(role, version, options, logger, callback) {
  version = version || vmConstants.EXTENSIONS.DOCKER_VERSION_ASM;
  var publicConfig = createDockerPublicConfiguration(options);
  var privateConfig = createDockerPrivateConfiguration(options);
  setVMExtension(role, vmConstants.EXTENSIONS.DOCKER_NAME, vmConstants.EXTENSIONS.DOCKER_PUBLISHER, version, vmConstants.EXTENSIONS.DOCKER_NAME, 'enable', privateConfig, publicConfig, function (err) {
    return callback(err);
  });

  function createDockerPublicConfiguration(options) {
    var publicConf = {
      docker: {
        port: options.dockerPort.toString()
      }
    };

    return JSON.stringify(publicConf);
  }

  function createDockerPrivateConfiguration(options) {
    var certs = getDockerCertificates(options);
    var privateConf = {
      certs: {
        ca: certs.caCert,
        cert: certs.serverCert,
        key: certs.serverKey
      },
    };

    return JSON.stringify(privateConf);
  }

  function convertFileToBase64(filePath) {
    var file = fs.readFileSync(filePath);
    return new Buffer(file).toString('base64');
  }

  function getDockerCertificates(options) {
    var caCert = convertFileToBase64(options.dockerCerts.ca);
    var serverKey = convertFileToBase64(options.dockerCerts.serverKey);
    var serverCert = convertFileToBase64(options.dockerCerts.serverCert);

    return {
      caCert: caCert,
      serverKey: serverKey,
      serverCert: serverCert
    };
  }
}

function lookupImage(computeManagementClient, imageName, logger, cli, callback) {
  var result = {
    error: null,
    image: null
  };

  progress = cli.interaction.progress(util.format($('Looking up image %s'), imageName));

  vmUtils.getImageInfo(computeManagementClient, imageName, function(error, response) {
    progress.end();
    if (!error) {
      result.image = response.vmImage || response.osImage;

      if (!result.image) {
        result.error = util.format($('Image "%s" not found'), imageName);
      } else {
        if (result.image.oSDiskConfiguration) {
          result.image.operatingSystemType = result.image.oSDiskConfiguration.operatingSystem;
        }

        result.image.isVMImage = response.vmImage ? true : false;
        result.image.isSpecializedVMImage = response.vmImage && (response.vmImage.oSDiskConfiguration.oSState === 'Specialized');
        logger.silly('image:');
        logger.json('silly', result.image);
      }
    } else {
      result.error = error;
    }

    return callback(result.error, result.image);
  });
}

function createRole(name, dnsPrefix, image, options, logger, cli, callback) {
  var inputEndPoints = [];
  logger.verbose($('Creating role'));
  var vmName = options.vmName || name || dnsPrefix;
  role = {
    roleName: vmName,
    roleSize: options.size,
    roleType: 'PersistentVMRole',
    provisionGuestAgent: true
  };

  if (image.isVMImage) {
    role.vMImageName = image.name;
  } else {
    role.oSVirtualHardDisk = {
      sourceImageName: image.name
    };
  }

  if (options.availabilitySet) {
    role.availabilitySetName = options.availabilitySet;
    logger.verbose(util.format($('VM will be part of the %s availability set.'), options.availabilitySet));
  }

  /*jshint camelcase:false*/
  function createRoleInternal() {
    var configureSshCert = false;
    var customDataBase64 = null;
    var isProvisionConfigSupported = !image.isSpecializedVMImage;
    role.configurationSets = [];

    // Setting OS ProvisioningConfiguration
    if (isProvisionConfigSupported) {
      if (image.operatingSystemType.toLowerCase() === 'linux') {
        logger.verbose($('Using Linux ProvisioningConfiguration'));

        provisioningConfig = {
          configurationSetType: 'LinuxProvisioningConfiguration',
          hostName: vmName,
          userName: options.userName,
          userPassword: options.password
        };

        if (options.ssh || options.noSshEndpoint) {
          provisioningConfig.disableSshPasswordAuthentication = 'false';

          if (options.sshCert || options.generateSshKeys) {
            options.sshFingerprint = options.sshFingerprint.toUpperCase();
            logger.verbose(util.format($('using SSH fingerprint: %s'), options.sshFingerprint));
            // Configure the cert for cloud service
            configureSshCert = true;
            if (options.noSshPassword) {
              logger.verbose($('Password-based authentication will not be enabled'));
              provisioningConfig.disableSshPasswordAuthentication = true;
            }
          }
        }
      } else {
        logger.verbose($('Using Windows ProvisioningConfiguration'));
        provisioningConfig = {
          configurationSetType: 'WindowsProvisioningConfiguration',
          computerName: vmName,
          adminPassword: options.password,
          adminUserName: options.userName,
          resetPasswordOnFirstLogon: false
        };
      }

      role.configurationSets.push(provisioningConfig);
    }

    // Setting required endpoints
    if (image.operatingSystemType.toLowerCase() === 'linux') {
      if (options.ssh) {
        if (isProvisionConfigSupported) {
          logger.verbose(util.format($('SSH is enabled on port %s'), options.ssh));
        } else {
          logger.verbose(util.format($('Opening SSH port %s, SSH access is possible only if the VM from which image captured had SSH provisioned'), options.ssh));
        }

        inputEndPoints.push({
          name: 'ssh',
          protocol: 'tcp',
          port: options.ssh,
          localPort: '22'
        });
      }
    } else {
      if (options.rdp) {
        if (isProvisionConfigSupported) {
          logger.verbose(util.format($('RDP is enabled on port %s'), options.rdp));
        } else {
          logger.verbose(util.format($('Opening RDP port %s, RDP access is possible only if the VM from which image captured had RDP provisioned'), options.rdp));
        }

        inputEndPoints.push({
          name: 'rdp',
          protocol: 'tcp',
          port: options.rdp,
          localPort: '3389'
        });
      }
    }

    var publicIPs = [];
    if (options.publicIp) {
      publicIPs.push({
        name: options.publicIp,
        idleTimeoutInMinutes: options.idleTimeoutInMinutes
      });
    }

    if (inputEndPoints.length || options.subnetNames || options.staticIp || publicIPs.length) {
      var subnetNames = options.subnetNames;
      if (options.staticIp) {
        var staticIpSubnetResult = getIPAddressSubnet(options.networkInfo, options.staticIp);
        if (staticIpSubnetResult.error) {
          return callback(staticIpSubnetResult.error);
        }
        if (!staticIpSubnetResult.subnetName) {
          return callback(new Error(util.format($('The static address %s doesn\'t belong to the address space defined by the role\'s subnets.'), options.staticIp)));
        }
        subnetNames = staticIpSubnetResult.subnetName;
      }

      var nicSubnetResult = validateNicSubnets(options.networkInfo, options.networkInterfaces);
      if (nicSubnetResult.error) {
        return callback(new Error('--nic-config: ' + nicSubnetResult.error));
      }

      role.configurationSets.push({
        configurationSetType: 'NetworkConfiguration',
        inputEndpoints: inputEndPoints,
        subnetNames: subnetNames ? subnetNames.split(',') : [],
        staticVirtualNetworkIPAddress: options.staticIp,
        publicIPs: publicIPs,
        networkInterfaces: options.networkInterfaces
      });
    }

    if (options.dockerPort) {
      if (role.configurationSets.length > 1) {
        role.configurationSets[1].inputEndpoints.push({
          name: 'docker',
          protocol: 'tcp',
          port: options.dockerPort,
          localPort: options.dockerPort
        });
      } else {
        role.configurationSets.push({
          configurationSetType: 'NetworkConfiguration',
          inputEndpoints: [{
            name: 'docker',
            protocol: 'tcp',
            port: options.dockerPort,
            localPort: options.dockerPort
          }],
          subnetNames: options.subnetNames ? options.subnetNames.split(',') : []
        });
      }
    }

    if (isProvisionConfigSupported) {
      customDataBase64 = loadCustomData(options.customData, logger);
      if (customDataBase64) {
        provisioningConfig.customData = customDataBase64;
      }

      if (configureSshCert) {
        progress = cli.interaction.progress($('Configuring certificate'));
        configureCert(dnsPrefix, provisioningConfig, options.pemSshCert, options.sshFingerprint, options, logger, function(error) {
          if (error) {
            return callback(error);
          }

          progress.end();
          return createRoleInternal2();
        });
      } else {
        return createRoleInternal2();
      }
    } else {
      return createRoleInternal2();
    }
  }

  /*jshint camelcase:false*/
  function createRoleInternal2() {
    if (options.dockerPort) {
      setDockerVMExtension(role, '1.*', options, logger, function (/*TODO: Handle error*/) {
        return createRoleDone();
      });
    } else {
      return createRoleDone();
    }
  }

  /*jshint camelcase:false*/
  function createRoleDone() {
    logger.verbose('role:');
    logger.json('verbose', role);
    return callback(null, role);
  }

  if (!options.imageTarget && image && image.mediaLink && image.mediaLink.indexOf('$root') >= 0) {
    // Make sure OS disk is not stored in $root container by default. Use a different container in the same storage account.
    options.imageTarget = image.mediaLink.split('$root')[0] +
      'vhd-store-root/' + vmName + '-' + crypto.randomBytes(8).toString('hex') + '.vhd';
  }

  if (options.imageTarget || image.category !== 'User') {
    blobUtils.getBlobName(cli, options.storageClient, options.location, options.affinityGroup, dnsPrefix, options.imageTarget,
      '/vhd-store/', vmName + '-' + crypto.randomBytes(8).toString('hex') + '.vhd', 'portalvhds',
      function(error, imageTargetUrl) {
        if (error) {
          logger.error($('Unable to retrieve storage account'));
          return callback(error);
        } else {
          imageTargetUrl = blobUtils.normalizeBlobUri(imageTargetUrl, false);
          if (image.isVMImage) {
            logger.info('using --blob-url as image MediaLocation: ' + imageTargetUrl);
            role.mediaLocation = imageTargetUrl;
          } else {
            logger.verbose('image MediaLink: ' + imageTargetUrl);
            role.oSVirtualHardDisk.mediaLink = imageTargetUrl;
          }

          if (imageTargetUrl.indexOf('$root') >= 0) {
            return callback(util.format($('Creating OS disks in $root storage container is not supported. Storage URL: %s'), imageTargetUrl));
          }
          return createRoleInternal();
        }
      }
    );
  } else {
    return createRoleInternal();
  }
}

function verifyUserNameAndPwd(osName, options, logger, cli, callback) {
  if (!options.userName) {
    return callback($('--userName is required when <image> is an OS image or a generalized image'));
  }

  var passwordErr = $('password must be at least 8 character in length, it must contain a lower case, an upper case, a number and a special character such as !@#$%^&+=');
  var passwordRegEx = new RegExp(/^.*(?=.{8,})(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\*!@#$%^&+=]).*$/);
  var promptMsg = util.format($('Enter VM \'%s\' password:'), options.userName);

  if (utils.ignoreCaseEquals(osName, 'windows')) {
    if (utils.ignoreCaseEquals(options.userName, 'administrator')) {
      return callback($('user name administrator cannot be used'));
    }

    if (typeof options.password === 'undefined') {
      cli.interaction.password(promptMsg, '*', function(password) {
        process.stdin.pause();
        options.password = password;
        if (!options.password.match(passwordRegEx)) {
          return callback(passwordErr);
        }

        return callback();
      });
    } else if (!options.password.match(passwordRegEx)) {
      return callback(passwordErr);
    } else {
      return callback();
    }
  } else if (utils.ignoreCaseEquals(osName, 'linux')) {
    if (options.noSshPassword !== true) {
      if (typeof options.password === 'undefined') {
        cli.interaction.password(promptMsg, '*', function(password) {
          process.stdin.pause();
          options.password = password;
          if (!options.password.match(passwordRegEx)) {
            return callback(passwordErr);
          }

          return callback();
        });
      } else if (!options.password.match(passwordRegEx)) {
        return callback(passwordErr);
      } else {
        return callback();
      }
    } else {
      return callback();
    }
  } else {
    return callback();
  }
}

function verifyCertFingerPrint(osName, options, logger, cb) {
  if (!utils.ignoreCaseEquals(osName, 'linux')) {
    return cb();
  }

  if (!options.generateSshKeys && !options.sshCert) {
    return cb();
  }

  if (options.sshCert && utils.isSha1Hash(options.sshCert)) {
    sshFingerprint = options.sshCert;
    return cb(null, null, sshFingerprint);
  } else {
    createOrLoadSshCert(options, logger, function(loadSshErr, pemSshCert, sshFingerprint) {
      if (loadSshErr) {
        return cb(loadSshErr);
      }

      sshFingerprint = sshFingerprint.toUpperCase();
      logger.verbose(util.format($('using SSH fingerprint: %s'), sshFingerprint));

      return cb(null, pemSshCert, sshFingerprint);
    });
  }
}

function createOrLoadSshCert(options, logger, cb) {
  if (!options.generateSshKeys && !options.sshCert) {
    return cb();
  }

  if (options.sshCert) {
    if (options.generateSshKeys) {
      logger.info($('--ssh-cert is specified, --generate-ssh-keys option will be ignored.'));
    }
    loadSshCert(options, logger, function(loadSshErr, pemSshCert, sshFingerprint) {
      if (loadSshErr) {
        return cb(loadSshErr);
      }

      return cb(null, pemSshCert, sshFingerprint);
    });
  } else {
    logger.verbose($('Generating SSH keys.'));
    certUtils.generateSSHKeysIfNeeded(options.dnsPrefix, function(error, keys) {
      if (error) {
        return cb(error);
      }

      logger.info(util.format($('You can use %s private key for SSH authentication.'), keys.privateKeyPath));
      options.sshCert = keys.certPath;
      loadSshCert(options, logger, function(loadSshErr, pemSshCert, sshFingerprint) {
        if (loadSshErr) {
          return cb(loadSshErr);
        }

        return cb(null, pemSshCert, sshFingerprint);
      });
    });
  }
}

function loadSshCert(options, logger, cb) {
  logger.verbose(util.format($('Trying to open SSH cert: %s'), options.sshCert));
  logger.silly(util.format($('Trying to open SSH cert: %s'), options.sshCert));
  var pemSshCert = fs.readFileSync(options.sshCert);
  var pemSshCertStr = pemSshCert.toString();

  if (certUtils.isOpenSshRSAPub(pemSshCertStr)) {
    pemSshCertStr = certUtils.openSshRSAPubToX509CertPEM(pemSshCertStr);
    pemSshCert = new Buffer(pemSshCertStr);
  } else if (!certUtils.isX509CertPEM(pemSshCertStr)) {
    return cb(new Error($('Specified SSH certificate is not in PEM or SSH RSA format')));
  }

  var sshFingerprint = certUtils.getFingerprintFromX509CertPEM(pemSshCertStr);
  return cb(null, pemSshCert, sshFingerprint);
}

function configureCert(serviceName, provisioningConfig, pemSshCert, sshFingerprint, options, logger, callback) {
  if (provisioningConfig) {
    provisioningConfig.sshSettings = {
      publicKeys: [{
        fingerprint: sshFingerprint,
        path: '/home/' + options.userName + '/.ssh/authorized_keys'
      }]
    };

    logger.silly($('provisioningConfig with SSH:'));
    logger.silly(JSON.stringify(provisioningConfig));
  }

  if (pemSshCert) {
    logger.verbose($('uploading cert'));

    var certParams = {
      data: pemSshCert,
      certificateFormat: 'pfx'
    };

    var computeManagementClient = options.computeManagementClient;
    computeManagementClient.serviceCertificates.create(serviceName, certParams, function(error) {
      if (error) {
        logger.json('data', error);
        return callback(error);
      } else {
        logger.verbose($('uploading cert succeeded'));
        return callback();
      }
    });
  } else {
    return callback();
  }
}

function createHostedService(dnsPrefix, options, logger, cli, callback) {
  var createNewHostedService = function() {
    var createHostedServiceInternal = function() {
      svcParams.location = options.location;
      svcParams.affinityGroup = options.affinityGroup;
      svcParams.label = dnsPrefix;
      svcParams.serviceName = dnsPrefix;
      progress = cli.interaction.progress($('Creating cloud service'));

      computeManagementClient.hostedServices.create(svcParams, function(error) {
        progress.end();
        return callback(error);
      });
    };

    if (options.location && options.affinityGroup) {
      return callback($('both --location and --affinitygroup options are specified'));
    }

    // In some cases we override the request to use the virtual network's affinity group or location
    if (options.virtualNetworkAffinityGroupName) {
      // The '--virtual-network-name' option is present and it is affinity group based VNet [not regional VNet]
      var usingVNetAffinityGroup = false;
      if (options.location) {
        if (!utils.ignoreCaseEquals(options.location, options.virtualNetworkAffinityGroupDetails.location)) {
          return callback(new Error($('The hosted service location must be the same as the virtual network\'s affinity group location')));
        }

        // Override options to use the virtual network's affinity group
        options.location = null;
        options.affinityGroup = options.virtualNetworkAffinityGroupDetails.name;
        usingVNetAffinityGroup = true;
      } else if (options.affinityGroup) {
        if (!utils.ignoreCaseEquals(options.affinityGroup, options.virtualNetworkAffinityGroupName)) {
          return callback(new Error($('The hosted service affinity group must be the same as the virtual network\'s affinity group')));
        }
      } else {
        logger.info(util.format($('Using the virtual network\'s affinity group %s'), options.virtualNetworkAffinityGroupName));

        // Override options to use the virtual network's affinity group
        options.location = null;
        options.affinityGroup = options.virtualNetworkAffinityGroupDetails.name;
        usingVNetAffinityGroup = true;
      }

      if (usingVNetAffinityGroup) {
        if (options.imageInfo && options.imageInfo.isVMImage) {
          if (!utils.ignoreCaseEquals(options.imageInfo.location, options.virtualNetworkAffinityGroupDetails.location)) {
            return callback(new Error(util.format($('VM image must reside in the same location as the virtual network affinity group location. The location of the given virtual network is %s and VM image is %s', options.virtualNetworkAffinityGroupDetails.location, options.imageInfo.location))));
          }
        }
      }
    } else if (options.networkInfo && options.networkInfo.location) {
      // The '--virtual-network-name' option is present and it is a regional VNet [not affinity group based VNet]
      if (!options.affinityGroup) {
        if (options.location) {
          if (!utils.ignoreCaseEquals(options.location, options.networkInfo.location)) {
            return callback(new Error($('The hosted service location must be the same as the virtual network\'s location')));
          }
        } else {
          logger.info(util.format($('Using the virtual network\'s location %s'), options.networkInfo.location));

          // Override options to use the virtual network's location
          options.location = options.networkInfo.location;

          if (options.imageInfo && options.imageInfo.isVMImage) {
            if (!utils.ignoreCaseEquals(options.imageInfo.location, options.networkInfo.location)) {
              return callback(new Error(util.format($('VM image must reside in the same location as the virtual network location. The location of the given virtual network is %s and VM image is %s', options.networkInfo.location, options.imageInfo.location))));
            }
          }
        }
      }
    }

    // In some cases we override the request to use the reserved IP address location
    if (options.reservedIpInfo) {
      if (options.location) {
        if (!utils.ignoreCaseEquals(options.location, options.reservedIpInfo.location)) {
          return callback(new Error($('The hosted service location must be the same as the reserved IP address\' location')));
        }
      } else if (!options.affinityGroup) {
        logger.info(util.format($('Using the reserved IP address\' location %s'), options.reservedIpInfo.location));

        // Override options to use the reserved IP address' location
        options.location = options.reservedIpInfo.location;

        if (options.imageInfo && options.imageInfo.isVMImage) {
          if (!utils.ignoreCaseEquals(options.imageInfo.location, options.location)) {
            return callback(new Error(util.format($('VM image must reside in the same location as the reserved ip location. The location of the given reserved ip is %s and VM image is %s'), options.location, options.imageInfo.location)));
          }
        }
      }
    }

    // In some cases we override the request to use the VM Image location
    if (options.imageInfo && options.imageInfo.isVMImage) {
      if (options.location) {
        if (!utils.ignoreCaseEquals(options.location, options.imageInfo.location)) {
          return callback(new Error($('The cloud service location must be the same as VM image location')));
        }
      } else if (!options.affinityGroup) {
        logger.info(util.format($('using the VM image location %s'), options.imageInfo.location));

        // Override options to use the VM image location
        options.location = options.imageInfo.location;
      }
    }

    if (!options.location && !options.affinityGroup) {
      logger.help($('location or affinity group is required for a new cloud service\nplease specify --location or --affinity-group'));
      logger.help($('following commands show available locations and affinity groups:'));
      logger.help('    azure vm location list');
      logger.help('    azure account affinity-group list');
      return callback(new Error($('location or affinity group is required for a new cloud service')));
    }

    if (options.location) {
      logger.verbose(util.format($('Resolving the location %s'), options.location));
      utils.resolveLocationName(managementClient, options.location, function(error, resolvedLocation) {
        if (!error) {
          if (!resolvedLocation.availableServices || !underscore.find(resolvedLocation.availableServices, function(s) {
              return s === 'PersistentVMRole';
            })) {
            logger.help($('following command show available locations along with supported services:'));
            logger.help('    azure vm location list --json');
            return callback(util.format($('the given location \'%s\' does not support PersistentVMRole service'), options.location));
          }

          options.location = resolvedLocation.name;
          logger.verbose(util.format($('Location resolved to %s'), options.location));

          createHostedServiceInternal();
        } else {
          return callback(error);
        }
      });
    } else if (options.affinityGroup) {
      logger.verbose(util.format($('Looking up the affinity group %s'), options.affinityGroup));
      managementClient.affinityGroups.list(function(error, affinityGrpRes) {
        var helpmsg1 = $('following command show available affinity groups along with supported services:');
        var helpmsg2 = '    azure account affinity-group list --json';

        if (!error) {
          var affinityGroups = affinityGrpRes.affinityGroups;
          var foundAffinityGroup = null;
          if (affinityGroups instanceof Array) {
            foundAffinityGroup = underscore.find(affinityGroups, function(af) {
              return utils.ignoreCaseEquals(af.name, options.affinityGroup);
            });
          }

          if (!foundAffinityGroup) {
            logger.help(helpmsg1);
            logger.help(helpmsg2);
            return callback(util.format($('No affinity group found with name %s'), options.affinityGroup));
          }

          if (foundAffinityGroup.capabilities && !(foundAffinityGroup.capabilities instanceof Array)) {
            // normalize Capability to an array.
            foundAffinityGroup.capabilities = [foundAffinityGroup.capabilities];
          }

          if (!foundAffinityGroup.capabilities || !underscore.find(foundAffinityGroup.capabilities, function(ca) {
              return ca === 'PersistentVMRole';
            })) {
            logger.help(helpmsg1);
            logger.help(helpmsg2);
            return callback(util.format($('the given affinity group \'%s\' does not support PersistentVMRole service'), options.affinityGroup));
          }

          if (options.networkInfo && options.networkInfo.location) {
            if (!utils.ignoreCaseEquals(foundAffinityGroup.location, options.networkInfo.location)) {
              return callback(new Error($('The hosted service affinity group location must be the same as the virtual network\'s location')));
            }
          }

          options.affinityGroup = foundAffinityGroup.name;
          createHostedServiceInternal();
        } else {
          return callback(error);
        }
      });
    } else {
      createHostedServiceInternal();
    }
  };

  var createHostedService3 = function() {
    // check if cloud service exists for specified dns name
    logger.verbose(util.format($('Checking for existence of %s cloud service'), dnsPrefix));

    progress = cli.interaction.progress($('Looking up cloud service'));

    computeManagementClient.hostedServices.list(function(error, response) {
      progress.end();
      if (error) {
        return callback(error);
      } else {
        var service = null;
        var services = response.hostedServices;
        for (var i = 0; i < services.length; i++) {
          if (services[i].serviceName.toLowerCase() === dnsPrefix.toLowerCase()) {
            service = services[i];
            break;
          }
        }

        if (service) {
          logger.verbose(util.format($('Found existing cloud service %s'), service.serviceName));
          return callback(null, true);
        } else {
          logger.info(util.format($('cloud service %s not found.'), dnsPrefix));
          createNewHostedService();
        }
      }
    });
  };

  var createHostedService2 = function() {
    if (options.reservedIp) {
      progress = cli.interaction.progress($('Looking up reserved IP address'));
      options.networkClient.reservedIPs.get(options.reservedIp, function(error, response) {
        if (error) {
          progress.end();
          return callback(error, response);
        } else {
          options.reservedIpInfo = response;
          return createHostedService3();
        }
      });
    } else {
      return createHostedService3();
    }
  };

  var computeManagementClient = options.computeManagementClient;
  var managementClient = options.managementClient;

  if (options.virtualNetworkName) {
    progress = cli.interaction.progress($('Looking up virtual network'));
    getNetworkInfo(options.networkClient, options.virtualNetworkName, function(error, networkInfo) {
      if (error) {
        progress.end();
        return callback(error);
      } else {
        options.networkInfo = networkInfo;
        if (options.networkInfo.affinityGroup) {
          options.virtualNetworkAffinityGroupName = options.networkInfo.affinityGroup;
          managementClient.affinityGroups.get(options.networkInfo.affinityGroup, function(error, affinityGroupDetails) {
            progress.end();
            if (error) {
              return callback(error);
            } else {
              options.virtualNetworkAffinityGroupDetails = affinityGroupDetails;
              createHostedService2();
            }
          });
        } else {
          return createHostedService2();
        }
      }
    });
  } else {
    return createHostedService2();
  }
}

function showExtensionDetails(role, options, logger, cli) {
  var extensionRefs = role.resourceExtensionReferences;
  var allExtensions = !(options.referenceName || options.extensionName || options.publisherName);
  if (!allExtensions && extensionRefs) {
    extensionRefs = _.filter(extensionRefs, function(r) {
      return utils.ignoreCaseEquals(options.extensionName, r.name) ||
        utils.ignoreCaseEquals(options.publisherName, r.publisher) ||
        utils.ignoreCaseEquals(options.referenceName, r.referenceName);
    });
  }

  cli.interaction.formatOutput(extensionRefs, function(extensions) {
    if (!extensionRefs || extensions.length === 0) {
      if (logger.format().json) {
        logger.json([]);
      } else {
        logger.info($('No extensions found'));
      }
    } else {
      logger.table(extensions, function(row, item) {
        row.cell($('Publisher'), item.publisher, null, 20);
        row.cell($('Extension name'), item.name, null, 15);
        row.cell($('ReferenceName'), item.referenceName, null, 25);
        row.cell($('Version'), item.version);
        row.cell($('State'), item.state);
      });
    }
  });
}

function getProgressMsg(extension) {
  switch (extension.state) {
    case 'Disable':
      return $('Disabling vm extension');
    case 'Uninstall':
      return $('Uninstalling vm extension');
    default:
      return $('Updating vm extension');
  }
}

function isLegacyExtension(name, publisher, version) {
  if (!VMClient.legacyExtensions) {
    VMClient.legacyExtensions = [{
      name: 'VMAccessAgent',
      publisher: 'Microsoft.Compute',
      version: '0.1'
    }, {
      name: 'DiagnosticsAgent',
      publisher: 'Microsoft.Compute',
      version: '0.1'
    }];
  }

  return _.find(VMClient.legacyExtensions, function(e) {
    return utils.ignoreCaseEquals(e.name, name) &&
      utils.ignoreCaseEquals(e.publisher, publisher) &&
      utils.ignoreCaseEquals(e.version, version);
  });
}

function lookupExtension(extensionRefs, extensionName, publisherName, options) {
  // if there's an extension name then we match on that and publisher name;
  // if not then we match on reference name
  if (!extensionName) {
    return _.find(extensionRefs, function(r) {
      return utils.ignoreCaseEquals(options.referenceName, r.referenceName);
    });
  } else {
    return _.find(extensionRefs, function(r) {
      return utils.ignoreCaseEquals(extensionName, r.name) &&
        utils.ignoreCaseEquals(publisherName, r.publisher);
    });
  }
}

function parseNICParams(nicParams) {
  var networkInterfaces = [];
  var nicConfig = {
    error: null,
    networkInterfaces: networkInterfaces
  };

  var nicConfigFmtMsg = '--nic-config must be comma separated NIC definitions, format of each NIC definition must be <nicName>:<subnetName>:[vnetStaticIP]:[nsgName]:[ipForwarding]';
  if (!utils.stringIsNullOrEmpty(nicParams)) {
    var vnetUtil = new VNetUtil();
    nicParams = nicParams.trim().split(',');
    for (var i = 0; i < nicParams.length; i++) {
      var nicParam = nicParams[i].trim();
      if (nicParam) {
        var nic = nicParam.split(':');
        if (nic.length !== 5) {
          nicConfig.error = nicConfigFmtMsg;
          break;
        }

        var networkInterface = {
          iPConfigurations: [{}]
        };
        networkInterfaces.push(networkInterface);
        var arg = nic[0].trim();
        if (!arg) {
          nicConfig.error = nicConfigFmtMsg + ', the nicName part is required in a NIC definition';
          break;
        }

        networkInterface.name = arg;
        arg = nic[1].trim();
        if (!arg) {
          nicConfig.error = nicConfigFmtMsg + ', the subnetName part is required in a NIC definition';
          break;
        }

        networkInterface.iPConfigurations[0].subnetName = arg;
        arg = nic[2].trim();
        if (arg) {
          var parsedIp = vnetUtil.parseIPv4(arg);
          if (parsedIp.error) {
            nicConfig.error = nicConfigFmtMsg + ', ' + parsedIp.error;
            break;
          }

          networkInterface.iPConfigurations[0].staticVirtualNetworkIPAddress = arg;
        }

        arg = nic[3].trim();
        if (arg) {
          networkInterface.networkSecurityGroup = arg;
        }

        arg = nic[4].trim();
        if (arg) {
          try {
            networkInterface.iPForwarding = utils.verifyParamExistsInCollection(['Enabled', 'Disabled'], arg, 'ipForwarding');
          } catch (e) {
            nicConfig.error = nicConfigFmtMsg + ', ' + e.message;
            break;
          }
        }
      }
    }
  }

  return nicConfig;
}

module.exports = VMClient;
