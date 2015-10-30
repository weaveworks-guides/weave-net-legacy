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
/**
 * Common code to work OS or Disk image that implements vm disk * and vm image* commands
 */
var path = require('path');
var util = require('util');
var async = require('async');
var _ = require('underscore');

var utils = require('../../../util/utils');
var blobUtils = require('../../../util/blobUtils');
var deleteImage = require('./deleteImage');
var uploadVMImage = require('./upload/uploadVMImage');
var $ = utils.getLocaleString;
var profile = require('../../../util/profile');

var DISK = exports.DISK = 0;
/*jshint unused:false*/
var OSIMAGE = exports.OSIMAGE = 1;

var whatAPI = ['Disk', 'OSImage'];
var whatLog = ['disk image', 'VM image'];
var whatLogs = ['disk images', 'VM images'];

var VMClient = require('../vm/vmclient');

exports.show = function(what, cli) {
  return function(name, options, callback) {
    var computeManagementClient = createComputeManagementClient(cli, options);
    var logger = cli.output;

    var progress = cli.interaction.progress('Fetching ' + whatLog[what]);

    if (what === DISK) {
      // show Data Disk
      computeManagementClient.virtualMachineDisks.getDisk(name, function(error, response) {
        progress.end();
        if (!error) {
          delete response['@']; // skip @ xmlns and @ xmlns:i
          delete response['requestId']; // skip requestId
          delete response['statusCode']; // statusCode

          if (logger.format().json) {
            logger.json(response);
          } else {
            utils.logLineFormat(response, logger.data);
          }
        }
        return callback(error);
      });
    } else {
      // This approach has been inspired from what's being done in the "Get-AzureVMImage -ImageName"
      // Azure PowerShell command. See: http://git.io/03o3ag
      var lookupError = null;
      async.parallel([

        function(callback) {
          computeManagementClient.virtualMachineVMImages.list(function(error, response) {
            var theImage = null;
            if (!error) {
              theImage = _.find(response.vMImages, function(img) {
                return name.toUpperCase() === img.name.toUpperCase();
              });
            }
            callback(error, theImage);
          });
        },

        function(callback) {
          // show OS Image
          computeManagementClient.virtualMachineOSImages.get(name, function(error, response) {
            var theImage = null;
            if (!error) {
              theImage = response;
            } else {
              // if this is a ResourceNotFound error then we save the error
              // info in "lookupError" and continue execution
              if (error.code === 'ResourceNotFound') {
                lookupError = error;
                error = null;
              }
            }
            callback(error, theImage);
          });
        }
      ], function(error, results) {
        progress.end();

        if (!error) {
          // we expect "results" to be an array with 2 elements; if both are
          // undefined then the image name supplied is invalid
          if (results.length !== 2 || (!results[0] && !results[1])) {
            error = lookupError;
          }
        }

        if (!error) {
          results.filter(function(theImage) {
            return !!theImage;
          }).forEach(function(theImage) {
            if (theImage['location']) {
              theImage['location'] = theImage['location'].split(';');
            }
            delete theImage['@']; // skip @ xmlns and @ xmlns:i
            delete theImage['requestId']; // skip requestId
            delete theImage['statusCode']; // statusCode

            if (logger.format().json) {
              logger.json(theImage);
            } else {
              utils.logLineFormat(theImage, logger.data);
            }
          });
        }
        return callback(error);
      });
    }
  };
};

