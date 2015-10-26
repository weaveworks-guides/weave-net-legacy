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

// If running from MSI installed version, don't use the
// compile on the fly streamline files. MSI install precompiles
// the streamline files
if (!process.env.PRECOMPILE_STREAMLINE_FILES) {
  require('streamline').register({ cache: true });
}

var fs = require('fs');
var path = require('path');
var util = require('util');

var _ = require('underscore');
var callerId = require('caller-id');

var CmdLoader = require('./cmdLoader');
var ExtendedCommand = require('./util/extendedcommand');
var log = require('./util/logging');

var utilsCore = require('./util/utilsCore');
var Interactor = require('./util/interaction');

//'genMode' is only used on generating command metadata, value: 'asm' or 'arm'
function AzureCli(name, parent, genMode) {
  this.parent = parent;
  this.output = log;
  this.interaction = new Interactor(this);

  AzureCli['super_'].call(this, name);
  
  if (parent) {
    this._mode = parent._mode;
  }
  else {
    this.initSetup();
    
    this.enableNestedCommands(this);
    
    // Check node.js version.
    // Do it after changing exception handler.
    this.checkVersion();
    
    this._mode = genMode;
    if (!this._mode) {
      this._mode = utilsCore.getMode();
    }
    var loader = new CmdLoader(this, this._mode);
    if (genMode) {
      log.info('Generating command metadata file: ' + loader.cmdMetadataFile);
      loader.harvestPlugins();
      loader.harvestModules();
      loader.saveCmdMetadata();
      log.info('Done');
      return;
    } else if (loader.cmdMetadataExists()) {
      loader.initFromCmdMetadata(AzureCli);
    } else {
      log.warn('No existing command metadata files. Command will run slow.');
      loader.harvestPlugins();
      loader.harvestModules();
    }
  }
}

util.inherits(AzureCli, ExtendedCommand);

