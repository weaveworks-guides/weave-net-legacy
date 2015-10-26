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

var fs = require('fs');
var path = require('path');

var should = require('should');

var testutils = require('../../test/util/util');

function websiteCredentialSteps() {
  this.World = require('../support/website-world').world;

  this.Given(/^a clone of the git repo? (.+)$/, function(repositoryUrl, callback) {
    var parts = repositoryUrl.split('/');
    var projectName = parts[parts.length - 1];

    this.originalPath = process.cwd();

    if (!this.createdDirectories) {
      this.createdDirectories = [];
    }

    this.createdDirectories.push(projectName);

    this.deleteFolderRecursive(projectName);
    this.runScript('git clone ' + repositoryUrl, function () {
      process.chdir(path.join(process.cwd(), projectName));
      callback();
    });
  });

  this.When(/^I create a new website? (.+) with git integration using location? (.+)$/, function(siteName, location, callback) {
    this.currentSiteName = siteName;

    this.runScript('azure site create ' + siteName + ' --git --location "' + location + '"', callback);
  });

  this.When(/^I create a new website? (.+) with git integration using location? (.+) and git user? (.+)$/, function(siteName, location, gitusername, callback) {
    var self = this;
    self.currentSiteName = siteName;

    this.runScript('azure site create ' + siteName + ' --git --gitusername "' + gitusername + '" --location "' + location + '"', callback);
  });

  this.When(/^I setup the remote git credentials to username? (.+) and password? (.+)$/, function(username, password, callback) {
    this.runScript('azure site deployment user set ' + username + ' ' + password, callback);
  });

  this.Then(/^the website? (.+) should be created in location? (.+)$/, function(siteName, location, callback) {
    var self = this;
    var webspace = location.toLowerCase().replace(/ /g, '') + 'webspace';
    var expected = new RegExp('^data:\\s+Site WebSpace\\s+' + webspace + '\\s*$', 'm');

    this.runScript('azure site show ' + siteName, function () {
      self.scriptStdout.should.match(expected);
      callback();
    });
  });

  this.Then(/^the local git repo should contain a remote called? (.+)$/, function(remoteName, callback) {
    var self = this;
    var expected = new RegExp('^' + remoteName + '(.+)$', 'm');

    this.runScript('git remote -v', function () {
      self.scriptStdout.should.match(expected);

      callback();
    }); 
  });

  this.Then(/^the local git repo should contain a remote called? (.+) with username? (.+)$/, function(remoteName, username, callback) {
    var self = this;
    var expected = new RegExp('^' + remoteName + '\\s+https://' + username + '@' + self.currentSiteName + '.scm.azurewebsites.net/' + self.currentSiteName + '.git(.+)$', 'm');

    this.runScript('git remote -v', function () {
      self.scriptStdout.should.match(expected);

      callback();
    });
  });
}

module.exports = websiteCredentialSteps;
