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

var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var Constants = require('./constants');

exports.camelcase = function (flag) {
  return flag.split('-').reduce(function (str, word) {
    return str + word[0].toUpperCase() + word.slice(1);
  });
};

exports.ignoreCaseEquals = function (a, b) {
  return a === b ||
    (a !== null && a !== undefined &&
    b !== null && b !== undefined &&
    (a.toLowerCase() === b.toLowerCase())) === true;
};

exports.azureDir = function () {
  var dir = process.env.AZURE_CONFIG_DIR ||
    path.join(homeFolder(), '.azure');
  
  if (!exports.pathExistsSync(dir)) {
    fs.mkdirSync(dir, 502); // 0766
  }
  
  return dir;
};

function homeFolder() {
  if (process.env.HOME !== undefined) {
    return process.env.HOME;
  }
  
  if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
    return process.env.HOMEDRIVE + process.env.HOMEPATH;
  }
  
  throw new Error('No HOME path available');
}

exports.stringStartsWith = function (text, prefix, ignoreCase) {
  if (_.isNull(prefix)) {
    return true;
  }
  
  if (ignoreCase) {
    return text.toLowerCase().substr(0, prefix.toLowerCase().length) === prefix.toLowerCase();
  } else {
    return text.substr(0, prefix.length) === prefix;
  }
};

exports.pathExistsSync = fs.existsSync ? fs.existsSync : path.existsSync;

/**
 * Read azure cli config
 */
exports.readConfig = function () {
  var azureConfigPath = path.join(exports.azureDir(), 'config.json');
  
  var cfg = {};
  
  if (exports.pathExistsSync(azureConfigPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(azureConfigPath));
    } catch (err) {
      cfg = {};
    }
  }
  
  return cfg;
};

exports.writeConfig = function (cfg) {
  var azurePath = exports.azureDir();
  var azureConfigPath = path.join(exports.azureDir(), 'config.json');
  
  if (!exports.pathExistsSync(azurePath)) {
    fs.mkdirSync(azurePath, 502); //0766
  }
  
  fs.writeFileSync(azureConfigPath, JSON.stringify(cfg));
};

exports.getMode = function () {
  var config = exports.readConfig();
  return config.mode ? config.mode : Constants.API_VERSIONS.ASM;
};

exports.getFiles = function (scanPath, recursively) {
  var results = [];

  var list = fs.readdirSync(scanPath);

  var pending = list.length;
  if (!pending) {
    return results;
  }

  for (var i = 0; i < list.length; i++) {
    var file = list[i];

    file = scanPath + '/' + file;

    var stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (recursively) {
        var res = exports.getFiles(file);
        results = results.concat(res);
      }
    } else {
      results.push(file);
    }
  }

  return results;
};
