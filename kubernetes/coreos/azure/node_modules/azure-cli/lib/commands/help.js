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

var utils = require('../util/utils');
var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  
  cli.command('help [command]')
    .description($('Display help for a given command'))
    .execute(function (name) {
    if (!name) {
      if (log.format().json) {
        log.json(cli.helpJSON());
      } else {
        cli.parse(['', '', '-h']);
      }
    } else {
      var args = ['', ''].concat(cli.rawArgs.slice(3), ['-h']);
      cli.parse(args);
    }
  });
};
