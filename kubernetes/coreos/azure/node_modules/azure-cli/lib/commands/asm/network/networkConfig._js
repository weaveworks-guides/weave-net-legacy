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
var fs = require('fs');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var VNetUtil = require('./../../../util/vnet.util');

function NetworkConfig(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(NetworkConfig.prototype, {
  export: function (filePath, options, _) {
    var self = this;
    var networkConfiguration = self.get(_);
    delete networkConfiguration['$'];
    fs.writeFileSync(filePath, JSON.stringify(networkConfiguration));
    self.output.verbose(util.format($('Network Configuration exported to %s'), filePath));
  },

  import: function (filePath, options, _) {
    var self = this;
    var configXml = fs.readFileSync(filePath, 'utf8');
    self.output.verbose(util.format($('Importing Network Configuration from %s'), filePath));
    var networkConfiguration = JSON.parse(utils.stripBOM(configXml));
    self.set(networkConfiguration, _);
  },

  get: function (_) {
    var self = this;
    var progress = self.interaction.progress($('Looking up network configuration'));
    try {
      var response = self.networkManagementClient.networks.getConfiguration(_);
      return self.vnetUtil.getNetworkConfigObj(response.configuration);
    } catch (e) {
      if (e.statusCode === 404) {
        return self.vnetUtil.getNewNetworkConfigObj();
      }
      throw e;
    } finally {
      progress.end();
    }
  },

  set: function (networkConfiguration, _) {
    var self = this;
    var configXml = self.vnetUtil.getNetworkConfigXml(networkConfiguration);

    var config = {
      configuration: configXml
    };

    var progress = self.interaction.progress($('Setting network configuration'));
    try {
      self.networkManagementClient.networks.setConfiguration(config, _);
    } finally {
      progress.end();
    }
  }
});

module.exports = NetworkConfig;
