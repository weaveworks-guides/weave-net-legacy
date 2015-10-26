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
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;

function StaticIp(cli, networkManagementClient) {
  this.networkManagementClient = networkManagementClient;
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(StaticIp.prototype, {
  check: function (vnet, ipAddress, options, _) {
    var self = this;

    var progress = self.interaction.progress($('Checking static IP address'));
    var response;
    try {
      response = self.networkManagementClient.staticIPs.check(vnet, ipAddress, _);
    } finally {
      progress.end();
    }

    var checkResult = {
      isAvailable: response.isAvailable,
      availableAddresses: response.availableAddresses
    };

    self.interaction.formatOutput(checkResult, function (data) {
      if (data.length === 0) {
        self.output.warn($('No static IP addresses found'));
      } else {
        utils.logLineFormat(data, self.output.data);
      }
    });
  }
});

module.exports = StaticIp;
