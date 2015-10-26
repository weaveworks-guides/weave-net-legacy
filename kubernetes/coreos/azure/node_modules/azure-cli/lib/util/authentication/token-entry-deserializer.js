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

//
// Internal helper functions for serializing and
// deserializing cache entries.
//

function deserializeBool(str) {
  return str.toLowerCase() === 'true';
}

function deserializeDate(str) {
  return new Date(str);
}

function deserializeNum(str) {
  return +str;
}

// Mapping of field names that need special handling
// on deserialization (typically type conversions)
// to the appropriate deserializer functions.
var fieldsToConvert = {
  expiresIn: deserializeNum,
  expiresOn: deserializeDate,
  isUserIdDisplayable: deserializeBool,
  isMRRT: deserializeBool
};

exports.deserializeEntry = function (entry) {
  return _.chain(entry)
    .pairs()
    .map(function (pair) {
      var key = pair[0], value = pair[1];
      if (_.has(fieldsToConvert, key)) {
        return [key, fieldsToConvert[key](value)];
      }
      return pair;
    })
    .object()
    .value();
};
