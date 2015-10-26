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
var resourceUtils = require('../resource/resourceUtils');
var tagUtils = require('../tag/tagUtils');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.show = function (lb, output) {
  var indent = 0;

  exports.showLoadBalancer(lb, output, indent);
  exports.showFrontEndIpConfigs(lb, output, indent);
  exports.showProbes(lb, output, indent);
  exports.showBackendAddressPools(lb, output, indent);
  exports.showLBRules(lb, output, indent);
  exports.showInboundRules(lb, output, indent);
  exports.showInboundNatPools(lb, output, indent);
};

exports.showLoadBalancer = function (lb, output, indent) {
  output.nameValue($('Id'), lb.id, indent);
  output.nameValue($('Name'), lb.name, indent);

  var resource = resourceUtils.getResourceInformation(lb.id);
  output.nameValue($('Type'), lb.type || resource.resourceType, indent);
  output.nameValue($('Location'), lb.location, indent);
  output.nameValue($('Provisioning State'), lb.provisioningState, indent);

  if (lb.tags) {
    output.nameValue($('Tags'), tagUtils.getTagsInfo(lb.tags), indent);
  }
};

exports.showFrontEndIpConfigs = function (lb, output, indent) {
  if (__.isEmpty(lb.frontendIpConfigurations)) {
    return;
  }
  output.header('Frontend IP configurations', indent);
  indent += 2;
  lb.frontendIpConfigurations.forEach(function (ipConfig) {
    _showFrontendIpDetails(ipConfig, output, indent);
  });
};

exports.showFrontendIpConfig = function (ipConfig, output) {
  var indent = 0;
  output.nameValue($('Id'), ipConfig.id, indent);

  var resource = resourceUtils.getResourceInformation(ipConfig.id);
  output.nameValue($('Type'), ipConfig.type || resource.resourceType, indent);
  _showFrontendIpDetails(ipConfig, output, indent);

  if (ipConfig.inboundNatRules && ipConfig.inboundNatRules.length > 0) {
    output.header($('Inbound NAT rules'), indent);
    indent += 2;
    ipConfig.inboundNatRules.forEach(function (rule) {
      output.listItem(rule.id, indent);
    });
    indent -= 2;
  }

  if (ipConfig.outboundNatRules && ipConfig.outboundNatRules.length > 0) {
    output.header($('Outbound NAT rules'), indent);
    indent += 2;
    ipConfig.outboundNatRules.forEach(function (rule) {
      output.listItem(rule.id, indent);
    });
    indent -= 2;
  }

  if (ipConfig.loadBalancingRules && ipConfig.loadBalancingRules.length > 0) {
    output.header($('Load balancing rules'), indent);
    indent += 2;
    ipConfig.loadBalancingRules.forEach(function (lbRule) {
      output.listItem(lbRule.id, indent);
    });
  }
};

exports.showBackendAddressPools = function (lb, output, indent) {
  if (__.isEmpty(lb.backendAddressPools)) {
    return;
  }
  output.header($('Backend address pools'), indent);
  indent += 2;

  lb.backendAddressPools.forEach(function (pool) {
    _showBackendAddressPoolDetails(pool, output, indent);
  });
};

exports.showBackendAddressPool = function (pool, output) {
  var indent = 0;
  output.nameValue($('Id'), pool.id, indent);

  var resource = resourceUtils.getResourceInformation(pool.id);
  output.nameValue($('Type'), pool.type || resource.resourceType, indent);
  _showBackendAddressPoolDetails(pool, output, indent);
  if (pool.loadBalancingRules && pool.loadBalancingRules.length > 0) {
    output.list($('Load balancing rules'), pool.loadBalancingRules, indent);
  }
};

exports.showLBRules = function (lb, output, indent) {
  if (__.isEmpty(lb.loadBalancingRules)) {
    return;
  }

  output.header($('Load balancing rules'), indent);
  indent += 2;
  lb.loadBalancingRules.forEach(function (rule) {
    _showLBRuleDetails(rule, output, indent);
  });
};

exports.showLBRule = function (rule, output) {
  var indent = 0;
  output.nameValue($('Id'), rule.id, indent);

  var resource = resourceUtils.getResourceInformation(rule.id);
  output.nameValue($('Type'), rule.type || resource.resourceType, indent);
  _showLBRuleDetails(rule, output, indent);
};

exports.showInboundRules = function (lb, output, indent) {
  if (__.isEmpty(lb.inboundNatRules)) {
    return;
  }
  output.header($('Inbound NAT rules'), indent);
  indent += 2;
  lb.inboundNatRules.forEach(function (inboundNatRule) {
    _showInboundRuleDetails(inboundNatRule, output, indent);
  });
};

exports.showInboundNatPools = function (lb, output) {
  if (lb.inboundNatPools.length === 0) return;
  output.header($('Inbound NAT pools'));
  lb.inboundNatPools.forEach(function (pool) {
    _showInboundNatPoolDetails(pool, output, 2);
    output.data('');
  });
};

