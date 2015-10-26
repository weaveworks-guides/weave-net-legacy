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

var fs = require('fs');
var xml2js = require('xml2js');

var keyFiles = require('../keyFiles');
var pfx2pem = require('../certificates/pkcs').pfx2pem;
var utils = require('../utils');

var $ = utils.getLocaleString;

function readFileContents(filePath) {
  var readBuffer = fs.readFileSync(filePath);
  var publishSettings;
  var parser = new xml2js.Parser();
  parser.parseString(readBuffer, function (err, result) {
    if (!err) {
      publishSettings = result;
    } else {
      throw err;
    }
  });
  return publishSettings;
}

function parseManagementCert(publishSettingsCert) {
  var pfx = new Buffer(publishSettingsCert, 'base64');
  var pem = pfx2pem(pfx).toString();
  return keyFiles.readFromString(pem);
}

function subscriptionsFromContents(xmlContent) {
  if (!xmlContent.PublishProfile ||
    (xmlContent.PublishProfile['@'] &&
      !xmlContent.PublishProfile['@'].ManagementCertificate &&
      xmlContent.PublishProfile['@'].SchemaVersion !== '2.0')) {
    throw new Error($('Invalid publishSettings file. Use "azure account download" to download publishing credentials.'));
  }

  var attribs = xmlContent.PublishProfile['@'];
  var subs = xmlContent.PublishProfile.Subscription;
  if (!subs) {
    subs = [];
  }

   else if (!subs[0]) {
    subs = [ subs ];
  }

  subs.forEach(function (sub) {
    if (sub['@']) {
      sub.id = sub['@'].Id;
      sub.name = sub['@'].Name;
      sub.managementCertificate = sub['@'].ManagementCertificate;
      sub.managementEndpointUrl = sub['@'].ServiceManagementUrl;

      delete sub['@'];
    }

    if (attribs) {
      if (attribs.ManagementCertificate && !sub.managementCertificate) {
        sub.managementCertificate = attribs.ManagementCertificate;
      }

      if (attribs.Url && !sub.ServiceManagementUrl) {
        sub.managementEndpointUrl = attribs.Url;
      }
    }
  });

  subs.forEach(function (s) { s.managementCertificate = parseManagementCert(s.managementCertificate); } );
  return subs;
}

function importPublishSettings(filePath) {
  var xml = readFileContents(filePath);
  return subscriptionsFromContents(xml);
}

exports.import = importPublishSettings;

