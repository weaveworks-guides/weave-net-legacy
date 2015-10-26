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

var $ = utils.getLocaleString;


exports.processInsightsResults = function (cli, log, insightsResults, subscription, graphClient, authzClient, _) {
  var startEvents = {}, endEvents = {}, offlineEvents = {};
  
  // Divide into 3 buckets - start events, end events and offline events
  for (var i = 0; i < insightsResults.length; i++) {
    if (insightsResults[i]['httpRequest'] && utils.ignoreCaseEquals((insightsResults[i]['status']).value, 'Started')) {
      startEvents[insightsResults[i]['operationId']] = insightsResults[i];
    } else if (insightsResults[i]['httpRequest'] && !utils.ignoreCaseEquals((insightsResults[i]['status']).value, 'Started')) {
      endEvents[insightsResults[i]['operationId']] = insightsResults[i];
    }
    else if (insightsResults[i]['eventName'] && insightsResults[i]['eventName'].value && insightsResults[i]['eventName'].value.toLowerCase().indexOf('classicadministrators') > 0) {
      offlineEvents[insightsResults[i]['operationId']] = insightsResults[i];
    }
  }
  
  var outputData = [];
  // cache principals encountered to prevent multiple graph calls for the same principal
  var principalDetailsCache = {};
  
  // Cache all roledefinitions
  var roleDefinitionCache = {};
  
  var result = authzClient.roleDefinitions.list(_);
  for (var j = 0; j < result.roleDefinitions.length; j++) {
    roleDefinitionCache[result.roleDefinitions[j]['id']] = result.roleDefinitions[j];
  }

  // Process StartEvents
  // Find matching EndEvents that succeeded and relating to role assignments only
  var se;
  for (se in startEvents) {
    var out = {};
    if (endEvents[se] && endEvents[se]['operationName'] && endEvents[se]['operationName'].value && utils.stringStartsWith(endEvents[se]['operationName'].value, 'Microsoft.Authorization/RoleAssignments', true) && utils.ignoreCaseEquals(endEvents[se]['status'].value, 'Succeeded')) {

      var endEvent = endEvents[se];
      var startEvent = startEvents[se];
      var scope;
      out['Timestamp'] = endEvent['eventTimestamp'];
      out['Caller'] = startEvent['caller'];

      var messageBody;
      if (startEvent['httpRequest'] && startEvent['httpRequest']['method'] && utils.ignoreCaseEquals(startEvent['httpRequest']['method'], 'PUT')) {
        out['Action'] = 'Granted';
        try {
          messageBody = JSON.parse(startEvent['properties']['requestbody']);
        } catch (ex) {
          // Do nothing. Do not stop on single record parsing error (messageBody will be null and corresponding output record will have empty fields)
        }
        scope = startEvent.authorization.scope;
      } else if (startEvent['httpRequest'] && startEvent['httpRequest']['method'] && utils.ignoreCaseEquals(startEvent['httpRequest']['method'], 'DELETE')) {
        out['Action'] = 'Revoked';
        try {
          messageBody = JSON.parse(endEvent['properties']['responseBody']);
        } catch (ex) {
          // Do nothing. Do not stop on single record parsing error (messageBody will be null and corresponding output record will have empty fields)
        }
      }

      if (messageBody) {
        messageBody = toCamelCaseObj(messageBody);
        var properties = messageBody['properties'];
        properties = toCamelCaseObj(properties);

        // Resolve principal details by querying Graph
        if (properties) {
          var principalId = properties['principalId'];
          out['PrincipalId'] = principalId;
          if (principalId) {
            getPrincipalDetails(principalId, principalDetailsCache, graphClient, _);
            if (principalDetailsCache && principalDetailsCache[principalId]) {
              out['PrincipalName'] = principalDetailsCache[principalId]['Name'];
              out['PrincipalType'] = principalDetailsCache[principalId]['Type'];
            }
          }
        }

        // Resolve scope
        if (!scope && properties) {
          scope = properties['scope'];
        }
        if (scope) {
          var index = scope.toLowerCase().indexOf('/providers/microsoft.authorization');
          if (index > 0) {
            scope = scope.substring(0, index);
          }

          out['Scope'] = scope;
          var resourceDetails = {};
          resourceDetails = getResourceDetails(out['Scope']);
          if (resourceDetails) {
            out['ScopeName'] = resourceDetails['Name'];
            out['ScopeType'] = resourceDetails['Type'];
          }
        }

        // Resolve role definition details from cached roles
        if (properties) {
          out['RoleDefinitionId'] = properties['roleDefinitionId'];
          var roleId = out['RoleDefinitionId'];
          if (roleId) {
            if (roleDefinitionCache[roleId]) {
              out['RoleName'] = roleDefinitionCache[roleId].properties.roleName;
            } else {
              out['RoleName'] = '';
            }
          }
        }
      }

      outputData.push(out);
    }
  } //end of startevent processing
  
  // Process classic admins events
  var oe;
  for (oe in offlineEvents) {
    var outOffline = {};
    var offlineEvent = offlineEvents[oe];
    if (offlineEvent['status'] && offlineEvent['status'].value && utils.ignoreCaseEquals(offlineEvent['status'].value, 'Succeeded') && offlineEvent['operationName'] && offlineEvent['operationName'].value && utils.stringStartsWith(offlineEvent['operationName'].value, 'Microsoft.Authorization/ClassicAdministrators', true)) {
      outOffline['Timestamp'] = offlineEvent['eventTimestamp'];
      outOffline['Caller'] = 'Subscription Admin';
      
      if (utils.ignoreCaseEquals(offlineEvent['operationName'].value, 'Microsoft.Authorization/ClassicAdministrators/write')) {
        outOffline['Action'] = 'Granted';
      }
      else if (utils.ignoreCaseEquals(offlineEvent['operationName'].value, 'Microsoft.Authorization/ClassicAdministrators/delete')) {
        outOffline['Action'] = 'Revoked';
      }

      outOffline['RoleDefinitionId'] = null;
      outOffline['PrincipalId'] = null;
      outOffline['PrincipalType'] = 'User';
      outOffline['Scope'] = '/subscriptions/' + subscription.id;
      outOffline['ScopeType'] = 'Subscription';
      outOffline['ScopeName'] = subscription.id;
      
      if (offlineEvent['properties']) {
        outOffline['PrincipalName'] = offlineEvent['properties']['adminEmail'];
        outOffline['RoleName'] = 'Classic ' + offlineEvent['properties']['adminType'];
      }
      
      outputData.push(outOffline);
    }

    
  } //end of offline event processing
 
  // Display output after sorting
  cli.interaction.formatOutput(outputData, function (data) {
    if (data.length === 0) {
      log.info($('No records were found in the specified search interval'));
    } else {
      data.sort(function(a, b) {
        return new Date(a['Timestamp']) - new Date(b['Timestamp']);
      });
      for (var k = 0; k < data.length; k++) {
        displayRecord(data[k], log);
      }
    }
  });
};

