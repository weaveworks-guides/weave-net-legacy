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

//
// Utility functions used to encode and decode values
// stored in the token cache as keys or values.
//

'use strict';

var _ = require('underscore');

//
// Replace ':' chars with '\:' and
// replace '\' chars with '\\'
//
function escape(s) {
  var result = '';
  _.each(s, function (ch) {
    switch (ch) {
      case ':':
        result += '\\:';
        break;
      case '\\':
        result += '\\\\';
        break;
      default:
        result += ch;
    }
  });
  return result;
}

//
// Reverse of escape - converts \: and \\ back
// to their single character equivalents.
//
function unescape(s) {
  var result = '';
  var afterSlash = false;
  _.each(s, function (ch) {
    if (!afterSlash) {
      if (ch === '\\') {
        afterSlash = true;
      } else {
        result += ch;
      }
    } else {
      result += ch;
      afterSlash = false;
    }
  });

  if (afterSlash) {
    result += '\\';
  }

  return result;
}

function encodeObject(obj) {
  return _.chain(obj)
    .pairs()
    .sortBy(function (p) { return p[0]; })
    .map(function (p) {
      if (_.isBoolean(p[1])) {
        return [p[0], p[1].toString()];
      }
      if (_.isDate(p[1])) {
        return [p[0], p[1].toISOString()];
      }
      return [p[0], p[1] ? p[1].toString() : ''];
    })
    .map(function (p) { return p.map(escape); })
    .map(function (p) { return p.join(':'); })
    .value()
    .join('::');
}

function endsWith(s, ending) {
  return s.substring(s.length - ending.length) === ending;
}

function partToKeyValue(part) {
  return part.split(':')
  .reduce(function (accumulator, value) {
      if (accumulator[1] !== null && endsWith(accumulator[1], '\\')) {
        accumulator[1] += ':' + value;
      } else if (accumulator[0] === null) {
        accumulator[0] = value;
      } else if (endsWith(accumulator[0], '\\')) {
        accumulator[0] += ':' + value;
      } else {
        accumulator[1] = value;
      }
      return accumulator;
    }, [null, null]);
}

function decodeObject(key) {
  return _.chain(key.split('::'))
    .map(partToKeyValue)
    .map(function (pairs) { return pairs.map(unescape); })
    .object()
    .value();
}

_.extend(exports, {
	escape: escape,
	unescape: unescape,
	encodeObject: encodeObject,
	decodeObject: decodeObject

});
