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

'use strict';

var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var utilsCore = require('./util/utilsCore');

function CmdLoader(topCmd, mode) {
  this.topCmd = topCmd;
  this.cmdMode = mode;
  this.cmdMetadataFile = path.join(__dirname, 'plugins.' + this.cmdMode  + '.json');
  this.cmdBasePath = __dirname;
}

_.extend(CmdLoader.prototype, {
  harvestPlugins: function (topLevelOnly) {
    var self = this;
    var plugins = this._loadCmdsFromFolder(path.join(this.cmdBasePath, 'commands'), false);
    plugins.forEach(function (plugin) { plugin.init(self.topCmd); });
    
    if (!topLevelOnly) {
      // Load mode specific plugins
      var modePlugins = this._loadCmdsFromFolder(path.join(this.cmdBasePath, 'commands', this.cmdMode), true);
      modePlugins.forEach(function (plugin) { plugin.init(self.topCmd); });
    }
  },
  
  harvestModules: function () {
    var self = this;
    
    var basePath = path.dirname(__filename);
    
    var walkPath = path.join(basePath, '../node_modules');
    var harvestPaths = [walkPath];
    
    while (path.basename(walkPath) === 'node_modules' && path.dirname(walkPath) !== 'npm') {
      var nextPath = path.join(walkPath, '../..');
      if (nextPath === walkPath) {
        break;
      }
      harvestPaths.push(nextPath);
      walkPath = nextPath;
    }
    
    var modules = [];
    harvestPaths.forEach(function (harvestPath) {
      modules = modules.concat(self._loadCmdsFromNodeModules(harvestPath));
    });
    
    modules.forEach(function (module) {
      module.plugin.init(self.topCmd);
    });
  },
  
  initFromCmdMetadata: function (AzureCli) {
    var self = this;
    var initCategory = function (category, parent) {
      function process(entity, entityParent) {
        var newEntity = new AzureCli(entity.name, entityParent);
        
        if (entity.description) {
          newEntity._description = entity.description;
        }
        
        //TODO, for some fields, we create wrapper functions here,
        //so that existing code won't break. We should get rid of them soon.
        newEntity.description = function () {
          return newEntity._description;
        };

        newEntity.fullName = function () {
          return entity.fullName;
        };
        
        newEntity._usage = entity.usage;
        newEntity.usage = function () {
          return newEntity._usage;
        };

        newEntity.filePath = entity.filePath ? 
          path.resolve(self.cmdBasePath, entity.filePath) : entity.filePath;
        newEntity.stub = true;
        
        if (entity.options) {
          for (var o in entity.options) {
            newEntity.option(entity.options[o].flags, entity.options[o].description);
          }
        }
        
        return newEntity;
      }
      

      var newCategory = category;
      //can't invoke "process" for top category, which would new  
      //up a top AzureCli and get us into an infinite loop. 
      if (parent) {
        newCategory = process(category, parent);
      }

      for (var i = 0 ; i < category.commands.length; i++) {
        newCategory.commands[i] = (process(category.commands[i], newCategory));
      }
      
      if (!newCategory.categories) {
        newCategory.categories = {};
      }
      
      for (var j in category.categories) {
        newCategory.categories[j] = initCategory(category.categories[j], newCategory);
      }
      
      return newCategory;
    };

    var data = fs.readFileSync(this.cmdMetadataFile);
    var cachedPlugins = JSON.parse(data);
    var plugins = initCategory(cachedPlugins);
    
    this.topCmd.commands = plugins.commands;
    this.topCmd.categories = plugins.categories;
  },
  
  saveCmdMetadata: function () {
    var metadate = this._serializeCategory(this.topCmd);
    fs.writeFileSync(this.cmdMetadataFile, JSON.stringify(metadate, null, 2));
  },
  
  cmdMetadataExists: function () {
    return utilsCore.pathExistsSync(this.cmdMetadataFile);
  },

  _loadCmdsFromFolder: function (scanPath, recursively) {
    var results = utilsCore.getFiles(scanPath, recursively);
    
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
      return require(filePath);
    });
    
    // look for exports.init
    results = results.filter(function (entry) {
      return entry.init !== undefined;
    });
    return results;
  },
  
  _loadCmdsFromNodeModules: function (scanPath) {
    var results = fs.readdirSync(scanPath);
    
    results = results.map(function (moduleName) {
      return {
        moduleName: moduleName,
        modulePath: path.join(scanPath, moduleName)
      };
    });
    
    results = results.filter(function (item) {
      try {
        item.moduleStat = fs.statSync(item.modulePath);
      } catch (error) {
        return false;
      }
      return item.moduleStat.isDirectory();
    });
    
    results = results.filter(function (item) {
      item.packagePath = path.join(item.modulePath, 'package.json');
      item.packageStat = utilsCore.pathExistsSync(item.packagePath) ? fs.statSync(item.packagePath) : undefined;
      return item.packageStat && item.packageStat.isFile();
    });
    
    results = results.filter(function (item) {
      try {
        item.packageInfo = JSON.parse(fs.readFileSync(item.packagePath));
        return item.packageInfo && item.packageInfo.plugins && item.packageInfo.plugins['azure-cli'];
      }
        catch (err) {
        return false;
      }
    });
    
    results = this._flatten(results.map(function (item) {
      var plugins = item.packageInfo.plugins['azure-cli'];
      if (!_.isArray(plugins)) {
        plugins = [plugins];
      }
      
      return plugins.map(function (relativePath) {
        return {
          context: item,
          pluginPath: path.join(item.modulePath, relativePath)
        };
      });
    }));
    
    results = results.filter(function (item) {
      item.plugin = require(item.pluginPath);
      return item.plugin.init;
    });
    
    return results;
  },
  
  _flatten: function (arrays) {
    var result = [];
    arrays.forEach(function (array) {
      result = result.concat(array);
    });
    return result;
  },
  
  _serializeIndividualEntity: function (entity) {
    //TODO: split out the concept of category or command
    var cmdOrCat = {};
    
    if (entity.name) {
      cmdOrCat.name = entity.name;
    }
    
    if (entity.description) {
      cmdOrCat.description = entity.description();
    }
    
    if (entity.fullName) {
      cmdOrCat.fullName = entity.fullName();
    }
    
    if (entity.usage) {
      cmdOrCat.usage = entity.usage();
    }
    
    if (entity.filePath) {
      //Normalize the file path, so that it can be used for both linux and windows.
      cmdOrCat.filePath = path.relative(this.cmdBasePath, entity.filePath).split('\\').join('/');
    }
    
    if (entity.options) {
      cmdOrCat.options = entity.options;
    }
    
    return cmdOrCat;
  },
  
  _serializeCategory: function (category) {
    var cat = this._serializeIndividualEntity(category);
    cat.commands = [];
    cat.categories = {};
    
    if (category.commands) {
      for (var i in category.commands) {
        cat.commands.push(this._serializeIndividualEntity(category.commands[i]));
      }
    }
    
    if (category.categories) {
      for (var j in category.categories) {
        var currentCategory = this._serializeCategory(category.categories[j]);
        cat.categories[currentCategory.name] = currentCategory;
      }
    }
    
    return cat;
  }

});

module.exports = CmdLoader;