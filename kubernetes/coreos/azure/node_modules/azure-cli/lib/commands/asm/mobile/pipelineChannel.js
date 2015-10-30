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

var xml2js = require('xml2js');

module.exports = PipelineChannel;

function PipelineChannel(client, webResource, log) {
  this.azureService = client;
  this.client = client.pipeline;
  this.resource = webResource;
  this.log = log;
}

PipelineChannel.prototype.path = function (path) {
  this.resource.url += '/' + path;
  return this;
};

PipelineChannel.prototype.header = function (name, value) {
  this.resource = this.resource.withHeader(name, value);
  return this;
};

PipelineChannel.prototype.query = function (name, value) {
  if (!this.resource.qs) {
    this.resource.qs = {};
  }
  this.resource.qs[name] = value;
  return this;
};

PipelineChannel.prototype.get = function (callback) {
  this.resource.method = 'GET';
  this._execute(callback);
};

PipelineChannel.prototype.poll = function (callback) {
  this.resource.method = 'GET';

  var self = this;

  function pollAndRetry() {
    self._execute(function (error, body) {
      var retry = callback(error, body);
      if(retry) {
        setTimeout(function() { pollAndRetry(); }, self.azureService.longRunningOperationRetryTimeout);
      }
    });
  }

  pollAndRetry();
};

PipelineChannel.prototype.post = function (settings, callback) {
  this.resource = this.resource.withBody(settings);
  this.resource.method = 'POST';
  this._execute(callback);
};

PipelineChannel.prototype.put = function (settings, callback) {
  this.resource = this.resource.withBody(settings);
  this.resource.method = 'PUT';
  this._execute(callback);
};

PipelineChannel.prototype.patch = function (settings, callback) {
  this.resource = this.resource.withBody(settings);
  this.resource.method = 'PATCH';
  this._execute(callback);
};

PipelineChannel.prototype.delete = function (callback) {
  this.resource.method = 'DELETE';
  this._execute(callback);
};

PipelineChannel.prototype._execute = function (callback) {
  var log = this.log;
  this.client(this.resource, function (error, response, body) {
    if (error) {
      log.silly('error');
      log.json('silly', error);
      callback(error, body, response);
    } else if (response.statusCode < 200 || response.statusCode >= 300) {
      callback(body, body, response);
    } else if (response.headers['content-type'] && response.headers['content-type'].indexOf('application/xml') > -1) {
      var parser = new xml2js.Parser();
      parser.parseString(body, function (parserError, output) {
        if (parserError) {
          log.silly('parserError');
          log.json('silly', parserError);
        }
        callback(parserError, output, response);
      });
    } else {
      callback(error, body, response);
    }
  });
};