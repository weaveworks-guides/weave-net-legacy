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
var resourceUtils = require('../resource/resourceUtils');
var VNetUtil = require('../../../util/vnet.util');

function Nsg(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(Nsg.prototype, {
  create: function (resourceGroupName, nsgName, location, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);

    if (nsg) {
      throw new Error(util.format($('A network security group with name "%s" already exists in the resource group "%s"'), nsgName, resourceGroupName));
    }

    var nsgProfile = {
      name: nsgName,
      location: location
    };

    if (options.tags) {
      nsgProfile.tags = tagUtils.buildTagsParameter(null, options);
    }

    var progress = self.interaction.progress(util.format($('Creating a network security group "%s"'), nsgName));
    try {
      self.networkResourceProviderClient.networkSecurityGroups.createOrUpdate(resourceGroupName, nsgName, nsgProfile, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, nsgName, options, _);
  },

  set: function (resourceGroupName, nsgName, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);

    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found in the resource group "%s"'), nsgName, resourceGroupName));
    }

    if (options.tags) {
      tagUtils.appendTags(nsg, tagUtils.buildTagsParameter(null, options));
    }
    if (options.tags === false) {
      nsg.tags = {};
    }

    var progress = self.interaction.progress(util.format($('Setting a network security group "%s"'), nsgName));
    try {
      self.networkResourceProviderClient.networkSecurityGroups.createOrUpdate(resourceGroupName, nsgName, nsg, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, nsgName, options, _);
  },

  list: function (resourceGroupName, options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting the network security groups'));
    var groups = null;
    try {
      groups = self.networkResourceProviderClient.networkSecurityGroups.list(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(groups.networkSecurityGroups, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn($('No network security groups found'));
      } else {
        self.output.table(outputData, function (row, nsg) {
          row.cell($('Name'), nsg.name);
          row.cell($('Location'), nsg.location);
        });
      }
    });
  },

  show: function (resourceGroupName, nsgName, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);

    if (nsg) {
      var resourceInfo = resourceUtils.getResourceInformation(nsg.id);
      var rules = self._getAllRules(nsg);
      self.interaction.formatOutput(nsg, function (nsg) {
        self.output.nameValue($('Id'), nsg.id);
        self.output.nameValue($('Name'), nsg.name);
        self.output.nameValue($('Type'), resourceInfo.resourceType);
        self.output.nameValue($('Location'), nsg.location);
        self.output.nameValue($('Provisioning state'), nsg.provisioningState);
        self.output.nameValue($('Tags'), tagUtils.getTagsInfo(nsg.tags));

        if (rules.length > 0) {
          self.output.header($('Security group rules'));
          self.output.table(rules, function (row, rule) {
            row.cell($('Name'), rule.name);
            row.cell($('Source IP'), rule.sourceAddressPrefix);
            row.cell($('Source Port'), rule.sourcePortRange);
            row.cell($('Destination IP'), rule.destinationAddressPrefix);
            row.cell($('Destination Port'), rule.destinationPortRange);
            row.cell($('Protocol'), rule.protocol);
            row.cell($('Direction'), rule.direction);
            row.cell($('Access'), rule.access);
            row.cell($('Priority'), rule.priority);
          });
        }
      });
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A network security group with name "%s" not found in the resource group "%s"'), nsgName, resourceGroupName));
      }
    }
  },

  delete: function (resourceGroupName, nsgName, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found in the resource group "%s"'), nsgName, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete network security group "%s"? [y/n] '), nsgName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting network security group "%s"'), nsgName));
    try {
      self.networkResourceProviderClient.networkSecurityGroups.deleteMethod(resourceGroupName, nsgName, _);
    } finally {
      progress.end();
    }
  },

  get: function (resourceGroupName, nsgName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the network security group "%s"'), nsgName));
    try {
      var nsg = self.networkResourceProviderClient.networkSecurityGroups.get(resourceGroupName, nsgName, _);
      return nsg.networkSecurityGroup;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  createRule: function (resourceGroupName, nsgName, ruleName, options, _) {
    var self = this;
    var nsgProfile = self._parseSecurityRule(options, true);

    var rule = self.getRule(resourceGroupName, nsgName, ruleName, _);
    if (rule) {
      throw new Error(util.format($('A network security rule with name "%s" already exists in the network security group "%s"'), ruleName, nsgName));
    }

    var progress = self.interaction.progress(util.format($('Creating a network security rule "%s"'), ruleName));
    try {
      self.networkResourceProviderClient.securityRules.createOrUpdate(resourceGroupName, nsgName, ruleName, nsgProfile, _);
    } finally {
      progress.end();
    }
    self.showRule(resourceGroupName, nsgName, ruleName, options, _);
  },

  setRule: function (resourceGroupName, nsgName, ruleName, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found in the resource group "%s"'), ruleName, resourceGroupName));
    }

    var rule = self._findSecurityRule(nsg, ruleName);
    if (!rule) {
      rule = self._findDefaultRule(nsg, ruleName);
      if (rule) {
        throw new Error(util.format($('Setting up for a network default security rule is not supported')));
      }
      throw new Error(util.format($('A network security rule with name "%s" not found in the security group "%s"'), ruleName, nsgName));
    }

    var ruleProfile = self._parseSecurityRule(options, false);
    if (options.description) rule.description = ruleProfile.description;
    if (options.protocol) rule.protocol = ruleProfile.protocol;
    if (options.sourceAddressPrefix) rule.sourceAddressPrefix = ruleProfile.sourceAddressPrefix;
    if (options.sourcePortRange) rule.sourcePortRange = ruleProfile.sourcePortRange;
    if (options.destinationAddressPrefix) rule.destinationAddressPrefix = ruleProfile.destinationAddressPrefix;
    if (options.destinationPortRange) rule.destinationPortRange = ruleProfile.destinationPortRange;
    if (options.access) rule.access = ruleProfile.access;
    if (options.priority) rule.priority = ruleProfile.priority;
    if (options.direction) rule.direction = ruleProfile.direction;

    var progress = self.interaction.progress(util.format($('Setting a network security rule "%s"'), ruleName));
    try {
      self.networkResourceProviderClient.securityRules.createOrUpdate(resourceGroupName, nsgName, ruleName, rule, _);
    } finally {
      progress.end();
    }
    self.showRule(resourceGroupName, nsgName, ruleName, options, _);
  },

  listRules: function (resourceGroupName, nsgName, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);
    var rules = self._getAllRules(nsg);

    self.interaction.formatOutput(rules, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn($('No rules found'));
      } else {
        self.output.table(outputData, function (row, rule) {
          row.cell($('Name'), rule.name);
          row.cell($('Source IP'), rule.sourceAddressPrefix);
          row.cell($('Source Port'), rule.sourcePortRange);
          row.cell($('Destination IP'), rule.destinationAddressPrefix);
          row.cell($('Destination Port'), rule.destinationPortRange);
          row.cell($('Protocol'), rule.protocol);
          row.cell($('Direction'), rule.direction);
          row.cell($('Access'), rule.access);
          row.cell($('Priority'), rule.priority);
        });
      }
    });
  },

  showRule: function (resourceGroupName, nsgName, ruleName, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);

    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found in the resource group "%s"'), nsgName, resourceGroupName));
    }

    var rule = self._findSecurityRule(nsg, ruleName);
    if (!rule) {
      rule = self._findDefaultRule(nsg, ruleName);
    }

    if (rule) {
      var resourceInfo = resourceUtils.getResourceInformation(rule.id);
      self.interaction.formatOutput(rule, function (rule) {
        self.output.nameValue($('Id'), rule.id);
        self.output.nameValue($('Name'), rule.name);
        self.output.nameValue($('Type'), resourceInfo.resourceType);
        self.output.nameValue($('Provisioning state'), rule.provisioningState);
        self.output.nameValue($('Description'), rule.description);
        self.output.nameValue($('Source IP'), rule.sourceAddressPrefix);
        self.output.nameValue($('Source Port'), rule.sourcePortRange);
        self.output.nameValue($('Destination IP'), rule.destinationAddressPrefix);
        self.output.nameValue($('Destination Port'), rule.destinationPortRange);
        self.output.nameValue($('Protocol'), rule.protocol);
        self.output.nameValue($('Direction'), rule.direction);
        self.output.nameValue($('Access'), rule.access);
        self.output.nameValue($('Priority'), rule.priority);
      });
    } else {
      if (output.format().json) {
        output.json({});
      } else {
        output.warn(util.format($('A network security rule with name "%s" not found in the security group "%s"'), ruleName, nsgName));
      }
    }
  },

  deleteRule: function (resourceGroupName, nsgName, ruleName, options, _) {
    var self = this;
    var nsg = self.get(resourceGroupName, nsgName, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found in the resource group "%s"'), ruleName, resourceGroupName));
    }

    var rule = self._findSecurityRule(nsg, ruleName);
    if (!rule) {
      rule = self._findDefaultRule(nsg, ruleName);
      if (rule) {
        throw new Error(util.format($('A network default security rule with name "%s" cannot be deleted'), ruleName));
      }
      throw new Error(util.format($('A network security rule with name "%s" not found in the security group "%s"'), ruleName, nsgName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete network security rule "%s"? [y/n] '), ruleName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting network security rule "%s"'), ruleName));
    try {
      self.networkResourceProviderClient.securityRules.deleteMethod(resourceGroupName, nsgName, ruleName, _);
    } finally {
      progress.end();
    }
  },

  getRule: function (resourceGroupName, nsgName, ruleName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the network security rule "%s"'), ruleName));
    try {
      var rule = self.networkResourceProviderClient.securityRules.get(resourceGroupName, nsgName, ruleName, _);
      return rule;
    } catch (e) {
      if (e.code === 'NotFound') {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  _parseSecurityRule: function (params, useDefaults) {
    var self = this;
    var ruleProfile = {};

    var protocols = constants.protocols;
    var accessTypes = constants.accessModes;
    var directions = constants.directionModes;
    var priorityRange = constants.priorityBounds;

    if (params.description) {
      if (params.description !== true && params.description !== '\'\'') {
        if (params.description.length > 140) {
          throw new Error($('description parameter restricted to 140 chars'));
        }
        ruleProfile.description = params.description;
      }
    }

    if (params.protocol) {
      if (utils.stringIsNullOrEmpty(params.protocol)) {
        throw new Error($('protocol parameter must not be null or empty string'));
      }
      ruleProfile.protocol = utils.verifyParamExistsInCollection(protocols,
        params.protocol, 'protocol');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default protocol: %s'), constants.NSG_DEFAULT_PROTOCOL));
      ruleProfile.protocol = constants.NSG_DEFAULT_PROTOCOL;
    }

    if (params.sourcePortRange) {
      ruleProfile.sourcePortRange = self._validatePortRange(params.sourcePortRange, 'source');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default source port: %s'), constants.NSG_DEFAULT_SOURCE_PORT));
      ruleProfile.sourcePortRange = constants.NSG_DEFAULT_SOURCE_PORT;
    }

    if (params.destinationPortRange) {
      ruleProfile.destinationPortRange = self._validatePortRange(params.destinationPortRange, 'destination');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default destination port: %s'), constants.NSG_DEFAULT_DESTINATION_PORT));
      ruleProfile.destinationPortRange = constants.NSG_DEFAULT_DESTINATION_PORT;
    }

    if (params.sourceAddressPrefix) {
      ruleProfile.sourceAddressPrefix = self._validateAddressPrefix(params.sourceAddressPrefix, 'source');
    }
    else if (useDefaults) {
      self.output.warn(util.format($('Using default source address prefix: %s'), constants.NSG_DEFAULT_SOURCE_ADDRESS_PREFIX));
      ruleProfile.sourceAddressPrefix = constants.NSG_DEFAULT_SOURCE_ADDRESS_PREFIX;
    }

    if (params.destinationAddressPrefix) {
      ruleProfile.destinationAddressPrefix = self._validateAddressPrefix(params.destinationAddressPrefix, 'destination');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default destination address prefix: %s'), constants.NSG_DEFAULT_DESTINATION_ADDRESS_PREFIX));
      ruleProfile.destinationAddressPrefix = constants.NSG_DEFAULT_DESTINATION_ADDRESS_PREFIX;
    }

    if (params.access) {
      if (utils.stringIsNullOrEmpty(params.access)) {
        throw new Error($('access parameter must not be null or empty string'));
      }
      ruleProfile.access = utils.verifyParamExistsInCollection(accessTypes,
        params.access, 'access');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default access: %s'), constants.NSG_DEFAULT_ACCESS));
      ruleProfile.access = constants.NSG_DEFAULT_ACCESS;
    }

    if (params.priority) {
      var priority = utils.parseInt(params.priority);
      if (isNaN(priority) || priority < priorityRange[0] || priority > priorityRange[1]) {
        throw new Error(util.format($('priority must be an integer between %s and %s'), priorityRange[0], priorityRange[1]));
      }
      ruleProfile.priority = priority;
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default priority: %s'), constants.NSG_DEFAULT_PRIORITY));
      ruleProfile.priority = constants.NSG_DEFAULT_PRIORITY;
    }

    if (params.direction) {
      if (utils.stringIsNullOrEmpty(params.direction)) {
        throw new Error($('direction parameter must not be null or empty string'));
      }
      ruleProfile.direction = utils.verifyParamExistsInCollection(directions,
        params.direction, 'direction');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default direction: %s'), constants.NSG_DEFAULT_DIRECTION));
      ruleProfile.direction = constants.NSG_DEFAULT_DIRECTION;
    }

    return ruleProfile;
  },

  _validatePortRange: function (port, portType) {
    if (port === '*') {
      return port;
    }

    port = utils.parseInt(port);
    var portRange = constants.portBounds;
    if (isNaN(port) || port < portRange[0] || port > portRange[1]) {
      throw new Error(util.format($('%s port parameter must be an integer between %s and %s'), portType, portRange[0], portRange[1]));
    }

    return port;
  },

  _validateAddressPrefix: function (ipInCidrFormat, addressPrefixType) {
    var self = this;
    if (utils.stringIsNullOrEmpty(ipInCidrFormat)) {
      throw new Error(util.format($('IPv4 %s address prefix must not be null or empty string'), addressPrefixType));
    }

    if (ipInCidrFormat === '*' || ipInCidrFormat === 'Internet' || ipInCidrFormat === 'VirtualNetwork' || ipInCidrFormat === 'AzureLoadBalancer') {
      return ipInCidrFormat;
    }

    var ipValidationResult = self.vnetUtil.parseIPv4Cidr(ipInCidrFormat);
    if (ipValidationResult.error || ipValidationResult.cidr === null) {
      throw new Error(util.format($('IPv4 %s address prefix must be in CIDR format. Asterix can also be used'), addressPrefixType));
    }
    return ipValidationResult.ipv4Cidr;
  },

  _getAllRules: function (nsg) {
    var rules = nsg.securityRules.concat(nsg.defaultSecurityRules);
    return rules;
  },

  _findDefaultRule: function (nsg, ruleName) {
    return utils.findFirstCaseIgnore(nsg.defaultSecurityRules, {name: ruleName});
  },

  _findSecurityRule: function (nsg, ruleName) {
    return utils.findFirstCaseIgnore(nsg.securityRules, {name: ruleName});
  }
});

module.exports = Nsg;