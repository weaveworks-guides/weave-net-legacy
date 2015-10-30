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
var VNetUtil = require('../../../util/vnet.util');

function Nsg(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(Nsg.prototype, {
  create: function (nsgName, location, options, _) {
    var self = this;
    var nsgProfile = {
      name: nsgName,
      location: location
    };

    if (options.label) nsgProfile.label = options.label;

    var progress = self.interaction.progress(util.format($('Creating a network security group "%s"'), nsgName));
    try {
      self.networkManagementClient.networkSecurityGroups.create(nsgProfile, _);
    } finally {
      progress.end();
    }
    self.show(nsgName, options, _);
  },

  list: function (options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting the network security groups'));

    var groups = null;
    try {
      groups = self.networkManagementClient.networkSecurityGroups.list(_);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(groups.networkSecurityGroups, function (data) {
      if (data.length === 0) {
        self.output.warn($('No network security groups found'));
      } else {
        self.output.table(data, function (row, nsg) {
          row.cell($('Name'), nsg.name);
          row.cell($('Location'), nsg.location);
          row.cell($('Label'), nsg.label || '');
        });
      }
    });
  },

  show: function (nsgName, options, _) {
    var self = this;
    var nsg = self.get(nsgName, true, _);

    if (nsg) {
      self.interaction.formatOutput(nsg, function (nsg) {
        self.output.nameValue($('Name'), nsg.name);
        self.output.nameValue($('Location'), nsg.location);
        self.output.nameValue($('Label'), nsg.label);

        if (nsg.rules.length > 0) {
          self.output.header($('Security group rules'));
          self.output.table(nsg.rules, function (row, rule) {
            row.cell($('Name'), rule.name);
            row.cell($('Source IP'), rule.sourceAddressPrefix);
            row.cell($('Source Port'), rule.sourcePortRange);
            row.cell($('Destination IP'), rule.destinationAddressPrefix);
            row.cell($('Destination Port'), rule.destinationPortRange);
            row.cell($('Protocol'), rule.protocol);
            row.cell($('Type'), rule.type);
            row.cell($('Action'), rule.action);
            row.cell($('Priority'), rule.priority);
            row.cell($('Default'), rule.isDefault || 'false');
          });
        }
      });
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A network security group with name "%s" not found'), nsgName));
      }
    }
  },

  delete: function (nsgName, options, _) {
    var self = this;
    if (!options.quiet && !self.interaction.confirm(util.format($('Delete network security group "%s"? [y/n] '), nsgName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting network security group "%s"'), nsgName));
    try {
      self.networkManagementClient.networkSecurityGroups.deleteMethod(nsgName, _);
    } finally {
      progress.end();
    }
  },

  get: function (nsgName, withRules, _) {
    var self = this;
    var detailLevel = null;
    if (withRules) detailLevel = 'Full';
    var progress = self.interaction.progress(util.format($('Looking up the network security group "%s"'), nsgName));
    try {
      var nsg = self.networkManagementClient.networkSecurityGroups.get(nsgName, detailLevel, _);
      return nsg;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  createRule: function (nsgName, ruleName, options, _) {
    var self = this;
    var ruleProfile = self._parseSecurityRule(options, true);

    var nsg = self.get(nsgName, false, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found'), nsgName));
    }

    var rule = self._findSecurityRule(nsg, ruleName);
    if (rule) {
      throw new Error(util.format($('A network security rule with name "%s" already exists in the network security group "%s"'), ruleName, nsgName));
    }

    var progress = self.interaction.progress(util.format($('Creating a network security rule "%s"'), ruleName));
    try {
      self.networkManagementClient.networkSecurityGroups.setRule(nsgName, ruleName, ruleProfile, _);
    } finally {
      progress.end();
    }
    self.showRule(nsgName, ruleName, options, _);
  },

  setRule: function (nsgName, ruleName, options, _) {
    var self = this;
    var ruleProfile = self._parseSecurityRule(options, false);

    var nsg = self.get(nsgName, true, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found'), nsgName));
    }

    var rule = self._findSecurityRule(nsg, ruleName);
    if (!rule) {
      throw new Error(util.format($('A network security rule with name "%s" not found in the security group "%s"'), ruleName, nsgName));
    }

    if (options.protocol) rule.protocol = ruleProfile.protocol;
    if (options.sourceAddressPrefix) rule.sourceAddressPrefix = ruleProfile.sourceAddressPrefix;
    if (options.sourcePortRange) rule.sourcePortRange = ruleProfile.sourcePortRange;
    if (options.destinationAddressPrefix) rule.destinationAddressPrefix = ruleProfile.destinationAddressPrefix;
    if (options.destinationPortRange) rule.destinationPortRange = ruleProfile.destinationPortRange;
    if (options.action) rule.action = ruleProfile.action;
    if (options.priority) rule.priority = ruleProfile.priority;
    if (options.type) rule.type = ruleProfile.type;

    var progress = self.interaction.progress(util.format($('Setting a network security rule "%s"'), ruleName));
    try {
      self.networkManagementClient.networkSecurityGroups.setRule(nsgName, ruleName, rule, _);
    } finally {
      progress.end();
    }
    self.showRule(nsgName, ruleName, options, _);
  },

  listRules: function (nsgName, options, _) {
    var self = this;
    var nsg = self.get(nsgName, true, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found'), nsgName));
    }

    self.interaction.formatOutput(nsg.rules, function (data) {
      if (data.length === 0) {
        self.output.warn($('No rules found'));
      } else {
        self.output.table(data, function (row, rule) {
          row.cell($('Name'), rule.name);
          row.cell($('Source address prefix'), rule.sourceAddressPrefix);
          row.cell($('Source port range'), rule.sourcePortRange);
          row.cell($('Destination address prefix'), rule.destinationAddressPrefix);
          row.cell($('Destination port range'), rule.destinationPortRange);
          row.cell($('Protocol'), rule.protocol);
          row.cell($('Type'), rule.type);
          row.cell($('Action'), rule.action);
          row.cell($('Priority'), rule.priority);
        });
      }
    });
  },

  showRule: function (nsgName, ruleName, options, _) {
    var self = this;
    var nsg = self.get(nsgName, constants.nsg.levelDef, _);

    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found'), nsgName));
    }

    var rule = self._findSecurityRule(nsg, ruleName);
    if (!rule) {
      throw new Error(util.format($('A network security rule with name "%s" not found in the security group "%s"'), ruleName, nsgName));
    }

    self.interaction.formatOutput(rule, function (rule) {
      if (rule === null) {
        self.output.warn(util.format($('A network security rule with name "%s" not found in the security group "%s"'), ruleName, nsgName));
      } else {
        self.output.nameValue($('Name'), rule.name);
        self.output.nameValue($('State'), rule.state);
        self.output.nameValue($('Source address prefix'), rule.sourceAddressPrefix);
        self.output.nameValue($('Source port range'), rule.sourcePortRange);
        self.output.nameValue($('Destination address prefix'), rule.destinationAddressPrefix);
        self.output.nameValue($('Destination port range'), rule.destinationPortRange);
        self.output.nameValue($('Protocol'), rule.protocol);
        self.output.nameValue($('Type'), rule.type);
        self.output.nameValue($('Action'), rule.action);
        self.output.nameValue($('Priority'), rule.priority);
      }
    });
  },

  deleteRule: function (nsgName, ruleName, options, _) {
    var self = this;
    var nsg = self.get(nsgName, constants.nsg.levelDef, _);
    if (!nsg) {
      throw new Error(util.format($('A network security group with name "%s" not found'), nsgName));
    }

    var rule = self._findSecurityRule(nsg, ruleName);
    if (!rule) {
      throw new Error(util.format($('A network security group rule with name "%s" not found in the security group "%s"'), ruleName, nsgName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete network security rule "%s"? [y/n] '), ruleName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting network security rule "%s"'), ruleName));
    try {
      self.networkManagementClient.networkSecurityGroups.deleteRule(nsgName, ruleName, _);
    } finally {
      progress.end();
    }
  },

  _validateAddressPrefix: function (prefix, paramName) {
    var self = this;
    if (prefix === '*' || prefix === '"*"') {
      return prefix;
    }
    try {
      var res = utils.verifyParamExistsInCollection(constants.nsg.prefix, prefix, paramName);
      return res;
    } catch (e) {
      var ipValidationResult = self.vnetUtil.parseIPv4Cidr(prefix);
      if (ipValidationResult.error) {
        throw new Error(util.format($('%s parameter must be in CIDR format. Asterisk, INTERNET, VIRTUAL_NETWORK, AZURE_LOADBALANCER can be used also.'), paramName));
      }
      return ipValidationResult.ipv4Cidr;
    }
  },

  _validatePortRange: function (port, paramName) {
    if (port === '*' || port === '"*"') {
      return port;
    }
    port = utils.parseInt(port);
    if (isNaN(port) || port < constants.nsg.portMin || port > constants.nsg.portMax) {
      throw new Error(util.format($('%s parameter must be an integer between %s and %s. Asterisk can be used also.'),
        paramName, constants.nsg.portMin, constants.nsg.portMax));
    }
    return port;
  },

  _parseSecurityRule: function (options, useDefaults) {
    var self = this;
    var rule = {};

    if (options.protocol) {
      if (options.protocol === '*' || options.protocol === '"*"') {
        rule.protocol = options.protocol;
      } else {
        rule.protocol = utils.verifyParamExistsInCollection(constants.nsg.protocols, options.protocol, '--protocol');
      }
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default protocol: %s'), constants.nsg.protocols[0]));
      rule.protocol = constants.nsg.protocols[0];
    }

    if (options.sourcePortRange) {
      rule.sourcePortRange = self._validatePortRange(options.sourcePortRange, '--source-port-range');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default source port range: %s'), constants.nsg.portDef));
      rule.sourcePortRange = constants.nsg.portDef;
    }

    if (options.destinationPortRange) {
      rule.destinationPortRange = self._validatePortRange(options.destinationPortRange, '--destination-port-range');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default destination port range: %s'), constants.nsg.portDef));
      rule.destinationPortRange = constants.nsg.portDef;
    }

    if (options.sourceAddressPrefix) {
      rule.sourceAddressPrefix = self._validateAddressPrefix(options.sourceAddressPrefix, '--source-address-prefix');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default source address prefix: %s'), constants.nsg.prefixDef));
      rule.sourceAddressPrefix = constants.nsg.prefixDef;
    }

    if (options.destinationAddressPrefix) {
      rule.destinationAddressPrefix = self._validateAddressPrefix(options.destinationAddressPrefix, '--destination-address-prefix');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default destination address prefix: %s'), constants.nsg.prefixDef));
      rule.destinationAddressPrefix = constants.nsg.prefixDef;
    }

    if (options.action) {
      rule.action = utils.verifyParamExistsInCollection(constants.nsg.action, options.action, '--action');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default action: %s'), constants.nsg.action[0]));
      rule.action = constants.nsg.action[0];
    }

    if (options.priority) {
      var priority = utils.parseInt(options.priority);
      if (isNaN(priority) || priority < constants.nsg.priorityMin || priority > constants.nsg.priorityMax) {
        throw new Error(util.format($('--priority must be an integer between %s and %s'), constants.nsg.priorityMin, constants.nsg.priorityMax));
      }
      rule.priority = priority;
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default priority: %s'), constants.nsg.priorityMin));
      rule.priority = constants.nsg.priorityMin;
    }

    if (options.type) {
      rule.type = utils.verifyParamExistsInCollection(constants.nsg.type, options.type, '--type');
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default type: %s'), constants.nsg.type[0]));
      rule.type = constants.nsg.type[0];
    }

    return rule;
  },

  _findSecurityRule: function (nsg, ruleName) {
    return utils.findFirstCaseIgnore(nsg.rules, {name: ruleName});
  }
});

module.exports = Nsg;