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

function VMStorageProfile(cli, resourceGroupName, params, serviceClients) {
  this.cli = cli;
  this.storageManagementClient = serviceClients.storageManagementClient;
  this.resourceGroupName = resourceGroupName;

  this.params = params;
  this.prefix = params.prefix;
}

__.extend(VMStorageProfile.prototype, {
        generateStorageProfile: function(_) {
          var storageProfile = {
            profile: {},
            osDiskDataDiskImgInfo: null,
            storageAccountInfo: null
          };

          storageProfile.osDiskDataDiskImgInfo = this._parseOSDataDiskImageParams(this.params, _);
          var containerUri = null;
          if (storageProfile.osDiskDataDiskImgInfo.requireStorage) {
            this.cli.output.info(util.format($('The [OS, Data] Disk or image configuration requires storage account')));
            // TODO: Validation for container-name?
            this.params.storageAccountContainerName = this.params.storageAccountContainerName || 'vhds';
            storageProfile.storageAccountInfo = this._createStorageAccountIfRequired(_);
            if (storageProfile.storageAccountInfo.profile.storageAccount) {
              containerUri = storageProfile.storageAccountInfo.profile.storageAccount.primaryEndpoints.blob + this.params.storageAccountContainerName + '/';
            } else {
              containerUri = storageProfile.storageAccountInfo.profile.primaryEndpoints.blob + this.params.storageAccountContainerName + '/';
            }
          }

          if (storageProfile.osDiskDataDiskImgInfo.osDiskInfo && !storageProfile.osDiskDataDiskImgInfo.osDiskInfo.isVhdParamAUrl) {
            storageProfile.osDiskDataDiskImgInfo.osDiskInfo.profile.virtualHardDisk.uri = containerUri + storageProfile.osDiskDataDiskImgInfo.osDiskInfo.profile.virtualHardDisk.uri;
          }

          if (storageProfile.osDiskDataDiskImgInfo.osDiskInfo) {
            storageProfile.profile.oSDisk = storageProfile.osDiskDataDiskImgInfo.osDiskInfo.profile;
          }

          if (storageProfile.osDiskDataDiskImgInfo.dataDiskInfo && !storageProfile.osDiskDataDiskImgInfo.dataDiskInfo.isVhdParamAUrl) {
            storageProfile.osDiskDataDiskImgInfo.dataDiskInfo.profile.virtualHardDisk.uri = containerUri + storageProfile.osDiskDataDiskImgInfo.dataDiskInfo.profile.virtualHardDisk.uri;
          }

          if (storageProfile.osDiskDataDiskImgInfo.dataDiskInfo) {
            storageProfile.osDiskDataDiskImgInfo.dataDiskInfo.profile.lun = this._generateDataDiskLun();
            storageProfile.profile.dataDisks = [storageProfile.osDiskDataDiskImgInfo.dataDiskInfo.profile];
          }

          if (storageProfile.osDiskDataDiskImgInfo.imageInfo) {
            // using imageUrn
            storageProfile.profile.imageReference = storageProfile.osDiskDataDiskImgInfo.imageInfo.profile;
            storageProfile.profile.destinationVhdsContainer = containerUri;
          }

          return storageProfile;
        },

        generateDataDiskProfile: function(_) {
          var dataDiskInfo = this._parseDataDiskParams(this.params);
          if (this.params.lun) {
            var lun = utils.parseInt(this.params.lun);
            if (isNaN(lun)) {
              throw new Error($('lun must be an integer'));
            }
            dataDiskInfo.profile.lun = lun;
          } else {
            dataDiskInfo.profile.lun = this._generateDataDiskLun();
          }

          if (dataDiskInfo.isVhdParamAUrl) {
            return dataDiskInfo.profile;
          } else if (!this.params.newDataDisk) {
            throw new Error($('dataDiskVhd URL param should be a valid URL.'));
          }

          var containerUri = this._generateDataDiskContainerURI(_);
          dataDiskInfo.profile.virtualHardDisk.uri = containerUri + dataDiskInfo.profile.virtualHardDisk.uri;

          return dataDiskInfo.profile;
        },

        removeDataDiskByLun: function(virtualMachine, lun) {
          var dataDisks = virtualMachine.storageProfile.dataDisks;
          if (!dataDisks || dataDisks.length === 0) {
            throw new Error(util.format($('There are no data disks attached to virtual machine "%s"'), virtualMachine.name));
          }

          var dataDiskIndex = -1;
          for (var index = 0; index < dataDisks.length; index++) {
            if (dataDisks[index].lun !== lun) {
              continue;
            }

            dataDiskIndex = index;
            break;
          }

          if(dataDiskIndex === -1) {
            throw new Error(util.format($('There is no data disk with lun "%s" attached to virtual machine "%s"'), lun, virtualMachine.name));
          }

          dataDisks.splice(dataDiskIndex, 1);
        },

        hasAllOSDiskParams: function(params) {
          return utils.allParamsAreSet([params.osDiskType, params.osDiskVhd]);
        },

        _generateDataDiskLun: function() {
          var lunArray = [];
          for (var i = 0; i < this.params.dataDisks.length; i++) {
            var lun = this.params.dataDisks[i].lun ? parseInt(this.params.dataDisks[i].lun, 10) : 0;
            lunArray[lun] = true;
          }

          for (var j = 0; j < lunArray.length; j++) {
            if (!lunArray[j]) {
              return j;
            }
          }

          return lunArray.length;
        },

        _generateDataDiskContainerURI: function(_) {
          var containerUri;
          if (utils.allParamsAreSet([this.params.storageAccountName, this.params.storageAccountContainerName])) {
            var storageAccountInfo = this._createStorageAccountIfRequired(_);
            if (storageAccountInfo.profile.storageAccount) {
              containerUri = storageAccountInfo.profile.storageAccount.primaryEndpoints.blob + this.params.storageAccountContainerName + '/';
            } else {
              containerUri = storageAccountInfo.profile.primaryEndpoints.blob + this.params.storageAccountContainerName + '/';
            }
          } else {
             // Build our new data disk's container URI based on existing OS disk's container URI.
             if (utils.stringIsNullOrEmpty(this.params.osDiskUri)) {
               throw new Error($('params.osDiskUri is required when vhd-name and --storage-account-* parameters are not specified'));
             }

             containerUri = this.params.osDiskUri.slice(0, this.params.osDiskUri.lastIndexOf('/')) + '/';
          }

          return containerUri;
        },

        _parseOSDataDiskImageParams: function (params, _) {
            var osDiskDataDiskImageInfo = {
              osDiskInfo: null,
              dataDiskInfo: null,
              imageInfo: null,
              requireStorage: false
            };

            if (params.imageUrn){
              var imageUrnParts = params.imageUrn.split(':');
              if (imageUrnParts.length !== 4) {
                throw new Error($('--image-urn must be in the form "publisherName:offer:skus:version"'));
              }

              osDiskDataDiskImageInfo.imageInfo = {
                profile: {
                  publisher: imageUrnParts[0],
                  offer: imageUrnParts[1],
                  sku: imageUrnParts[2],
                  version: imageUrnParts[3]
                }
              };

              // Prepare the osDisk profile where CRP needs to store the copy of the image
              osDiskDataDiskImageInfo.osDiskInfo = this._parseOSDiskParams(params, 'FromImage', _);
              if (osDiskDataDiskImageInfo.osDiskInfo && !osDiskDataDiskImageInfo.osDiskInfo.isVhdParamAUrl) {
                osDiskDataDiskImageInfo.requireStorage = true;
              }
            } else {
              // Prepare the osDisk profile where CRP looks for disk containing the OS
              osDiskDataDiskImageInfo.osDiskInfo = this._parseOSDiskParams(params, 'Attach', _);
              if (osDiskDataDiskImageInfo.osDiskInfo && !osDiskDataDiskImageInfo.osDiskInfo.isVhdParamAUrl) {
                osDiskDataDiskImageInfo.requireStorage = true;
              }
            }

            if (osDiskDataDiskImageInfo.imageInfo === null && osDiskDataDiskImageInfo.osDiskInfo === null) {
              throw new Error($('Either imageUrn or os-disk-vhd parameter is required to create VM'));
            }

            osDiskDataDiskImageInfo.dataDiskInfo = this._parseDataDiskParams(params);
            if (osDiskDataDiskImageInfo.dataDiskInfo && !osDiskDataDiskImageInfo.dataDiskInfo.isVhdParamAUrl) {
              osDiskDataDiskImageInfo.requireStorage = true;
            }

            // Logic to validate ImageReference, if present then osDiskInfo args not allowed
            return osDiskDataDiskImageInfo;
        },

        _parseOSDiskParams: function(params, createOption, _) {
          if (createOption !== 'Attach' && createOption !== 'FromImage') {
            throw new Error(util.format($('invalid createOption "%s""'), createOption));
          }

          var attachMode = createOption === 'Attach';
          var osType = null;
          if (attachMode) {
            var useOsDisk = utils.atLeastOneParameIsSet([params.osDiskType, params.osDiskCaching, params.osDiskVhd]);
            if (!useOsDisk) {
              return null;
            }

            if (utils.stringIsNullOrEmpty(params.osDiskType)) {
              params.osDiskType = this.cli.interaction.prompt($('Enter OS disk type: '), _);
            }

            osType = utils.verifyParamExistsInCollection(['Windows', 'Linux'], this.params.osDiskType, 'osDiskType');
            if (utils.stringIsNullOrEmpty(params.osDiskVhd)) {
              params.osDiskVhd = this.cli.interaction.prompt($('Enter OS disk VHD: '), _);
            }
          }

           var osDiskInfo = {
             profile: {
               createOption: createOption,
               operatingSystemType: osType,
               name: null,
               caching: null,
               virtualHardDisk: {
                 uri: null
               }
             },
             isVhdParamAUrl: false
           };


           osDiskInfo.profile.name = this._generateOSDiskName(_);
           var supportedDiskCaching = ['None', 'ReadOnly', 'ReadWrite'];
           if (!utils.stringIsNullOrEmpty(params.osDiskCaching)) {
             osDiskInfo.profile.caching  = utils.verifyParamExistsInCollection(supportedDiskCaching, params.osDiskCaching, 'osDiskCaching');
           } else {
            osDiskInfo.profile.caching = supportedDiskCaching[2];
           }

           if (!attachMode && utils.stringIsNullOrEmpty(params.osDiskVhd)) {
               params.osDiskVhd = osDiskInfo.profile.name + '.vhd';
           }

           // The osDiskVhd can be a full url to a vhd or just vhd name
           if (params.osDiskVhd.match(/^((http|https):\/\/)/)) {
             osDiskInfo.parsedOsDiskVhd = this._parseBlobUrl(params.osDiskVhd, 'osDiskVhd');
             osDiskInfo.isVhdParamAUrl = true;
           }

           // Uri can be name or a URL, if name then this will be replaced with full URL later.
           osDiskInfo.profile.virtualHardDisk.uri = params.osDiskVhd;
           return osDiskInfo;
       },

        _parseDataDiskParams: function(params) {
          var useDataDisk = utils.atLeastOneParameIsSet([params.dataDiskSize, params.dataDiskCaching, params.dataDiskVhd]);
          if(!useDataDisk) {
            return null;
          }

          var dataDiskInfo = {
            profile: {
              name: null,
              diskSizeGB: null,
              caching: null,
              createOption: null,
              virtualHardDisk: {
                uri: null
              }
            },
            isVhdParamAUrl: false
          };

          if (params.newDataDisk) {
            dataDiskInfo.profile.createOption = 'empty';
            var sizeAsInt = utils.parseInt(params.dataDiskSize);
            if (isNaN(sizeAsInt) || sizeAsInt === 0) {
              throw new Error($('dataDiskSize is required when any one of the dataDisk configuration parameter is specified and must be an integer'));
            }
            dataDiskInfo.profile.diskSizeGB = sizeAsInt;
          } else {
            dataDiskInfo.profile.createOption = 'attach';
          }

          var supportedDiskCaching = ['None', 'ReadOnly', 'ReadWrite'];
          if (!utils.stringIsNullOrEmpty(params.dataDiskCaching)) {
            dataDiskInfo.profile.caching = utils.verifyParamExistsInCollection(supportedDiskCaching, params.dataDiskCaching, 'dataDiskCaching');
          } else {
            dataDiskInfo.profile.caching = supportedDiskCaching[2];
          }

          if (utils.stringIsNullOrEmpty(params.dataDiskVhd)) {
            dataDiskInfo.profile.name = this._generateDataDiskName(params.vmName);
            dataDiskInfo.profile.virtualHardDisk.uri = dataDiskInfo.profile.name + '.vhd';
          } else {
            // The dataDiskVhd can be a full url to a vhd or just vhd name
            // Uri can be name or a URL, if name then this will be replaced with full URL later.
            if (params.dataDiskVhd.match(/^((http|https):\/\/)/)) {
              var vhdUrl = this._parseBlobUrl(params.dataDiskVhd, 'dataDiskVhd');
              dataDiskInfo.profile.name = vhdUrl.blobName.substr(0, vhdUrl.blobName.length - 4);
              dataDiskInfo.profile.virtualHardDisk.uri = params.dataDiskVhd;
              dataDiskInfo.isVhdParamAUrl = true;
            } else {
              if (utils.stringEndsWith(params.dataDiskVhd, '.vhd', true)) {
                dataDiskInfo.profile.name = params.dataDiskVhd.substr(0, params.dataDiskVhd.length - 4);
              } else {
                dataDiskInfo.profile.name = params.dataDiskVhd;
                params.dataDiskVhd = params.dataDiskVhd + '.vhd';
              }
              dataDiskInfo.profile.virtualHardDisk.uri = params.dataDiskVhd;
            }
          }

          return dataDiskInfo;
        },

        _parseStorageCreateParams: function (params, _) {
          if (!utils.allParamsAreSet([params.storageAccountName, params.location])) {
            params.storageAccountName = this.cli.interaction.prompt($('Enter storage account name: '), _);
            params.location = this.cli.interaction.prompt($('Enter location: '), _);
          }

          var createRequestProfile = {
            accountType: 'Standard_LRS',
            name: params.storageAccountName,
            location: params.location
          };

          return createRequestProfile;
        },

        _createStorageAccountIfRequired: function (_) {
          var storageInfo = {
            storageAccountName: null,
            createdNew: false,
            profile: null,
            createRequestProfile: null
          };

          if (utils.stringIsNullOrEmpty(this.params.location)) {
            this.params.location = this.cli.interaction.prompt($('Enter location: '), _);
          }

          if (!utils.stringIsNullOrEmpty(this.params.storageAccountName)) {
            storageInfo.storageAccountName = this.params.storageAccountName;
            var existingStorageAccount = this._findStorageAccount(storageInfo.storageAccountName, _);
            if (existingStorageAccount) {
              storageInfo.profile = existingStorageAccount.storageAccount;
              if (!utils.ignoreCaseAndSpaceEquals(storageInfo.profile.location, this.params.location)) {
                throw new Error(util.format($('A storage account with name "%s" already exists in another region "%s"'), this.params.storageAccountName, storageInfo.profile.location));
              }
            } else {
              this.cli.output.info(util.format($('Could not find the storage account "%s", trying to create new one'), this.params.storageAccountName));
              storageInfo.createRequestProfile = this. _createNewStorageAccount(storageInfo.storageAccountName, this.params, _);
              storageInfo.profile = this._findStorageAccount(storageInfo.storageAccountName, _);
              storageInfo.createdNew = true;
            }
          } else {
            var defaultStorageAccount = this._getFirstStorageAccount(this.resourceGroupName, this.params.location, _);
            if (defaultStorageAccount) {
              storageInfo.profile = defaultStorageAccount.storageAccount;
              storageInfo.storageAccountName = storageInfo.profile.name;
              this.cli.output.info(util.format($('Using the storage account "%s" in "%s"'), storageInfo.storageAccountName, this.params.location));
            } else {
              this.cli.output.info(util.format($('Could not find any storage accounts in the region "%s", trying to create new one'), this.params.location));
              storageInfo.storageAccountName = this._generateNewStorageAccountName(_);
              this.params.storageAccountName = storageInfo.storageAccountName;
              storageInfo.createRequestProfile = this. _createNewStorageAccount(storageInfo.storageAccountName, this.params, _);
              // Retrieve the profile of just created storage account
              storageInfo.profile = this._findStorageAccount(storageInfo.storageAccountName, _);
              storageInfo.createdNew = true;
            }
          }

          return storageInfo;
        },

        _isStorageAccountNameAvailable: function (params, _) {
          var progress = this.cli.interaction.progress(util.format($('Checking storage account name "%s" is available'), params.storageAccountName));
          try {
            var result = this.storageManagementClient.storageAccounts.checkNameAvailability(params.storageAccountName, _);
            // TODO: Right now API endpoint for availability check is broken
            return result.nameAvailable;
          } finally {
            progress.end();
          }
        },

        _createNewStorageAccount: function (resourceGroupName, params, _) {
          var createRequestProfile = this._parseStorageCreateParams(params, _);
          var progress = this.cli.interaction.progress(util.format($('Creating storage account "%s" in "%s"'), params.storageAccountName, params.location));
          try {
            this.storageManagementClient.storageAccounts.create(this.resourceGroupName, params.storageAccountName, createRequestProfile, _);
            return createRequestProfile;
          } finally {
            progress.end();
          }
        },

        _getFirstStorageAccount: function (resourceGroup, location, _) {
          var progress = this.cli.interaction.progress($('Retrieving storage accounts'));
          try {
            var listStorageAccountResult = this.storageManagementClient.storageAccounts.list(_);
            var storageAccounts = (listStorageAccountResult && listStorageAccountResult.storageAccounts instanceof Array) ?
                listStorageAccountResult.storageAccounts : [];

            for (var i = 0; i < storageAccounts.length; i++) {
              var storageResourceGroup = utils.parseResourceReferenceUri(storageAccounts[i].id).resourceGroupName;
              if (utils.ignoreCaseAndSpaceEquals(storageAccounts[i].location, location) &&
                  utils.ignoreCaseAndSpaceEquals(storageResourceGroup, resourceGroup)) {
                return {
                  storageAccount: storageAccounts[i]
                };
              }
            }

            return null;
          } finally {
              progress.end();
          }
        },

        _findStorageAccount: function (storageAccountName, _) {
          var progress = this.cli.interaction.progress(util.format($('Looking up the storage account %s'), storageAccountName));
          try {
              var storageAccount = this.storageManagementClient.storageAccounts.getProperties(this.resourceGroupName, storageAccountName, _);
              return storageAccount;
          } catch (e) {
            if (e.code === 'ResourceNotFound' || e.code === 'StorageAccountNotFound') {
              return null;
            }
            throw e;
          } finally {
            progress.end();
          }
        },

        _getPrefix: function (_) {
          if (utils.stringIsNullOrEmpty(this.prefix)) {
            this.prefix = 'cli' + (require('crypto').randomBytes(8, _).toString('hex'));
          }

          return this.prefix;
        },

        _generateNewStorageAccountName: function (_) {
          return this._normalizeString(this._getPrefix(_) + (new Date()).getTime().toString());
        },

        _generateOSDiskName: function (_) {
          return this._normalizeString(this._getPrefix(_)) + '-os-' + (new Date()).getTime().toString();
        },

        // Build data disk name the same way it is done in Azure Portal.
        // Result will look like this: vmName-YYYYMMDD-HHmmsssss
        _generateDataDiskName: function (vmName) {
          var currentDateTime = this._getCurrentDateTime();
          return vmName + '-' + currentDateTime.date + '-' + currentDateTime.time;
        },

        // Date format: YYYYMMDD, time format: HHmmsssss
        _getCurrentDateTime: function () {
           var newDate = new Date();
           var currentDate = newDate.getFullYear() +''+ (((newDate.getMonth()+1) < 10)?'0':'') +''+ (newDate.getMonth()+1) + ((newDate.getDate() < 10)?'0':'') + newDate.getDate();
           var currentTime = ((newDate.getHours() < 10)?'0':'') + newDate.getHours() +''+ ((newDate.getMinutes() < 10)?'0':'') + newDate.getMinutes() +''+ ((newDate.getSeconds() < 10)?'0':'') + newDate.getSeconds() +''+ newDate.getMilliseconds();
           return {
             date: currentDate,
             time: currentTime
           };
        },

        _normalizeString: function (str) {
          return str.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 24).toLowerCase();
        },

        _parseBlobUrl: function (blobUrl, paramName) {
          var result = {};

          if (utils.stringIsNullOrEmpty(blobUrl)) {
            throw new Exception (util.format($('%s cannot be null'), paramName));
          }

          var protocolSplit = blobUrl.split('://');
          if (protocolSplit.length != 2 || (protocolSplit[0] !== 'http' && protocolSplit[0] !== 'https')) {
            throw new Error (util.format($('Invalid %s, url must contain protocol part and it must be either http or https'), paramName));
          }

          result.protocol = protocolSplit[0];

          var urlWithoutProtocol = protocolSplit.slice(-1)[0];
          var urlPartsSplit = urlWithoutProtocol.split('/');
            // host, container, path-to-blob
          if (urlPartsSplit.length < 3) {
            throw new Error (util.format($('Invalid %s, the url must contain container name and blob name'), paramName));
          }

          var hostSplit = urlPartsSplit[0].split('.');
          // Validate storage account name
          if (/^([a-z0-9]){3,24}$/.test(hostSplit[0]) === false) {
            throw new Error (util.format($('Invalid %s, the storage account name %s is invalid'), paramName, hostSplit[0]));
          }

          result.storageAccountName = hostSplit[0];

          // Validate container name
          if (/^[a-z0-9](?!.*([-])\1)[a-z0-9\-]+[a-z0-9]$/.test(urlPartsSplit[1]) === false) {
            throw new Error (util.format($('Invalid %s, the container name %s is invalid'), paramName, urlPartsSplit[1]));
          }

          result.containerName = urlPartsSplit[1];

          for (var i = 2; i < urlPartsSplit.length; i++) {
              var p = urlPartsSplit[i].replace(/\s+/g, '');
              if (p === '') {
                throw new Error (util.format($('Invalid %s, the blob name part is invalid'), paramName));
              }
          }

          result.blobName = urlPartsSplit.slice(2).join('/');

          return result;
        }
    }
);

module.exports = VMStorageProfile;