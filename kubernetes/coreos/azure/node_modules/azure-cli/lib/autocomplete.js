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

var CmdLoader = require('./cmdLoader');
var utilsCore = require('./util/utilsCore');

function AutoComplete() {
  this.mode = utilsCore.getMode();
  this.cmdMetadataFile = path.join(__dirname, 'plugins.' + this.mode + '.json');
  this.cmdBasePath = __dirname;
  var loader = new CmdLoader(this, this.mode);
  if (loader.cmdMetadataExists()) {
    this.initFromCmdMetadata();
  }
  
  this.enableAutoComplete();
}

_.extend(AutoComplete.prototype, {
  initFromCmdMetadata: function () {
    var data = fs.readFileSync(this.cmdMetadataFile);
    var cachedPlugins = JSON.parse(data);
    this.commands = cachedPlugins.commands;
    this.categories = cachedPlugins.categories;
  },
  
  enableAutoComplete: function () {
    var root = this;
    var omelette = require('omelette');
    root.autoComplete = omelette('azure');
    
    function handleAutocomplete(fragment, word, line) {
      var args = line.trim().split(' ')
        .filter(function (a) {
        return a !== '';
      }).map(function (c) {
        return c.trim();
      });
      
      var currentCommand;
      var arg;
      var index;
      var parentCategory;
      var currentCategory;
      
      // start from 1, so to discard "azure" word
      for (index = 1, currentCategory = root; index < args.length; index++) {
        arg = args[index];
        parentCategory = currentCategory;
        currentCategory = currentCategory.categories[arg];
        if (!currentCategory) {
          break;
        }
      }
      
      var tempCategory = currentCategory ? currentCategory : parentCategory;
      var allSubCategoriesAndCommands = Object.keys(tempCategory.categories)
        .concat(tempCategory.commands.map(function (c) { return c.name; }));
      
      currentCommand = tempCategory.commands
        .filter(function (c) {return c.name === arg;})[0];
      
      //run out argument while have a valid category?
      if (currentCategory) {
        //return sub categories and command combind
        return this.reply(allSubCategoriesAndCommands);
      }
      
      var allCommandOptions;
      if (currentCommand) {
        allCommandOptions = currentCommand.options.map(function (o) { return o.long; })
            .concat(currentCommand.options.map(function (o) { return o.short; }));
      }
      //we are at the last arg, try match both categories and commands
      if (index === args.length - 1) {
        if (currentCommand) {
          return this.reply(allCommandOptions);
        } else {
          return this.reply(allSubCategoriesAndCommands.filter(function (c) {
            return utilsCore.stringStartsWith(c, arg);
          }));
        }
      }
      
      // try to match a command's options
      var lastArg = args[args.length - 1];
      if (currentCommand && utilsCore.stringStartsWith(lastArg, '-')) {
        var option = currentCommand.options
          .filter(function (c) {
            return c.fileRelatedOption && (c.short === lastArg || c.long === lastArg);
          })[0];
        
        if (option) {
          return this.reply(fs.readdirSync(process.cwd()));
        } else {
          return this.reply(
            allCommandOptions.filter(function (c) { return c && utilsCore.stringStartsWith(c, lastArg);}));
        }
      }
      return this.reply([]);
    }
    
    root.autoComplete.on('complete', handleAutocomplete);
    root.autoComplete.init();
  }
});

module.exports = AutoComplete;