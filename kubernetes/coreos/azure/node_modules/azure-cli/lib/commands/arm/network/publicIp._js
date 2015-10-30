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
var resourceUtils = require('../resource/resourceUtils');
var tagUtils = require('../tag/tagUtils');

function PublicIp(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(PublicIp.prototype, {
  create: function (resourceGroupName, name, options, _) {
    var self = this;
    var publicipProfile = self._parsePublicIP(name, options);

    var publicip = self.get(resourceGroupName, name, _);
    if (publicip) {
      throw new Error(util.format($('A public ip address with name "%s" already exists in the resource group "%s"'), name, resourceGroupName));
    }

    var progress = self.interaction.progress(util.format($('Creating public ip address "%s"'), name));
    try {
      self.networkResourceProviderClient.publicIpAddresses.createOrUpdate(resourceGroupName, name, publicipProfile, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, name, options, _);
  },

  set: function (resourceGroupName, name, options, _) {
    var self = this;
    var publicipProfile = self._parsePublicIP(name, options);

    var publicip = self.get(resourceGroupName, name, _);
    if (!publicip) {
      throw new Error(util.format($('A public ip address with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    if (options.idletimeout) publicip.idleTimeoutInMinutes = publicipProfile.idleTimeoutInMinutes;
    if (options.allocationMethod) publicip.publicIpAllocationMethod = publicipProfile.publicIpAllocationMethod;

    var optionalDomainLabel = utils.getOptionalArg(options.domainNameLabel);
    if (optionalDomainLabel.hasValue) {
      if (optionalDomainLabel.value !== null) {
        self._createDnsSettingsIfNotExist(publicip);
        publicip.dnsSettings.domainNameLabel = publicipProfile.dnsSettings.domainNameLabel;
      } else {
        delete publicip.dnsSettings;
      }
    }

    var optionalReverseFqdn = utils.getOptionalArg(options.reverseFqdn);
    if (optionalReverseFqdn.hasValue) {
      if (optionalReverseFqdn.value !== null) {
        self._createDnsSettingsIfNotExist(publicip);
        publicip.dnsSettings.reverseFqdn = publicipProfile.dnsSettings.reverseFqdn;
      } else {
        delete publicip.dnsSettings.reverseFqdn;
      }
    }

    if (options.tags) {
      tagUtils.appendTags(publicip, publicipProfile.tags);
    }

    if (options.tags === false) {
      publicip.tags = {};
    }

    self.update(resourceGroupName, name, publicip, _);
    self.show(resourceGroupName, name, options, _);
  },

  show: function (resourceGroupName, name, options, _) {
    var self = this;
    var publicip = self.get(resourceGroupName, name, _);

    self.interaction.formatOutput(publicip, function (publicip) {
      if (publicip === null) {
        self.output.warn(util.format($('A public ip address with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
      } else {
        var resourceInfo = resourceUtils.getResourceInformation(publicip.id);
        self.output.nameValue($('Id'), publicip.id);
        self.output.nameValue($('Name'), publicip.name);
        self.output.nameValue($('Type'), resourceInfo.resourceType);
        self.output.nameValue($('Location'), publicip.location);
        self.output.nameValue($('Provisioning state'), publicip.provisioningState);
        self.output.nameValue($('Tags'), tagUtils.getTagsInfo(publicip.tags));
        self.output.nameValue($('Allocation method'), publicip.publicIpAllocationMethod);
        self.output.nameValue($('Idle timeout'), publicip.idleTimeoutInMinutes);
        self.output.nameValue($('IP Address'), publicip.ipAddress);
        if (publicip.dnsSettings) {
          var dnsSettings = publicip.dnsSettings;
          self.output.nameValue($('Domain name label'), dnsSettings.domainNameLabel);
          self.output.nameValue($('FQDN'), dnsSettings.fqdn);
          self.output.nameValue($('Reverse FQDN'), dnsSettings.reverseFqdn);
        }
      }
    });
  },

  delete: function (resourceGroupName, name, options, _) {
    var self = this;
    var publicIP = self.get(resourceGroupName, name, _);

    if (!publicIP) {
      throw new Error(util.format($('A public ip address with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete public ip address "%s"? [y/n] '), name), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting public ip address "%s"'), name));
    try {
      self.networkResourceProviderClient.publicIpAddresses.deleteMethod(resourceGroupName, name, _);
    } finally {
      progress.end();
    }
  },

  list: function (resourceGroupName, options, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting the public ip addresses'));

    var publicIPs = null;
    try {
      publicIPs = self.networkResourceProviderClient.publicIpAddresses.list(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(publicIPs.publicIpAddresses, function (data) {
      if (data.length === 0) {
        self.output.warn($('No public ip address found'));
        return;
      }
      self.output.table(data, function (row, publicip) {
        row.cell($('Name'), publicip.name);
        row.cell($('Location'), publicip.location);
        row.cell($('Allocation'), publicip.publicIpAllocationMethod);
        row.cell($('IP Address'), publicip.ipAddress || '');
        row.cell($('Idle timeout'), publicip.idleTimeoutInMinutes || '');
        var dnsName = '';
        if (publicip.dnsSettings) {
          dnsName = publicip.dnsSettings.fqdn;
        }
        row.cell($('DNS Name'), dnsName);
      });
    });
  },

  get: function (resourceGroupName, name, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the public ip "%s"'), name));

    try {
      var publicIP = self.networkResourceProviderClient.publicIpAddresses.get(resourceGroupName, name, _);
      return publicIP.publicIpAddress;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  update: function (resourceGroupName, name, publicIpProfile, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Updating public ip address "%s"'), name));

    try {
      self.networkResourceProviderClient.publicIpAddresses.createOrUpdate(resourceGroupName, name, publicIpProfile, _);
    } finally {
      progress.end();
    }
  },

  _parsePublicIP: function (name, options) {
    var supportedAllocationTypes = ['Dynamic', 'Static'];
    var self = this;

    var publicipProfile = {
      name: name,
      publicIpAllocationMethod: supportedAllocationTypes[0]
    };

    if (options.idletimeout) {
      var timeoutAsInt = utils.parseInt(options.idletimeout);
      if (isNaN(timeoutAsInt) || timeoutAsInt === 0) {
        throw new Error($('idletimeout parameter must be an integer'));
      }
      publicipProfile.idleTimeoutInMinutes = timeoutAsInt;
    }

    if (options.allocationMethod) {
      if (utils.stringIsNullOrEmpty(options.allocationMethod)) {
        throw new Error($('allocation method parameter must not be null or empty string'));
      }
      publicipProfile.publicIpAllocationMethod = utils.verifyParamExistsInCollection(supportedAllocationTypes,
        options.allocationMethod, 'allocationMethod');
    }

    if (options.domainNameLabel) {
      self._createDnsSettingsIfNotExist(publicipProfile);
      publicipProfile.dnsSettings.domainNameLabel = options.domainNameLabel;
    }

    if (options.reverseFqdn) {
      self._createDnsSettingsIfNotExist(publicipProfile);
      publicipProfile.dnsSettings.reverseFqdn = options.reverseFqdn;
    }

    if (options.tags) {
      publicipProfile.tags = tagUtils.buildTagsParameter(null, options);
    }

    if (options.location) {
      publicipProfile.location = options.location;
    }

    return publicipProfile;
  },

  _createDnsSettingsIfNotExist: function (publicip) {
    if (!publicip.dnsSettings) publicip.dnsSettings = {};
  }
});

module.exports = PublicIp;