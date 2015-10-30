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

var adUtils = require('../ad/adUtils');
var rbacClients = require('./rbacClients');
var profile = require('../../../util/profile');
var RoleAssignments = require('./roleAssignments');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var role = cli.category('role');
  var roleAssignment = role.category('assignment')
      .description($('Commands to manage role assignments'));

  roleAssignment.command('create [objectId] [signInName] [spn] [roleName] [scope] [resource-group] [resource-type] [resource-name]')
    .description($('Assigns the specified RBAC role to the specified principal, at the specified scope.'))
    .usage('[objectId] [signInName] [spn] [roleName] [scope] [resource-group] [resource-type] [resource-name]' +
      '\n' +
      '\n           -----    Example 1   -------' +
      '\n           azure role assignment create --resource-group testRG --signInName john.doe@contoso.com' +
      '\n           Grant access to a user at a resource group scope.' +
      '\n' +
      '\n           -----    Example 2   -------' +
      '\n           azure ad group show --search "Christine Koch Team"' +
      '\n           + Getting group list' + 
      '\n           data:    Display Name:      Christine Koch Team' +
      '\n           data:    ObjectId:          2f9d4375-cbf1-48e8-83c9-2a0be4cb33fb' +
      '\n           data:    Security Enabled:  true' + 
      '\n           data:    Mail Enabled:' +
      '\n' +
      '\n           azure role assignment create --objectId 2f9d4375-cbf1-48e8-83c9-2a0be4cb33fb --roleName Contributor --resource-group testRG' +
      '\n           Grants access to a security group.' +
      '\n' +
      '\n           -----    Example 3   -------' +
      '\n           azure role assignment create --signInName john.doe@contoso.com --roleName Owner --scope "/subscriptions/96231a05-34ce-4eb4-aa6a-70759cbb5e83/resourcegroups/rg1/providers/Microsoft.Web/sites/site1"' +
      '\n           Grants access to a user at a resource \'site1\' (website) scope.' +
      '\n' +
      '\n           -----    Example 4   -------' +
      '\n           azure role assignment create --objectId 5ac84765-1c8c-4994-94b2-629461bd191b --roleName "Virtual Machine Contributor" --resouce-name Devices-Engineering-ProjectRND --resource-type Microsoft.Network/virtualNetworks/subnets --parent virtualNetworks/VNET-EASTUS-01 --resource-group Network' +
      '\n           Grant access to a group at a nested resource (subnet)' +
      '\n')
    .option('--objectId <objectId>', $('Azure AD Objectid of the user, group or service principal'))
    .option('--signInName <signInName>', $('The email address or the user principal name of the user.'))
    .option('--spn <spn>', $('The ServicePrincipalName of the Azure AD application.'))
    .option('-o --roleName <roleName>', $('The Name of the RBAC role that needs to be assigned to the principal i.e. Reader, Contributor, Virtual Network Administrator, etc.'))
    .option('-c --scope <scope>', $('The Scope of the role assignment. In the format of relative URI. For e.g. "/subscriptions/9004a9fd-d58e-48dc-aeb2-4a4aec58606f/resourceGroups/TestRG". If not specified, will create the role assignment at subscription level. If specified, it should start with "/subscriptions/{id}".'))
    .option('-g --resource-group <resource-group>', $('The resource group name. Creates an assignment that is effective at the specified resource group. When used in conjunction with resource-name, resource-type and (optionally)parent parameters, the command constructs a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('-r --resource-type <resource-type>', $('The resource type. For e.g. Microsoft.Network/virtualNetworks. Should only be used in conjunction with resource-name, resource-group and (optionally)parent parameters to construct a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('-u --resource-name <resource-name>', $('The resource name. For e.g. storageaccountprod. Should only be used in conjunction with resource-type, resource-group and (optionally)parent parameters to construct a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('--parent <parent>', $('The parent resource in the hierarchy of the resource specified using resource-name parameter. Must be used in conjunction with resource-name, resource-type and resource-group parameters to construct a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('--subscription <subscription>', $('Name or identifier of the subscription where the role assignment will be created.'))
    .execute(function (objectId, signInName, spn, roleName, scope, resourceGroup, resourceType, resourceName, options, _) {
      if (!roleName) {
        return cli.missingArgument('roleName');
    }
    adUtils.validateParameters({
      objectId: objectId,
      signInName: signInName,
      spn: spn
    });
    
    var subscription = profile.current.getSubscription(options.subscription);
    var authzClient = rbacClients.getAuthzClient(subscription);
    var graphClient = adUtils.getADGraphClient(subscription);
    var helper = new RoleAssignments(authzClient, graphClient);

    scope = RoleAssignments.buildScopeString({
      scope: scope,
      subscriptionId: subscription.id, 
      resourceGroup: resourceGroup,
      resourceType: resourceType, 
      resourceName: resourceName,
      parent: options.parent
    });

    var objectType = {};
    objectId = adUtils.getObjectId(
      {
        objectId: objectId,
        signInName: signInName,
        spn: spn
      }, graphClient, true, false, objectType, _);
    
    var matchedRoles;
    var progress = cli.interaction.progress($('Finding role with specified name'));
    try {
      matchedRoles = authzClient.roleDefinitions.list(_);
      matchedRoles = matchedRoles.roleDefinitions.filter(function (r) {
        return utils.ignoreCaseEquals(r.properties.roleName, roleName);
      });
    } finally {
      progress.end();
    }
    
    var roleId;
    if (matchedRoles && matchedRoles.length > 0) {
      roleId = matchedRoles[0].id;
    }
    if (!roleId) {
      throw new Error(util.format($('Role with name \'%s\' was not found'), roleName));
    }

    var parameter = {
      properties: {
        principalId: objectId,
        roleDefinitionId: roleId,
        scope: scope
      }
    };

    var roleAssignmentNameGuid = utils.uuidGen();
    progress = cli.interaction.progress($('Creating role assignment'));
    var createdAssignment = null;
    try {
      createdAssignment = authzClient.roleAssignments.create(scope, roleAssignmentNameGuid, parameter, _);
    } finally {
      if (createdAssignment) {
        var assignmentToDisplay = helper.fillRoleAndPrincipalDetailsForAssignment(createdAssignment.roleAssignment, _);
        if (assignmentToDisplay && assignmentToDisplay.length > 0) {
          showRoleAssignment(assignmentToDisplay[0]);
        }
      }
      progress.end();
    }
  });

  roleAssignment.command('list [objectId] [signInName] [spn] [roleName] [scope] [resource-group] [resource-type] [resource-name]')
    .usage('[objectId] [signInName] [spn] [roleName] [scope] [resource-group] [resource-type] [resource-name]' +
      '\n' +
      '\n           -----    Example 1   -------' +
      '\n           azure role assignment list' + 
      '\n           List all role assignments in the subscription' +
      '\n' +
      '\n           -----    Example 2   -------' +
      '\n           azure role assignment list --resource-group testRG --signInName john.doe@contoso.com -e' +
      '\n           Gets all role assignments made to user john.doe@contoso.com, and the groups of which he is member, at the testRG scope or above.' +
      '\n' +
      '\n           -----    Example 3   -------' +
      '\n           azure role assignment list --spn "http://testapp1.com"' +
      '\n           Gets all role assignments of the specified service principal.' +
      '\n' +
      '\n           -----    Example 4   -------' +
      '\n           azure role assignment list --scope "/subscriptions/96231a05-34ce-4eb4-aa6a-70759cbb5e83/resourcegroups/rg1/providers/Microsoft.Web/sites/site1"' +
      '\n           Gets role assignments at the \'site1\' website scope.' +
      '\n')
    .description($('Lists Azure RBAC role assignments at the specified scope. ' +
      '\n         By default it lists all role assignments in the selected Azure subscription. Use respective parameters to list assignments to a specific user, or to list assignments on a specific resource group or resource. ' +
      '\n         The Azure RBAC role that is assigned dictates what type of resources the user is allowed to manage in the scope, and what actions the user is allowed to perform on those resources. Use \'azure role list\' or \'azure role show\' commands to list actions that a given role allows. '))
    .option('--objectId <objectId>', $('The Azure AD ObjectId of the User, Group or Service Principal. Filters all assignments that are made to the specified principal.'))
    .option('--signInName <signInName>', $('The email address or the user principal name of the user. Filters all assignments that are made to the specified user.'))
    .option('--spn <spn>', $('The ServicePrincipalName of the service principal. Filters all assignments that are made to the specified Azure AD application.'))
    .option('-o --roleName <roleName>', $('The Role that is assigned to the principal i.e. Reader, Contributor, Virtual Network Administrator, etc.'))
    .option('-c --scope <scope>', $('The Scope of the role assignment. In the format of relative URI. For e.g. /subscriptions/9004a9fd-d58e-48dc-aeb2-4a4aec58606f/resourceGroups/TestRG. It must start with "/subscriptions/{id}". The command filters all assignments that are effective at that scope.'))
    .option('-g --resource-group <resource-group>', $('The resource group name. Lists role assignments that are effective at the specified resource group. When used in conjunction with resource-name, resource-type and (optionally)parent parameters, the command lists assignments effective at resources within the resource group.'))
    .option('-r --resource-type <resource-type>', $('The resource type. For e.g. Microsoft.Network/virtualNetworks. Must be used in conjunction with resource-name, resource-group and (optionally)parent parameters.'))
    .option('-u --resource-name <resource-name>', $('The resource name. For e.g. storageaccountprod. Must be used in conjunction with resource-group, resource-type and (optionally)parent parameters.'))
    .option('--parent <parent>', $('The parent resource in the hierarchy of the resource specified using --resource-name parameter. Must be used in conjunction with resource-name, resource-type and resource-group parameters.'))
    .option('-e --expandPrincipalGroups', $('If specified, returns roles directly assigned to the user and to the groups of which the user is a member (transitively). Supported only for a user principal.'))
    .option('-a --includeClassicAdministrators', $('If specified, also lists subscription classic administrators (co-admins, service admins, etc.) role assignments.'))
    .option('--subscription <subscription>', $('Name or identifier of the subscription to search the role assignments.'))
    .execute(function (objectId, signInName, spn, roleName, scope, resourceGroup, resourceType, resourceName, options, _) {

      adUtils.validateParameters({
        objectId: objectId,
        signInName: signInName,
        spn: spn
      }, false);

      var subscription = profile.current.getSubscription(options.subscription);
      var authzClient = rbacClients.getAuthzClient(subscription);
      var graphClient = adUtils.getADGraphClient(subscription);

      var progress = cli.interaction.progress($('Searching for role assignments'));
      var assignmentCollection = new RoleAssignments(authzClient, graphClient);
      var subscriptionIdForScope;

      if (resourceGroup) {
        subscriptionIdForScope = subscription.id;
      }

      var scopeString = RoleAssignments.buildScopeString({
        scope: scope,
        resourceGroup: resourceGroup,
        resourceType: resourceType,
        resourceName: resourceName,
        parent: options.parent,
        subscriptionId: subscriptionIdForScope
      });

      var assignments;

      var expandGroups = false;
      if (options.expandPrincipalGroups) {
        expandGroups = true;
      }
      var includeAdmins = false;
      if (options.includeClassicAdministrators) {
        includeAdmins = true;
      }

      var principalParameters = {
        objectId: objectId,
        signInName: signInName
      };

      if (!assignmentCollection.optionIsSet(principalParameters) && expandGroups) {
        var parameterNames = Object.keys(principalParameters);
        throw new Error(util.format(('Please provide a value to one of the parameters \'%s\' for using option \'-e\' or \'expandPrincipalGroups\''), parameterNames.join()));
      }
      
      try {
        assignments = assignmentCollection.query(true,
          {
            objectId: objectId,
            signInName: signInName,
            spn: spn
          },
          scopeString, roleName, expandGroups, includeAdmins, cli, subscription, _);

      } finally {
        progress.end();
      }

      if (assignments.length === 0) {
        log.info($('No role assignments matching the search criteria were found'));
        return;
      }
      
      cli.interaction.formatOutput(assignments, function (outputData) {
        for (var i = 0; i < outputData.length; i++) { 
          showRoleAssignment(outputData[i]);
        }        
      });
    });

  roleAssignment.command('delete [objectId] [signInName] [spn] [roleName] [scope] [resource-group] [resource-type] [resource-name]')
   .usage('[objectId] [signInName] [spn] [roleName] [scope] [resource-group] [resource-type] [resource-name]' +
      '\n' +
      '\n           -----    Example 1   -------' +
      '\n           azure role assignment delete --resource-group testRG --signInName john.doe@contoso.com --roleName Reader' +
      '\n           Removes a role assignment for john.doe@contoso.com who is assigned to the Reader role at the testRG resourcegroup scope' +
      '\n' +
      '\n           -----    Example 2   -------' +
      '\n           azure role assignment delete --objectId 2f9d4375-cbf1-48e8-83c9-2a0be4cb33fb --roleName Reader' +
      '\n           Removes the role assignment to the group principal identified by the ObjectId and assigned to the Reader role. Defaults to using the current subscription as the scope to find the assignment to be deleted.' +
      '\n')
    .description($('Removes a role assignment to the specified principal who is assigned to a particular role at a particular scope. Use the \'azure role assignment list\' command to retrieve assignments under the subscription'))
    .option('--objectId <objectId>', $('Azure AD Objectid of the user, group or service principal'))
    .option('--signInName <signInName>', $('The email address or the user principal name of the user.'))
    .option('--spn <spn>', $('The ServicePrincipalName of the Azure AD application.'))
    .option('-o --roleName <roleName>', $('The Name of the RBAC role for which the assignment needs to be deleted i.e. Reader, Contributor, Virtual Network   Administrator, etc.'))
    .option('-c --scope <scope>', $('The Scope of the role assignment to be deleted. In the format of relative URI. For e.g. "/subscriptions/9004a9fd-d58e-48dc-aeb2-4a4aec58606f/resourceGroups/TestRG". If not specified, will attempt to delete the role assignment at subscription level. If specified, it should start with "/subscriptions/{id}".'))
    .option('-g --resource-group <resource-group>', $('The resource group name. Attempts to delete an assignment at the specified resource group scope. When used in conjunction with resource-name, resource-type and (optionally)parent parameters, the command constructs a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('-r --resource-type <resource-type>', $('The resource type. For e.g. Microsoft.Network/virtualNetworks. Should only be used in conjunction with resource-name, resource-group and (optionally)parent parameters to construct a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('-u --resource-name <resource-name>', $('The resource name. For e.g. storageaccountprod. Should only be used in conjunction with resource-type, resource-group and (optionally)parent parameters to construct a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('--parent <parent>', $('The parent resource in the hierarchy of the resource specified using --resource-name parameter, if any. Must be used in conjunction with resource-name, resource-type and resource-group parameters to construct a hierarchical scope in the form of a relative URI that identifies a resource.'))
    .option('-q --quiet', $('If specified, the command does not prompt for a confirmation before deleting the role assignment.'))
    .option('--passthru', $('If specified, displays the deleted role assignment'))
    .option('--subscription <subscription>', $('Name or identifier of the subscription to delete the role assignment'))
    .execute(function (objectId, signInName, spn, roleName, scope, resourceGroup, resourceType, resourceName, options, _) {

      var principal = {
        objectId: objectId,
        signInName: signInName,
        spn: spn
      };

      adUtils.validateParameters(principal);

      if (!roleName) {
        return cli.missingArgument('roleName');
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var authzClient = rbacClients.getAuthzClient(subscription);
      var graphClient = adUtils.getADGraphClient(subscription);
      var assignmentCollection = new RoleAssignments(authzClient, graphClient);
      var progress;

      var scopeString = RoleAssignments.buildScopeString({
        scope: scope,
        resourceGroup: resourceGroup,
        resourceType: resourceType,
        resourceName: resourceName,
        parent: options.parent,
        subscriptionId: subscription.id
      });

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete role assignment for AD object "%s" at scope "%s" assigned to role "%s"? [y/n] '),
          assignmentCollection.activeFilterADObject(principal), scopeString, roleName), _)) {
        return;
      }

      var assignments = assignmentCollection.query(false, principal, scopeString, roleName, false, false, cli, subscription, _);

      if (assignments.length > 0) {
        progress = cli.interaction.progress($('Deleting role assignment'));

        try {
          authzClient.roleAssignments.deleteById(assignments[0].id, _);
        } finally {
          progress.end();
        }

        if (options.passthru) {
          cli.interaction.formatOutput(assignments[0], function (assignment) {
            showRoleAssignment(assignment);
          });
        }
      }
      else {
        throw new Error($('No role assignment matching the search criteria was found'));
      }
    });

  function showRoleAssignment(roleAssignment) {
    log.data($('RoleAssignmentId     :'), roleAssignment.id);
    log.data($('RoleDefinitionName   :'), roleAssignment.properties.roleName);
    log.data($('RoleDefinitionId     :'), roleAssignment.properties.roleDefinitionId);
    log.data($('Scope                :'), roleAssignment.properties.scope);
    log.data($('Display Name         :'), roleAssignment.properties.aADObject.displayName);
    log.data($('SignInName           :'), roleAssignment.properties.aADObject.signInName);
    log.data($('ObjectId             :'), roleAssignment.properties.aADObject.objectId);
    log.data($('ObjectType           :'), roleAssignment.properties.aADObject.objectType);
    
    log.data('');
  }
};