function toCamelCaseObj(obj) {
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

function displayRecord(record, log) {
  log.data($('Timestamp         :'), record['Timestamp']);
  log.data($('Caller            :'), record['Caller']);
  log.data($('Action            :'), record['Action']);
  log.data($('PrincipalId       :'), record['PrincipalId']);
  log.data($('PrincipalName     :'), record['PrincipalName']);
  log.data($('PrincipalType     :'), record['PrincipalType']);
  log.data($('Scope             :'), record['Scope']);
  log.data($('ScopeType         :'), record['ScopeType']);
  log.data($('ScopeName         :'), record['ScopeName']);
  log.data($('RoleDefinitionId  :'), record['RoleDefinitionId']);
  log.data($('RoleName          :'), record['RoleName']);
  log.data('');
}

// Resolve principal. Get from cache if present else query graph
function getPrincipalDetails(principalId, principalDetailsCache, graphClient, _) {
  if (principalId in principalDetailsCache) {
    return principalDetailsCache[principalId.toString()];
  }

  var principalDetails = {};
  var user;

  try {
    user = graphClient.user.get(principalId, _).user;
  } catch (ex) {
    if (ex.statusCode !== 404) {
      throw ex;
    }
  }

  if (user) {
    principalDetails['Name'] = user.displayName;
    principalDetails['Type'] = 'User';
    principalDetailsCache[principalId] = principalDetails;
  } else { // user not found, search for group
    var group;
    try {
      group = graphClient.group.get(principalId, _).group;
    } catch (ex) {
      if (ex.statusCode !== 404) {
        throw ex;
      }
    }
    if (group) {
      principalDetails['Name'] = group.displayName;
      principalDetails['Type'] = 'Group';
      principalDetailsCache[principalId] = principalDetails;

    } else { // group not found, search for servicePrincipal
      var sp;
      try {
        sp = graphClient.servicePrincipal.get(principalId, _).servicePrincipal;
      } catch (ex) {
        if (ex.statusCode !== 404) {
          throw ex;
        }
      }

      if (sp) {
        principalDetails['Name'] = sp.displayName;
        principalDetails['Type'] = 'Service Principal';
        principalDetailsCache[principalId] = principalDetails;
      }
    }
  }
}

// Resolve resource scope
function getResourceDetails(scope) {
  var resourceDetails = {};

  var scopeParts = scope.split('/').filter(function(r) {
    return !__.isEmpty(r);
  });

  var len = scopeParts.length;

  if (len > 0 && len <= 2 && scope.toLowerCase().indexOf('subscriptions') > 0) {
    resourceDetails['Type'] = 'Subscription';
    resourceDetails['Name'] = scopeParts[1];
  } else if (len > 0 && len <= 4 && scope.toLowerCase().indexOf('resourcegroups') > 0) {
    resourceDetails['Type'] = 'Resource Group';
    resourceDetails['Name'] = scopeParts[3];
  } else if (len >= 6 && scope.toLowerCase().indexOf('providers') > 0) {
    resourceDetails['Type'] = 'Resource';
    resourceDetails['Name'] = scopeParts[len - 1];
  }

  return resourceDetails;
}

