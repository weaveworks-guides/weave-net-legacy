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
var _ = require('underscore');
var EnvironmentDownloader = require('./environmentDownloader').EnvironmentDownloader;
var ScriptRunner = require('./scriptrunner').ScriptRunner;
var util = require('util');

function World(callback) {
  ScriptRunner.call(this);
  this.downloader = new EnvironmentDownloader('credentials');

  callback();
}

util.inherits(World, ScriptRunner);

_.extend(World.prototype, {
  selectPublishSettings: function (settingsName, callback) {
    var self = this;
    self.downloader.getPublishSettings(settingsName, function (err, results) {
      if (!err) {
        if (results.length === 1) {
          self.managementEndpoint = results[0].endpoint;
          self.subscriptionId = results[0].subscriptionId;
          self.subscriptionName = results[0].subscriptionName;
          self.publishSettingsPath = results[0].path;
        } else {
          self.subscriptions = results;
        }
      }
      callback(err);
    });
  },

  runScript: function (script, callback) {
    var self = this;
    if (_.isString(script)) {
      script = script.split(/\n|\r\n/);
    }
    if (!_.isArray(script)) {
      throw new Error('Must pass either a string or array for scripts to run');
    }
    self.runCommands(script, function (err, stdout, stderr) {
      self.scriptErr = err;
      self.scriptStdout = stdout;
      self.scriptStdErr = stderr;
      callback();
    });
  },

  deleteFolderRecursive: function(path) {
    var self = this;

    var files = [];
    if(fs.existsSync(path) ) {
      files = fs.readdirSync(path);
      files.forEach(function(file){
        var curPath = path + '/' + file;
        if(fs.statSync(curPath).isDirectory()) { // recurse
          self.deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }
});

exports.world = World;
