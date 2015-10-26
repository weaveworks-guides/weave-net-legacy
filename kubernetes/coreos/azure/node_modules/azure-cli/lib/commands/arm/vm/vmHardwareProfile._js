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

function VMHardwareProfile(cli, params) {
    this.cli = cli;
    this.params = params;
}

__.extend(VMHardwareProfile.prototype, {
  generateHardwareProfile: function() {
    var hardwareProfile = this._parseHardwareProfileParams(this.params);
    return {
      profile: hardwareProfile
    };
  },

  updateHardwareProfile: function(hardwareProfile) {
    if (!utils.stringIsNullOrEmpty(this.params.vmSize)) {
      hardwareProfile.virtualMachineSize = this.params.vmSize;
    }

    return hardwareProfile;
  },

  _parseHardwareProfileParams: function(params) {
    var requestProfile = {
      virtualMachineSize: null
    };

    if (utils.stringIsNullOrEmpty(params.vmSize)) {
      requestProfile.virtualMachineSize = 'Standard_A1';
    } else {
      requestProfile.virtualMachineSize = params.vmSize;
    }

    this.cli.output.info(util.format($('Using the VM Size "%s"'), requestProfile.virtualMachineSize));
    return requestProfile;
  }
});

module.exports = VMHardwareProfile;