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
var tagUtils = require('../tag/tagUtils');

function Traffic(cli, trafficManagerProviderClient) {
  this.trafficManagerProviderClient = trafficManagerProviderClient;
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(Traffic.prototype, {
  create: function (resourceGroupName, name, options, _) {
    var self = this;
    var tmProfile = self.get(resourceGroupName, name, _);

    if (tmProfile) {
      throw new Error(util.format($('A Traffic Manager profile with name "%s" already exists in resource group "%s"'), name, resourceGroupName));
    }

    var profile = self._parseProfile(options, true);
    var trafficManager = {
      profile: profile
    };

    var progress = self.interaction.progress(util.format($('Creating Traffic Manager profile "%s"'), name));
    try {
      self.trafficManagerProviderClient.profiles.createOrUpdate(resourceGroupName, name, trafficManager, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, name, options, _);
  },

  set: function (resourceGroupName, name, options, _) {
    var self = this;
    var tmProfile = self.get(resourceGroupName, name, _);

    if (tmProfile) {
      var profile = self._parseProfile(options, false);
      if (options.profileStatus) tmProfile.profile.properties.profileStatus = profile.properties.profileStatus;
      if (options.trafficRoutingMethod) tmProfile.profile.properties.trafficRoutingMethod = profile.properties.trafficRoutingMethod;
      if (options.ttl) tmProfile.profile.properties.dnsConfig.ttl = profile.properties.dnsConfig.ttl;
      if (options.monitorProtocol) tmProfile.profile.properties.monitorConfig.protocol = profile.properties.monitorConfig.protocol;
      if (options.monitorPort) tmProfile.profile.properties.monitorConfig.port = profile.properties.monitorConfig.port;
      if (options.monitorPath) tmProfile.profile.properties.monitorConfig.path = profile.properties.monitorConfig.path;
      if (options.tags) tagUtils.appendTags(tmProfile.profile, profile.tags);
      if (options.tags === false) tmProfile.profile.tags = {};

      self.update(resourceGroupName, name, tmProfile, _);
      self.show(resourceGroupName, name, options, _);
    } else {
      throw new Error(util.format($('A Traffic Manager profile with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }
  },

  list: function (resourceGroupName, options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting Traffic Manager profiles'));
    var tmProfiles = null;
    try {
      tmProfiles = self.trafficManagerProviderClient.profiles.listAllInResourceGroup(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(tmProfiles.profiles, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn(util.format($('No Traffic Manager profiles found in resource group "%s"'), resourceGroupName));
      } else {
        self.output.table(outputData, function (row, tm) {
          row.cell($('Name'), tm.name);
          row.cell($('Location'), tm.location);
          row.cell($('DNS name'), tm.properties.dnsConfig.relativeName);
          row.cell($('Status'), tm.properties.profileStatus);
          row.cell($('Routing method'), tm.properties.trafficRoutingMethod);
          row.cell($('Monitoring protocol'), tm.properties.monitorConfig.protocol);
          row.cell($('Monitoring path'), tm.properties.monitorConfig.path);
          row.cell($('Monitoring port'), tm.properties.monitorConfig.port);
          row.cell($('Number of endpoints'), tm.properties.endpoints.length || 0);
        });
      }
    });
  },

  show: function (resourceGroupName, name, options, _) {
    var self = this;
    var tmProfile = self.get(resourceGroupName, name, _);

    if (!tmProfile) {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A Traffic Manager profile with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
      }
      return;
    }
    self._showProfile(tmProfile.profile);
  },

  get: function (resourceGroupName, name, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the Traffic Manager profile "%s"'), name));
    try {
      var tmProfile = self.trafficManagerProviderClient.profiles.get(resourceGroupName, name, _);
      return tmProfile;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  delete: function (resourceGroupName, name, options, _) {
    var self = this;
    var tmProfile = self.get(resourceGroupName, name, _);
    if (!tmProfile) {
      throw new Error(util.format('Traffic Manager profile with name "%s" not found in the resource group "%s"', name, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete Traffic Manager profile %s? [y/n] '), name), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting Traffic Manager profile "%s"'), name));
    try {
      self.trafficManagerProviderClient.profiles.deleteMethod(resourceGroupName, name, _);
    } finally {
      progress.end();
    }
  },

  checkDnsAvailability: function (resourceGroupName, relativeDnsName, options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting Traffic Manager profiles'));
    var profiles = null;
    try {
      profiles = self.trafficManagerProviderClient.profiles.listAllInResourceGroup(resourceGroupName, _);
    } finally {
      progress.end();
    }

    var tmProfile;
    for (var i = 0; i < profiles.profiles.length; i++) {
      var item = profiles.profiles[i];
      if (item.properties.dnsConfig && item.properties.dnsConfig.relativeName === relativeDnsName.toLowerCase()) {
        tmProfile = item;
        break;
      }
    }

    if (self.output.format().json) {
      self.output.json({
        isAvailable: tmProfile ? false : true
      });
      return;
    }

    if (tmProfile) {
      self.output.warn(util.format($('The DNS name "%s" is already reserved by "%s" Traffic Manager profile'), relativeDnsName, tmProfile.name));
    } else {
      self.output.info(util.format($('The DNS name "%s" is available in resource group "%s"'), relativeDnsName, resourceGroupName));
    }
  },

  createEndpoint: function (resourceGroupName, profileName, endpointName, options, _) {
    var self = this;
    var endpoint = self._parseEndpoint(endpointName, options, true);
    var trafficManager = self.get(resourceGroupName, profileName, _);
    if (!trafficManager) {
      throw new Error(util.format($('A Traffic Manager with name "%s" not found in the resource group "%s"'), profileName, resourceGroupName));
    }

    var ep = utils.findFirstCaseIgnore(trafficManager.profile.properties.endpoints, {name: endpointName});

    if (ep) {
      self.output.error(util.format($('An endpoint with name "%s" already exist in Traffic Manager "%s"'), endpointName, profileName));
    } else {
      trafficManager.profile.properties.endpoints.push(endpoint);
      self.update(resourceGroupName, profileName, trafficManager, _);
      self.show(resourceGroupName, profileName, options, _);
    }
  },

  setEndpoint: function (resourceGroupName, profileName, endpointName, options, _) {
    var self = this;
    var endpoint = self._parseEndpoint(endpointName, options, false);
    var trafficManager = self.get(resourceGroupName, profileName, _);
    if (!trafficManager) {
      throw new Error(util.format($('A Traffic Manager with name "%s" not found in the resource group "%s"'), profileName, resourceGroupName));
    }

    var ep = utils.findFirstCaseIgnore(trafficManager.profile.properties.endpoints, {name: endpointName});

    if (ep) {
      if (options.type) ep.type = endpoint.type;
      if (options.target) ep.properties.target = endpoint.properties.target;
      if (options.endpointStatus) ep.properties.endpointStatus = endpoint.properties.endpointStatus;
      if (options.weight) ep.properties.weight = endpoint.properties.weight;
      if (options.priority) ep.properties.priority = endpoint.properties.priority;
      self.update(resourceGroupName, profileName, trafficManager, _);
      self.show(resourceGroupName, profileName, options, _);
    } else {
      self.output.error(util.format($('An endpoint with name "%s" not found in the Traffic Manager "%s"'), endpointName, profileName));
    }
  },

  deleteEndpoint: function (resourceGroupName, profileName, endpointName, options, _) {
    var self = this;
    var trafficManager = self.get(resourceGroupName, profileName, _);
    if (!trafficManager) {
      throw new Error(util.format($('A Traffic Manager with name "%s" not found in the resource group "%s"'), profileName, resourceGroupName));
    }

    var index = utils.indexOfCaseIgnore(trafficManager.profile.properties.endpoints, {name: endpointName});
    if (index !== -1) {
      if (!options.quiet && !self.interaction.confirm(util.format($('Delete an endpoint "%s?" [y/n] '), endpointName), _)) {
        return;
      }

      trafficManager.profile.properties.endpoints.splice(index, 1);
      self.update(resourceGroupName, profileName, trafficManager, _);
    } else {
      self.output.error(util.format($('An endpoint with name "%s" not found in the Traffic Manager "%s"'), endpointName, profileName));
    }
  },

  update: function (resourceGroupName, profileName, trafficManager, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Updating Traffic Manager "%s"'), profileName));
    try {
      self.trafficManagerProviderClient.profiles.createOrUpdate(resourceGroupName, profileName, trafficManager, _);
    } finally {
      progress.end();
    }
  },

  _parseEndpoint: function (endpointName, options, useDefaults) {
    var self = this;
    var endpoint = {
      name: endpointName,
      properties: {}
    };

    if (options.type) {
      endpoint.type = utils.verifyParamExistsInCollection(constants.TM_VALID_ENDPOINT_TYPES,
        options.type, 'endpoint type');

      if (endpoint.type == constants.TM_VALID_ENDPOINT_TYPES[0]) {
        endpoint.type = 'Microsoft.Network/trafficmanagerprofiles/ExternalEndpoints';
      }
    } else if (useDefaults) {
      endpoint.type = 'Microsoft.Network/trafficmanagerprofiles/ExternalEndpoints';
    }

    if (options.target) {
      if (utils.stringIsNullOrEmpty(options.target)) {
        throw new Error($('Target parameter must not be null or empty string'));
      }
      endpoint.properties.target = utils.trimTrailingChar(options.target, '.');
    }

    if (options.endpointStatus) {
      endpoint.properties.endpointStatus = utils.verifyParamExistsInCollection(constants.TM_VALID_ENDPOINT_STATUSES,
        options.endpointStatus, 'endpoint status');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default endpoint status: %s'), constants.TM_VALID_ENDPOINT_STATUSES[0]));
      endpoint.properties.endpointStatus = constants.TM_VALID_ENDPOINT_STATUSES[0];
    }

    if (options.weight) {
      var weightAsInt = utils.parseInt(options.weight);
      if (weightAsInt != options.weight) {
        throw new Error($('Weight parameter must be an integer'));
      }
      endpoint.properties.weight = options.weight;
    }

    if (options.priority) {
      var priorityAsInt = utils.parseInt(options.priority);
      if (priorityAsInt != options.priority) {
        throw new Error($('Priority parameter must be an integer'));
      }
      endpoint.properties.priority = options.priority;
    }

    if (options.endpointLocation) {
      endpoint.properties.endpointLocation = options.endpointLocation;
    }

    return endpoint;
  },

  _parseProfile: function (options, useDefaults) {
    var self = this;
    var parameters = {};

    if (options.location) {
      parameters.location = options;
    } else {
      if (useDefaults) {
        parameters.location = constants.TM_DEFAULT_LOCATION;
      }
    }
    parameters.properties = {
      dnsConfig: {
        relativeName: options.relativeDnsName
      },
      endpoints: []
    };

    if (options.profileStatus) {
      utils.verifyParamExistsInCollection(constants.statuses, options.profileStatus, 'profile-status');
      parameters.properties.profileStatus = options.profileStatus;
    } else {
      if (useDefaults) {
        parameters.properties.profileStatus = constants.TM_DEFAULT_PROFILE_STATUS;
      }
    }

    if (options.trafficRoutingMethod) {
      utils.verifyParamExistsInCollection(constants.trafficRoutingMethods, options.trafficRoutingMethod, 'traffic-routing-method');
      parameters.properties.trafficRoutingMethod = options.trafficRoutingMethod;
    } else {
      if (useDefaults) {
        parameters.properties.trafficRoutingMethod = constants.TM_DEFAULT_ROUTING_METHOD;
      }
    }

    if (options.ttl) {
      var ttl = parseInt(options.ttl);
      if (!ttl || ttl < 0) {
        throw new Error('time to live parameter must be a positive integer value');
      }
      parameters.properties.dnsConfig.ttl = options.ttl;
    } else {
      if (useDefaults) {
        parameters.properties.dnsConfig.ttl = constants.TM_DEFAULT_TIME_TO_LIVE;
      }
    }

    parameters.properties.monitorConfig = {};
    if (options.monitorProtocol) {
      utils.verifyParamExistsInCollection(constants.monitorProtocols, options.monitorProtocol, 'monitor-protocol');
      parameters.properties.monitorConfig.protocol = options.monitorProtocol;
    } else {
      if (useDefaults) {
        parameters.properties.monitorConfig.protocol = constants.TM_DEFAULT_MONITOR_PROTOCOL;
      }
    }

    if (options.monitorPort) {
      var monitorPort = parseInt(options.monitorPort);
      if (!monitorPort || monitorPort < 0) {
        throw new Error('monitor port parameter must be a positive integer value');
      }
      parameters.properties.monitorConfig.port = options.monitorPort;
    } else {
      if (useDefaults) {
        if (parameters.properties.monitorConfig.protocol === 'http') {
          parameters.properties.monitorConfig.port = constants.TM_DEFAULT_MONITOR_PORT.http;
        }
        if (parameters.properties.monitorConfig.protocol === 'https') {
          parameters.properties.monitorConfig.port = constants.TM_DEFAULT_MONITOR_PORT.https;
        }
      }
    }

    if (options.monitorPath) {
      parameters.properties.monitorConfig.path = options.monitorPath;
    }

    if (options.tags) {
      var tags = tagUtils.buildTagsParameter(null, options);
      parameters.tags = tags;
    } else {
      self.output.verbose($('No tags specified'));
    }

    return parameters;
  },

  _showProfile: function (tmProfile) {
    var self = this;
    self.interaction.formatOutput(tmProfile, function (tm) {
      self.output.nameValue($('Id'), tm.id);
      self.output.nameValue($('Name'), tm.name);
      self.output.nameValue($('Type'), tm.type);
      self.output.nameValue($('Location'), tm.location);
      self.output.nameValue($('Status'), tm.properties.profileStatus);
      self.output.nameValue($('Routing method'), tm.properties.trafficRoutingMethod);
      self.output.nameValue($('DNS name'), tm.properties.dnsConfig.relativeName);
      self.output.nameValue($('Time to live'), tm.properties.dnsConfig.ttl);
      self.output.nameValue($('Monitoring protoco'), tm.properties.monitorConfig.protocol);
      self.output.nameValue($('Monitoring path'), tm.properties.monitorConfig.path);
      self.output.nameValue($('Monitoring port'), tm.properties.monitorConfig.port);
      self.output.nameValue($('Tags'), tagUtils.getTagsInfo(tm.tags));

      var endpoints = tm.properties.endpoints;
      if (endpoints.length !== 0) {
        self.output.header($('Endpoints'));
        self.output.table(endpoints, function (row, ep) {
          row.cell($('Name'), ep.name);
          row.cell($('Location'), ep.properties.endpointLocation || '');
          row.cell($('Target'), ep.properties.target);
          row.cell($('Status'), ep.properties.endpointStatus);
          row.cell($('Weight'), ep.properties.weight);
          row.cell($('Priority'), ep.properties.priority);
          row.cell($('Type'), ep.type);
        });
      }
    });
  }
});

module.exports = Traffic;