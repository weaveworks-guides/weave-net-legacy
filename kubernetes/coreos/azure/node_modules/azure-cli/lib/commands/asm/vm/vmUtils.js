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
var async = require('async');
var _ = require('underscore');

exports.getImageInfo = function(computeManagementClient, name, callback) {
  async.parallel({
    vmImage: function(callback) {
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

    osImage: function(callback) {
      // show OS Image
      computeManagementClient.virtualMachineOSImages.get(name, function(error, response) {
        var theImage = null;
        if (!error) {
          theImage = response;
        } else {
          // if this is a ResourceNotFound error then we continue execution
          if (error.code === 'ResourceNotFound') {
            error = null;
          }
        }
        callback(error, theImage);
      });
    }
  }, function(error, results) {
    callback(error, results);
  });
};