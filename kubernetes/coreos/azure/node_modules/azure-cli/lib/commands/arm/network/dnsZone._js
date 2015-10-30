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
var tagUtils = require('../tag/tagUtils');

function DnsZone(cli, dnsManagementClient) {
  this.dnsManagementClient = dnsManagementClient;
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(DnsZone.prototype, {
  create: function (resourceGroupName, zoneName, options, _) {
    var self = this;
    zoneName = utils.trimTrailingChar(zoneName, '.');

    var parameters = {
      zone: {
        properties: {},
        location: 'global'
      },
      ifNoneMatch: '*'
    };

    if (options.tags) {
      parameters.zone.tags = tagUtils.buildTagsParameter(null, options);
    }

    var progress = self.interaction.progress(util.format($('Creating dns zone "%s"'), zoneName));
    try {
      self.dnsManagementClient.zones.createOrUpdate(resourceGroupName, zoneName, parameters, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, zoneName, options, _);
  },

  list: function (resourceGroupName, params, _) {
    var self = this;
    var progress = self.interaction.progress($('Getting the dns zones'));
    var dnsZones = null;

    try {
      dnsZones = self.dnsManagementClient.zones.list(resourceGroupName, _);
      var nextLink = dnsZones.nextLink;
      while (nextLink !== undefined) {
        self.output.silly('Following nextLink');
        var nextZones = self.dnsManagementClient.zones.listNext(nextLink, _);
        dnsZones.zones = dnsZones.zones.concat(nextZones.zones);
        nextLink = nextZones.nextLink;
      }
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(dnsZones.zones, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn($('No dns zones found'));
      } else {
        self.output.table(outputData, function (row, zone) {
          row.cell($('Name'), zone.name);
          row.cell($('Resource group'), resourceGroupName);
        });
      }
    });
  },

  get: function (resourceGroupName, zoneName, _) {
    var self = this;
    zoneName = utils.trimTrailingChar(zoneName, '.');
    var progress = self.interaction.progress(util.format($('Looking up the dns zone "%s"'), zoneName));
    try {
      var dnsZone = self.dnsManagementClient.zones.get(resourceGroupName, zoneName, _);
      return dnsZone;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  set: function (resourceGroupName, zoneName, options, _) {
    var self = this;
    zoneName = utils.trimTrailingChar(zoneName, '.');
    var dnsZone = self.get(resourceGroupName, zoneName, _);
    if (!dnsZone) {
      throw new Error(util.format($('A dns zone with name "%s" not found in the resource group "%s"'), zoneName, resourceGroupName));
    }

    if (options.tags) {
      var tags = tagUtils.buildTagsParameter(null, options);
      tagUtils.appendTags(dnsZone.zone, tags);
    }

    if (options.tags === false) {
      dnsZone.zone.tags = {};
    }

    self.update(resourceGroupName, zoneName, dnsZone, _);
    self.show(resourceGroupName, zoneName, options, _);
  },

  show: function (resourceGroupName, zoneName, options, _) {
    var self = this;
    zoneName = utils.trimTrailingChar(zoneName, '.');

    var dnsZone = self.get(resourceGroupName, zoneName, _);
    if (dnsZone) {
      self.interaction.formatOutput(dnsZone.zone, function (zone) {
        self.output.nameValue($('Id'), zone.id);
        self.output.nameValue($('Name'), zone.name);
        self.output.nameValue($('Type'), zone.type);
        self.output.nameValue($('Location'), zone.location);
        self.output.nameValue($('Number of record sets'), zone.properties.numberOfRecordSets);
        self.output.nameValue($('Max number of record sets'), zone.properties.maxNumberOfRecordSets);
        self.output.nameValue($('Tags'), tagUtils.getTagsInfo(zone.tags));
      });
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A dns zone with name "%s" not found in the resource group "%s"'), zoneName, resourceGroupName));
      }
    }
  },

  delete: function (resourceGroupName, zoneName, options, _) {
    var self = this;
    zoneName = utils.trimTrailingChar(zoneName, '.');

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete dns zone "%s"? [y/n] '), zoneName), _)) {
      return;
    }

    var parameters = {
      ifMatch: '*'
    };

    var progress = self.interaction.progress(util.format($('Deleting dns zone "%s"'), zoneName));
    var response;
    try {
      response = self.dnsManagementClient.zones.deleteMethod(resourceGroupName, zoneName, parameters, _);
    } finally {
      progress.end();
    }

    if (response.statusCode === 204) {
      throw new Error(util.format($('A dns zone with name "%s" not found in the resource group "%s"'), zoneName, resourceGroupName));
    }
  },

  update: function (resourceGroupName, zoneName, zoneProfile, _) {
    var self = this;
    zoneName = utils.trimTrailingChar(zoneName, '.');
    var progress = self.interaction.progress(util.format($('Updating dns zone "%s"'), zoneName));
    try {
      self.dnsManagementClient.zones.createOrUpdate(resourceGroupName, zoneName, zoneProfile, _);
    } catch (e) {
      throw e;
    } finally {
      progress.end();
    }
  }
});

module.exports = DnsZone;