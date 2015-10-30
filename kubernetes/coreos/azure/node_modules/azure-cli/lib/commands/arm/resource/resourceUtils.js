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

exports.getProviderName = function (resourceType) {
  var firstIndex = resourceType.indexOf('/');
  var providerName;
  if (firstIndex !== -1) {
    providerName = resourceType.substr(0, firstIndex);
  }
  return providerName;
};

exports.getResourceTypeName = function (resourceType) {
  var lastIndex = resourceType.lastIndexOf('/');
  var resourceTypeName;
  if (lastIndex !== -1) {
    resourceTypeName = resourceType.substr(lastIndex + 1);
  }
  return resourceTypeName;
};

exports.getResourceInformation = function (resourceIDFromServer) {
  function removeEmptyElement(existing) {
    var newArray = [];
    for (var i = 0; i < existing.length; i++) {
      if (existing[i]) {
        newArray.push(existing[i]);
      }
    }
    return newArray;
  }
  
  if (!resourceIDFromServer) {
    return {};
  }
  
  var tokens = resourceIDFromServer.split('/');
  tokens = removeEmptyElement(tokens);
  if (tokens.length < 8) {
    throw new Error('invalid resource id from server');
  }
  var resourceGroupName = tokens[3];
  var resourceName = tokens[tokens.length - 1];
  
  var resourceTypeBuilder = [];
  resourceTypeBuilder.push(tokens[5]);
  
  // Extract out the 'parent resource' and 'full resource type'
  // for id like: subscriptions/abc123/resourceGroups/group1/providers/Microsoft.Test/servers/r12345sql/db/r45678db,
  // we will extract out parent resource: 'servers/r12345sql'.
  // from id like: subscriptions/abc123/resourceGroups/group1/providers/Microsoft.Test/db/r45678db,
  // parent resource does not exist.
  var parentResourceBuilder = [];
  for (var i = 6; i <= tokens.length - 3; i++) {
    parentResourceBuilder.push(tokens[i]);
    //from 'resourceType/resourcName/<same pattern...>', skip the "resourceName" and keep the type
    if (i % 2 === 0) {
      resourceTypeBuilder.push(tokens[i]);
    }
  }
  resourceTypeBuilder.push(tokens[tokens.length - 2]);
  
  var parentResource;
  if (parentResourceBuilder.length > 0) {
    parentResource = parentResourceBuilder.join('/');
  }
  
  var resourceType;
  if (resourceTypeBuilder.length > 0) {
    resourceType = resourceTypeBuilder.join('/');
  }
  
  return {
    'resourceName': resourceName,
    'resourceGroup' : resourceGroupName,
    'resourceType' : resourceType,
    'parentResource' : parentResource
  };
};

