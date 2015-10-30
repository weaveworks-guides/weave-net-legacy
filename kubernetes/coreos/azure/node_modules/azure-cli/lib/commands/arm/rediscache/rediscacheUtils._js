/**
* Copyright (c) Microsoft.  All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the 'License');
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an 'AS IS' BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

var __ = require('underscore');
var util = require('util');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

var C0String = 'C0';
var C1String = 'C1';
var C2String = 'C2';
var C3String = 'C3';
var C4String = 'C4';
var C5String = 'C5';
var C6String = 'C6';

var AllKeysLRU = 'allkeys-lru';
var AllKeysRandom = 'allkeys-random';
var VolatileLRU = 'volatile-lru';
var VolatileRandom = 'volatile-random';
var VolatileTTL = 'volatile-ttl';
var NoEviction = 'noeviction';

var AllKeysLRUString = 'AllKeysLRU';
var AllKeysRandomString = 'AllKeysRandom';
var VolatileLRUString = 'VolatileLRU';
var VolatileRandomString = 'VolatileRandom';
var VolatileTTLString = 'VolatileTTL';
var NoEvictionString = 'NoEviction';

exports.getrediscacheClient = function (subscription) {
  return utils.createRedisCacheManagementClient(subscription);
};

exports.getMaxMemoryPolicy = function GetMaxMemoryPolicyString(maxMemPolicy) {
  var policy = null;
  switch (maxMemPolicy) {
    case AllKeysLRUString:
      policy = AllKeysLRU; break;
    case AllKeysRandomString:
      policy = AllKeysRandom; break;
    case VolatileLRUString:
      policy = VolatileLRU; break;
    case VolatileRandomString:
      policy = VolatileRandom; break;
    case VolatileTTLString:
      policy = VolatileTTL; break;
    case NoEvictionString:
      policy = NoEviction; break;
  }

  return policy;
};

exports.getSizeRedisSpecific = function GetSizeInRedisSpecificFormat(vmSize) {
  var size = null;
  switch (vmSize) {
    case C0String:
      size = C0String; break;
    case C1String:
      size = C1String; break;
    case C2String:
      size = C2String; break;
    case C3String:
      size = C3String; break;
    case C4String:
      size = C4String; break;
    case C5String:
      size = C5String; break;
    case C6String:
      size = C6String; break;
    default:
      size = C1String; break;
  }

  return size;
};

exports.parseEnumArgument = function (argName, argValue, validValues, _default) {
  if (__.isUndefined(argValue)) {
    return _default;
  }
  var index = validValues.indexOf(argValue);
  if (index < 0) {
    throw new Error(util.format($('Argument %s has an invalid value: %s. Expected one of [%s].'), argName, argValue, validValues.join(', ')));
  }
  return validValues[index];
};

exports.parseArg = function (argName, argValue, _default) {
  if (__.isUndefined(argValue)) {
    return _default;
  }
  else {
    return argValue;
  }
};

exports.showNotFoundError = function notFoundError(resourceGroup, cacheName) {
  var msg;
  if (resourceGroup) {
    msg = util.format($('Cache not found in resource group %s: %s'), resourceGroup, cacheName);
  } else {
    msg = util.format($('Cache not found: %s'), cacheName);
  }
  return msg;
};

