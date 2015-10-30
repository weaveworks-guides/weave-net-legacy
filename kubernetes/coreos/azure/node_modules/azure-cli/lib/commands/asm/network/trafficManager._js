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

var __ = require('underscore');
var util = require('util');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var constants = require('./constants');
var EndPointUtil = require('../../../util/endpointUtil');

function TrafficManager(cli, trafficManagerManagementClient) {
  this.trafficManagerManagementClient = trafficManagerManagementClient;
  this.endpointUtil = new EndPointUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(TrafficManager.prototype, {
  create: function (profileName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      var profileProgress = self.interaction.progress(util.format($('Creating Traffic Manager profile "%s"'), profileName));
      try {
        self.trafficManagerManagementClient.profiles.create(profileName, options.domainName, _);
      } finally {
        profileProgress.end();
      }
      tmProfile = self.getProfile(profileName, _);
    }

    if (tmProfile.profile.definitions.length > 0) {
      throw new Error(util.format($('Traffic Manager profile "%s" already exists'), profileName));
    }

    var tmDefConfig = self._prepareDefinition(options);
    var definitionProgress = self.interaction.progress(util.format($('Creating Traffic Manager definition for profile "%s"'), profileName));
    try {
      self.trafficManagerManagementClient.definitions.create(profileName, tmDefConfig, _);
    } finally {
      definitionProgress.end();
    }

    var tmDefinition = self.getDefinition(profileName, _);
    self._showTrafficManager(profileName, tmProfile, tmDefinition);
  },

  set: function (profileName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      throw new Error(util.format($('Traffic Manager "%s" not found'), profileName));
    }

    var tmDefinition = self.getDefinition(profileName, _);
    if (!tmDefinition) {
      tmDefinition = self._prepareDefinition(options);
    } else {
      tmDefinition = tmDefinition.definition;
      self._validateDefinitionOptions(options, false);
      if (options.ttl) tmDefinition.dnsOptions.timeToLiveInSeconds = options.ttl;
      if (options.monitorRelativePath) tmDefinition.monitors[0].httpOptions.relativePath = options.monitorRelativePath;
      if (options.monitorPort) tmDefinition.monitors[0].port = options.monitorPort;
      if (options.monitorProtocol) tmDefinition.monitors[0].protocol = options.monitorProtocol;
      if (options.loadBalancingMethod) tmDefinition.policy.loadBalancingMethod = options.loadBalancingMethod;
    }

    var definitionProgress = self.interaction.progress(util.format($('Updating Traffic Manager "%s"'), profileName));
    try {
      self.trafficManagerManagementClient.definitions.create(profileName, tmDefinition, _);
    } finally {
      definitionProgress.end();
    }

    tmDefinition = self.getDefinition(profileName, _);
    self._showTrafficManager(profileName, tmProfile, tmDefinition);
  },

  show: function (profileName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    var tmDefinition = self.getDefinition(profileName, _);
    self._showTrafficManager(profileName, tmProfile, tmDefinition);
  },

  list: function (options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting Traffic Manager profiles'));

    var tmProfiles = null;
    try {
      tmProfiles = self.trafficManagerManagementClient.profiles.list(_);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(tmProfiles.profiles, function (data) {
      if (data.length === 0) {
        self.output.warn($('No Traffic Manager profiles found'));
      } else {
        self.output.table(data, function (row, item) {
          row.cell($('Name'), item.name);
          row.cell($('Domain name'), item.domainName);
          row.cell($('Status'), item.status);
        });
      }
    });
  },

  delete: function (profileName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      throw new Error(util.format('Traffic manager profile with name "%s" not found', profileName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete Traffic Manager profile "%s"? [y/n] '), profileName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting Traffic Manager profile "%s"'), profileName));
    try {
      self.trafficManagerManagementClient.profiles.deleteMethod(profileName, _);
    } finally {
      progress.end();
    }
  },

  enable: function (profileName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        throw new Error(util.format('Traffic manager profile with name "%s" not found', profileName));
      }
    } else {
      var definitionVersionNumber = tmProfile.profile.definitions[0].version;
      self.update(profileName, 'Enabled', definitionVersionNumber, _);
      self.show(profileName, options, _);
    }
  },

  disable: function (profileName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        throw new Error(util.format('Traffic manager profile with name "%s" not found', profileName));
      }
    } else {
      var definitionVersionNumber = tmProfile.profile.definitions[0].version;
      self.update(profileName, 'Disabled', definitionVersionNumber, _);
      self.show(profileName, options, _);
    }
  },

  getDefinition: function (profileName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the Traffic Manager definition "%s"'), profileName));
    try {
      var tmDefinition = self.trafficManagerManagementClient.definitions.get(profileName, _);
      return tmDefinition;
    } catch (e) {
      if (e.code === 'ResourceNotFound') {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  getProfile: function (profileName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the Traffic Manager profile "%s"'), profileName));
    try {
      var tmProfile = self.trafficManagerManagementClient.profiles.get(profileName, _);
      return tmProfile;
    } catch (e) {
      if (e.code === 'ResourceNotFound') {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  update: function (profileName, profileStatus, definitionVersionNumber, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Updating Traffic Manager profile "%s"'), profileName));
    try {
      self.trafficManagerManagementClient.profiles.update(profileName, profileStatus, definitionVersionNumber, _);
    } finally {
      progress.end();
    }
  },

  createEndpoint: function (profileName, domainName, endpointType, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      throw new Error(util.format($('Traffic manager profile with name "%s" not found'), profileName));
    }

    var tmDefinition = self.getDefinition(profileName, _).definition;
    if (utils.findFirstCaseIgnore(tmDefinition.policy.endpoints, {domainName: domainName})) {
      throw new Error(util.format($('An endpoint with name "%s" already exists for Traffic Manager profile "%s"'), domainName, profileName));
    }

    var endpoint = {
      domainName: domainName,
      status: constants.trafficManager.endpoints.statuses[0],
      type: utils.verifyParamExistsInCollection(constants.trafficManager.endpoints.types,
        endpointType, 'endpoint type')
    };

    if (options.endpointLocation) {
      endpoint.location = options.endpointLocation;
    }
    if (options.endpointStatus) {
      endpoint.endpointStatus = utils.verifyParamExistsInCollection(constants.trafficManager.endpoints.statuses,
        options.endpointStatus, 'endpoint status');
    }
    if (options.weight) {
      endpoint.weight = options.weight;
    }
    if (options.minChildEndpoint) {
      if (endpoint.type === constants.trafficManager.endpoints.types[0]) {
        endpoint.minChildEndpoint = options.minChildEndpoint;
      } else {
        self.output.warn(util.format($('--min-child-endpoint will be ignored for %s endpoint type'), options.type));
      }
    }

    tmDefinition.policy.endpoints.push(endpoint);

    var progress = self.interaction.progress(util.format($('Creating endpoint %s for Traffic Manager profile "%s"'), domainName, profileName));
    try {
      self.trafficManagerManagementClient.definitions.create(profileName, tmDefinition, _);
    } finally {
      progress.end();
    }
    self.show(profileName, options, _);
  },

  setEndpoint: function (profileName, domainName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      throw new Error(util.format($('Traffic manager profile with name "%s" not found'), profileName));
    }

    var tmDefinition = self.getDefinition(profileName, _).definition;
    var endpoint = utils.findFirstCaseIgnore(tmDefinition.policy.endpoints, {domainName: domainName});
    if (!endpoint) {
      throw new Error(util.format($('An endpoint with name "%s" not found for Traffic Manager profile "%s"'), domainName, profileName));
    }

    if (options.endpointLocation) {
      endpoint.location = options.endpointLocation;
    }
    if (options.endpointStatus) {
      endpoint.endpointStatus = utils.verifyParamExistsInCollection(constants.trafficManager.endpoints.statuses,
        options.endpointStatus, 'endpoint status');
    }
    if (options.weight) {
      endpoint.weight = options.weight;
    }
    if (options.type) {
      endpoint.type = utils.verifyParamExistsInCollection(constants.trafficManager.endpoints.types,
        options.type, 'endpoint type');
    }
    if (options.minChildEndpoint) {
      if (endpoint.type === constants.trafficManager.endpoints.types[0]) {
        endpoint.minChildEndpoint = options.minChildEndpoint;
      } else {
        self.output.warn(util.format($('--min-child-endpoint will be ignored for %s endpoint type'), options.type));
      }
    }

    var progress = self.interaction.progress(util.format($('Updating endpoint "%s" for Traffic Manager profile "%s"'), domainName, profileName));
    try {
      self.trafficManagerManagementClient.definitions.create(profileName, tmDefinition, _);
    } finally {
      progress.end();
    }
    self.show(profileName, options, _);
  },

  deleteEndpoint: function (profileName, domainName, options, _) {
    var self = this;
    var tmProfile = self.getProfile(profileName, _);
    if (!tmProfile) {
      throw new Error(util.format($('Traffic manager profile with name "%s" not found'), profileName));
    }

    var tmDefinition = self.getDefinition(profileName, _).definition;
    var index = utils.indexOfCaseIgnore(tmDefinition.policy.endpoints, {domainName: domainName});
    if (index !== -1) {
      if (!options.quiet && !self.interaction.confirm(util.format($('Delete endpoint %s for Traffic Manager profile "%s"? [y/n] '), domainName, profileName), _)) {
        return;
      }
      tmDefinition.policy.endpoints.splice(index, 1);
    } else {
      throw new Error(util.format($('An endpoint with name "%s" not found for Traffic Manager profile "%s"'), domainName, profileName));
    }

    var progress = self.interaction.progress(util.format($('Deleting endpoint %s for Traffic Manager profile "%s"'), domainName, profileName));
    try {
      self.trafficManagerManagementClient.definitions.create(profileName, tmDefinition, _);
    } finally {
      progress.end();
    }
  },

  _showTrafficManager: function (profileName, tmProfile, tmDefinition) {
    var self = this;

    var tm = {
      profile: tmProfile.profile,
      definition: tmDefinition.definition
    };

    if (tmProfile) {
      self.interaction.formatOutput(tm, function (tm) {
        self.output.nameValue($('Name'), tm.profile.name);
        self.output.nameValue($('Domain name'), tm.profile.domainName);
        self.output.nameValue($('Status'), tm.profile.status);
        if (tm.definition) {
          self.output.nameValue($('TTL'), tm.definition.dnsOptions.timeToLiveInSeconds);
          self.output.nameValue($('Load balancing method'), tm.definition.policy.loadBalancingMethod);
          self.output.nameValue($('Monitor status'), tm.definition.policy.monitorStatus);
          if (tm.definition.monitors && tm.definition.monitors.length > 0) {
            self.output.header($('Monitors'));
            tm.definition.monitors.forEach(function (monitor) {
              self.output.nameValue($('Interval in seconds'), monitor.intervalInSeconds, 2);
              self.output.nameValue($('Timeout in seconds'), monitor.timeoutInSeconds, 2);
              self.output.nameValue($('Tolerated number of failures'), monitor.toleratedNumberOfFailures, 2);
              self.output.nameValue($('Protocol'), monitor.protocol, 2);
              self.output.nameValue($('Port'), monitor.port, 2);
              self.output.nameValue($('Verb'), monitor.httpOptions.verb, 2);
              self.output.nameValue($('Relative path'), monitor.httpOptions.relativePath, 2);
              self.output.nameValue($('Expected status code'), monitor.httpOptions.expectedStatusCode, 2);
            });
          }
          if (tm.definition.endpoints && tm.definition.endpoints.length > 0) {
            self.output.header($('Endpoints'));
            tm.definition.endpoints.forEach(function (endpoint) {
              self.output.nameValue($('Domain name'), endpoint.domainName, 2);
              self.output.nameValue($('Status'), endpoint.status, 2);
              self.output.nameValue($('Type'), endpoint.type, 2);
              self.output.nameValue($('Location'), endpoint.location, 2);
              self.output.nameValue($('Minimum child endpoints'), endpoint.minChildEndpoints, 2);
              self.output.nameValue($('Weight'), endpoint.weight, 2);
            });
          }
        }
      });
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A Traffic Manager profile with name "%s" not found'), profileName));
      }
    }
  },

  _validateDefinitionOptions: function (options, useDefaults) {
    var self = this;
    if (!options.monitorRelativePath && useDefaults) {
      throw new Error($('--monitor-relative-path parameter must be set'));
    }

    if (options.ttl) {
      var validatedTtl = self.endpointUtil.validateTtl(options.ttl, '--ttl');
      if (validatedTtl.error) {
        throw new Error(validatedTtl.error);
      }
    } else if (useDefaults) {
      self.output.warn('--ttl parameter is not set. Using default TTL - ' + constants.trafficManager.ttl);
      options.ttl = constants.trafficManager.ttl;
    }

    if (options.monitorPort) {
      var validatedPort = self.endpointUtil.validatePort(options.monitorPort, '--monitor-port');
      if (validatedPort.error) {
        throw new Error(validatedPort.error);
      }
    } else if (useDefaults) {
      self.output.warn('--monitor-port parameter is not set. Using default port - ' + constants.trafficManager.port);
      options.monitorPort = constants.trafficManager.ttl;
    }

    if (options.monitorProtocol) {
      self._validateProtocol(options.monitorProtocol);
    } else if (useDefaults) {
      self.output.warn('--monitor-protocol parameter is not set. Using default protocol - ' + constants.trafficManager.protocol);
      options.monitorProtocol = constants.trafficManager.protocol;
    }

    if (options.loadBalancingMethod) {
      self._validateLoadBalancingMethod(options.loadBalancingMethod);
    } else if (useDefaults) {
      self.output.warn('--load-balancing-method parameter is not set. Using default load balancing method - ' + constants.trafficManager.loadBalancingMethod);
      options.loadBalancingMethod = constants.trafficManager.loadBalancingMethod;
    }
  },

  _prepareDefinition: function (options) {
    var self = this;
    self._validateDefinitionOptions(options, true);

    return {
      dnsOptions: {
        timeToLiveInSeconds: options.ttl
      },
      monitors: [
        {
          httpOptions: {
            relativePath: options.monitorRelativePath,
            verb: constants.trafficManager.verb,
            expectedStatusCode: constants.trafficManager.statusCode
          },
          intervalInSeconds: constants.trafficManager.interval,
          port: options.monitorPort,
          protocol: options.monitorProtocol,
          timeoutInSeconds: constants.trafficManager.timeout,
          toleratedNumberOfFailures: constants.trafficManager.numberOfFailures
        }
      ],
      policy: {
        endpoints: [],
        loadBalancingMethod: options.loadBalancingMethod
      }
    };
  },

  _validateProtocol: function (protocol) {
    protocol = protocol.toLowerCase();
    if (!__.contains(constants.trafficManager.protocols, protocol)) {
      throw new Error(util.format($('--monitor-protocol is invalid. Valid values are [%s].'), constants.trafficManager.protocols));
    }
  },

  _validateLoadBalancingMethod: function (loadBalancingMethod) {
    loadBalancingMethod = loadBalancingMethod.toLowerCase();
    if (!__.contains(constants.trafficManager.loadBalancingMethods, loadBalancingMethod)) {
      throw new Error(util.format($('--load-balancing-method is invalid. Valid values are [%s].'), constants.trafficManager.loadBalancingMethods));
    }
  }
});

module.exports = TrafficManager;