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

var __ = require('underscore');
var util = require('util');
var url = require('url');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.getAttributesWithPrettyDates = function(attributes) {
  if (!attributes) {
    return attributes;
  }
  var result = JSON.parse(JSON.stringify(attributes));
  makePrettyDate(result, 'created');
  makePrettyDate(result, 'updated');
  makePrettyDate(result, 'nbf');
  makePrettyDate(result, 'exp');
  return result;
};

function makePrettyDate(obj, unixTimeField) {
  var d = obj[unixTimeField];
  if (__.isNumber(d) && !__.isNaN(d)) {
    obj[unixTimeField] = new Date(d * 1000).toISOString();
  }
}

exports.parseDateArgument = function(argName, argValue, _default) {
  if (__.isUndefined(argValue)) {
    return _default;
  }
  if (utils.ignoreCaseEquals(argValue, 'null')) {
    return null;
  }
  var n = parseInt(argValue);
  if (('' + n) !== argValue) {
    // Unix Time (seconds from 1970-01-01 00:00:00)
    n = (new Date(argValue)).getTime() / 1000;
  }
  if (__.isNumber(n) && !__.isNaN(n)) {
    return n;
  }
  throw new Error(util.format($('Invalid date specified on %s: %s.'), argName, argValue));
};

exports.parseBooleanArgument = function(argName, argValue, _default) {
  if (__.isUndefined(argValue)) {
    return _default;
  }
  if (utils.ignoreCaseEquals(argValue, 'false')) {
    return false;
  }
  if (utils.ignoreCaseEquals(argValue, 'true')) {
    return true;
  }
  throw new Error(util.format($('Invalid value specified on %s: %s (not boolean).'), argName, argValue));
};

exports.parseEnumArgument = function(argName, argValue, validValues, _default) {
  if (__.isUndefined(argValue)) {
    return _default;
  }
  var index = validValues.indexOf(argValue);
  if (index < 0) {
    throw new Error(util.format($('Argument %s has an invalid value: %s. Expected one of [%s].'), argName, argValue, validValues.join(', ')));
  }
  return validValues[index];
};

exports.parseArrayArgument = function(argName, argValue, validValues, _default) {
  if (__.isUndefined(argValue)) {
    return _default;
  }
  var a;
  try {
    a = JSON.parse(argValue);
  } catch (err) {
    throw new Error(util.format($('Not a JSON value informed on %s: %s.'), argName, argValue));
  }
  if (__.isArray(a)) {
    // get all elements that are not present on validValues.
    var left = a.filter(function(elem) {
      return validValues.indexOf(elem) == -1;
    });
    // if some is left, we abort as invalid.
    if (left.length !== 0) {
      throw new Error(util.format($('Argument %s has invalid elements: %s.'), argName, JSON.stringify(left)));
    }
    return a;
  }
  throw new Error(util.format($('Invalid value specified on %s: %s.'), argName, argValue));
};

exports.parseTagsArgument = function(argName, argValue) {
  if (__.isUndefined(argValue)) {
    return argValue;
  }
  var result = {};
  argValue.split(';').forEach(function(tagValue) {
    var tv = tagValue.split('=');
    if (tv.length === 2) {
      result[tv[0]] = tv[1];
    } else {
      result[tv[0]] = '';
    }
  });
  return result;
};

exports.mergeTags = function(currentTags, newTags) {
  for (var property in newTags) {
    if (newTags.hasOwnProperty(property)) {
      currentTags[property] = newTags[property];
    }
  }
  return currentTags;
};

exports.getTagsInfo = function(tags) {
  var tagsInfo = '';
  for (var tagName in tags) {
    if (tags.hasOwnProperty(tagName)) {
      var tagEntity = tags[tagName] ? (tagName + '=' + tags[tagName]) : tagName;
      tagsInfo = tagsInfo ? (tagsInfo + ';' + tagEntity) : tagEntity;
    }
  }
  return tagsInfo;
};

exports.parseKeyIdentifier = function(identifier) {
  return parseIdentifier(identifier, 'keys');
};

exports.parseSecretIdentifier = function(identifier) {
  return parseIdentifier(identifier, 'secrets');
};

function parseIdentifier(identifier, folder) {
  var parsed = url.parse(identifier);

  var vaultUri = '';
  vaultUri += parsed.protocol || '';
  if (parsed.slashes) {
    vaultUri += '//';
  }
  vaultUri += parsed.host || '';

  if (!parsed.pathname) {
    throw unsupported();
  }

  var path = parsed.pathname.split('/');
  if (path.length < 3 || !utils.ignoreCaseEquals(path[1], folder)) {
    throw unsupported();
  }

  var name = path[2];
  var version;
  if (path.length > 3) {
    version = path[3];
  }

  return {
    vaultUri: vaultUri,
    name: name,
    version: version
  };

  function unsupported() {
    throw new Error(util.format($('Unsupported identifier: %s'), identifier));
  }
}

exports.bufferToBase64Url = function(buffer) {
  // Buffer to Base64.
  var str = buffer.toString('base64');
  // Base64 to Base64Url.
  return trimEnd(str, '=').replace(/\+/g, '-').replace(/\//g, '_');
};

function trimEnd(str, ch) {
  var len = str.length;
  while ((len - 1) >= 0 && str[len - 1] === ch) {
    --len;
  }
  return str.substr(0, len);
}

exports.base64UrlToBuffer = function(str) {
  // Base64Url to Base64.
  str = str.replace(/\-/g, '+').replace(/\_/g, '/');
  // Base64 to Buffer.
  return new Buffer(str, 'base64');
};