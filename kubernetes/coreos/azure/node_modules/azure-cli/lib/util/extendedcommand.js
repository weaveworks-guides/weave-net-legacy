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

//
// Extensions to Commander to support nested commands / help system
//
var _ = require('underscore');
var commander = require('commander');
var fs = require('fs');
var path = require('path');
var util = require('util');
var utilsCore = require('./utilsCore');
var pjson = require('../../package.json');
var Constants = require('./constants');

function ExtendedCommand(name) {
  ExtendedCommand['super_'].call(this, name);
}

util.inherits(ExtendedCommand, commander.Command);

_.extend(ExtendedCommand.prototype, {

  //////////////////////////////
  // override help subsystem

  fullName: function () {
    var name = this.name;
    var scan = this.parent;
    while (scan && scan.parent !== undefined) {
      name = scan.name ? scan.name + ' ' + name : name;
      scan = scan.parent;
    }

    return name;
  },

  usage: function (str) {
    var ret;

    if (str) {
      ret = commander.Command.prototype.usage.call(this, str);
    } else {
      ret = commander.Command.prototype.usage.call(this);
      ret = ret.replace(/,/g,' ');
    }

    return ret;
  },

  helpInformation: function() {
    var self = this;

    if (!self.parent) {
      var raw = self.normalize(process.argv.slice(2));

      var packagePath = path.join(__dirname, '../../package.json');
      var packageInfo = JSON.parse(fs.readFileSync(packagePath));

      if (raw.indexOf('-v') >= 0) {
        console.log(packageInfo.version);
      } else if (raw.indexOf('--version') >= 0) {
        console.log(util.format('%s (node: %s)', packageInfo.version, process.versions.node));
      } else {
        self.setupCommandLogFormat(true);

        self.output.info('         _    _____   _ ___ ___'.cyan);
        self.output.info('        /_\\  |_  / | | | _ \\ __|'.cyan);
        self.output.info('  _ ___'.grey + '/ _ \\'.cyan + '__'.grey + '/ /| |_| |   / _|'.cyan + '___ _ _'.grey);
        self.output.info('(___  '.grey + '/_/ \\_\\/___|\\___/|_|_\\___|'.cyan + ' _____)'.grey);
        self.output.info('   (_______ _ _)         _ ______ _)_ _ '.grey);
        self.output.info('          (______________ _ )   (___ _ _)'.grey);
        self.output.info('');

        self.output.info('Microsoft Azure: Microsoft\'s Cloud Platform');
        self.output.info('');
        self.output.info('Tool version', packageInfo.version);

        self.helpCommands();
        self.helpCategoriesSummary(self.showMore());
        self.helpOptions();
        self.showCommandMode();
      }
    } else {
      self.output.help(self.description());
      self.output.help('');
      self.output.help('Usage:', self.fullName() + ' ' + self.usage());
      self.helpOptions();
      self.showCommandMode();
    }

    return '';
  },

  showCommandMode: function(){
    this.output.help('');
    var mode = this._mode;
    if (!mode) {
      mode = utilsCore.getMode();
    }
    var text = util.format('Current Mode: %s (Azure %s Management)', mode, 
      (mode === Constants.API_VERSIONS.ASM ? 'Service' : 'Resource')); 
    this.output.help(text);
  },

  showMore: function () {
    var raw = this.normalize(process.argv.slice(2));
    return raw.indexOf('--help') >= 0 || raw.indexOf('-h') >= 0;
  },

  categoryHelpInformation: function() {
    var self = this;

    this.output.help(self.description());
    self.helpCommands();
    self.helpCategories(-1) ;
    self.helpOptions();
    self.showCommandMode();
    return '';
  },

  commandHelpInformation: function() {
    var self = this;

    if (self._detailedDescription) {
      this.output.help(self.detailedDescription());
    } else {
      this.output.help(self.description());
    }

    this.output.help('');
    this.output.help('Usage:', self.fullName() + ' ' + self.usage());

    self.helpOptions();
    self.showCommandMode();

    return '';
  },

  helpJSON: function() {
    var self = this;
    var result = _.tap({}, function(res){
      if(_.isNull(self.parent) || _.isUndefined(self.parent)){
        res.name = pjson.name;
        res.description = pjson.description;
        res.author = pjson.author;
        res.version = pjson.version;
        res.contributors = pjson.contributors;
        res.homepage = pjson.homepage;
        res.licenses = pjson.licenses;
      } else {
        res.name = self.fullName();
        res.description = self.description();
      }
      res.usage = self.usage();
    });

    if (this.categories && Object.keys(this.categories).length > 0) {
      result.categories = {};

      for (var name in this.categories) {
        result.categories[name] = this.categories[name].helpJSON();
      }
    }

    if (this.commands && this.commands.length > 0) {
      result.commands = [];

      this.commands.forEach(function (cmd) {
        var command = {
          name: cmd.fullName(),
          description: cmd.description(),
          options: cmd.options,
          usage: cmd.usage()
        };

        result.commands.push(command);
      });
    }

    return result;
  },

  helpCategories: function(levels) {
    for (var name in this.categories) {
      var cat = this.categories[name];

      this.output.help('');

      this.output.help(cat.description().cyan);

      if (levels === -1 || levels > 0) {
        for (var index in cat.commands) {
          var cmd = cat.commands[index];
          this.output.help(' ', cmd.fullName() + ' ' + cmd.usage());
        }

        cat.helpCategories(levels !== -1 ? --levels : -1);
      } else {
        this.output.help(' ', cat.fullName());
      }
    }
  },

  helpCategoriesSummary: function(showMore) {
    var self = this;
    var categories = [];
    function scan(parent, levels, each) {
      for (var name in parent.categories) {
        var cat = parent.categories[name];

        each(cat);

        if (levels === -1 || levels > 0) {
          scan(cat, levels !== -1 ? --levels : -1, each);
        }
      }
    }

    scan(this, showMore ? -1 : 0, function (cat) { categories.push(cat); });
    var maxLength = 14;

    // Sort categories by alphabetical order
    categories.sort(function (a, b) {
      return (a.fullName() <  b.fullName()) ? -1 : (a.fullName() >  b.fullName()) ? 1 : 0;
    });

    categories.forEach(function (cat) {
      if (maxLength < cat.fullName().length)
        maxLength = cat.fullName().length;
    });

    self.output.help('');
    self.output.help('Commands:');
    categories.forEach(function (cat) {
      var name = cat.fullName();
      while (name.length < maxLength) {
        name += ' ';
      }

      self.output.help('  ' + name + ' ' + cat.description().cyan);
    });
  },

  helpCommands: function() {
    var self = this;

    this.commands.forEach(function (cmd) {
      self.output.help('');
      self.output.help(cmd.description().cyan);
      self.output.help(' ', cmd.fullName() + ' ' + cmd.usage());
    });
  },

  helpOptions: function() {
    var self = this;
    self.output.help('');
    self.output.help('Options:');
    self.optionHelp().split('\n').forEach(function (line) { self.output.help(' ', line); });
  },
  
  //enable the flag for auto-complete to list files under 
  //current working directory
  fileRelatedOption: function (flags, description) {
    this.option(flags, description);
    this.options[this.options.length - 1].fileRelatedOption = true;
    return this;
  },

  option: function (flags, description, fn, defaultValue) {
    var self = this;

    var option = new commander.Option(flags, description);

    // Remove preexistant option with same name
    self.options = self.options.filter(function (o) {
      return o.name() !== option.name() || o.long !== option.long;
    });

    var oname = option.name();
    var name = utilsCore.camelcase(oname);

    if (!self.optionValues) {
      self.optionValues = {};
    }

    // default as 3rd arg
    if ('function' !== typeof fn) {
      defaultValue = fn;
      fn = null;
    }

    // preassign default value only for --no-*, [optional], or <required>
    if (false === option.bool || option.optional || option.required) {
      // when --no-* we make sure default is true
      if (false === option.bool) defaultValue = true;
      // preassign only if we have a default
      if (undefined !== defaultValue) self.optionValues[name] = defaultValue;
    }

    // register the option
    this.options.push(option);

    // when it's passed assign the value
    // and conditionally invoke the callback
    this.on(oname, function (val) {
      // coercion
      if (val && fn) val = fn(val);

      // unassigned or bool
      if ('boolean' === typeof self.optionValues[name] || 'undefined' === typeof self.optionValues[name]) {
        // if no value, bool true, and we have a default, then use it!
        if (!val) {
          self.optionValues[name] = option.bool ? defaultValue || true : false;
        } else {
          self.optionValues[name] = val;
        }
      } else if (val) {
        // reassign
        self.optionValues[name] = val;
      }
    });

    return this;
  }
});

module.exports = ExtendedCommand;
