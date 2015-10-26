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

// Helper functions for Azure SDK methods that have pageable results
// that return those results via a node stream, thus hiding the paging
// from the caller.

var Stream = require('stream');

/**
* Calls an azure SDK operation that returns an array of results including a next link.
* Returns a stream where each item in result is delivered. Querying the next page is
* done automatically.
*
* @param {object} azureOperation The operation object on the client object that contains the list operations to wrap.
* @param {string} initialMethodName Name of the method that starts the list operation. Any additional required arguments
*                                   EXCEPT the callback are passed at the end of the argument list.
* @param {string} nextPageMethodName Name of the method to call to get the next page of results
* @param {string} resultFieldName    Name of the property in the response object containing the result array.
*
* @return {Stream}                  Stream returning the results.
*/
function streamPaged(azureOperation, initialMethodName, nextPageMethodName, resultFieldName) {
  var s = new Stream();
  s.readable = true;

  function handleResponse(err, response) {
    if (err) {
      s.emit('error', err);
      return;
    }

    var items = response[resultFieldName] || [];

    items.forEach(function (item) {
      s.emit('data', item);
    });

    if (response.nextLink) {
      return azureOperation[nextPageMethodName].call(azureOperation, response.nextLink, handleResponse);
    }
    return s.emit('end');
  }

  var initialArgs = Array.prototype.slice.call(arguments, 4);
  azureOperation[initialMethodName].apply(azureOperation, initialArgs.concat(handleResponse));
  return s;
}

/**
* Wraps an Azure SDK list method that returns a response containing a nextLink property
* with a new method that returns a stream. Creates a new method on that object named [initialMethod]Stream.
*
* @param {object} azureOperation     The operation object containing the raw method to wrap
* @param {string} initialMethodName  Name of method that gets the first page of information
* @param {string} nextPageMethodName Name of method that gets the next page of information
* @param {string} resultFieldName    Name of property in result object containing the requested data
*
*/
function streamify(azureOperation, initialMethodName, nextPageMethodName, resultFieldName) {
  var streamMethodName = initialMethodName + 'Stream';
  azureOperation[streamMethodName] = streamPaged.bind(null, azureOperation, initialMethodName, nextPageMethodName, resultFieldName);
}

/**
* Helper function that will read a stream to the end, returning an array with
* one element per item returned via the data event on the stream.
*
* @param {Stream}                 stream The stream to read
* @param {function(Error, items)} done   Completion callback
*
*/
function toArray(stream, done) {
  var results = [];
  stream.on('data', function (item) {
    results.push(item);
  });
  stream.on('error', function (err) {
    return done(err);
  });
  stream.on('end', function () {
    return done(null, results);
  });
}

module.exports.streamPaged = streamPaged;
module.exports.streamify = streamify;
module.exports.toArray = toArray;
