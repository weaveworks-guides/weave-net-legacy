/*
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

'use strict';

var exec = require('child_process').exec;
var os = require('os');
var path = require('path');

var separators = {
  'Win32': ' && '
};

/**
* Object that encapsulates the logic required to run scripts
* and capture their output. Intended to be mixed into World
* objects.
*/
function ScriptRunner() {
  this.azureScriptPath = path.resolve(path.dirname(module.filename), '../../bin/azure');
}

ScriptRunner.prototype.azureCommandToNodeInvocation = function (command) {
  var nodeCall = 'node ' + this.azureScriptPath + ' ';
  return command.replace(/^azure\s+/, nodeCall);
};

ScriptRunner.prototype.osScriptSeparator = function () {
  return separators[os.platform] || ' ; ';
};

/**
* Run a set of scripts as a separate process through the
* system shell, calling the callback when the scripts
* complete.
*/
ScriptRunner.prototype.runCommands = function(commands, callback) {
  commands = commands.map(this.azureCommandToNodeInvocation.bind(this));
  var command = commands.join(this.osScriptSeparator());
  return exec(command, callback);
};

exports.ScriptRunner = ScriptRunner;
