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
// Safe reference to static hasownproperty
//

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

//
// Yet another variant of a set in javascript
//

function Set(keyTransform) {
  this.values = Object.create(null);
  this.keyTransform = keyTransform;
  if (!this.keyTransform) {
    this.keyTransform = function (x) { return x; };
  }
}

Object.defineProperties(Set.prototype, {
  add: {
    value: function (x) {
      if (x.forEach) {
        return this.addRange(x);
      }
      if (arguments.length > 1) {
        return this.addRange(Array.prototype.slice.call(arguments, 0));
      }
      var key = this.keyTransform(x);
      this.values[key] = 1;
      return this;
    },
  },

  addRange: {
    value: function (values) {
      var self = this;
      values.forEach(function (x) {
        var key = self.keyTransform(x);
        self.values[key] = 1;
      });
      return self;
    }
  },

  has: {
    value: function (key) {
      return has(this.values, this.keyTransform(key));
    }
  },

  delete: {
    value: function (key) {
      var self = this;
      if (key.forEach) {
        key.forEach(function (k) { delete self.values[self.keyTransform(k)]; });
      } else if (arguments.length > 1) {
        return self.delete(Array.prototype.slice.call(arguments, 0));
      } else {
        delete self.values[self.keyTransform(key)];
      }
      return self;
    }
  },

  clear: {
    value: function () {
      this.values = Object.create(null);
    }
  },

  keys: {
    value: function () {
      return Object.keys(this.values);
    }
  },

  forEach: {
    value: function (callbackFn, thisArg) {
      this.keys().forEach(callbackFn, thisArg);
    }
  },

  map: {
    value: function (callbackFn, thisArg) {
      return this.keys().map(callbackFn, thisArg);
    }
  },

  size: {
    value: function () {
      return Object.keys(this.values).length;
    }
  }
});

module.exports = Set;
