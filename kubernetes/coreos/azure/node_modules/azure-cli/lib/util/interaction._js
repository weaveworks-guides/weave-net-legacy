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

var __ = require('underscore');
var tty = require('tty');
var fs = require('fs');
var util = require('util');
var tty = require('tty');

/*jshint camelcase:false*/
var child_process = require('child_process');

var log = require('./logging');

function Interactor(cli) {
  this.cli = cli;
  this.istty1 = tty.isatty(1);

  this.initProgressBars();
}

__.extend(Interactor.prototype, {
  initProgressBars: function() {
    var self = this;
    self.progressChars = ['-', '\\', '|', '/'];
    self.progressIndex = 0;

    self.clearBuffer = new Buffer(79, 'utf8');
    self.clearBuffer.fill(' ');
    self.clearBuffer = self.clearBuffer.toString();
  },


  drawAndUpdateProgress: function() {
    var self = this;

    fs.writeSync(1, '\r');
    process.stdout.write(self.progressChars[self.progressIndex].cyan);

    self.progressIndex++;
    if (self.progressIndex === self.progressChars.length) {
      self.progressIndex = 0;
    }
  },

  clearProgress: function() {
    var self = this;

    // do not output '+' if there is no progress
    if (self.currentProgress) {
      if (self.activeProgressTimer) {
        clearInterval(self.activeProgressTimer);
        self.activeProgressTimer = null;
      }
      fs.writeSync(1, '\r+\n');
      self.currentProgress = undefined;
    }
  },

  writeDuringProgress: function(level, message) {
    if (this.currentProgress) {
      fs.writeSync(1, '\r' + this.clearBuffer + '\r');
      log[level](message);
      this.drawAndUpdateProgress();
    }
  },

  pauseProgress: function () {
    if (this.currentProgress) {
      fs.writeSync(1, '\r' + this.clearBuffer + '\r');
    }
  },

  restartProgress: function (label) {
    if (this.currentProgress) {
      this.drawAndUpdateProgress();
      if (label) {
        fs.writeSync(1, ' ' + label);
      }
    }
  },

  progress: function(label, log) {
    var self = this;
    if (!log && self.cli) {
      log = self.cli.output;
    }

    var verbose = log && (log.format().json || log.format().level === 'verbose' || log.format().level === 'silly');
    if (!self.istty1 || verbose)  {
      (verbose ? log.verbose : log.info)(label);
      return {
        write: function (logAction) {
          logAction();
        },
        end: function() {}
      };
    }

    // clear any previous progress
    self.clearProgress();

    // Clear the console
    fs.writeSync(1, '\r' + self.clearBuffer);

    // Draw initial progress
    self.drawAndUpdateProgress();

    // Draw label
    if (label) {
      fs.writeSync(1, ' ' + label);
    }

    self.activeProgressTimer = setInterval(function() {
      self.drawAndUpdateProgress();
    }, 200);

    self.currentProgress = {
      write: function (logAction, newLabel) {
        newLabel = newLabel || label;
        self.pauseProgress();
        logAction();
        self.restartProgress(newLabel);
      },
      end: function() {
        self.clearProgress();
      }
    };

    return self.currentProgress;
  },

  withProgress: function (label, action, callback) {
    var self = this;
    var p = this.progress(label);
    var logMsgs = [];
    var logger = {
      error: function (message) {
        logMsgs.push(function () { self.cli.output.error(message); });
      },
      info: function (message) {
        logMsgs.push(function () { self.cli.output.info(message); });
      },
      data: function (message) {
        logMsgs.push(function () { self.cli.output.data(message); });
      },
      warn: function (message) {
        logMsgs.push(function () { self.cli.output.warn(message); });
      }
    };

    action.call(p, logger, function () {
      p.end();
      logMsgs.forEach(function (lf) { lf(); });
      callback.apply(null, arguments);
    });
  },

  prompt: function (msg, callback) {
    this.cli.prompt(msg, function (result) {
      callback(null, result);
    });
  },

  confirm: function(msg, callback) {
    this.cli.confirm(msg, function(ok) {
      callback(null, ok);
    });
  },

  promptPassword: function (msg, callback) {
    this.password(msg, '*', function (result) {
      callback(null, result);
    });
  },

  promptPasswordIfNotGiven: function (promptString, currentValue, _) {
    if (__.isUndefined(currentValue)) {
      var value = this.promptPassword(promptString, _);
      return value;
    } else {
      return currentValue;
    }
  },

  promptPasswordOnce: function (msg, callback) {
    this.passwordOnce(msg, '*', function (result) {
      callback(null, result);
    });
  },

  promptPasswordOnceIfNotGiven: function (promptString, currentValue, _) {
    if (__.isUndefined(currentValue)) {
      var value = this.promptPasswordOnce(promptString, _);
      return value;
    } else {
      return currentValue;
    }
  },

  promptIfNotGiven: function (promptString, currentValue, _) {
    if (__.isUndefined(currentValue)) {
      var value = this.prompt(promptString, _);
      return value;
    } else {
      return currentValue;
    }
  },

  choose: function (values, callback) {
    this.cli.choose(values, function(value) {
      callback(null, value);
    });
  },

  chooseIfNotGiven: function (promptString, progressString, currentValue, valueProvider, _) {
    if (__.isUndefined(currentValue)) {
      var progress = this.cli.interaction.progress(progressString);
      var values = valueProvider(_);
      progress.end();

      this.cli.output.help(promptString);
      var i = this.choose(values, _);
      return values[i];
    } else {
      return currentValue;
    }
  },

  formatOutput: function (outputData, humanOutputGenerator) {
    this.cli.output.json('silly', outputData);
    if(this.cli.output.format().json) {
      this.cli.output.json(outputData);
    } else {
      humanOutputGenerator(outputData);
    }
  },

  logEachData: function (title, data) {
    for (var property in data) {
      if (data.hasOwnProperty(property)) {
        if (data[property]) {
          this.cli.output.data(title + ' ' + property, data[property]);
        } else {
          this.cli.output.data(title + ' ' + property, '');
        }
      }
    }
  },

  launchBrowser: function (url, _) {
    log.info('Launching browser to', url);
    if (process.env.OS !== undefined) {
      // escape & characters for start cmd
      var cmd = util.format('start %s', url).replace(/&/g, '^&');
      child_process.exec(cmd, _);
    } else {
      child_process.spawn('open', [url]);
    }
  },

  passwordOnce: function (currentStr, mask, callback) {
    var buf = '';

    // default mask
    if ('function' === typeof mask) {
      callback = mask;
      mask = '';
    }

    if (!process.stdin.setRawMode) {
      process.stdin.setRawMode = tty.setRawMode;
    }

    process.stdin.resume();
    process.stdin.setRawMode(true);
    fs.writeSync(this.istty1 ? 1 : 2, currentStr);

    process.stdin.on('data', function (character) {
      // Exit on Ctrl+C keypress
      character = character.toString();
      if (character === '\003') {
        console.log('%s', buf);
        process.exit();
      }

      // Return password in the buffer on enter key press
      if (character === '\015') {
        process.stdin.pause();
        process.stdin.removeAllListeners('data');
        process.stdout.write('\n');
        process.stdin.setRawMode(false);

        return callback(buf);
      }

      // Backspace handling
      // Windows usually sends '\b' (^H) while Linux sends '\x7f'
      if (character === '\b' || character === '\x7f') {
        if (buf) {
          buf = buf.slice(0, -1);
          for (var j = 0; j < mask.length; ++j) {
            process.stdout.write('\b \b'); // space the last character out
          }
        }

        return;
      }

      character = character.split('\015')[0]; // only use the first line if many (for paste)
      for(var i = 0; i < character.length; ++i) {
        process.stdout.write(mask); // output several chars (for paste)
      }

      buf += character;
    });
  },

  // Allow cli.password to accept empty passwords
  password: function (str, mask, fn) {
    var self = this;

    // Prompt first time
    this.passwordOnce(str, mask, function (pass) {
      // Prompt for confirmation
      self.passwordOnce('Confirm password: ', mask, function (pass2) {
        if (pass === pass2) {
          fn (pass);
        } else {
          throw new Error('Passwords do not match.');
        }
      });
    });
  }
});

module.exports = Interactor;