exports.list = function(what, cli) {
  function list(name, options, callback) {
    var logger = cli.output;
    var computeManagementClient = createComputeManagementClient(cli, options);
    var progress = cli.interaction.progress('Fetching ' + whatLogs[what]);
    var images = [];

    if (what === DISK) {
      if (name || options.dnsName) {
        // list data disks for a specific VM name and/or dns name
        listDisks(cli, {
          subscription: options.subscription,
          name: name,
          dnsPrefix: utils.getDnsPrefix(options.dnsName, true)
        }, callback);
        return;
      } else {
        // list all Data Disks
        computeManagementClient.virtualMachineDisks.listDisks(function(error, response) {
          progress.end();
          if (!error) {
            if (response.disks.length > 0) {
              logger.table(response.disks, function(row, item) {
                row.cell('Name', item.name);
                if (what === DISK) {
                  row.cell('OS', item.operatingSystemType || '');
                } else {
                  if (item.category) {
                    row.cell('Category', item.category);
                  }
                  row.cell('OS', item.operatingSystemType || '');
                }
              });
            } else {
              if (logger.format().json) {
                logger.json([]);
              } else {
                logger.info('No ' + whatLogs[what] + ' found');
              }
            }
          }
          callback(error);
        });
      }
    } else {
      // list all Images
      async.parallel([

        function(callback) {
          computeManagementClient.virtualMachineOSImages.list(function(error, response) {
            callback(error, (error) ? null : response.images);
          });
        },
        function(callback) {
          computeManagementClient.virtualMachineVMImages.list(function(error, response) {
            callback(error, (error) ? null : response.vMImages);
          });
        }
      ], function(error, results) {
        if (!error) {
          progress.end();

          // splice all images into "images"
          results.forEach(function(result) {
            images = images.concat(result);
          });

          if (images.length > 0) {
            logger.table(images, function(row, item) {
              row.cell('Name', item.name);
              if (what === DISK) {
                row.cell('OS', item.operatingSystemType || '');
              } else {
                if (item.category) {
                  row.cell('Category', item.category);
                }
                row.cell('OS', item.operatingSystemType || item.oSDiskConfiguration.operatingSystem);
                row.cell('Publisher', item.publisherName);
              }
            });
          } else {
            if (logger.format().json) {
              logger.json([]);
            } else {
              logger.info('No ' + whatLogs[what] + ' found');
            }
          }
        }

        callback(error);
      });
    }
  }
  // return 2 or 3-arg version of the function
  return what === DISK ? list : function(options, callback) {
    return list(undefined, options, callback);
  };
};

exports.delete = function(what, cli) {
  return function(diskName, deleteOptions, callback) {
    var computeManagementClient = createComputeManagementClient(cli, deleteOptions);
    var storageClient = createStorageClient(cli, deleteOptions);
    var logger = cli.output;
    deleteImage.deleteImage(whatAPI[what], ['Disk', 'Image'][what], logger, computeManagementClient, storageClient, diskName, deleteOptions, cli.interaction.progress, callback);
  };
};

