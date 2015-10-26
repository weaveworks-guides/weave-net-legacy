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

var fs = require('fs');
var path = require('path');
var utilsCore = require('../util/utilsCore');

exports.init = function(cli) {
  function scan(scanPath) {
    var results = utilsCore.getFiles(scanPath, true);

    results = results.filter(function (filePath) {
      var extname = path.extname(filePath);
      if (filePath.substring(0, 5) === 'tmp--') {
        return false;
      } else if (extname !== '.js' && extname !== '._js') {
        //Skip unrelated/temp files
        return false;
      }
      return true;
    });

    if (process.env.PRECOMPILE_STREAMLINE_FILES) {
      results = results.filter(function (filePath) {
        if (filePath.substring(filePath.length - 4) === '._js') {
          return false;
        }
        return true;
      });
    }

    // sort them so they load in a predictable order
    results = results.sort();

    // skip directories
    results = results.filter(function (filePath) {
      return fs.statSync(filePath).isFile();
    });

    // load modules
    results = results.map(function (filePath) {
      var module = require(filePath);
      module.filePath = filePath;
      return module;
    });

    // look for exports.init
    results = results.filter(function (entry) {
      return entry.init !== undefined;
    });

    return results;
  }

  scan(path.join(path.dirname(__filename), 'storage')).forEach(function (module) { module.init(cli); });
};