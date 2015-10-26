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

function ReservedIp(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(ReservedIp.prototype, {
  create: function (name, location, options, _) {
    var self = this;

    var params = {
      name: name,
      location: location
    };

    if (options.label) {
      params.label = options.label;
    }

    var progress = self.interaction.progress($('Creating reserved IP address'));
    try {
      self.networkManagementClient.reservedIPs.create(params, _);
    } finally {
      progress.end();
    }
  },

  list: function (options, _) {
    var self = this;

    var progress = self.interaction.progress($('Getting reserved IP addresses'));
    var reservedIPs;
    try {
      reservedIPs = self.networkManagementClient.reservedIPs.list(_);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(reservedIPs.reservedIPs, function (data) {
      if (data.length === 0) {
        self.output.warn($('No reserved IP addresses found'));
      } else {
        self.output.table(data, function (row, ip) {
          row.cell($('Name'), ip.name);
          row.cell($('Location'), ip.location);
          row.cell($('Address'), ip.address);
          row.cell($('Label'), ip.label || '');
          row.cell($('State'), ip.state);
        });
      }
    });
  },

  show: function (name, options, _) {
    var self = this;
    var reservedIP = self.get(name, _);

    if (reservedIP) {
      self.interaction.formatOutput(reservedIP, function (ip) {
        self.output.nameValue($('Name'), ip.name);
        self.output.nameValue($('Location'), ip.location);
        self.output.nameValue($('Address'), ip.address);
        self.output.nameValue($('Label'), ip.label || '');
        self.output.nameValue($('State'), ip.state);
      });
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A reserved ip address with name "%s" not found'), name));
      }
    }
  },

  delete: function (name, options, _) {
    var self = this;

    var progress = self.interaction.progress($('Looking up reserved IP address'));
    try {
      if (!options.quiet) {
        // Ensure the reserved IP address exists before prompting for confirmation
        self.networkManagementClient.reservedIPs.get(name, _);
        if (!self.interaction.confirm(util.format($('Delete reserved IP address %s? [y/n] '), name), _))
          return;
      }

      progress = self.interaction.progress($('Deleting reserved IP address'));
      self.networkManagementClient.reservedIPs.deleteMethod(name, _);
    } finally {
      progress.end();
    }
  },

  get: function (name, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up the reserved ip "%s"'), name));
    try {
      var reservedIP = self.networkManagementClient.reservedIPs.get(name, _);
      return reservedIP;
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
  }

});

module.exports = ReservedIp;