_.extend(AzureCli.prototype, {
  initSetup: function () {
    var self = this;

    self.debug = process.env.AZURE_DEBUG === '1';

    // Install global unhandled exception handler to make unexpected errors more user-friendly.
    if (!self.debug && process.listeners('uncaughtException').length === 0) {
      self.uncaughExceptionHandler = function (err) {
        self.interaction.clearProgress();

        // Exceptions should always be logged to the console
        var noConsole = false;
        if (!log['default'].transports.console) {
          noConsole = true;
          self.output.add(self.output.transports.Console);
        }

        var loggedFullError = false;
        if (err.message) {
          log.error(err.message);
        } else if (err.Message) {
          log.error(err.Message);
        } else {
          log.json('error', err);
          loggedFullError = true;
        }

        if (!loggedFullError) {
          if (err.stack) {
            log.verbose('stack', err.stack);
          }

          log.json('silly', err);
        }

        self.recordError(err);

        if (noConsole) {
          self.output.remove(self.output.transports.Console);
        }

        self.exit('error', null, 1);
      };

      process.addListener('uncaughtException', self.uncaughExceptionHandler);
    }
  },

  getErrorFile: function () {
    return path.join(utilsCore.azureDir(), 'azure.err');
  },

  getSillyErrorFile: function () {
    return path.join(utilsCore.azureDir(), 'azure.details.err');
  },

  recordError: function (err) {
    if (err) {
      var errorFile = this.getErrorFile();
      try {
        var writeFileFunction = process.env.AZURE_CLI_APPEND_LOGS ? fs.appendFileSync : fs.writeFileSync;
        writeFileFunction(errorFile, (new Date()) + ':\n' +
            util.inspect(err) + '\n' + err.stack + '\n');
        (log.format().json ? log.error : log.info)('Error information has been recorded to ' + errorFile);
      } catch (err2) {
        log.warn('Cannot save error information :' + util.inspect(err2));
      }

      log.writeCapturedSillyLogs(this.getSillyErrorFile(), process.env.AZURE_CLI_APPEND_LOGS);
    }
  },

  exit: function (level, message, exitCode) {
    var self = this;

    self.interaction.clearProgress();
    if (message) {
      log.log(level, message);
    }

    if (self.uncaughtExceptionHandler) {
      process.removeListener('uncaughtException', self.uncaughExceptionHandler);
    }

    process.exit(exitCode);
  },
  
  normalizeAuthorizationError: function (msg) {
    var regex = /.*The \'Authorization\' header is not present or provided in an invalid format.*/ig;
    if (msg.match(regex)) {
      msg = 'Certificate based Authentication is not supported in current mode: \'' + this._mode + 
            '\'. Please authenticate using an organizational account via \'azure login\' command.';
    }
    return msg;
  },

  execute: function (fn) {
    var self = this;

    return self.action(function () {
      self.setupCommandOutput();
      
      if (log.format().json) {
        log.verbose('Executing command ' + self.fullName().bold);
      } else {
        log.info('Executing command ' + self.fullName().bold);
      }

      try {
        // Expected arguments + options + callback
        var argsCount = fn.length <= 1 ? self.args.length + 2 : fn.length;
        var args = new Array(argsCount);

        var optionIndex = arguments.length - 1;
        for (var i = 0; i < arguments.length; i++) {
          if (typeof arguments[i] === 'object') {
            optionIndex = i;
            break;
          }
        }

        // append with options and callback 
        var options = arguments[optionIndex].optionValues;

        args[args.length - 2] = options;
        args[args.length - 1] = callback;

        // set option arguments into their positional respective places
        var freeArguments = 0;
        for (var j = 0; j < self.args.length; j++) {
          var optionName = utilsCore.camelcase(self.args[j].name);
          if (options[optionName]) {
            args[j] = options[optionName];
            delete options[optionName];
          } else if (freeArguments < arguments.length) {
            args[j] = arguments[freeArguments];
            freeArguments++;
          }
        }

        fn.apply(this, args);
      } catch (err) {
        callback(err);
      }

      function callback(err) {
        if (err) {
          // Exceptions should always be logged to the console unless overturned by test run
          var noConsole = false;
          if (!process.env.AZURE_NO_ERROR_ON_CONSOLE && !log['default'].transports.console) {
            noConsole = true;
            self.output.add(self.output.transports.Console);
          }

          if (err.message) {
            log.error(err.message);
            log.json('silly', err);
          } else if (err.Message) {
            if (typeof err.Message === 'object' && typeof err.Message['#'] === 'string') {
              var innerError;
              try {
                innerError = JSON.parse(err.Message['#']);
              } catch (e) {
                // empty
              }

              if (innerError) {
                if (noConsole) {
                  self.output.remove(self.output.transports.Console);
                }

                return callback(innerError);
              }
            }

            err.message = self.normalizeAuthorizationError(err.message);
            log.error(err.Message);
            log.json('verbose', err);
          } else {
            log.error(err);
          }

          self.recordError(err);
          if (err.stack) {
            (self.debug ? log.error : log.verbose)(err.stack);
          }

          if (noConsole) {
            self.output.remove(self.output.transports.Console);
          }

          self.exit('error', self.fullName().bold + ' command ' + 'failed\n'.red.bold, 1);
        } else {
          if (log.format().json) {
            self.exit('verbose', self.fullName().bold + ' command ' + 'OK'.green.bold, 0);
          }
          else {
            self.exit('info', self.fullName().bold + ' command ' + 'OK'.green.bold, 0);
          }
        }
      }
    });
  },

  /*
  * Extends the default parseOptions to support multiple levels in commans parsing.
  */
  parseOptions: function (argv) {
    var args = [];
    var len = argv.length;
    var literal = false;
    var option;
    var arg;

    var unknownOptions = [];

    // parse options
    for (var i = 0; i < len; ++i) {
      arg = argv[i];

      // literal args after --
      if ('--' == arg) {
        literal = true;
        continue;
      }

      if (literal) {
        args.push(arg);
        continue;
      }

      // find matching Option
      option = this.optionFor(arg);

      //// patch begins
      var commandOption = null;

      if (!option && arg[0] === '-') {
        var command = this;
        var arga = null;
        for (var a = 0; a < args.length && command && !commandOption; ++a) {
          arga = args[a];
          if (command.categories && (arga in command.categories)) {
            command = command.categories[arga];
            commandOption = command.optionFor(arg);
            continue;
          }
          break;
        }
        if (!commandOption && arga && command && command.commands) {
          for (var j in command.commands) {
            if (command.commands[j].name === arga) {
              commandOption = command.commands[j].optionFor(arg);
              break;
            }
          }
        }
      }
      //// patch ends

      // option is defined
      if (option) {
        // requires arg
        if (option.required) {
          arg = argv[++i];
          if (!arg) {
            return this.optionMissingArgument(option);
          }

          if ('-' === arg[0]) {
            return this.optionMissingArgument(option, arg);
          }

          this.emit(option.name(), arg);
        } else if (option.optional) {
          // optional arg
          arg = argv[i + 1];
          if (!arg || '-' === arg[0]) {
            arg = null;
          } else {
            ++i;
          }

          this.emit(option.name(), arg);
        // bool
        } else {
          this.emit(option.name());
        }
        continue;
      }

      // looks like an option
      if (arg.length > 1 && '-' == arg[0]) {
        unknownOptions.push(arg);

        // If the next argument looks like it might be
        // an argument for this option, we pass it on.
        //// patch: using commandOption if available to detect if the next value is an argument
        // If it isn't, then it'll simply be ignored
        commandOption = commandOption || { optional : 1 }; // default assumption
        if (commandOption.required || (commandOption.optional && argv[i + 1] && '-' != argv[i + 1][0])) {
          unknownOptions.push(argv[++i]);
        }
        continue;
      }

      // arg
      args.push(arg);
    }

    return { args: args, unknown: unknownOptions };
  },

  setupCommandLogFormat: function (topMost) {
    if (topMost) {
      var opts = {
        json: false,
        level: 'info',
        logo: 'on'
      };

      log.format(opts);
    }
  },

  setupCommandOutput: function (raw) {
    var self = this;
    var verbose = 0;
    var json = 0;

    if (!raw) {
      raw = self.normalize(self.parent.rawArgs.slice(2));
    }

    function hasOption(optionName) {
      return self.options.some(function (o) { return o.long === optionName; });
    }

    for (var i = 0, len = raw.length; i < len; ++i) {
      if (hasOption('--json') &&
        raw[i] === '--json') {
        ++json;
      } else if (hasOption('--verbose') &&
        (raw[i] === '-v' || raw[i] === '--verbose')) {
        ++verbose;
      }
    }

    var opts = {};
    if (verbose || json) {
      if (json) {
        opts.json = true;
        opts.level = 'data';
      }
      
      if (verbose == 1) {
        opts.json = false;
        opts.level = 'verbose';
      }
      
      if (verbose >= 2) {
        opts.json = false;
        opts.level = 'silly';
      }
    } else {
      opts.level = 'info';
    }
    log.format(opts);
  },

  enableNestedCommands: function (command) {
    if (!command.parent) {
      command.option('-v, --version', 'output the application version');
    }

    if (!command.categories) {
      command.categories = {};
    }

    command.category = function (name) {
      var category = command.categories[name];
      if (!command.categories[name] || (command.categories[name]).stub && this.executingCmd) {
        category = command.categories[name] = new AzureCli(name, this);
        command.categories[name].stub = false;
        category.helpInformation = command.categoryHelpInformation;
        command.enableNestedCommands(category);
      }

      return category;
    };

    command.on('*', function () {
      var args = command.rawArgs.slice(0, 2);
      var raw = command.normalize(command.rawArgs.slice(2));

      var category = '*';
      if (raw.length > 0) {
        category = raw[0];
        args = args.concat(raw.slice(1));
      }

      var i, index;
      var targetCmd;
      var cat = command.categories[category];
      //see whether it is top level command, like 'login', 'logout', etc
      if (!cat){
        index = command.searchCommand(category, command.commands);
        if (index !== -1){
          targetCmd = require(command.commands[index].filePath);
          targetCmd.init.apply(command, [command]);
          //execute command by emitting event, which will be routed to the handler. 
          return this.parse(command.rawArgs);
        }
      }

      //see whether it is a nested command
      for (i = 2; cat && i < args.length && args[i] !== '-h' && args[i] !== '--help';  i++) {
        index = command.searchCommand(args[i], cat.commands);
        if (index !== -1) {
          targetCmd = cat.commands[index];
          break;
        } else {
          cat = cat.categories[args[i]];
        }
      }

      //we have found the command, execute it.
      if (targetCmd) {
        //no need to load the command file, as we get help from the metadata file
        if (i+1 < args.length && (args[i+1] === '-h' || args[i+1] === '--help')) {
          return targetCmd.commandHelpInformation();
        }
        this.executingCmd = true;
        if (!this.workaroundOnAsmSiteCommands(targetCmd, command)) {
          targetCmd = require(targetCmd.filePath);
          targetCmd.init(command);
        }
        cat = command.categories[category];
        return cat.parse(args);
      }

      if (!cat) {
        var toBlame = (i>2) ? args[i-1] : category;
        log.error('\'' + toBlame + '\' is not an azure command. See \'azure help\'.');
      } else {
        //if we are here, then it is about display help.
        command.categoryHelpInformation.apply(cat,[]);
      }
    });
  },
  
  //Contrary to all other commands, ASM\Site commands were written 
  //differently that loading the single file containing the command 
  //is not enough, due to cross referencing, so we load them all.
  //For new commands, we will not approve using the style. 
  workaroundOnAsmSiteCommands: function (targetCmd, command) {
    if (path.basename(targetCmd.filePath).indexOf('site.') !== -1) {
      var siteCmdDir = path.dirname(targetCmd.filePath);
      var siteCmdFiles = utilsCore.getFiles(siteCmdDir, false);
      var filesToLoad = {};
      var sitePlugins = [];
      
      //It is possible that ._js and precompiled version (.js) co-exist when 
      //both are laid down by the installer. We should only load .js ones.
      siteCmdFiles.forEach(function (f) {
        var basename = path.basename(f);
        if (basename.indexOf('site.') === 0) {
          var nameWithoutExt = basename.substring(0, basename.lastIndexOf('.'));
          var ext = path.extname(basename);
          if (filesToLoad[nameWithoutExt]) {
            if (ext === '.js') {
              filesToLoad[nameWithoutExt] = f;
            }
          } else {
            filesToLoad[nameWithoutExt] = f;
          }
        }
      });
      Object.keys(filesToLoad).forEach(function (f) {
        sitePlugins.push(require(filesToLoad[f]));
      });
      sitePlugins.forEach(function (plugin) {
        if (plugin.init) {
          plugin.init(command);
        }
      });
      return true;
    } else {
      return false;
    }
  },

  command: function (name) {
    var args = name.split(/ +/);
    var cmd = new AzureCli(args.shift(), this);
    cmd.option('-v, --verbose', 'use verbose output');
    cmd.option('-vv', 'more verbose with debug output');
    cmd.option('--json', 'use json output');

    var caller = callerId.getData();
    cmd.filePath = caller.filePath;
    cmd.helpInformation = cmd.commandHelpInformation;
    var index = this.searchCommand(cmd.name, this.commands);
    if (index !== -1) {
      this.commands[index] = cmd;
    } else {
      this.commands.push(cmd);
    }
    cmd.parseExpectedArgs(args);
    return cmd;
  },

  searchCommand: function(name, commands) {
    if ( !commands || !name ) return -1;
    for (var i = 0; i < commands.length; i++) {
      if (commands[i].name === name) {
        return i;
      }
    }
    return -1;
  },

  deprecatedDescription: function (text, newCommand) {
    return this.description(util.format('%s (deprecated. This command is deprecated and will be removed in a future version. Please use \"%s\" instead', text, newCommand));
  },
  
  detailedDescription: function (str) {
    if (0 === arguments.length) return this._detailedDescription;
    this._detailedDescription = str;
    return this;
  },
   
  getMode: function () {
    return this._mode;
  }, 

  isAsmMode: function () {
    return utilsCore.ignoreCaseEquals(this._mode, 'asm');
  },

  checkVersion: function () {
    // Uploading VHD needs 0.6.15 on Windows
    var version = process.version;
    var ver = version.split('.');
    var ver1num = parseInt(ver[1], 10);
    var ver2num = parseInt(ver[2], 10);
    if (ver[0] === 'v0') {
      if (ver1num < 6 || (ver1num === 6 && ver2num < 15)) {
        throw new Error('You need node.js v0.6.15 or higher to run this code. Your version: ' +
            version);
      }
      if (ver1num === 7 && ver2num <= 7) {
        throw new Error('You need node.js v0.6.15 or higher to run this code. Your version ' +
            version + ' won\'t work either.');
      }
    }
  }
});

exports = module.exports = AzureCli;
