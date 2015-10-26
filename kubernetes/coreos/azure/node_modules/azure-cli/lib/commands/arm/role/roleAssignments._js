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

var underscore = require('underscore');

var adUtils = require('../ad/adUtils');
var resourceUtils = require('../resource/resourceUtils');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var util = require('util');

exports = module.exports = RoleAssignments;

function RoleAssignments(authzClient, graphClient) {
  this.authzClient = authzClient;
  this.graphClient = graphClient;
}

underscore.extend(RoleAssignments.prototype, {

  query: function (forRoleAssignmentsGet, principal, scope, roleName, shouldExpandPrincipalGroups, shouldIncludeClassicAdmins, cli, subscription, _) {
    var assignments;
    var objectType = {};
    var shouldRetrieveObjectType = forRoleAssignmentsGet && shouldIncludeClassicAdmins;
    var principalId = adUtils.getObjectId(principal, this.graphClient, false, shouldRetrieveObjectType, objectType, _);
    var parameters = { atScope: false };
    
    if (principalId) {
      if (shouldExpandPrincipalGroups) {
        if (objectType.value && !utils.ignoreCaseEquals(objectType.value, 'user')) {
          throw new Error($('expandprincipalgroups option is only supported for a user principal. Given principal is a ' + objectType.value));
        }
        parameters['assignedToPrincipalId'] = principalId;
      } else {
        parameters['principalId'] = principalId;
      }

      assignments = this.getAssignmentsList(parameters, _);

      // If assignments are for Get then filter on AtOrAbove Scope else filter on Exact Scope for Delete
      if (forRoleAssignmentsGet) {
        assignments = this.filterByScopeAtOrAbove(assignments, scope);
      }
      else {
        assignments = this.filterByScopeExact(assignments, scope);
      }

    } else if (scope) {
      parameters.atScope = true;
      assignments = this.getAssignmentsListForScope(scope, parameters, _);
    } 
    else {
      assignments = this.getAssignmentsList(parameters, _);
    }
    
    var roleDefinitions = this.getRoleDefinitions(_);
    assignments = this.filterByRoleName(assignments, roleName, roleDefinitions);
    
    var excludeAssignmentsForDeletedPrincipals = forRoleAssignmentsGet ? true : false;
    assignments = this.filterForDeletedPrincipalsAndFillInPrincipalInfo(assignments, excludeAssignmentsForDeletedPrincipals, _);
    assignments = this.fillInRoleDetails(assignments, roleDefinitions);
    
    if (shouldIncludeClassicAdmins) {
      var admins = this.authzClient.classicAdministrators.list(_);
      var adminsAsAssignments = this.convertAdminsToAssignments(admins, subscription);

      // Filter by principal name if provided
      if (this.optionIsSet(principal) && principalId) {
        if (objectType.value && !utils.ignoreCaseEquals(objectType.value, 'user')) {
          throw new Error($('includeClassicAdministrators option is only supported for a user principal. Given principal is a ' + objectType.value));
        }

        var objects = this.graphClient.objects.getObjectsByObjectIds({ ids: new Array (principalId) }, _).aADObject;
        
        if (objects && objects.length > 0) {
          adminsAsAssignments = adminsAsAssignments.filter(function(r) {
            return utils.ignoreCaseEquals(r.properties.aADObject.displayName, objects[0].signInName);
          });
        } else { // Display warning and do not filter
          console.log('Warning: failed to retrieve graph object details for principal:%s. Falling back to non-filtered list of classic administrators.', principalId);
        }
      }
      assignments = assignments.concat(adminsAsAssignments);
    }
    
    return assignments;
  },
  
  getAssignmentsList: function (parameter, _) {
    var result = this.authzClient.roleAssignments.list(parameter, _);
    return result.roleAssignments;
  },

  convertAdminsToAssignments: function (classicAdmins, subscription) {
    var roleAssignments = [];
    if (classicAdmins && classicAdmins.classicAdministrators) {
      for (var i = 0; i < classicAdmins.classicAdministrators.length; i++) {
        var ra = {};
        ra.properties = {};
        ra.properties.aADObject = {};
        ra.properties.roleName = classicAdmins.classicAdministrators[i].properties.role;
        ra.properties.scope = '/subscriptions/' + subscription.id;
        ra.properties.aADObject.displayName = classicAdmins.classicAdministrators[i].properties.emailAddress;
        ra.properties.aADObject.signInName = classicAdmins.classicAdministrators[i].properties.emailAddress;
        ra.properties.aADObject.objectType = 'User';
        roleAssignments.push(ra);
      }
    }

    return roleAssignments;
  },

getAssignmentsListForScope: function (scope, parameter, _) {
    var result = this.authzClient.roleAssignments.listForScope(scope, parameter, _);
    return result.roleAssignments;
  },

  filterByScopeAtOrAbove: function (assignments, scope) {
    if (scope) {
      assignments = assignments.filter(function (assignment) {
        return utils.stringStartsWith(scope, assignment.properties.scope, true);
      });
    }
    return assignments;
  },

  filterByScopeExact: function (assignments, scope) {
    if (scope) {
      assignments = assignments.filter(function (assignment) {
        return utils.ignoreCaseEquals(scope, assignment.properties.scope);
      });
    }
    return assignments;
  },

  filterForDeletedPrincipalsAndFillInPrincipalInfo: function (assignments, excludeAssignmentsForDeletedPrincipals, _) {
    var allIds = underscore.map(assignments, function (assignment) {
      return assignment.properties.principalId;
    });
    var graphCallSucceeded = true;
    
    if (allIds.length > 0) {
      var objects = [];

      try {
        objects = this.graphClient.objects.getObjectsByObjectIds({ ids: allIds }, _).aADObject;
      } catch (ex) {
        graphCallSucceeded = false;
      }

      var assignmentsForValidPrincipals = [];
      assignments.forEach(function (assignment) {
        var adObjectDetails = underscore.chain(objects)
            .where({ objectId: assignment.properties.principalId })
            .first().value();

        if (graphCallSucceeded && adObjectDetails) {
          assignment.properties.aADObject = adObjectDetails;
          assignmentsForValidPrincipals.push(assignment);
        }
        // If Graph Call failed  OR if Graph call succeeded but assignment is to a deleted principal, and exclude such assignments is set to false
        else if (!graphCallSucceeded || !excludeAssignmentsForDeletedPrincipals) {
          assignment.properties.aADObject = {
            objectId: assignment.properties.principalId,
            objectType: '',
            displayName: '',
            signInName: ''
          };
          assignmentsForValidPrincipals.push(assignment);
        }
      });
      assignments = assignmentsForValidPrincipals;
    }
    return assignments;
  },

  filterByRoleName: function (assignments, roleName, roleDefinitions) {
    if (roleName) {
      var self = this;
      var roleDefinitionName;
      for (var i = 0; i < roleDefinitions.length; i++) {
        if (utils.ignoreCaseEquals(roleDefinitions[i].properties.roleName, roleName)) {
          roleDefinitionName = roleDefinitions[i].name;
        }
      }
      if (!roleDefinitionName) {
        throw new Error(util.format($('Role with name \'%s\' was not found'), roleName));
      }
      assignments = assignments.filter(function (assignment) {
        return utils.ignoreCaseEquals(self.getRoleDefinitionName(assignment.properties.roleDefinitionId), roleDefinitionName);
      });
    }
    return assignments;
  },

  fillInRoleDetails: function (assignments, roleDefinitions) {
    if (assignments && assignments.length > 0) {
      var self = this;
      var roleNames = [];
      var roleDefinitionId;
      for (var i = 0; i < roleDefinitions.length; i++) {
        var roleDefinition = roleDefinitions[i];
        roleDefinitionId = roleDefinition.name; //Note, the 'name' field here really means the 'id' (guid)
        roleNames[roleDefinitionId] = roleDefinition.properties.roleName;
      }

      assignments.forEach(function (assignment) {
        roleDefinitionId = assignment.properties.roleDefinitionId;
        assignment.properties.roleName = roleNames[self.getRoleDefinitionName(roleDefinitionId)];
        assignment.properties.roleDefinitionId = self.getRoleDefinitionName(roleDefinitionId);
      });
    }

    return assignments;
  },

  getRoleDefinitionName: function (roleDefintionResourceID) {
    //to extract out the <guid> from definition id like '/subscriptions/358f3860-9dbe-4ace-b0c0-3d4f2d861014/providers/.../<guid>'
    return roleDefintionResourceID.substring(roleDefintionResourceID.lastIndexOf('/') + 1);
  },

  getRoleDefinitions: function (_) {
    return this.authzClient.roleDefinitions.list(_).roleDefinitions;
  },

  fillRoleAndPrincipalDetailsForAssignment: function (assignment, _) {
    assignment = this.filterForDeletedPrincipalsAndFillInPrincipalInfo(new Array(assignment), true, _);
    var roleDefinitions = this.getRoleDefinitions(_);
    assignment = this.fillInRoleDetails(assignment, roleDefinitions);
    return assignment;
  },

  activeFilterADObject: function (principal) {
    if (principal.objectId) {
      return principal.objectId;
    }
    else if (principal.signInName) {
      return principal.signInName;
    }
    else if (principal.spn) {
      return principal.spn;
    }
    return null;
  },

  optionIsSet: function (option) {
    var properties = option ? Object.keys(option) : [];
    var propertyValues = properties.filter(function (p) {
      return !!option[p];
    });
    return (propertyValues.length > 0);
  },
});

