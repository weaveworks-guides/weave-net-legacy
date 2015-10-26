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

var __ = require('underscore');
var utils = require('../../../util/utils');
var utilsCore = require('../../../util/utilsCore');
var permissionsUtils = require('./permissionsUtils');
var util = require('util');
var fs = require('fs');
var rbacConstants = require('./rbacConstants');

var $ = utils.getLocaleString;

function validateRole(role) {
  if (__.isEmpty(role.name)) {
   throw new Error($('RoleDefinition Name is invalid'));
 }

  if (__.isEmpty(role.assignableScopes)) {
    throw new Error($('RoleDefinition AssignableScopes is invalid'));
  }

  if (__.isEmpty(role.actions)) {
    throw new Error($('RoleDefinition Actions is invalid'));
  }
}

function toCamelCase(obj) {
  var key, destKey, value;
  var camelCasedObj = {};
  if (obj && typeof obj === 'object')
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      destKey = (key.charAt(0).toLowerCase() + key.substring(1)).toString();
      value = obj[key];
      camelCasedObj[destKey] = value;
    }
  }

  return camelCasedObj;
}

exports.showRoleDefinition = function (role, log, hideDetails) {
  log.data($('Name             :'), role.properties.roleName);
  if (!hideDetails) {
    log.data($('Id               :'), role.id);
    log.data($('Description      :'), role.properties.description);
    log.data($('AssignableScopes :'), role.properties.assignableScopes);
  }
  var permissionDetails = permissionsUtils.getPermissionDetails(role.properties.permissions);
  log.data($('Actions          :'), permissionDetails.actions);
  log.data($('NotActions       :'), permissionDetails.notActions);
  log.data($('IsCustom         :'), utilsCore.ignoreCaseEquals(role.properties.type, rbacConstants.CUSTOM_ROLE_TYPE) ? 'true' : 'false');
  log.data('');
};

exports.getRoleToCreateOrUpdate = function(inputfile, roledefinition) {
  var roleToCreateOrUpdate;
  if (inputfile) {
    var exists = fs.existsSync(inputfile);

    if (exists) {
      var filecontent = fs.readFileSync(inputfile);
      try {
        roleToCreateOrUpdate = JSON.parse(filecontent);
      } catch (e) {
        throw new Error($('Deserializing the input role definition failed'));
      }
    } else {
      // exists = false
      throw new Error(util.format($('File %s does not exist'), inputfile));
    }
  } else {
    // no inputfile, JSON string provided
    try {
      roleToCreateOrUpdate = JSON.parse(roledefinition);
    } catch (e) {
      throw new Error($('Deserializing the input role definition failed'));
    }
  }

  return toCamelCase(roleToCreateOrUpdate);
};

exports.validateAndConstructCreateParameters = function (cli, role) {
  cli.output.info($('Validating role definition'));

  // Attempts to convert property names to camelCase by lower-casing the first letter of the property
  // i.e. If user specifies "AssignableScopes" or "assignableScopes" as property-name this will work,
  // but not if "assignablescopes" is specified
  var newRole = toCamelCase(role);

  validateRole(newRole);

  var newRoleDefinitionNameGuid = utils.uuidGen();

  var roleProperties = {
    assignableScopes: newRole.assignableScopes,
    description: newRole.description,
    permissions: [
      {
        actions: newRole.actions,
        notActions: newRole.notActions
      }
    ],
    roleName: newRole.name,
    type: rbacConstants.CUSTOM_ROLE_TYPE
  };

  var parameters = {
    roleDefinition: {
      name: newRoleDefinitionNameGuid,
      properties: roleProperties
    }
  };

  return parameters;
};

exports.constructRoleDefinitionUpdateParameters = function (cli, inputrole, roleFromService) {
  // Attempts to convert property names of the (user) input role to camelCase by lower-casing the first letter of the property
  // i.e. If user specifies "AssignableScopes" or "assignableScopes" as property-name this will work, but not if "assignablescopes" is specified
  // roleFromService will already have properties camelcased.
  var inputRoleCamelcased = toCamelCase(inputrole);

  // Merge properties from user input and the GET result from service
  var roleToUpdateRoleName = (!inputRoleCamelcased.name) ? roleFromService.roleDefinition.properties.roleName : inputRoleCamelcased.name;
  var roleToUpdateActions = (!inputRoleCamelcased.actions) ? roleFromService.roleDefinition.properties.actions : inputRoleCamelcased.actions;
  var roleToUpdateNotActions = (!inputRoleCamelcased.notActions) ? roleFromService.roleDefinition.properties.notActions : inputRoleCamelcased.notActions;
  var roleToUpdateAssignableScopes = (!inputRoleCamelcased.assignableScopes) ? roleFromService.roleDefinition.properties.assignableScopes : inputRoleCamelcased.assignableScopes;
  var roleToUpdateDescription = (!inputRoleCamelcased.description) ? roleFromService.roleDefinition.properties.description : inputRoleCamelcased.description;

  var roleProperties = {
    assignableScopes: roleToUpdateAssignableScopes,
    description: roleToUpdateDescription,
    permissions: [
      {
        actions: roleToUpdateActions,
        notActions: roleToUpdateNotActions
      }
    ],
    roleName: roleToUpdateRoleName,
    type: rbacConstants.CUSTOM_ROLE_TYPE
  };

  // Get the last segment as the roleid(name)
  var scopes = roleFromService.roleDefinition.id.split('/');
  var roleDefinitionId = scopes[scopes.length - 1];

  var parameters = {
    roleDefinition: {
      id: roleFromService.roleDefinition.id,
      name: roleDefinitionId,
      properties: roleProperties
    }
  };

  return parameters;
};


