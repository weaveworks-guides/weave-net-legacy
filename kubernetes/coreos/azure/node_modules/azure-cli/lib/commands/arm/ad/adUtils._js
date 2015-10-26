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

var ADGraphClient = require('azure-extra');
var log = require('../../../../lib/util/logging');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;

exports.getADGraphClient = function getADGraphClient(subscription) {
  var client = new ADGraphClient.createGraphRbacManagementClient(subscription.tenantId,
      subscription._createCredentials(),
      subscription.activeDirectoryGraphResourceId)
        .withFilter(log.createLogFilter());
  return client;
};

exports.getObjectId = function (principal, graphClient, throwIfNoOption, shouldRetrieveObjectType, objectType, _) {
  if (principal.objectId) {
    // get object type if requested
    if (shouldRetrieveObjectType) {
      var objects = graphClient.objects.getObjectsByObjectIds({ ids: new Array(principal.objectId) }, _).aADObject;
      if (objects && objects.length > 0) {
        objectType.value = objects[0].objectType;
      }
    }

    return principal.objectId;
  }

  var graphQueryResult = null;
  if (principal.signInName) {
    graphQueryResult = graphClient.user.getBySignInName(principal.signInName, _);
    if (graphQueryResult.users.length > 0) {
      objectType.value = 'user';
      return graphQueryResult.users[0].objectId;
    } else {
      throw new Error($('Invalid user signInName')); 
    }
  }

  if (principal.spn) {
    graphQueryResult = graphClient.servicePrincipal.getByServicePrincipalName(principal.spn, _);
    if (graphQueryResult.servicePrincipals.length > 0) {
      objectType.value = 'servicePrincipal';
      return graphQueryResult.servicePrincipals[0].objectId;
    } else {
      throw new Error($('Invalid service principal name'));
    }
  }
  if (throwIfNoOption) {
    throw new Error($('Failed to retrieve Active Dirctory Object Id'));
  } else {
    objectType.value = '';
    return '';
  }
};

exports.validateParameters = function (parameters, throwOnNoValues) {
  throwOnNoValues = (typeof throwOnNoValues !== 'undefined' ? throwOnNoValues : true);
  var parameterNames = Object.keys(parameters);

  //empty object is fine.
  if (parameterNames.length === 0) {
    return;
  }

  var values = parameterNames.filter(function (p) {
    return (!!parameters[p]);
  });

  if (values.length === 0 && throwOnNoValues) {
    throw new Error(util.format(('Please provide a value to one of the parameters \'%s\''), parameterNames.join()));
  }

  if (values.length > 1) {
    throw new Error(util.format($('You can only specify value to one of \'%s\''), values.join()));
  }
};

exports.listGraphObjects = function (client, objectType, interaction, log, _) {
  var isServicePrincipal = utils.ignoreCaseEquals(objectType, 'servicePrincipal');
  function displayObjects(objects) {
    if (objects.length === 0) {
      return;
    }
    if (utils.ignoreCaseEquals(objectType, 'user')) {
      exports.displayUsers(objects, interaction, log);
    } else if (utils.ignoreCaseEquals(objectType, 'group')) {
      exports.displayGroups(objects, interaction, log);
    } else if (isServicePrincipal) {
      exports.displayServicePrincipals(objects, interaction, log);
    }
  }
  var response;
  if (isServicePrincipal) {
    response = client[objectType].list(null, _);
  } else {
    response = client[objectType].list(null, null, _);
  }

  displayObjects(response[objectType + 's']);
  var nextLink = response.nextLink;

  while (nextLink) {
    response = client[objectType].listNext(nextLink, _);
    displayObjects(response[objectType + 's']);
    nextLink = response.nextLink;
  }
};

exports.listGroupMembers = function (client, groupId, interaction, log, _) {
  var response = client.group.getGroupMembers(groupId, _);
  displayGroupMembers(response.aADObject, interaction, log);
  var nextLink = response.nextLink;

  while (nextLink) {
    response = client.group.getGroupMembersNext(nextLink, _);
    displayGroupMembers(response.aADObject, interaction, log);
    nextLink = response.nextLink;
  }
};

exports.displayUsers = function (users, interaction, log) {
  interaction.formatOutput(users, function (data) {
    for (var i = 0; i < data.length; i++) {
      displayAUser(data[i], log);
      log.data('');
    }
  });
};

exports.displayGroups = function (groups, interaction, log) {
  interaction.formatOutput(groups, function (data) {
    for (var i = 0; i < data.length; i++) {
      displayAGroup(data[i], log);
      log.data('');
    }
  });
};

exports.displayServicePrincipals = function (servicePrincipals, interaction, log) {
  interaction.formatOutput(servicePrincipals, function (data) {
    for (var i = 0; i < data.length; i++) {
      exports.displayAServicePrincipal(data[i], log);
      log.data('');
    }
  });
};

exports.displayAServicePrincipal = function (servicePrincipal, log, showType) {
  log.data($('Object Id:              '), servicePrincipal.objectId);
  log.data($('Display Name:           '), servicePrincipal.displayName);
  log.data($('Service Principal Names:'));
  servicePrincipal.servicePrincipalNames.forEach(function (name) {
    log.data($('                        '), name);
  });
  if (showType) {
    log.data($('Object Type:          '), 'ServicePrincipal');
  }
};

exports.displayAApplication = function (application, log) {
  log.data($('Application Id:         '), application.appId);
  log.data($('Application Object Id:  '), application.objectId);
  if (application.appPermissions) {
    log.data($('Application Permissions:  '));
    Object.keys(application.appPermissions).forEach(function (item) {
      if (application.appPermissions[item]) {
        Object.keys(application.appPermissions[item]).forEach(function (subItem) {
          log.data($('                         ' + subItem + ': '), application.appPermissions[item][subItem]);
        });
      }
    });
  }
};

function displayGroupMembers(members, interaction, log) {
  interaction.formatOutput(members, function (data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].objectType === 'User') {
        displayAUser(data[i], log, true);
      } else if (data[i].objectType === 'Group') {
        displayAGroup(data[i], log, true);
      } else {
        log.warn('an unexpected object type:' + data[i].objectType);
      }
      log.data('');
    }
  });
}

function displayAUser(user, log, showType) {
  log.data($('Object Id:      '), user.objectId);
  log.data($('Principal Name: '), user.userPrincipalName);
  log.data($('Display Name:   '), user.displayName);
  log.data($('E-Mail:         '), user.mail || user.signInName);
  if (showType) {
    log.data($('Object Type:    '), 'User');
  }
}

function displayAGroup(group, log, showType) {
  log.data($('Display Name:     '), group.displayName);
  log.data($('ObjectId:         '), group.objectId);
  log.data($('Security Enabled: '), group.securityEnabled);
  log.data($('Mail Enabled:     '), group.mailEnabled);
  if (showType) {
    log.data($('Object Type:      '), 'Group');
  }
}
