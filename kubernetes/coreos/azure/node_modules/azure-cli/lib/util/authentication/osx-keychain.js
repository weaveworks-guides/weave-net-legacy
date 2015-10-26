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
// Access to the OSX keychain - list, add, get password, remove
//
var _ = require('underscore');
var childProcess = require('child_process');
var es = require('event-stream');
var parser = require('./osx-keychain-parser');

var securityPath = '/usr/bin/security';

/**
* List contents of default keychain, no passwords.
*
* @return {Stream} object mode stream of parsed results.
*/
function list() {
  var securityProcess = childProcess.spawn(securityPath, ['dump-keychain']);

  return securityProcess.stdout
    .pipe(es.split())
    .pipe(es.mapSync(function (line) {
      return line.replace(/\\134/g, '\\');
    }))
    .pipe(new parser.ParsingStream());
}

/**
* Get the password for a given key from the keychain
* Assumes it's a generic credential.
* 
* @param {string} userName user name to look up
* @param {string} service service identifier
* @param {Function(err, string)} callback callback receiving
*                                returned result.
*/
function get(userName, service, callback) {
  var args = [
    'find-generic-password',
    '-a', userName,
    '-s', service,
    '-g'
  ];


  childProcess.execFile(securityPath, args, function (err, stdout, stderr) {
    if (err) { return callback(err); }
    var match = /^password: (?:0x[0-9A-F]+  )?"(.*)"$/m.exec(stderr);
    if (match) {
      var password = match[1].replace(/\\134/g, '\\');
      return callback(null, password);
    }
    return callback(new Error('Password in invalid format'));
  });
}

/**
* Set the password for a given key in the keychain.
* Will overwrite password if the key already exists.
*
* @param {string} userName
* @param {string} service
* @param {string} description
* @param {string} password
* @param {function(err)} callback called on completion.
*/
function set(userName, service, description, password, callback) {
  var args = [
    'add-generic-password',
    '-a', userName,
    '-D', description,
    '-s', service,
    '-w', password,
    '-U'
  ];

  childProcess.execFile(securityPath, args, function (err, stdout, stderr) {
    if (err) {
      return callback(new Error('Could not add password to keychain: ' + stderr));
    }
    return callback();
  });
}

/**
* Remove the given account from the keychain
*
* @param {string} userName
* @param {string} service
* @param {string} description
* @param {function (err)} callback called on completion
*/
function remove(userName, service, description, callback) {
  var args = ['delete-generic-password'];
  if (userName) {
    args = args.concat(['-a', userName]);
  }
  if (service) {
    args = args.concat(['-s', service]);
  }
  if (description) {
    args = args.concat(['-D', description]); 
  }

  childProcess.execFile(securityPath, args, function (err, stdout, stderr) {
    if (err) {
      return callback(new Error('Could not remove account from keychain, ' + stderr));
    }
    return callback();
  });
}

_.extend(exports, {
  list: list,
  set: set,
  get: get,
  remove: remove
});