RoleAssignments.buildScopeString = function (scopeInfo) {
  if (scopeInfo.scope && (scopeInfo.resourceGroup || scopeInfo.resourceName)) {
    throw new Error($('Please specify either scope or resource group and resource name'));
  }

  if (scopeInfo.resourceName && !scopeInfo.resourceGroup) {
    throw new Error($('Please specify a valid resourcegroup name'));
  }

  if (scopeInfo.scope) {
    return scopeInfo.scope;
  }
  var scope;
  if (scopeInfo.subscriptionId) {
    scope = '/subscriptions/' + scopeInfo.subscriptionId;
    if (scopeInfo.resourceGroup) {
      scope = scope + '/resourcegroups/' + scopeInfo.resourceGroup.trim();
      if (scopeInfo.resourceName) {
        if (!scopeInfo.resourceType) {
          throw new Error($('Please specify a valid resource type'));
        }
        var resourceTypeName = resourceUtils.getResourceTypeName(scopeInfo.resourceType);
        var provider = resourceUtils.getProviderName(scopeInfo.resourceType);
        scope = scope + '/providers/' + provider.trim() + '/' + (scopeInfo.parent ? scopeInfo.parent.trim() + '/' + resourceTypeName.trim() : resourceTypeName.trim()) +
        '/' + scopeInfo.resourceName.trim();
      }
    }
  }
  
  return scope;
};