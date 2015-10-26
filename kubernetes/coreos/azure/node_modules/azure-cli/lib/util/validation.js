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
var check = require('validator');

var util = require('util');
var azureutil = require('./utils');

exports.isValidEnumValue = function(value, list) {
  if (!list.some(function (current) {
    return current.toLowerCase() === value.toLowerCase();
  })) {
    throw new Error(util.format('Invalid value: %s. Options are: %s.', value, list));
  }
};

exports.isURL = function (uri) {
  return (azureutil.stringStartsWith(uri, 'http://') ||
    azureutil.stringStartsWith(uri, 'https://')) &&
    check.isURL(uri);
};

exports.isIP = function (uri) {
  if (azureutil.stringStartsWith(uri, 'http://') || azureutil.stringStartsWith(uri, 'https://')) {
    uri = uri.substring(uri.indexOf('/') + 2);    
  }
  return check.isIP(uri);
};

/**
* Creates a anonymous function that check if the given uri is valid or not.
*
* @param {string} uri The uri to validate.
* @return {function}
*/
exports.isValidUri = function (uri) {
  if (!check.isURL(uri)){
    throw new Error('The provided URI "' + uri + '" is invalid.');
  }
  return true;
};

/**
* Creates a anonymous function that check if the given value is an integer or a string that can be parsed into integer
*
* @param {object} value The value to validate.
*/
exports.isInt = function (value) {
  return !isNaN(value) && 
         parseInt(Number(value)) == value && 
         !isNaN(parseInt(value, 10));
};

/**
* Creates a anonymous function that check if the given string is a valid datetime.
*
* @param {string} stringDateTime The datetime string.
* @return {Date}
*/
exports.parseDateTime = function (stringDateTime) {
  try {
    return new Date(stringDateTime);
  } catch (e) {
    throw new Error($('The date format is incorrect'));
  }
};

// common functions for validating arguments

function throwMissingArgument(name, func) {
  throw new Error('Required argument ' + name + ' for function ' + func + ' is not defined');
}

function ArgumentValidator(functionName) {
  this.func = functionName;
}

_.extend(ArgumentValidator.prototype, {
  string: function (val, name) {
    if (typeof val != 'string' || val.length === 0) {
      throwMissingArgument(name, this.func);
    }
  },

  object: function (val, name) {
    if (!val) {
      throwMissingArgument(name, this.func);
    }
  },

  exists: function (val, name) {
    this.object(val, name);
  },

  function: function (val, name) {
    if (typeof val !== 'function') {
      throw new Error('Parameter ' + name + ' for function ' + this.func + ' should be a function but is not');
    }
  },

  value: function (val, name) {
    if (!val) {
      throwMissingArgument(name, this.func);
    }
  },

  nonEmptyArray: function (val, name) {
    if (!val || val.length === 0) {
      throw new Error('Required array argument ' + name + ' for function ' + this.func + ' is either not defined or empty');
    }
  },

  callback: function (val) {
    this.object(val, 'callback');
    this.function(val, 'callback');
  },

  test: function (predicate, message) {
    if (!predicate()) {
      throw new Error(message + ' in function ' + this.func);
    }
  },

  tableNameIsValid: exports.tableNameIsValid,
  containerNameIsValid: exports.containerNameIsValid,
  blobNameIsValid: exports.blobNameIsValid,
  pageRangesAreValid: exports.pageRangesAreValid,
  queueNameIsValid: exports.queueNameIsValid
});

function validateArgs(functionName, validationRules) {
  var validator = new ArgumentValidator(functionName);
  validationRules(validator);
}

exports.ArgumentValidator = ArgumentValidator;
exports.validateArgs = validateArgs;