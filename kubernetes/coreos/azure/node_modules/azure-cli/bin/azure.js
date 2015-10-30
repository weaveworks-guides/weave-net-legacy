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

var AutoComplete = require('../lib/autocomplete');
//load the autocomplete, so that rest code in the file will not execute 
//till the command gets committed. This gets autocomplete faster
new AutoComplete();

var AzureCli = require('../lib/cli');
var Constants = require('../lib/util/constants');

if (process.argv[2] !== '--gen') {
  cli = new AzureCli();
  cli.parse(process.argv);
  if (cli.args.length === 0) {
    cli.parse(['', '', '-h']);
  }
} else {
  if (process.argv[3]) {
    cli = new AzureCli(null, null, process.argv[3]);
  } else {
    cli = new AzureCli(null, null, Constants.API_VERSIONS.ARM);
    cli = new AzureCli(null, null, Constants.API_VERSIONS.ASM);
  }
}