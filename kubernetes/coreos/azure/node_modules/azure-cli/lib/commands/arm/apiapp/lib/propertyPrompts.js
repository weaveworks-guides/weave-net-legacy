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
var util = require('util');
var fmt = util.format;

var utils = require('../../../../util/utils');
var $ = utils.getLocaleString;

//
// Implementation of interactive prompts for the various parameter types
// Each type gets the following functions:
//  prompter(interaction): return a function fn(prompt, done) where
//            prompt is the prompt message for the user and
//            done is the callback to return the retrieved value.
//
//  convert(value): Convert the string input value to the final value
//                  to be sent to Azure.
//
//  validate(value): Verifies that the value entered matches the expected type.
//                   Returns error message string if validation fails, nothing
//                   if validation passes.
//

var promptersByType = {
  string: {
    prompter: function (interaction) { return interaction.prompt.bind(interaction); },
    convert: function (value) { return value.trim(); },
    validate: function () { }
  },

  securestring: {
    prompter: function (interaction) { return interaction.promptPasswordOnce.bind(interaction); },
    convert: function (value) { return value; },
    validate: function () { }
  },

  int: {
    prompter: function (interaction) { return interaction.prompt.bind(interaction); },
    convert: function (value) {
      return Number(value);
    },
    validate: function (value) {
      var n = Number(value);
      if (!_.isNaN(n) && n !== (n|0)) {
        return fmt($('The value %s is not a valid integer.'), n);
      }
    }
  },

  bool: {
    prompter: function (interaction) {
      return function (prompt, done) {
        // console.log is ok here, that's what underlying prompt command uses.
        console.log(prompt);
        interaction.choose(['true', 'false'], done);
      };
    },
    convert: function (value) {
      return value === 'true';
    },
    validate: function () {
      // no need, since we're using choose method there's no option to get it wrong
    }
  },

  array: {
    prompter: function (interaction) { return interaction.prompt.bind(interaction); },
    convert: function (value) {
      // Comma separated values, remove extraneous whitespace
      return value.split(',').map(function (s) { return s.trim(); });
    },
    validate: function () {
      // No need to validate, it's just a string at this point
    }
  },
  object: {
    prompter: function (interaction) { return interaction.prompt.bind(interaction); },
    convert: function (value) {
      return JSON.parse(value.trim());
    },
    validate: function (value) {
      if (value.trim()[0] !== '{') {
        return $('This is not a valid JSON object literal.');
      }
      try {
        JSON.parse(value.trim());
      } catch (ex) {
        return $('This is not a valid JSON object literal.');
      }
    }
  }
};

//
// Prompt the user interactively for a parameter value.
//
function interactivePrompt(interaction) {
  return function (parameterInfo, done) {
    getPrompter(parameterInfo, function (err, prompter) {
      if (err) { return done(err); }

      var promptFunc = prompter.prompter(interaction);
      function doPrompt(message) {
        promptFunc(message, function (err, value) {
          // Fatal error, bail
          if (err) { return done(err); }

          // No value given but there's a default, return default
          if (value ==='' && !_.isUndefined(parameterInfo.defaultValue)) {
            return done(null, parameterInfo.defaultValue);
          }

          // No value given, no default
          if (value === '') {
            return doPrompt(message);
          }

          // Value given, is it good?
          var errMessage = validate(prompter, parameterInfo, value);
          if (!errMessage) {
            // Passed validation, return final value
            var converted = prompter.convert(value);
            return done(null, converted);
          }

          var newMessage = fmt('%s %s', errMessage, createPromptMessage(parameterInfo));
          // Try again
          doPrompt(newMessage);
        });
      }

      // and kick off the prompt
      doPrompt(createPromptMessage(parameterInfo));
    });
  };
}

function getPrompter(parameterInfo, done) {
  var prompter;
  if (parameterInfo.type) {
    prompter = promptersByType[parameterInfo.type.toLowerCase()];
  } else {
    prompter = promptersByType.string;
  }

  if (!prompter) {
    return done(new Error(fmt($('The data type %s is not supported'), parameterInfo.type)));
  }

  return done(null, prompter);
}

function createPromptMessage(parameterInfo) {
  var format = $('Enter value for %s%s: ');
  var defaultValuePrompt = '';
  if (!_.isUndefined(parameterInfo.defaultValue)) {
    defaultValuePrompt = fmt(' [%s]', parameterInfo.defaultValue);
  }
  return fmt(format, parameterInfo.displayName || parameterInfo.name, defaultValuePrompt);
}

function validate(prompter, parameterInfo, value) {
  var errMessage = prompter.validate(value);
  if (parameterInfo.extraValidator) {
    errMessage = errMessage || parameterInfo.extraValidator(value);
  }

  return errMessage;
}

//
// read parameter values from object. Fails if a requested object is not
// found in the object and no default value is available.

function objectPrompter(sourceObject) {
  return function(propertyInfo, done) {
    if (_.has(sourceObject, propertyInfo.name)) {
      return done(null, sourceObject[propertyInfo.name]);
    }
    if (_.has(propertyInfo, 'defaultValue')) {
      return done(null, propertyInfo.defaultValue);
    }

    return done(new Error(fmt($('Value for parameter %s has not been given and there is no default value'), propertyInfo.name)));
  };
}

_.extend(exports, {
  interactive: interactivePrompt,
  object: objectPrompter
});