exports.create = function(what, cli) {
  return function(name, sourcePath, options, callback) {
    var computeManagementClient = createComputeManagementClient(cli, options);
    var managementClient = createManagementClient(cli, options);
    var storageClient = createStorageClient(cli, options);
    var logger = cli.output;
    var os = (undefined);
    if (typeof options.os === 'string') {
      var los = options.os.trim().toLowerCase();
      os = los[0].toUpperCase() + los.slice(1); // start with capital letter
    }

    if (os && os !== 'Windows' && os !== 'Linux' && os !== 'None') {
      callback('--os [type] must specify linux, windows or none');
    }

    if (what === DISK) {
      // @"^[a-zA-Z_][^\\\/\:\*\?\""\<\>\|\`\'\^%\#]*(?<![\.\s])$" in C# syntax
      if (!name.match(/^[a-zA-Z_][^\\\/\:\*\?\"<\>\|\`\'\^%\#]*$/) || name.slice(-1).match(/[\.\s]/)) {
        callback('Invalid image name. Disk image name should start with a Latin letter or underscore (_), cannot contain any of the following characters:\n\\/:*?\"<>|`\'%#^\nIt cannot end with a period (.) or space character.');
      }
    } else {
      if (os !== 'Windows' && os !== 'Linux') {
        callback('--os <type> must specify linux or windows');
      }
      // @"^[A-Za-z0-9\-\.]{1,512}(?<!\-)$" in C# syntax
      if (!name.match(/^[A-Za-z0-9\-\.]{0,511}[A-Za-z0-9\.]$/)) {
        callback('Invalid image name. OS image name can only contain Latin letters, digits, \'.\' and \'-\'. It cannot end with \'-\' or be longer than 512 chars.');
      }
    }

    var genBlobUrl = '';
    var force = options.forceOverwrite;
    var blobUrl = options.blobUrl;
    var location = options.location;
    var affinityGroup = options.affinityGroup;

    if (sourcePath) {
      if (!blobUrl && !location && !affinityGroup) {
        logger.error('--blob-url, --location, or --affinity-group must be specified');
        logger.help('following commands show available locations and affinity groups:');
        logger.help('    azure vm location list');
        logger.help('    azure account affinity-group list');
        callback(' ');
      }
    } else {
      // When source-path is not specified, the user is attempting to register an
      // already uploaded disk or OS blob.  In that case we need the blob-url.
      if (!blobUrl) {
        callback('--blob-url must be specified if sourcePath is not specified');
      }
    }

    if (blobUrl) {
      if (blobUrl[0] === '/') {
        // With partial urls, we need to know location/affinity group of the storage account.
        if (!location && !affinityGroup) {
          logger.error('location or affinity group is required if no full URL is specified');
          logger.help('following commands show available locations and affinity groups:');
          logger.help('    azure vm location list');
          logger.help('    azure account affinity-group list');
          callback('--location, or --affinity-group must be specified');
        }
      } else {
        if (location) {
          logger.warn('--location option will be ignored');
        }

        if (affinityGroup) {
          logger.warn('--affinity-group option will be ignored');
        }
      }
    }

    var parameters = {
      imageOptions: {
        name: name,
        label: options.label || name,
        isPremium: false,
        operatingSystemType: '',
        showInGui: true
      },
      verbose: cli.verbose ||
        logger.format().level === 'verbose' ||
        logger.format().level === 'silly',
      skipMd5: options.md5Skip,
      force: force,
      vhd: true,
      threads: options.parallel,
      parentBlob: options.baseVhd,
      exitWithError: callback,
      logger: logger
    };

    if (options.os) {
      var hasOS = os !== 'None';
      parameters.imageOptions.hasOperatingSystem = hasOS;
      if (hasOS && os) {
        parameters.imageOptions.operatingSystemType = os;
      }
    }

    logger.silly('Options: ', parameters.imageOptions);

    if (location) {
      logger.verbose('Resolving the location \'' + location + '\'');
      utils.resolveLocationName(managementClient, location, function(error, resolvedLocation) {
        if (!error) {
          location = resolvedLocation.name;
          logger.verbose('Location resolved to \'' + location + '\'');
          getBlobNameAndUpload();
        } else {
          callback(error);
        }
      });
    } else {
      getBlobNameAndUpload();
    }

    function getBlobNameAndUpload() {
      blobUtils.getBlobName(cli, storageClient, location, affinityGroup,
        path.basename(sourcePath), blobUrl, ['/disks/', '/vm-images/'][what],
        sourcePath, '', function(error, url) {
          if (error) {
            logger.error('Unable to retrieve storage account.');
            callback(error);
          } else {
            genBlobUrl = url;
            logger.verbose('Blob url: ' + genBlobUrl);
            upload();
          }
        });
    }

    function upload() {
      // uploading
      if (sourcePath) {
        if (/^https?\:\/\//i.test(sourcePath)) {
          logger.verbose('Copying blob from ' + sourcePath + ' to ' + genBlobUrl);
          if (options.md5Skip || options.parallel !== 96 || options.baseVhd) {
            logger.warn('--md5-skip, --parallel and/or --base-vhd options will be ignored');
          }
          if (!options.forceOverwrite) {
            logger.warn('Any existing blob will be overwritten' + (blobUrl ? ' at ' + blobUrl : ''));
          }
          var progress = cli.interaction.progress('');
          uploadVMImage.copyBlobFromIaasClient(storageClient, sourcePath, options.sourceKey, genBlobUrl,
            parameters, function(error, blob, response, newDestUri) {
              progress.end();
              logger.silly(util.inspect(response, null, null, true));
              if (!error) {
                var status = blob.copyStatus;
                (status === 'success' ? logger.silly : logger.warn)('Status : ' + status);
                createImage(newDestUri);
              } else {
                logger.error('Couldn\'t copy blob ' + sourcePath + ' to ' + newDestUri);
                callback(error);
              }
            });
          return;
        }

        uploadVMImage.uploadPageBlobFromIaasClient(genBlobUrl, storageClient, sourcePath,
          parameters, function(error, finalBlobUrl, alreadyExisted) {
            if (error && !error.isSuccessful) {
              // do not delete incomplete blob
              logger.error('Couldn\'t upload blob ' + genBlobUrl);
              callback(error);
            }
            if (!error) { // final callback
              logger.info(finalBlobUrl + (alreadyExisted ? ' was already uploaded' : ' was uploaded successfully'));
              createImage(finalBlobUrl);
            }
          });
      } else {
        // not uploading
        createImage();
      }
    }

    function createImage(finalBlobUrl) {
      finalBlobUrl = finalBlobUrl || genBlobUrl;
      var normUrl = blobUtils.normalizeBlobUri(finalBlobUrl, true);
      if (normUrl !== genBlobUrl) {
        logger.verbose('Creating image from ' + normUrl);
      }

      parameters.imageOptions.mediaLinkUri = normUrl; // example: http://example.blob.core.windows.net/disks/mydisk.vhd

      if (what === DISK) {
        computeManagementClient.virtualMachineDisks.createDisk(parameters.imageOptions, function(error) {
          callback(error);
        });
      } else {
        computeManagementClient.virtualMachineOSImages.create(parameters.imageOptions, function(error) {
          callback(error);
        });
      }

    }
  };
};

function listDisks(cli, options, callback) {
  var logger = cli.output;
  var computeManagementClient = createComputeManagementClient(cli, options);

  var vmClient = new VMClient(cli, profile.current.getSubscription(options.subscription).Id);

  vmClient.getDeployments(options, function(error, deployments) {
    if (error) {
      return callback(error);
    } else {
      var found = null;
      var foundDisks = null;

      for (var i = 0; i < deployments.length; i++) {
        var roles = deployments[i].deploy.roles;
        if (roles) {
          for (var j = 0; j < roles.length; j++) {
            if (roles[j].roleType === 'PersistentVMRole' &&
              (!options.name || roles[j].roleName === options.name)) {
              if (found) {
                // found duplicates, emit error
                callback(new Error($('VM name is not unique')));
              }
              found = deployments[i];
              foundDisks = [roles[j].oSVirtualHardDisk];
              if (roles[j].dataVirtualHardDisks) {
                foundDisks = foundDisks.concat(roles[j].dataVirtualHardDisks);
              }
            }
          }
        }
      }

      // got unique role under a deployment and service, list the disks
      if (found) {
        var osDiskName = foundDisks[0].name;
        logger.verbose('Getting info for OS disk ' + osDiskName);

        var progress = cli.interaction.progress($('Getting VM disks'));
        computeManagementClient.virtualMachineDisks.getDisk(osDiskName, function(error, response) {
          progress.end();
          foundDisks[0].logicalDiskSizeInGB = error ? 'Error' : response.logicalSizeInGB;

          logger.table(foundDisks, function(row, item) {
            row.cell('Lun', (item === foundDisks[0]) ? '' : (item.logicalUnitNumber || 0));
            row.cell('Size(GB)', item.logicalDiskSizeInGB);
            var mediaLink = item.mediaLink.split('/');
            row.cell('Blob-Name', mediaLink[mediaLink.length - 1]);
            row.cell('OS', item.operatingSystem || '');
          });

          callback(error);
        });

      } else {
        logger.warn($('No VMs found'));
        callback();
      }
    }
  });
}

function createComputeManagementClient(cli, options) {
  return utils.createComputeClient(profile.current.getSubscription(options.subscription));
}

function createManagementClient(cli, options) {
  return utils.createManagementClient(profile.current.getSubscription(options.subscription));
}

function createStorageClient(cli, options) {
  return utils.createStorageClient(profile.current.getSubscription(options.subscription));
}