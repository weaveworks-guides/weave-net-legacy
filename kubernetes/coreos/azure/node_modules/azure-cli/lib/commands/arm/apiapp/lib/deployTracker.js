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

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;

function createDeployTracker(resourceClient, resourceGroup, deploymentName) {
  var operations = {};

  var emitter = new EventEmitter();

  function done(err, deployment) {
    if (err) {
      emitter.emit('error', err);
    } else {
      emitter.emit('done', null, deployment);
    }
  }

  function pollDeployment(deployment) {
    processDeploymentOperations(resourceClient, resourceGroup, deployment.name, function (err, ops) {
      if(err) {
        return done(err);
      }

      _.sortBy(ops, function (op) { return op.properties.timestamp; }).forEach(function (op) {
        if(!_.has(operations, op.id) ||
          (operations[op.id].properties.provisioningState !== op.properties.provisioningState) ||
          (operations[op.id].properties.statusCode !== op.properties.statusCode)) {
          emitter.emit('operation', null, op);
        }
        operations[op.id] = op;
      });

      if (deploymentIsDone(deployment)) {
        return done(null, deployment);
      }

      setTimeout(function () {
        resourceClient.deployments.get(resourceGroup, deploymentName, function (err, response) {
          if (err) { return done(err); }
          return pollDeployment(response.deployment);
        });
      }, 5000);
    });
  }

  resourceClient.deployments.get(resourceGroup, deploymentName, function (err, response) {
    if (err) {
      return done(err);
    }
    emitter.emit('start', null, response.deployment);
    pollDeployment(response.deployment);
  });

  return emitter;
}

function processDeploymentOperations(resourceClient, resourceGroup, deploymentName, done) {

  // Go through the list of operations, accumulating results.
  // If any operation references a deployment, recurse through the
  // operations in the reference deployment too
  function process(remainingOps, currentResult) {
    if (remainingOps.length === 0) {
      return done(null, currentResult);
    }

    var currentOp;
    for(currentOp = remainingOps.shift(); remainingOps.length > 0; currentOp = remainingOps.shift()) {
      if (isNestedDeploymentOperation(currentOp)) {
        break;
      }
      currentResult.push(currentOp);
    }

    // Push final op onto results list
    currentResult.push(currentOp);

    // If we got here either we're done, or currentOp is nested
    if (isNestedDeploymentOperation(currentOp)) {
      // Get nested operations and recurse
      var nestedDeploymentName = currentOp.properties.targetResource.resourceName;
      resourceClient.deploymentOperations.list(resourceGroup, nestedDeploymentName, function (err, response) {
        if (err) { return done(err); }
        return process(response.operations.concat(remainingOps), currentResult);
      });
    } else {
      return done(null, currentResult);
    }
  }

  // And kick off the process
  resourceClient.deploymentOperations.list(resourceGroup, deploymentName, function (err, response) {
    if (err) { return done(err); }
    return process(response.operations, []);
  });
}

function isNestedDeploymentOperation(op) {
  return op.properties &&
  op.properties.targetResource &&
  op.properties.targetResource.resourceType === 'Microsoft.Resources/deployments';
}

function deploymentIsDone(deployment) {
  var state = deployment.properties.provisioningState;
  return state !== 'Running' && state !== 'Accepted';
}

_.extend(exports, {
  create: createDeployTracker
});
