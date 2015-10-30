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
var uuid = require('node-uuid');
var util = require('util');
var utils = require('../../../../util/utils');
var $ = utils.getLocaleString;

//
// General implementation helpers for deployment operations.
//

function ApiAppDeployer(options) {
  __.extend(this, options);

  this.apiappClient = utils.createApiAppManagementClient(options.subscription);
  this.resourceClient = utils.createResourceClient(options.subscription);
}

__.extend(ApiAppDeployer.prototype, {

  doDeployment: function doDeployment(_) {
    var self = this;
    self.withProgress($('Getting package metadata'),
      function (log, _) {
        self.getMetadata(_);
      }, _);

    self.gatherParameters(_);

    var deployment = self.withProgress($('Creating deployment'),
      function (log, _) {
        self.getDeploymentTemplate(_);
        return self.createDeployment(_);
      }, _);
    return deployment.deployment;
  },

  getMetadata: function(_) {
    if (this.package) {
      this.packageMetadata = this.apiappClient.templates.getMetadata({
        microserviceId: this.package.fullName,
        resourceGroup: this.resourceGroup
      }, _);

      // If parameters come back as required with empty string as
      // default value, treat it as not having a default value at all.
      // This is consistent with portal validation behavior.
      var parameters = this.packageMetadata.metadata.parameters || [];
      this.packageMetadata.metadata.parameters = parameters.map(function (p) {
        if (p.constraints && p.constraints.required && p.defaultValue === '') {
          p = __.omit(p, 'defaultValue');
        }
        return p;
      });

      // convenience member for getting at the parameter data
      this.parameters = this.packageMetadata.metadata.parameters;
    }
  },

  getDeploymentTemplate: function (_) {
    var request = this.getGenerateDeploymentTemplateRequest();
    this.deploymentTemplate = this.apiappClient.templates.generate(this.resourceGroup, request, _);
  },

  gatherParameters: function (_) {
    if (this.packageMetadata) {
      // add artificial apiAppName parameter to the list
      this.parameters.unshift({
        name: '$apiAppName',
        displayName: 'ApiApp Name',
        defaultValue: this.package.id,
        extraValidator: validateApiAppName
      });

      var valueProvider = this.valueProvider;
      this.parameters.forEach_(_, function (_, parameter) {
        parameter.value = valueProvider(parameter, _);
      });
    }
  },

  getGenerateDeploymentTemplateRequest: function () {
    return {
      location: this.location,
      gateway: this.gatewayFragment(),
      hostingPlan: this.hostingPlanFragment(),
      packages: this.createPackageFragment()
    };
  },

  // Helper functions to generate various pieces of the payload
  // to generate the deployment template.
  gatewayFragment: function() {
    return {
      resourceType: 'Microsoft.AppService/gateways'
      // TODO: Add support for nuget installs, specific versions
    };
  },

  hostingPlanFragment: function() {
    return {
      resourceType: 'Microsoft.Web/serverfarms',
      isNewHostingPlan: false,
      // Hosting plan name is the last segment of the id
      hostingPlanName: this.hostingPlanId.split('/').pop()
    };
  },

  createPackageFragment: function() {
    if (this.package) {
      return [{
        resourceType: 'Microsoft.Web/apiapps',
        id: this.package.id,
        version: this.package.version,
        settings: this.parameters.reduce(function (acc, parameter) {
          if (parameter.uiHint === 'Microsoft.SQL' && parameter.value.isNewResource) {
            acc[parameter.name] = { isNewResource: true };
          }
          return acc;
        }, {})
      }];
    } else {
      // No package, just the gateway
      return [];
    }
  },

  createDeploymentParameters: function () {
    return {
      properties: {
        template: this.deploymentTemplate,
        parameters: this.buildDeploymentParameterValues(),
        mode: 'Incremental'
      }
    };
  },

  buildDeploymentParameterValues: function () {
    var self = this;
    var key = self.package.id;

    var result = {};

    result[key] = {
      value: {}
    };

    return self.parameters.reduce(
      function (acc, parameter) {
        var value = parameter.value;
        var secretKey = self.parameterSecret(parameter);
        if (secretKey) {
          acc[util.format('%s_%s_%s', key, parameter.name, secretKey)] = value[secretKey];
          value = __.omit(value, secretKey);
        }

        acc[key].value[parameter.name] = value;
        return acc;
      }, result);
  },

  parameterSecret: function (parameterData) {
    return parameterData.uiHint === 'Microsoft.SQL' ? 'administratorLoginPassword' : null;
  },

  createDeployment: function(_) {
    return this.resourceClient.deployments.createOrUpdate(this.resourceGroup,
      // Important to call through exports here so tests can mock out this logic
      exports.createDeploymentName(),
      this.createDeploymentParameters(),
      _);
  }
});

function validateApiAppName(value) {
  if(value.length < 8 || value.length > 50) {
    return 'Name must be between 8 and 50 characters long.';
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.]*$/.test(value)) {
    return 'Name contains invalid characters.';
  }
}

function createDeploymentName() {
  return 'AppServiceDeployment_' + uuid();
}

__.extend(exports, {
  ApiAppDeployer: ApiAppDeployer,
  validateApiAppName: validateApiAppName,
  createDeploymentName: createDeploymentName
});
