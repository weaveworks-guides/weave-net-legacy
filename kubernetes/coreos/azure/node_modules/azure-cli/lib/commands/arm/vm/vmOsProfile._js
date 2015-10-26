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
var fs = require('fs');
var util = require('util');

var utils = require('../../../util/utils');
var certUtils = require('../../../util/certUtils');

var $ = utils.getLocaleString;

function VMOSProfile(cli, params) {
  this.cli = cli;
  this.params = params;
}

__.extend(VMOSProfile.prototype, {
  generateOSProfile: function(_) {
    var osProfile = this._parseOSProfileParams(this.params, _);
    return {
      profile: osProfile
    };
  },

  _parseOSProfileParams: function(params, _) {
    var requestProfile = {
      computerName: null,
      adminUsername: null,
      adminPassword: null,
      customData: null
    };

    if (utils.stringIsNullOrEmpty(params.computerName)) {
      if(utils.stringIsNullOrEmpty(params.vmName)) {
        throw new Error($('Either computerName or vmName is required to prepare OS profile'));
      }

      requestProfile.computerName = params.vmName;
    } else {
      requestProfile.computerName = params.computerName;
    }

    if (utils.stringIsNullOrEmpty(params.osType)) {
      params.osType = this.cli.interaction.prompt($('Enter OS type: '), _);
    }

    var osType = utils.verifyParamExistsInCollection(['Windows', 'Linux'], this.params.osType, 'osType');
    if( (osType === 'Windows')) {
      requestProfile.windowsConfiguration = this._parseWindowsConfiguration(params, _);
    } else {
      requestProfile.linuxConfiguration = this._parseLinuxConfiguration(params, _);
    }

    requestProfile.adminUsername = params.adminUsername;
    requestProfile.adminPassword = params.adminPassword;

    if (!utils.stringIsNullOrEmpty(params.customData)) {
      requestProfile.customData = this._loadCustomData(params.customData);
    }

    return requestProfile;
  },

  _parseWindowsConfiguration: function (params, _) {
    var windowsConfiguration = {
      provisionVMAgent: true
    };

    if (utils.stringIsNullOrEmpty(params.adminUsername)) {
      params.adminUsername = this.cli.interaction.promptIfNotGiven($('Enter username: '), params.adminUsername, _);
    }

    if (utils.ignoreCaseEquals(params.adminUsername, 'administrator')) {
      throw new Error($('The value administrator for parameter adminUsername is not allowed'));
    }

    if (utils.stringIsNullOrEmpty(params.adminPassword)) {
      params.adminPassword = this.cli.interaction.promptPassword(util.format($('Enter password for %s: '), params.adminUsername), _);
    }

    this._ensurePasswordComplexity(params.adminPassword);
    if (params.sshPublickeyFile) {
      this.cli.output.warn($('The parameter sshPublickeyFile will be ignored when operating system type is Windows'));
    }

    return windowsConfiguration;
  },

  _parseLinuxConfiguration: function (params, _) {
    var linuxConfiguration = {
      disablePasswordAuthentication: false,
      ssh: null
    };

    if (utils.stringIsNullOrEmpty(params.adminUsername)) {
      params.adminUsername = this.cli.interaction.promptIfNotGiven($('Enter username: '), params.adminUsername, _);
    }

    if (utils.stringIsNullOrEmpty(params.adminPassword)) {
      if (params.sshPublickeyFile || params.generateSshKeys) {
        linuxConfiguration.disablePasswordAuthentication = true;
      } else {
        params.adminPassword = this.cli.interaction.promptPassword(util.format($('Enter password for %s: '), params.adminUsername), _);
      }
    }

    if (params.generateSshKeys) {
      if (params.sshPublickeyFile) {
        this.cli.output.info($('--ssh-publickey-file is specified, --generate-ssh-keys option will be ignored.'));
      } else {
        this.cli.output.verbose($('Generating SSH keys.'));
        var keys = certUtils.generateSSHKeysIfNeeded(params.computerName, _);
        this.cli.output.info(util.format($('You can use %s private key for SSH authentication.'), keys.privateKeyPath));
        params.sshPublickeyFile = keys.certPath;
      }
    }

    if (params.adminPassword) {
      this._ensurePasswordComplexity(params.adminPassword);
    }

    if (params.sshPublickeyFile) {
      linuxConfiguration.sshConfiguration = {
        publicKeys: []
      };

      var publicKeyResult = this._parseSSHPublicKeyFile(params);
      var publicKey = {
        path: '/home/' + params.adminUsername + '/.ssh/authorized_keys',
        keyData: publicKeyResult.sshPublickeyPemDataBase64
      };

      linuxConfiguration.sshConfiguration.publicKeys.push(publicKey);
    }

    return linuxConfiguration;
  },

  _ensurePasswordComplexity: function (password) {
    if (utils.stringIsNullOrEmpty(password)) {
      throw new Error($('The parameters adminPassword is required'));
    }

    var passwordRegEx = new RegExp(/^.*(?=.{8,})(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\*!@#$%^&+=]).*$/);
    if (!password.match(passwordRegEx)) {
      throw new Error($('Parameter adminPassword must be at least 8 character in length, it must contain a lower case, an upper case, a number and a special character such as !@#$%^&+='));
    }
  },

  _parseSSHPublicKeyFile: function (params) {
    this.cli.output.info(util.format($('Verifying the public key SSH file: %s'), params.sshPublickeyFile));
    var sshPublickey = fs.readFileSync(params.sshPublickeyFile);
    var sshPublickeyPemStr = sshPublickey.toString();

    if (certUtils.isOpenSshRSAPub(sshPublickeyPemStr)) {
      sshPublickeyPemStr = certUtils.openSshRSAPubToX509CertPEM(sshPublickeyPemStr);
    } else if (!certUtils.isX509CertPEM(sshPublickeyPemStr)) {
      throw new Error($('Specified SSH certificate is not in PEM or SSH RSA format'));
    }

    return {
      sshPublickeyPemDataBase64: certUtils.extractBase64X509CertFromPEM(sshPublickeyPemStr)
    };
  },

  _loadCustomData: function (customDataFilePath) {
    var stats = fs.statSync(customDataFilePath);
    var maxSize = 65535; // 64 KB

    if (stats['size'] > maxSize) {
      throw new Error($('--custom-data must be less than 64 KB'));
    }

    var customData = fs.readFileSync(customDataFilePath);
    return customData.toString('base64');
  }
});

module.exports = VMOSProfile;