exports.showInboundRule = function (rule, output) {
  var indent = 0;
  output.nameValue($('Id'), rule.id, indent);

  var resource = resourceUtils.getResourceInformation(rule.id);
  output.nameValue($('Type'), rule.type || resource.resourceType, indent);
  _showInboundRuleDetails(rule, output, indent);
};

exports.showProbes = function (lb, output, indent) {
  if (__.isEmpty(lb.probes)) {
    return;
  }
  output.header($('Probes'), indent);
  indent += 2;

  lb.probes.forEach(function (probe) {
    output.nameValue($('Name'), probe.name, indent);
    output.nameValue($('Provisioning state'), probe.provisioningState, indent);
    output.nameValue($('Protocol'), probe.protocol, indent);
    output.nameValue($('Port'), probe.port, indent);
    output.nameValue($('Interval in seconds'), probe.intervalInSeconds, indent);
    output.nameValue($('Number of probes'), probe.numberOfProbes, indent);
    if (!__.isEmpty(probe.loadBalancingRules)) {
      output.header($('Load balancing rules'), indent);
      indent += 2;
      probe.loadBalancingRules.forEach(function (probeRule) {
        output.listItem(probeRule.id, indent);
      });
      indent -= 2;
    }
    output.data('');
  });
};

_showFrontendIpDetails = function (ipConfig, output, indent) {
  output.nameValue('Name', ipConfig.name, indent);
  output.nameValue('Provisioning state', ipConfig.provisioningState, indent);
  output.nameValue('Private IP allocation method', ipConfig.privateIpAllocationMethod, indent);
  output.nameValue('Public IP address id', ipConfig.publicIpAddress.id, indent);
  if (ipConfig.subnet) {
    output.nameValue($('Subnet'), ipConfig.subnet.id, indent);
  }
  output.data('');
};

_showBackendAddressPoolDetails = function (pool, output, indent) {
  output.nameValue($('Name'), pool.name, indent);
  output.nameValue($('Provisioning state'), pool.provisioningState, indent);
  if (!__.isEmpty(pool.backendIpConfigurations)) {
    output.header($('Backend IP configurations'), indent);
    indent += 2;
    pool.backendIpConfigurations.forEach(function (backendIpConfig) {
      output.listItem(backendIpConfig.id, indent);
    });
    indent -= 2;
  }
  output.data('');
};

_showLBRuleDetails = function (rule, output, indent) {
  output.nameValue($('Name'), rule.name, indent);
  output.nameValue($('Provisioning state'), rule.provisioningState, indent);
  output.nameValue($('Protocol'), rule.protocol, indent);
  output.nameValue($('Frontend port'), rule.frontendPort, indent);
  output.nameValue($('Backend port'), rule.backendPort, indent);
  output.nameValue($('Enable floating IP'), rule.enableFloatingIP.toString(), indent);
  output.nameValue($('Idle timeout in minutes'), rule.idleTimeoutInMinutes, indent);
  if (rule.frontendIPConfiguration) {
    output.nameValue($('Frontend IP configuration'), rule.frontendIPConfiguration.id, indent);
  }
  if (rule.backendAddressPool) {
    output.nameValue($('Backend address pool'), rule.backendAddressPool.id, indent);
  }
  if (rule.probe) {
    output.nameValue($('Probe'), rule.probe.id, indent);
  }
  output.data('');
};

_showInboundRuleDetails = function (inboundNatRule, output, indent) {
  output.nameValue($('Name'), inboundNatRule.name, indent);
  output.nameValue($('Provisioning state'), inboundNatRule.provisioningState, indent);
  output.nameValue($('Protocol'), inboundNatRule.protocol, indent);
  output.nameValue($('Frontend port'), inboundNatRule.frontendPort, indent);
  output.nameValue($('Backend port'), inboundNatRule.backendPort, indent);
  output.nameValue($('Enable floating IP'), inboundNatRule.enableFloatingIP.toString(), indent);
  output.nameValue($('Idle timeout in minutes'), inboundNatRule.idleTimeoutInMinutes, indent);
  if (inboundNatRule.frontendIPConfiguration) {
    output.nameValue($('Frontend IP configuration'), inboundNatRule.frontendIPConfiguration.id, indent);
  }
  if (inboundNatRule.backendIPConfiguration) {
    output.nameValue($('Backend IP Configuration:  '), inboundNatRule.backendIPConfiguration.id, indent);
  }
  output.data('');
};

_showInboundNatPoolDetails = function (pool, output, indent) {
  output.nameValue($('Name'), pool.name, indent);
  output.nameValue($('Provisioning state'), pool.provisioningState, indent);
  output.nameValue($('Protocol'), pool.protocol, indent);
  output.nameValue($('Frontend port range start'), pool.frontendPortRangeStart, indent);
  output.nameValue($('Frontend port range end'), pool.frontendPortRangeEnd, indent);
  output.nameValue($('Backend port'), pool.backendPort, indent);
  output.nameValue($('Frontend IP configuration'), pool.frontendIPConfiguration.id, indent);
};