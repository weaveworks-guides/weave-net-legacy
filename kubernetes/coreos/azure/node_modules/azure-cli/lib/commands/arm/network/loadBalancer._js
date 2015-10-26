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
var resourceUtils = require('../resource/resourceUtils');
var lbShowUtil = require('./lbShowUtil');
var tagUtils = require('../tag/tagUtils');
var EndPointUtil = require('../../../util/endpointUtil');
var PublicIp = require('./publicIp');
var Subnet = require('./subnet');

function LoadBalancer(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.publicIpCrud = new PublicIp(cli, networkResourceProviderClient);
  this.subnetCrud = new Subnet(cli, networkResourceProviderClient);
  this.endpointUtil = new EndPointUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(LoadBalancer.prototype, {
  create: function (resourceGroupName, lbName, location, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);
    if (lb) {
      throw new Error(util.format($('A load balancer with name "%s" already exists in the resource group "%s"'), lbName, resourceGroupName));
    }

    var lbProfile = {
      location: location
    };

    if (options.tags) {
      lbProfile.tags = tagUtils.buildTagsParameter(null, options);
    }

    var progress = self.interaction.progress(util.format($('Creating load balancer "%s"'), lbName));
    try {
      self.networkResourceProviderClient.loadBalancers.createOrUpdate(resourceGroupName, lbName, lbProfile, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, lbName, options, _);
  },

  list: function (resourceGroupName, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting the load balancers'));
    var lbs = null;
    try {
      lbs = self.networkResourceProviderClient.loadBalancers.list(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(lbs.loadBalancers, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn($('No load balancers found'));
      } else {
        self.output.table(outputData, function (row, lb) {
          row.cell($('Name'), lb.name);
          row.cell($('Location'), lb.location);
          row.cell($('Probes'), lb.probes.length);
          row.cell($('Frontend IP'), lb.frontendIpConfigurations.length);
          row.cell($('Backend address pool'), lb.backendAddressPools.length);
          row.cell($('Load balancing rule'), lb.loadBalancingRules.length);
          row.cell($('Inbound NAT rule'), lb.inboundNatRules.length);
          row.cell($('Inbound NAT pool'), lb.inboundNatPools.length);
          row.cell($('Outnbound NAT rule'), lb.outboundNatRules.length);
        });
      }
    });
  },

  show: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    self.interaction.formatOutput(lb, function (lb) {
      if (lb === null) {
        self.output.warn(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
      } else {
        lbShowUtil.show(lb, self.output);
      }
    });
  },

  get: function (resourceGroupName, lbName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the load balancer "%s"'), lbName));
    try {
      var lb = self.networkResourceProviderClient.loadBalancers.get(resourceGroupName, lbName, _);
      return lb.loadBalancer;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  delete: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);
    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete load balancer "%s"? [y/n] '), lbName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting load balancer "%s"'), lbName));
    try {
      self.networkResourceProviderClient.loadBalancers.deleteMethod(resourceGroupName, lbName, _);
    } finally {
      progress.end();
    }
  },

  update: function (resourceGroupName, lbName, parameters, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Updating load balancer "%s"'), lbName));
    try {
      self.networkResourceProviderClient.loadBalancers.createOrUpdate(resourceGroupName, lbName, parameters, _);
    } finally {
      progress.end();
    }
  },

  /**
   * Commands to manage Probes
   */

  createProbe: function (resourceGroupName, lbName, probeName, options, _) {
    var self = this;
    var probeProfile = self._parseProbe(probeName, options, true);
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var probe = utils.findFirstCaseIgnore(lb.probes, {name: probeName});
    if (probe) {
      throw new Error(util.format($('A probe with name "%s" already exists'), probeName));
    }

    lb.probes.push(probeProfile);
    self.update(resourceGroupName, lbName, lb, _);
  },

  setProbe: function (resourceGroupName, lbName, probeName, options, _) {
    var self = this;
    var probeProfile = self._parseProbe(probeName, options, false);
    var lb = self.get(resourceGroupName, lbName, _);
    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var probe = utils.findFirstCaseIgnore(lb.probes, {
      name: probeName
    });
    if (!probe) {
      throw new Error(util.format($('A probe with name "%s" not found'), probeName));
    }

    if (options.newProbeName) probe.name = probeProfile.name;
    if (options.port) probe.port = probeProfile.port;
    if (options.path) probe.requestPath = probeProfile.requestPath;
    if (options.interval) probe.intervalInSeconds = probeProfile.intervalInSeconds;
    if (options.count) probe.numberOfProbes = probeProfile.numberOfProbes;
    if (options.protocol) {
      probe.protocol = probeProfile.protocol;
      if (options.protocol.toLowerCase() === self.endpointUtil.protocols.TCP) {
        delete probe.requestPath;
      }
    }
    self.update(resourceGroupName, lbName, lb, _);
  },

  listProbes: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);
    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    self.interaction.formatOutput(lb.probes, function (probes) {
      if (probes.length === 0) {
        self.output.warn($('No probes found'));
      } else {
        self.output.table(probes, function (row, probe) {
          row.cell($('Name'), probe.name);
          row.cell($('Provisioning state'), probe.provisioningState);
          row.cell($('Protocol'), probe.protocol);
          row.cell($('Port'), probe.port);
          row.cell($('Path'), probe.requestPath || '');
          row.cell($('Interval'), probe.intervalInSeconds);
          row.cell($('Count'), probe.numberOfProbes);
        });
      }
    });
  },

  deleteProbe: function (resourceGroupName, lbName, probeName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);
    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var probeIndex = utils.indexOfCaseIgnore(lb.probes, {name: probeName});
    if (probeIndex === -1) {
      throw new Error(util.format($('A probe with name with name "%s" not found in the load balancer "%s"'), probeName, lbName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete probe %s? [y/n] '), probeName), _)) {
      return;
    }

    lb.probes.splice(probeIndex, 1);
    self.update(resourceGroupName, lbName, lb, _);
  },

  /**
   * Commands to manage Frontend IP configurations
   */

  createFrontendIP: function (resourceGroupName, lbName, fipName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var fipConfiguration = {
      name: fipName
    };
    fipConfiguration = self._parseFrontendIP(resourceGroupName, fipConfiguration, options, _);

    if (utils.findFirstCaseIgnore(lb.frontendIpConfigurations, {name: fipName})) {
      throw new Error(util.format($('Frontend IP configuration with name "%s" already exists in the load balancer "%s"'), fipName, lbName));
    }

    lb.frontendIpConfigurations.push(fipConfiguration);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedFip = utils.findFirstCaseIgnore(updatedLb.frontendIpConfigurations, {name: fipName});
    self.showFrontendIP(updatedFip);
  },

  setFrontendIP: function (resourceGroupName, lbName, fipName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var fipConfiguration = utils.findFirstCaseIgnore(lb.frontendIpConfigurations, {name: fipName});
    if (!fipConfiguration) {
      throw new Error(util.format($('Frontend IP configuration with name "%s" not found in the load balancer "%s"'), ruleName, lbName));
    }

    self._parseFrontendIP(resourceGroupName, fipConfiguration, options, _);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedFip = utils.findFirstCaseIgnore(updatedLb.frontendIpConfigurations, {name: fipName});
    self.showFrontendIP(updatedFip);
  },

  listFrontendIPs: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    self.interaction.formatOutput(lb.frontendIpConfigurations, function (frontendIpConfigurations) {
      if (frontendIpConfigurations.length === 0) {
        self.output.warn($('No frontend ip configurations found'));
      } else {
        self.output.table(frontendIpConfigurations, function (row, fip) {
          row.cell($('Name'), fip.name);
          row.cell($('Provisioning state'), fip.provisioningState);
          row.cell($('Private IP allocation method'), fip.privateIpAllocationMethod);
          row.cell($('Subnet'), fip.subnet ? fip.subnet.id : '');
        });
      }
    });
  },

  showFrontendIP: function (fipConfig) {
    var self = this;
    self.interaction.formatOutput(fipConfig, function (fipConfig) {
      lbShowUtil.showFrontendIpConfig(fipConfig, self.output);
    });
  },

  deleteFrontendIP: function (resourceGroupName, lbName, fipName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var fipIndex = utils.indexOfCaseIgnore(lb.frontendIpConfigurations, {name: fipName});
    if (fipIndex === -1) {
      throw new Error(util.format($('Frontend ip configuration with name "%s" not found in the load balancer "%s"'), fipName, lbName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete frontend ip configuration %s? [y/n] '), fipName), _)) {
      return;
    }

    lb.frontendIpConfigurations.splice(fipIndex, 1);
    self.update(resourceGroupName, lbName, lb, _);
  },

  /**
   * Commands to manage Backend Address Pools
   */

  createBackendAddressPool: function (resourceGroupName, lbName, poolName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    if (utils.findFirstCaseIgnore(lb.backendAddressPools, {name: poolName})) {
      throw new Error(util.format($('A backend address pool with name "%s" already exists in the load balancer "%s"'), ruleName, lbName));
    }

    var backendAddressPool = {
      name: poolName,
      properties: {}
    };

    lb.backendAddressPools.push(backendAddressPool);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedPool = utils.findFirstCaseIgnore(updatedLb.backendAddressPools, {name: poolName});
    self.showBackendAddressPool(updatedPool);
  },

  listBackendAddressPools: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    self.interaction.formatOutput(lb.backendAddressPools, function (backendAddressPools) {
      if (backendAddressPools.length === 0) {
        self.output.warn($('No backend address pools found'));
      } else {
        self.output.table(backendAddressPools, function (row, pool) {
          row.cell($('Name'), pool.name);
          row.cell($('Provisioning state'), pool.provisioningState);
        });
      }
    });
  },

  showBackendAddressPool: function (backendAddressPool) {
    var self = this;
    self.interaction.formatOutput(backendAddressPool, function (backendAddressPool) {
      lbShowUtil.showBackendAddressPool(backendAddressPool, self.output);
    });
  },

  deleteBackendAddressPool: function (resourceGroupName, lbName, poolName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var poolIndex = utils.indexOfCaseIgnore(lb.backendAddressPools, {name: poolName});
    if (poolIndex === -1) {
      throw new Error(util.format($('Backend address pool with name with name "%s" not found in the load balancer "%s"'), poolName, lbName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete backend address pool %s? [y/n] '), poolName), _)) {
      return;
    }

    lb.backendAddressPools.splice(poolIndex, 1);
    self.update(resourceGroupName, lbName, lb, _);
  },

  /**
   * Commands to manage load balancing Rules
   */

  createRule: function (resourceGroupName, lbName, ruleName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);
    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var lbRule = utils.findFirstCaseIgnore(lb.loadBalancingRules, {name: ruleName});
    if (lbRule) {
      throw new Error(util.format($('Load balancing rule with name "%s" already exists in load balancer "%s"'), ruleName, lbName));
    }

    var rule = {
      name: ruleName
    };
    rule = self._parseRule(lb, rule, options, true);

    lb.loadBalancingRules.push(rule);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedRule = utils.findFirstCaseIgnore(updatedLb.loadBalancingRules, {name: ruleName});
    self.showRule(updatedRule);
  },

  setRule: function (resourceGroupName, lbName, ruleName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var lbRule = utils.findFirstCaseIgnore(lb.loadBalancingRules, {name: ruleName});
    if (!lbRule) {
      throw new Error(util.format($('Rule with the name "%s" not found in load balancer "%s"'), ruleName, lbName));
    }

    lbRule.name = options.newRuleName || ruleName;
    lbRule = self._parseRule(lb, lbRule, options, false);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedRule = utils.findFirstCaseIgnore(updatedLb.loadBalancingRules, {name: ruleName});
    self.showRule(updatedRule);
  },

  listRules: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    self.interaction.formatOutput(lb.loadBalancingRules, function (loadBalancingRules) {
      if (loadBalancingRules.length === 0) {
        self.output.warn($('No load balancing rules found'));
      } else {
        self.output.table(loadBalancingRules, function (row, rule) {
          row.cell($('Name'), rule.name);
          row.cell($('Provisioning state'), rule.provisioningState);
          row.cell($('Load distribution'), rule.loadDistribution);
          row.cell($('Protocol'), rule.protocol);
          row.cell($('Frontend port'), rule.frontendPort);
          row.cell($('Backend port'), rule.backendPort);
          row.cell($('Enable floating IP'), rule.enableFloatingIP);
          row.cell($('Idle timeout in minutes'), rule.idleTimeoutInMinutes);
        });
      }
    });
  },

  showRule: function (rule) {
    var self = this;
    self.interaction.formatOutput(rule, function (rule) {
      lbShowUtil.showLBRule(rule, self.output);
    });
  },

  deleteRule: function (resourceGroupName, lbName, ruleName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var ruleIndex = utils.indexOfCaseIgnore(lb.loadBalancingRules, {name: ruleName});
    if (ruleIndex === -1) {
      throw new Error(util.format($('A load balancing rule with name "%s" not found in the load balancer "%s"'), ruleName, lbName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete load balancing rule %s? [y/n] '), ruleName), _)) {
      return;
    }

    lb.loadBalancingRules.splice(ruleIndex, 1);
    self.update(resourceGroupName, lbName, lb, _);
  },

  /**
   * Commands to manage inbound NAT Rules
   */

  createInboundNatRule: function (resourceGroupName, lbName, ruleName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var inboundRule = {
      name: ruleName
    };
    inboundRule = self._parseInboundNatRule(resourceGroupName, lb, inboundRule, options, true);

    if (utils.findFirstCaseIgnore(lb.inboundNatRules, {name: ruleName})) {
      throw new Error(util.format($('An inbound NAT rule with name "%s" already exists in the load balancer "%s"'), ruleName, lbName));
    }

    lb.inboundNatRules.push(inboundRule);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedRule = utils.findFirstCaseIgnore(updatedLb.inboundNatRules, {name: ruleName});
    self.showInboundNatRule(updatedRule);
  },

  setInboundNatRule: function (resourceGroupName, lbName, ruleName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var inboundRule = utils.findFirstCaseIgnore(lb.inboundNatRules, {name: ruleName});
    if (!inboundRule) {
      throw new Error(util.format($('An inbound NAT rule with name "%s" not found in the load balancer "%s"'), ruleName, lbName));
    }

    self._parseInboundNatRule(resourceGroupName, lb, inboundRule, options, false);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedRule = utils.findFirstCaseIgnore(updatedLb.inboundNatRules, {name: ruleName});
    self.showInboundNatRule(updatedRule);
  },

  listInboundNatRules: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    self.interaction.formatOutput(lb.inboundNatRules, function (inboundNatRules) {
      if (inboundNatRules.length === 0) {
        self.output.warn($('No inbound NAT rules found'));
      } else {
        self.output.table(inboundNatRules, function (row, rule) {
          row.cell($('Name'), rule.name);
          row.cell($('Provisioning state'), rule.provisioningState);
          row.cell($('Protocol'), rule.protocol);
          row.cell($('Frontend port'), rule.frontendPort);
          row.cell($('Backend port'), rule.backendPort);
          row.cell($('Enable floating IP'), rule.enableFloatingIP);
          row.cell($('Idle timeout in minutes'), rule.idleTimeoutInMinutes);
        });
      }
    });
  },

  showInboundNatRule: function (rule) {
    var self = this;
    self.interaction.formatOutput(rule, function (rule) {
      lbShowUtil.showInboundRule(rule, self.output);
    });
  },

  deleteInboundNatRule: function (resourceGroupName, lbName, ruleName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var ruleIndex = utils.indexOfCaseIgnore(lb.inboundNatRules, {name: ruleName});
    if (ruleIndex === -1) {
      throw new Error(util.format($('An inbound NAT rule with name "%s" not found in the load balancer "%s"'), ruleName, lbName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete inbound NAT rule %s? [y/n] '), ruleName), _)) {
      return;
    }

    lb.inboundNatRules.splice(ruleIndex, 1);
    self.update(resourceGroupName, lbName, lb, _);
  },

  /**
   * Commands to manage inbound NAT Pools
   */

  createInboundNatPool: function (resourceGroupName, lbName, poolName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);
    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var inboundPool = {
      name: poolName
    };
    inboundPool = self._parseInboundNatPool(resourceGroupName, lb, inboundPool, options, true);

    if (utils.findFirstCaseIgnore(lb.inboundNatPools, {name: poolName})) {
      throw new Error(util.format($('An inbound NAT pool with name "%s" already exists in the load balancer "%s"'), poolName, lbName));
    }

    lb.inboundNatPools.push(inboundPool);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedPool = utils.findFirstCaseIgnore(updatedLb.inboundNatPools, {name: poolName});
    if (!updatedPool) throw new Error(util.format($('An inbound NAT pool with name "%s" not found in the resource group "%s"'), poolName, resourceGroupName));

    self.showInboundNatPool(updatedPool);
  },

  setInboundNatPool: function (resourceGroupName, lbName, poolName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);
    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var inboundPool = utils.findFirstCaseIgnore(lb.inboundNatPools, {name: poolName});
    if (!inboundPool) {
      throw new Error(util.format($('An inbound NAT pool with name "%s" not found in the load balancer "%s"'), poolName, lbName));
    }

    self._parseInboundNatPool(resourceGroupName, lb, inboundPool, options, false);
    self.update(resourceGroupName, lbName, lb, _);

    var updatedLb = self.get(resourceGroupName, lbName, _);
    var updatedPool = utils.findFirstCaseIgnore(updatedLb.inboundNatPools, {name: poolName});
    self.showInboundNatPool(updatedPool);
  },

  listInboundNatPools: function (resourceGroupName, lbName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    self.interaction.formatOutput(lb.inboundNatPools, function (inboundPools) {
      if (inboundPools.length === 0) {
        self.output.warn($('No inbound NAT pools found'));
      } else {
        self.output.table(inboundPools, function (row, pool) {
          row.cell($('Name'), pool.name);
          row.cell($('Provisioning state'), pool.provisioningState);
          row.cell($('Protocol'), pool.protocol);
          row.cell($('Port range start'), pool.frontendPortRangeStart);
          row.cell($('Port range end'), pool.frontendPortRangeEnd);
          row.cell($('Backend port'), pool.backendPort);
          var fipInfo = resourceUtils.getResourceInformation(pool.frontendIPConfiguration.id);
          row.cell($('Frontend IP configuration'), fipInfo.resourceName);
        });
      }
    });
  },

  showInboundNatPool: function (pool) {
    var self = this;
    self.interaction.formatOutput(pool, function (pool) {
      self.output.nameValue($('Name'), pool.name);
      self.output.nameValue($('Provisioning state'), pool.provisioningState);
      self.output.nameValue($('Protocol'), pool.protocol);
      self.output.nameValue($('Frontend port range start'), pool.frontendPortRangeStart);
      self.output.nameValue($('Frontend port range end'), pool.frontendPortRangeEnd);
      self.output.nameValue($('Backend port'), pool.backendPort);
      self.output.nameValue($('Frontend IP configuration'), pool.frontendIPConfiguration.id);
    });
  },

  deleteInboundNatPool: function (resourceGroupName, lbName, poolName, options, _) {
    var self = this;
    var lb = self.get(resourceGroupName, lbName, _);

    if (!lb) {
      throw new Error(util.format($('A load balancer with name "%s" not found in the resource group "%s"'), lbName, resourceGroupName));
    }

    var poolIndex = utils.indexOfCaseIgnore(lb.inboundNatPools, {name: poolName});
    if (poolIndex === -1) {
      throw new Error(util.format($('An inbound NAT pool with name "%s" not found in the load balancer "%s"'), poolName, lbName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete inbound NAT pool %s? [y/n] '), poolName), _)) {
      return;
    }

    lb.inboundNatPools.splice(poolIndex, 1);
    self.update(resourceGroupName, lbName, lb, _);
  },

  /**
   * Internal methods
   */

  _parseProbe: function (probeName, params, useDefaults) {
    var self = this;

    var probeProfile = {
      name: probeName
    };

    if (params.path) {
      if (utils.stringIsNullOrEmpty(params.path)) {
        throw new Error($('Path parameter must not be null or empty string'));
      }
      probeProfile.requestPath = params.path;
    }

    if (params.protocol) {
      var protocolValidation = self.endpointUtil.validateProbProtocol(params.protocol, 'Protocol');
      if (protocolValidation.error) {
        throw new Error(protocolValidation.error);
      }

      var protocol = protocolValidation.protocol.toLowerCase();
      if (protocol === self.endpointUtil.protocols.TCP && params.path) {
        self.output.warn($('Probe request path will be ignored when its protocol is Tcp'));
        delete probeProfile.requestPath;
      }

      if (protocol === self.endpointUtil.protocols.HTTP && !params.path) {
        throw new Error($('Probe request path is required when its protocol is Http'));
      }

      probeProfile.protocol = protocolValidation.protocol;
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default probe protocol: %s'), constants.lb.defProtocol));
      probeProfile.protocol = constants.lb.defProtocol;
    }

    if (params.port) {
      var portValidation = self.endpointUtil.validatePort(params.port, 'Port');
      if (portValidation.error) throw new Error(portValidation.error);
      probeProfile.port = portValidation.port;
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default probe port: %s'), constants.lb.defPort));
      probeProfile.port = constants.lb.defPort;
    }

    if (params.interval) {
      var intervalValidation = self.endpointUtil.validateProbInterval(params.interval, 'Interval');
      if (intervalValidation.error) throw new Error(intervalValidation.error);
      probeProfile.intervalInSeconds = intervalValidation.interval;
    }

    if (params.count) {
      var countAsInt = utils.parseInt(params.count);
      if (isNaN(countAsInt)) {
        throw new Error(util.format($('Count parameter must be an integer'), countAsInt));
      }
      probeProfile.numberOfProbes = countAsInt;
    }

    if (params.newProbeName) {
      if (utils.stringIsNullOrEmpty(params.newProbeName)) {
        throw new Error($('Name parameter must not be null or empty string'));
      }
      probeProfile.name = params.newProbeName;
    }

    return probeProfile;
  },

  _parseRule: function (lb, rule, options, useDefaults) {
    var self = this;

    if (options.protocol) {
      var protocolValidation = self.endpointUtil.validateProtocol(options.protocol, 'protocol');
      if (protocolValidation.error) {
        throw new Error(protocolValidation.error);
      }

      rule.protocol = options.protocol;
    } else if (useDefaults) {
      options.protocol = constants.lb.defProtocol;
      self.output.warn(util.format($('Using default protocol: %s'), options.protocol));
      rule.protocol = options.protocol;
    }

    if (options.frontendPort) {
      var frontendPortValidation = self.endpointUtil.validatePort(options.frontendPort, 'front end port');
      if (frontendPortValidation.error) {
        throw new Error(frontendPortValidation.error);
      }

      rule.frontendPort = options.frontendPort;
    } else if (useDefaults) {
      options.frontendPort = constants.lb.defPort;
      self.output.warn(util.format($('Using default frontend port: %s'), options.frontendPort));
      rule.frontendPort = options.frontendPort;
    }

    if (options.backendPort) {
      var backendPortValidation = self.endpointUtil.validatePort(options.backendPort, 'back end port');
      if (backendPortValidation.error) {
        throw new Error(backendPortValidation.error);
      }

      rule.backendPort = options.backendPort;
    } else if (useDefaults) {
      options.backendPort = constants.lb.defPort;
      self.output.warn(util.format($('Using default backend port: %s'), options.backendPort));
      rule.backendPort = options.backendPort;
    }

    if (options.idleTimeout) {
      var parsed = utils.parseInt(options.idleTimeout);
      if (isNaN(parsed)) {
        throw new Error($('Idle timeout must be posivite integer'));
      }

      rule.idleTimeoutInMinutes = options.idleTimeout;
    } else if (useDefaults) {
      options.idleTimeout = constants.lb.defTimeout;
      self.output.warn(util.format($('Using default idle timeout: %s'), options.idleTimeout));
      rule.idleTimeoutInMinutes = options.idleTimeout;
    }

    if (options.enableFloatingIp) {

      // Enable floating IP must be boolean.
      if (!utils.ignoreCaseEquals(options.enableFloatingIp, 'true') && !utils.ignoreCaseEquals(options.enableFloatingIp, 'false')) {
        throw new Error($('Enable floating IP parameter must be boolean'));
      }

      rule.enableFloatingIP = options.enableFloatingIp;
    } else if (useDefaults) {
      options.enableFloatingIp = constants.lb.defFloatingIp;
      self.output.warn(util.format($('Using default enable floating ip: %s'), options.enableFloatingIp));
      rule.enableFloatingIP = options.enableFloatingIp;
    }

    var backendAddressPool = null;
    if (options.backendAddressPool) {
      backendAddressPool = utils.findFirstCaseIgnore(lb.backendAddressPools, {
        name: options.backendAddressPool
      });
      if (!backendAddressPool) {
        throw new Error(util.format($('Backend address pool "%s" not found'), options.backendAddressPool));
      }

      rule.backendAddressPool = {
        id: backendAddressPool.id
      };
    } else if (useDefaults) {
      if (!lb.backendAddressPools || lb.backendAddressPools.length === 0) {
        throw new Error($('Load balancer must have at least one backend address pool if --backend-address-pool parameter is not specified.'));
      }

      self.output.warn(util.format($('Using first backend address pool: %s'), lb.backendAddressPools[0].name));
      backendAddressPool = lb.backendAddressPools[0];
      rule.backendAddressPool = {
        id: backendAddressPool.id
      };
    }

    if (options.frontendIpName) {
      rule.frontendIPConfiguration = {};
      ipConfigFound = utils.findFirstCaseIgnore(lb.frontendIpConfigurations, {
        name: options.frontendIpName
      });
      if (!ipConfigFound) {
        throw new Error(util.format($('Frontend IP config "%s" not found'), options.frontendIpName));
      }

      rule.frontendIPConfiguration.id = ipConfigFound.id;
    } else if (useDefaults) {
      rule.frontendIPConfiguration = {};
      if (!lb.frontendIpConfigurations || lb.frontendIpConfigurations.length === 0) {
        throw new Error($('Load balancer must have at least one frontend IP configuration if --frontend-ip-name parameter is not specified.'));
      }

      self.output.warn(util.format($('Using first frontend IP config: %s'), lb.frontendIpConfigurations[0].name));
      defaultIpConfig = lb.frontendIpConfigurations[0];
      rule.frontendIPConfiguration.id = defaultIpConfig.id;
    }

    var optionalProbe = utils.getOptionalArg(options.probeName);
    if (optionalProbe.hasValue) {
      if (optionalProbe.value !== null) {
        // probes must exist
        if (!lb.probes || lb.probes.length === 0) {
          throw new Error(util.format($('No probes found for the load balancer "%s"'), lb.name));
        }

        // probe with provided name must exist
        var probe = utils.findFirstCaseIgnore(lb.probes, {
          name: options.probeName
        });
        if (!probe) {
          throw new Error(util.format($('Probe "%s" not found in the load balancer "%s"'), options.probeName, lb.name));
        }

        rule.probe = {
          id: probe.id
        };
      } else {
        self.output.warn($('Clearing probe'));
        if (rule.probe) {
          delete rule.probe;
        }
      }
    }

    return rule;
  },

  _parseInboundNatRule: function (resourceGroupName, lb, inboundRule, options, useDefaults) {
    var self = this;

    if (options.protocol) {
      var protocolValidation = self.endpointUtil.validateProtocol(options.protocol, 'protocol');
      if (protocolValidation.error) {
        throw new Error(protocolValidation.error);
      }
      inboundRule.protocol = options.protocol;
    } else if (useDefaults) {
      options.protocol = constants.lb.defProtocol;
      self.output.warn(util.format($('Using default protocol: %s'), options.protocol));
      inboundRule.protocol = options.protocol;
    }

    if (options.frontendPort) {
      var frontendPortValidation = self.endpointUtil.validatePort(options.frontendPort, 'front end port');
      if (frontendPortValidation.error) {
        throw new Error(frontendPortValidation.error);
      }
      inboundRule.frontendPort = options.frontendPort;
    } else if (useDefaults) {
      options.frontendPort = constants.lb.defPort;
      self.output.warn(util.format($('Using default frontend port: %s'), options.frontendPort));
      inboundRule.frontendPort = options.frontendPort;
    }

    if (options.backendPort) {
      var backendPortValidation = self.endpointUtil.validatePort(options.backendPort, 'back end port');
      if (backendPortValidation.error) {
        throw new Error(backendPortValidation.error);
      }
      inboundRule.backendPort = options.backendPort;
    } else if (useDefaults) {
      options.backendPort = constants.lb.defPort;
      self.output.warn(util.format($('Using default backend port: %s'), options.backendPort));
      inboundRule.backendPort = options.backendPort;
    }

    if (options.enableFloatingIp) {

      // Enable floating IP must be boolean.
      if (!utils.ignoreCaseEquals(options.enableFloatingIp, 'true') && !utils.ignoreCaseEquals(options.enableFloatingIp, 'false')) {
        throw new Error($('Enable floating IP parameter must be boolean'));
      }

      inboundRule.enableFloatingIP = options.enableFloatingIp;
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default enable floating ip: %s'), constants.lb.defFloatingIp));
      inboundRule.enableFloatingIP = constants.lb.defFloatingIp;
    }

    if (options.frontendIp) {
      var ipConfigurations = options.frontendIp.split(',');
      for (var num in ipConfigurations) {
        var frontendIpConf = ipConfigurations[num];
        var frontendIpConfFound = utils.findFirstCaseIgnore(lb.frontendIpConfigurations, {
          name: frontendIpConf
        });
        if (!frontendIpConfFound) {
          throw new Error(util.format($('Frontend IP config "%s" not found'), frontendIpConf));
        }
        inboundRule.frontendIPConfiguration = {
          id: frontendIpConfFound.id
        };
      }
    } else if (useDefaults) {
      if (!inboundRule.frontendIPConfiguration) {
        if (lb.frontendIpConfigurations.length === 0) {
          throw new Error(util.format($('Load balancer with name "%s" has no frontend IP configurations'), lb.name));
        }
        inboundRule.frontendIPConfiguration = {
          id: lb.frontendIpConfigurations[0].id
        };
        self.output.warn($('Setting default inbound rule frontend IP configuration'));
      }
    }

    return inboundRule;
  },

  _parseInboundNatPool: function (resourceGroupName, lb, inboundPool, options, useDefaults) {
    var self = this;

    if (options.protocol) {
      utils.verifyParamExistsInCollection(constants.lb.protocols, options.protocol, '--protocol');
      inboundPool.protocol = options.protocol;
    } else if (useDefaults) {
      var defProtocol = constants.lb.protocols[0];
      self.output.warn(util.format($('Using default protocol: %s'), defProtocol));
      inboundPool.protocol = defProtocol;
    }

    if (options.frontendPortRangeStart) {
      var portStartValidation = self.endpointUtil.validatePort(options.frontendPortRangeStart, '--frontend-port-range-start');
      if (portStartValidation.error) {
        throw new Error(portStartValidation.error);
      }
      inboundPool.frontendPortRangeStart = options.frontendPortRangeStart;
    } else if (useDefaults) {
      var defPortRangeStart = constants.portBounds[0];
      self.output.warn(util.format($('Using default frontend port range start: %s'), defPortRangeStart));
      inboundPool.frontendPortRangeStart = defPortRangeStart;
    }

    if (options.frontendPortRangeEnd) {
      var portEndValidation = self.endpointUtil.validatePort(options.frontendPortRangeEnd, '--frontend-port-range-end');
      if (portEndValidation.error) {
        throw new Error(portEndValidation.error);
      }
      inboundPool.frontendPortRangeEnd = options.frontendPortRangeEnd;
    } else if (useDefaults) {
      var defPortRangeEnd = constants.portBounds[1];
      self.output.warn(util.format($('Using default frontend port range end: %s'), defPortRangeEnd));
      inboundPool.frontendPortRangeEnd = defPortRangeEnd;
    }

    if (options.frontendPortRangeStart && options.frontendPortRangeEnd) {
      if (options.frontendPortRangeStart > options.frontendPortRangeEnd) {
        throw new Error($('The frontend port range start should be less or equal to frontend port range end'));
      }
    }

    if (options.backendPort) {
      var backendPortValidation = self.endpointUtil.validatePort(options.backendPort, '--backend-port');
      if (backendPortValidation.error) {
        throw new Error(backendPortValidation.error);
      }
      inboundPool.backendPort = options.backendPort;
    } else if (useDefaults) {
      self.output.warn(util.format($('Using default backend port: %s'), constants.lb.defPort));
      inboundPool.backendPort = constants.lb.defPort;
    }

    if (options.frontendIp) {
      var frontendIpConfig = utils.findFirstCaseIgnore(lb.frontendIpConfigurations, {name: options.frontendIp});
      if (!frontendIpConfig) {
        throw new Error(util.format($('Frontend IP configuration with name "%s" not found in load balancer "%s"'), options.frontendIp, lb.name));
      }
      inboundPool.frontendIPConfiguration = {
        id: frontendIpConfig.id
      };
    } else if (useDefaults) {
      if (!inboundPool.frontendIPConfiguration) {
        if (lb.frontendIpConfigurations.length === 0) {
          throw new Error(util.format($('Load balancer with name "%s" has no frontend IP configurations'), lb.name));
        }
        inboundPool.frontendIPConfiguration = {
          id: lb.frontendIpConfigurations[0].id
        };
        self.output.warn($('Setting default inbound NAT pool frontend IP configuration'));
      }
    }

    return inboundPool;
  },

  _parseFrontendIP: function (resourceGroupName, frontendIPConfig, options, _) {
    var self = this;
    if (options.privateIpAddress && options.publicIpName) {
      throw new Error($('Both optional parameters --private-ip-address and --public-ip-name cannot be specified together'));
    }

    if (options.privateIpAddress && options.publicIpId) {
      throw new Error($('Both optional parameters --private-ip-address and --public-ip-id cannot be specified together'));
    }

    if (options.publicIpName && options.publicIpId) {
      throw new Error($('Both optional parameters --public-ip-name and --public-ip-id cannot be specified together'));
    }

    if (options.subnetName && options.subnetId) {
      throw new Error($('Both optional parameters --subnet-name and --subnet-id cannot be specified together'));
    }

    if (!options.subnetId) {
      if (options.subnetName) {
        if (!options.vnetName) {
          throw new Error($('You must specify subnet virtual network (vnet-name) if subnet name (subnet-name)  is provided'));
        }
      }

      if (options.vnetName) {
        if (!options.subnetName) {
          throw new Error($('You must specify  subnet name (subnet-name) if subnet virtual network (vnet-name) is provided'));
        }
      }
    }

    var subnetIdOpt = null;
    var publicIpIdOpt = null;
    var hasPublicIP = false;

    if (options.subnetName || options.subnetId) {
      frontendIPConfig.subnet = {};
      if (options.subnetId) {
        subnetIdOpt = utils.getOptionalArg(options.subnetId);
        if (subnetIdOpt.value) {
          frontendIPConfig.subnet.id = subnetIdOpt.value.replace(/'|""/gm, '');
        } else {
          delete frontendIPConfig.subnet;
        }
      } else {
        var subnet = self.subnetCrud.get(resourceGroupName, options.vnetName, options.subnetName, _);
        if (!subnet) {
          throw new Error(util.format($('Subnet with name "%s" not found'), options.subnetName));
        }
        frontendIPConfig.subnet.id = subnet.id;
      }
    }

    if (options.publicIpName || options.publicIpId) {
      frontendIPConfig.publicIpAddress = {};
      if (options.publicIpId) {
        publicIpIdOpt = utils.getOptionalArg(options.publicIpId);
        if (publicIpIdOpt.value) {
          frontendIPConfig.publicIpAddress.id = publicIpIdOpt.value.replace(/'|""/gm, '');
          hasPublicIP = true;
        } else {
          delete frontendIPConfig.publicIpAddress;
        }
      } else {
        var publicip = self.publicIpCrud.get(resourceGroupName, options.publicIpName, _);
        if (!publicip) {
          throw new Error(util.format($('Public IP "%s" not found'), options.publicIpName));
        }

        frontendIPConfig.publicIpAddress.id = publicip.id;
        hasPublicIP = true;
      }
    }

    var privateIpAddressOpt = utils.getOptionalArg(options.privateIpAddress);
    if (hasPublicIP) {
      delete frontendIPConfig.privateIpAddress;
      delete frontendIPConfig.privateIpAllocationMethod;
    }

    if (privateIpAddressOpt.hasValue) {
      if (privateIpAddressOpt.value) {
        frontendIPConfig.privateIpAddress = privateIpAddressOpt.value;
        frontendIPConfig.privateIpAllocationMethod = 'Static';
      } else {
        delete frontendIPConfig.privateIpAddress;
        frontendIPConfig.privateIpAllocationMethod = 'Dynamic';
      }
    }

    return frontendIPConfig;
  }
});

module.exports = LoadBalancer;
