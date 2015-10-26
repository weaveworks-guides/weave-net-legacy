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

/**
 * BitArray
 * 
 * Implements some operations with bit arrays of fixed length
 * 
 */

var assert = require('assert');


var bitsPerWord = 8;
var bitsPerWordLog2 = 3;

var BitArray = function(length, initVal) {
  if (!(this instanceof BitArray)) {
    return new BitArray(length, initVal);
  }

  var numWords = Math.ceil(length / bitsPerWord);
  this._data = new Buffer(numWords * bitsPerWord / 8);
  this._data.fill(initVal ? 0xff : 0);
  this.length = length;
};

function wordPos(x) {
  return x >>> bitsPerWordLog2;
}

function mask(x) {
  return 1 << (x & (bitsPerWord - 1));
}

BitArray.prototype.get = function(x) {
  assert(x >= 0 && x < this.length);

  var wp = wordPos(x);
  var word = this._data[wp] & mask(x);
  return word ? 1 : 0;
};

BitArray.prototype.set = function(x, val) {
  assert(x >= 0 && x < this.length);

  var wp = wordPos(x);
  var newWord;
  if (val)
    newWord = this._data[wp] | mask(x);
  else
    newWord = this._data[wp] & ~mask(x);
  
  this._data[wp] = newWord;
};

module.exports = BitArray;

