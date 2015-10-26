// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

'use strict';
var should = require('should');

function websiteCredentialSteps() {
  this.World = require('../support/website-world').world;

  this.Given(/^an? (.+) publishsettings file$/, function(publishSettingsName, callback) {
    this.selectPublishSettings(publishSettingsName, callback);
  });

  this.When(/^I import the publishsettings file$/, function(callback) {
    this.runScript('azure account import ' + this.publishSettingsPath, callback);
  });

  this.Then(/^current subscription is set correctly$/, function(callback) {
    var self = this;

    self.runScript('azure account list', function () {
      self.scriptStdout.should.include(self.subscriptionId);
      callback();
    });
  });

  this.Then(/^management endpoint is set correctly$/, function(callback) {
    var self = this;
    var expected = new RegExp('^data:\\s+endpoint\\s+' + self.managementEndpoint + '\\s*$', 'm');
    self.runScript('azure config list', function () {
      self.scriptStdout.should.match(expected);
      callback();
    });
  });

  this.When(/^I list Websites$/, function(callback) {
    this.runScript('azure site list', callback);
  });

  this.Then(/^the command succeeds$/, function(callback) {
    should.not.exist(this.scriptErr);
    callback();
  });
}

module.exports = websiteCredentialSteps;
