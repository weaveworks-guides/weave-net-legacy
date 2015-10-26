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

function VMDiagnosticsProfile(cli, params) {
    this.cli = cli;
    this.params = params;
}

__.extend(VMDiagnosticsProfile.prototype, {
  generateDiagnosticsProfile: function() {
    var diagnosticsProfile = this._parseDiagnosticsProfileParams(this.params);
    return {
      profile: diagnosticsProfile
    };
  },

  updateDiagnosticsProfile: function(diagnosticsProfile) {
    if (!utils.stringIsNullOrEmpty(this.params.enableBootDiagnostics) || !utils.stringIsNullOrEmpty(this.params.bootDiagnosticsStorageUri)) {
      diagnosticsProfile = this._parseDiagnosticsProfileParams(this.params);
    }

    return diagnosticsProfile;
  },

  _parseDiagnosticsProfileParams: function(params) {
    if (this.params.enableBootDiagnostics === null && utils.stringIsNullOrEmpty(this.params.bootDiagnosticsStorageUri)) {
        return null;
    }

    var requestProfile = {
      bootDiagnostics: null
    };

    requestProfile.bootDiagnostics = this._parseBootDiagnosticsParams(params);
    return requestProfile;
  },

  _parseBootDiagnosticsParams: function(params) {
    var bootDiagnostics = {
      enabled: null,
      storageUri: null
    };

    bootDiagnostics.enabled = params.enableBootDiagnostics;
    bootDiagnostics.storageUri = params.bootDiagnosticsStorageUri;

    return bootDiagnostics;
  }
});

module.exports = VMDiagnosticsProfile;