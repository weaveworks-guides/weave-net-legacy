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

var __ = require('underscore');
var constants = require('./constants');
var util = require('util');
var utils = require('../../../util/utils');
var $ = utils.getLocaleString;
var resourceUtils = require('../resource/resourceUtils');
var tagUtils = require('../tag/tagUtils');
var DnsZone = require('./dnsZone');

function DnsRecordSet(cli, dnsManagementClient) {
  this.dnsManagementClient = dnsManagementClient;
  this.dnsZoneCrud = new DnsZone(cli, dnsManagementClient);
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(DnsRecordSet.prototype, {
  create: function (resourceGroupName, zoneName, name, options, _) {
    var self = this;
    var dnsZone = {ifNoneMatch: '*'};

    self._handleRecordSetOptions(dnsZone, options, true);

    var progress = self.interaction.progress(util.format($('Creating DNS record set "%s"'), name));
    var recordSet;
    try {
      recordSet = self.dnsManagementClient.recordSets.createOrUpdate(resourceGroupName, zoneName, name, options.type, dnsZone, _);
    } finally {
      progress.end();
    }
    self._showRecord(recordSet);
  },

  set: function (resourceGroupName, zoneName, name, options, _) {
    var self = this;
    var dnsZone = self.dnsZoneCrud.get(resourceGroupName, zoneName, _);
    if (!dnsZone) {
      throw new Error(util.format($('A DNS zone with name "%s" not found in the resource group "%s"'), zoneName, resourceGroupName));
    }

    options.type = self._validateType(options.type);

    var existingSet = self.get(resourceGroupName, zoneName, name, options.type, _);
    if (!existingSet) {
      throw new Error(util.format($('DNS Record set "%s" of type "%s" not found in the resource group "%s"'), name, options.type, resourceGroupName));
    }

    dnsZone.recordSet = existingSet.recordSet;
    self._handleRecordSetOptions(dnsZone, options, false);
    self._deleteRecordsIfEmpty(dnsZone.recordSet);

    var progress = self.interaction.progress(util.format($('Updating DNS record set "%s"'), name));
    var recordSet;
    try {
      recordSet = self.dnsManagementClient.recordSets.createOrUpdate(resourceGroupName, zoneName, name, options.type, dnsZone, _);
    } finally {
      progress.end();
    }
    self._showRecord(recordSet);
  },

  delete: function (resourceGroupName, zoneName, name, options, _) {
    var self = this;
    options.type = self._validateType(options.type);

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete DNS record set "%s"? [y/n] '), name), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting DNS record set "%s"'), name));
    var result;
    try {
      result = self.dnsManagementClient.recordSets.deleteMethod(resourceGroupName, zoneName, name, options.type, options, _);
    } finally {
      progress.end();
    }

    if (result.code === 204) {
      throw new Error(util.format($('DNS Record set "%s" of type "%s" not found in the resource group "%s"'), name, options.type, resourceGroupName));
    }
  },

  list: function (resourceGroupName, zoneName, options, _) {
    var self = this;
    var dnsRecords = null;

    var progress = self.interaction.progress($('Looking up the DNS record sets'));
    try {
      if (options.type) {
        options.type = self._validateType(options.type);
        dnsRecords = self.dnsManagementClient.recordSets.list(resourceGroupName, zoneName, options.type, options, _);
      } else {
        dnsRecords = self.dnsManagementClient.recordSets.listAll(resourceGroupName, zoneName, options, _);
      }
    } finally {
      progress.end();
    }

    var nextLink = dnsRecords.nextLink;
    while (nextLink !== undefined) {
      self.output.silly('Following nextLink');
      var nextRecordSets = self.dnsManagementClient.recordSets.listNext(nextLink, _);
      dnsRecords.recordSets = dnsRecords.recordSets.concat(nextRecordSets.recordSets);
      nextLink = nextRecordSets.nextLink;
    }

    self.interaction.formatOutput(dnsRecords.recordSets, function (outputData) {
      if (outputData.length === 0) {
        self.output.warn($('No DNS records sets found'));
      } else {
        self.output.table(outputData, function (row, recordSet) {
          row.cell($('Name'), recordSet.name);
          row.cell($('TTL'), recordSet.properties.ttl);
          row.cell($('Type'), self._detectType(recordSet.id));
          row.cell($('Tags'), tagUtils.getTagsInfo(recordSet.tags) || '');
        });
      }
    });
  },

  get: function (resourceGroupName, zoneName, name, type, _) {
    var self = this;
    type = self._validateType(type);

    var progress = self.interaction.progress(util.format($('Looking up the DNS record set "%s"'), name));
    var dnsRecord = null;
    try {
      dnsRecord = self.dnsManagementClient.recordSets.get(resourceGroupName, zoneName, name, type, _);
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      }
      throw e;
    } finally {
      progress.end();
    }
    return dnsRecord;
  },

  show: function (resourceGroupName, zoneName, name, options, _) {
    var self = this;
    options.type = self._validateType(options.type);

    var dnsRecord = self.get(resourceGroupName, zoneName, name, options.type, _);
    if (dnsRecord) {
      self._showRecord(dnsRecord);
    } else {
      if (self.output.format().json) {
        self.output.json({});
      } else {
        self.output.warn(util.format($('A DNS record with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
      }
    }
  },

  addRecord: function (resourceGroupName, zoneName, name, options, _) {
    var self = this;
    options.type = self._validateType(options.type);

    var dnsZone = self.dnsZoneCrud.get(resourceGroupName, zoneName, _);
    if (!dnsZone) {
      throw new Error(util.format($('A DNS zone with name "%s" not found in the resource group "%s"'), zoneName, resourceGroupName));
    }

    var existingSet = self.get(resourceGroupName, zoneName, name, options.type, _);
    if (!existingSet) {
      throw new Error(util.format($('DNS Record set "%s" of type "%s" not found in the resource group "%s"'), name, options.type, resourceGroupName));
    }

    dnsZone.recordSet = existingSet.recordSet;
    self._handleRecordSetOptions(dnsZone, options, false);
    self._handleRecordSetRecordParameters(dnsZone.recordSet, options, true);

    var recordSet;
    var progress = self.interaction.progress(util.format($('Updating DNS record set "%s"'), name));
    try {
      recordSet = self.dnsManagementClient.recordSets.createOrUpdate(resourceGroupName, zoneName, name, options.type, dnsZone, _);
    } finally {
      progress.end();
    }
    self._showRecord(recordSet);
  },

  deleteRecord: function (resourceGroupName, zoneName, name, options, _) {
    var self = this;
    options.type = self._validateType(options.type);

    var existingSet = self.get(resourceGroupName, zoneName, name, options.type, _);
    if (!existingSet) {
      throw new Error(util.format($('DNS Record set "%s" of type "%s" not found in the resource group "%s"'), name, options.type, resourceGroupName));
    }

    var recordSetParams = {recordSet: existingSet.recordSet};
    self._handleRecordSetRecordParameters(recordSetParams.recordSet, options, false);

    if (!options.quiet && !self.interaction.confirm($('Delete DNS record? [y/n] '), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Updating DNS record set "%s"'), name));
    var recordSet;
    try {
      recordSet = self.dnsManagementClient.recordSets.createOrUpdate(resourceGroupName, zoneName, name, options.type, recordSetParams, _);
    } finally {
      progress.end();
    }

    self._showRecord(recordSet);
  },

  promptRecordParameters: function (type, options, _) {
    var self = this;
    var lowerType = type.toLowerCase();
    switch (lowerType) {
      case 'a':
        options.ipv4Address = self.interaction.promptIfNotGiven($('IPv4 address for A record type: '), options.ipv4Address, _);
        break;
      case 'aaaa':
        options.ipv6Address = self.interaction.promptIfNotGiven($('IPv6 address for AAAA record type: '), options.ipv6Address, _);
        break;
      case 'cname':
        options.cname = self.interaction.promptIfNotGiven($('Canonical name for CNAME record type: '), options.cname, _);
        break;
      case 'mx':
        options.preference = self.interaction.promptIfNotGiven($('Preference for MX record type: '), options.preference, _);
        options.exchange = self.interaction.promptIfNotGiven($('Exchange for MX record type: '), options.exchange, _);
        break;
      case 'ns':
        options.nsdname = self.interaction.promptIfNotGiven($('Domain name for NS record type: '), options.nsdname, _);
        break;
      case 'srv':
        options.priority = self.interaction.promptIfNotGiven($('Priority for SRV record type: '), options.priority, _);
        options.weight = self.interaction.promptIfNotGiven($('Weight for SRV record type: '), options.weight, _);
        options.port = self.interaction.promptIfNotGiven($('Port for SRV record type: '), options.port, _);
        options.target = self.interaction.promptIfNotGiven($('Target for SRV record type: '), options.target, _);
        break;
      case 'soa':
        options.email = self.interaction.promptIfNotGiven($('Email for SOA record type: '), options.email, _);
        options.expireTime = self.interaction.promptIfNotGiven($('Expire time for SOA record type: '), options.expireTime, _);
        options.serialNumber = self.interaction.promptIfNotGiven($('Serial number for SOA record type: '), options.serialNumber, _);
        options.host = self.interaction.promptIfNotGiven($('Host for SOA record type: '), options.host, _);
        options.minimumTtl = self.interaction.promptIfNotGiven($('Minimum TTL for SOA record type: '), options.minimumTtl, _);
        options.refreshTime = self.interaction.promptIfNotGiven($('Refresh time for SOA record type: '), options.refreshTime, _);
        options.retryTime = self.interaction.promptIfNotGiven($('Retry time for SOA record type: '), options.retryTime, _);
        break;
      case 'txt':
        options.text = self.interaction.promptIfNotGiven($('Text for TXT record type: '), options.text, _);
        break;
      case 'ptr':
        options.ptrdName = self.interaction.promptIfNotGiven($('Ptr domain name for PTR record type: '), options.ptrdName, _);
        break;
      default:
        break;
    }
  },

  _handleRecordSetOptions: function (dnsZone, options, useDefaults) {
    var self = this;
    options.type = self._validateType(options.type, useDefaults);

    if (dnsZone.recordSet === null || dnsZone.recordSet === undefined) {
      dnsZone.recordSet = {
        location: constants.DNS_RS_DEFAULT_LOCATION,
        properties: {}
      };
    }

    if (options.ttl) {
      var ttlAsInt = utils.parseInt(options.ttl);
      if (isNaN(ttlAsInt) || (ttlAsInt < 0)) {
        throw new Error($('--ttl value must be positive integer'));
      }
      dnsZone.recordSet.properties.ttl = ttlAsInt;
    } else if (useDefaults) {
      self.output.info(util.format($('--ttl parameter is not specified, using default TTL - "%s"'), constants.DNS_RS_DEFAULT_TTL));
      options.ttl = constants.DNS_RS_DEFAULT_TTL;
      dnsZone.recordSet.properties.ttl = options.ttl;
    }

    if (options.tags === false || !dnsZone.recordSet.tags) {
      dnsZone.recordSet.tags = {};
    }

    if (options.tags) {
      var tags = tagUtils.buildTagsParameter(dnsZone.recordSet.tags, options);
      for (var key in tags) {
        dnsZone.recordSet.tags[key] = tags[key];
      }
    }
  },

  _validateType: function (type, useDefaults) {
    var self = this;
    if (type) {
      var index = constants.DNS_RS_TYPES.indexOf(type.toUpperCase());
      if (index < 0) {
        throw new Error(util.format($('DNS Record set type "%s" is not valid. Use -h to see valid record set types.'), type));
      }
    } else if (useDefaults) {
      type = constants.DNS_RS_DEFAULT_TYPE;
      self.output.info(util.format($('--type parameter is not specified, using default type - "%s"'), constants.DNS_RS_DEFAULT_TYPE));
    } else {
      throw new Error($('--type parameter must be specified for this operation'));
    }
    return type;
  },

  _detectType: function (id) {
    var resourceInfo = resourceUtils.getResourceInformation(id);
    return resourceInfo.resourceType.split('/')[2];
  },

  _deleteRecordsIfEmpty: function (recordSet) {
    if (!recordSet.properties) {
      return;
    }

    var recordTypesForDeletion = ['aRecords', 'aaaaRecords', 'nsRecords', 'mxRecords', 'srvRecords', 'txtRecords', 'soaRecord', 'ptrRecords'];
    for (var i = 0; i < recordTypesForDeletion.length; i++) {
      if (__.isEmpty(recordSet.properties[recordTypesForDeletion[i]])) {
        delete recordSet.properties[recordTypesForDeletion[i]];
      }
    }
  },

  _handleRecordSetRecordParameters: function (recordSet, options, isAddingRecord) {
    var self = this;
    // A records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[0]) {
      if (options.ipv4Address) {
        self.output.info(util.format($('--ipv4-address parameter will be ignored due to type of this DNS record - "%s"'), options.type));
      }
      delete recordSet.properties.aRecords;
    } else if (options.ipv4Address) {
      if (isAddingRecord) {
        recordSet.properties.aRecords.push({ipv4Address: options.ipv4Address});
      } else {
        var aRecordIndex = utils.indexOfCaseIgnore(recordSet.properties.aRecords, {ipv4Address: options.ipv4Address});
        if (aRecordIndex === -1) {
          self.output.warn($('Record A not found in the record set with parameters specified.'));
        } else {
          recordSet.properties.aRecords.splice(aRecordIndex, 1);
        }
      }
    }

    // AAAA records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[1]) {
      if (options.ipv6Address) {
        self.output.info(util.format($('--ipv6-address parameter will be ignored due to type of this DNS record - "%s"'), options.type));
      }
      delete recordSet.properties.aaaaRecords;
    } else if (options.ipv6Address) {
      if (isAddingRecord) {
        recordSet.properties.aaaaRecords.push({ipv6Address: options.ipv6Address});
      } else {
        var aaaaRecordIndex = utils.indexOfCaseIgnore(recordSet.properties.aaaaRecords, {ipv6Address: options.ipv6Address});
        if (aaaaRecordIndex === -1) {
          self.output.warn($('Record AAAA not found in the record set with parameters specified.'));
        } else {
          recordSet.properties.aaaaRecords.splice(aaaaRecordIndex, 1);
        }
      }
    }

    // CNAME record
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[2]) {
      if (options.cname) {
        self.output.info(util.format($('--cname parameter will be ignored due to type of this DNS record - "%s"'), options.type));
      }
    } else if (options.cname) {
      if (isAddingRecord) {
        options.cname = utils.trimTrailingChar(options.cname, '.');
        recordSet.properties.cnameRecord = {cname: options.cname};
      } else {
        var cnameRecord = recordSet.properties.cnameRecord.cname === options.cname;
        if (!cnameRecord) {
          self.output.warn($('Record CNAME not found in the record set with parameters specified.'));
        } else {
          delete recordSet.properties.cnameRecord;
        }
      }
    }

    // MX records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[3]) {
      if (options.preference || options.exchange) {
        self.output.info(util.format($('MX parameters will be ignored due to type of this DNS record - "%s"'), options.type));
      }
      delete recordSet.properties.mxRecords;
    } else if (options.preference || options.exchange) {
      if (!(options.preference && options.exchange)) {
        throw new Error($('--preference and --exchange parameters must be specified together'));
      }

      if (isNaN(options.preference) || options.preference < 0) {
        throw new Error($('--preference parameter must be positive integer'));
      }

      options.exchange = utils.trimTrailingChar(options.exchange, '.');

      if (isAddingRecord) {
        recordSet.properties.mxRecords.push({preference: options.preference, exchange: options.exchange});
      } else {
        var mxRecordIndex = utils.indexOfCaseIgnore(recordSet.properties.mxRecords, {
          preference: parseInt(options.preference),
          exchange: options.exchange
        });
        if (mxRecordIndex === -1) {
          self.output.warn($('Record MX not found in the record set with parameters specified.'));
        } else {
          recordSet.properties.mxRecords.splice(mxRecordIndex, 1);
        }
      }
    }

    // NS records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[4]) {
      if (options.nsdname) {
        self.output.info(util.format($('--nsdname parameter will be ignored due to type of this DNS record - "%s"'), options.type));
      }
      delete recordSet.properties.nsRecords;
    } else if (options.nsdname) {
      if (isAddingRecord) {
        recordSet.properties.nsRecords.push({nsdname: options.nsdname});
      } else {
        var nsRecordIndex = utils.indexOfCaseIgnore(recordSet.properties.nsRecords, {nsdname: options.nsdname});
        if (nsRecordIndex === -1) {
          self.output.warn($('Record NS not found in the record set with parameters specified.'));
        } else {
          recordSet.properties.nsRecords.splice(nsRecordIndex, 1);
        }
      }
    }

    // SRV records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[5]) {
      if (options.priority || options.weight || options.port || options.target) {
        self.output.info(util.format($('SRV parameters will be ignored due to type of this DNS record - "%s"'), options.type));
      }
      delete recordSet.properties.srvRecords;
    } else if (options.priority || options.weight || options.port || options.target) {
      if (!(options.priority && options.weight && options.port && options.target)) {
        throw new Error($('You must specify all SRV parameters if even one is specified'));
      }

      if (isNaN(options.priority) || options.priority < 0) {
        throw new Error($('--priority parameter must be positive integer'));
      }

      if (isNaN(options.weight) || options.weight < 0) {
        throw new Error($('--weight parameter must be positive integer'));
      }

      if (isNaN(options.port) || options.port < 0) {
        throw new Error($('--port parameter must be positive integer'));
      }

      options.target = utils.trimTrailingChar(options.target, '.');

      if (isAddingRecord) {
        recordSet.properties.srvRecords.push({
          priority: options.priority,
          weight: options.weight,
          port: options.port,
          target: options.target
        });
      } else {
        var srvRecordIndex = utils.indexOfCaseIgnore(recordSet.properties.srvRecords, {
          priority: parseInt(options.priority),
          weight: parseInt(options.weight),
          port: parseInt(options.port),
          target: options.target
        });
        if (srvRecordIndex === -1) {
          self.output.warn($('Record SRV not found in the record set with parameters specified.'));
        } else {
          recordSet.properties.srvRecords.splice(srvRecordIndex, 1);
        }
      }
    }

    // TXT records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[6]) {
      if (options.text) {
        self.output.info(util.format($('--text parameter will be ignored due to type of this DNS record - "%s"'), options.type));
      }
      delete recordSet.properties.txtRecords;
    } else if (options.text) {
      if (isAddingRecord) {
        recordSet.properties.txtRecords.push({value: options.text});
      } else {
        var txtRecordIndex = utils.indexOfCaseIgnore(recordSet.properties.txtRecords, {value: options.text});
        if (txtRecordIndex === -1) {
          self.output.warn($('Record TXT not found in the record set with parameters specified.'));
        } else {
          recordSet.properties.txtRecords.splice(txtRecordIndex, 1);
        }
      }
    }

    // SOA records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[7]) {
      if (options.email || options.expireTime || options.host || options.minimumTtl || options.refreshTime || options.retryTime) {
        self.output.info(util.format($('SOA parameters will be ignored due to type of this DNS record - "%s"'), options.type));
      }
    } else if (options.email || options.expireTime || options.host || options.minimumTtl || options.refreshTime || options.retryTime) {
      if (options.email && options.expireTime && options.host && options.minimumTtl && options.refreshTime && options.retryTime) {
        throw new Error($('You must specify all SOA parameters if even one is specified'));
      }

      if (isNaN(options.expireTime) || options.expireTime < 0) {
        throw new Error($('--expire-time parameter must be positive integer'));
      }

      if (isNaN(options.refreshTime) || options.refreshTime < 0) {
        throw new Error($('--refresh-time parameter must be positive integer'));
      }

      if (isNaN(options.retryTime) || options.retryTime < 0) {
        throw new Error($('--retry-time parameter must be positive integer'));
      }

      if (isNaN(options.minimumTtl) || options.minimumTtl < 255) {
        throw new Error($('--minimumTtl parameter must be in the range [0,255]'));
      }

      if (isAddingRecord) {
        recordSet.properties.soaRecord = {
          email: options.email,
          expireTime: options.expireTime,
          host: options.host,
          minimumTtl: options.minumumTtl,
          refreshTime: options.refreshTime,
          retryTime: options.retryTime
        };
      } else {
        var soaRecord = ((recordSet.properties.soaRecord.email === options.email) && (recordSet.properties.soaRecord.expireTime === parseInt(options.expireTime)) && (recordSet.properties.soaRecord.host === options.host) &&
        (recordSet.properties.soaRecord.minimumTtl === parseInt(options.minimumTtl)) && (recordSet.properties.soaRecord.refreshTime === parseInt(options.refreshTime)) && (recordSet.properties.soaRecord.retryTime === parseInt(options.retryTime)));
        if (!soaRecord) {
          self.output.warn($('Record SOA not found in the record set with parameters specified.'));
        } else {
          delete recordSet.properties.soaRecord;
        }
      }
    }

    // PTR records
    if (options.type.toUpperCase() !== constants.DNS_RS_TYPES[8]) {
      if (options.ptrdName) {
        self.output.info(util.format($('--ptrd-name parameter will be ignored due to type of this DNS record - "%s"'), options.type));
      }
      delete recordSet.properties.ptrRecords;
    } else {
      if (options.ptrdName) {
        if (isAddingRecord) {
          options.ptrdName = utils.trimTrailingChar(options.ptrdName, '.');
          recordSet.properties.ptrRecords.push({ptrdname: options.ptrdName});
        } else {
          var ptrRecordIndex = utils.indexOfCaseIgnore(recordSet.properties.ptrRecords, {ptrdname: options.ptrdname});
          if (ptrRecordIndex === -1) {
            self.output.warn($('Record PTR not found in the record set with parameters specified.'));
          } else {
            recordSet.properties.ptrRecords.splice(ptrRecordIndex, 1);
          }
        }
      }
    }
  },

  _showRecord: function (dnsRecord) {
    var self = this;

    var resourceInfo = resourceUtils.getResourceInformation(dnsRecord.recordSet.id);
    self.interaction.formatOutput(dnsRecord.recordSet, function (record) {
      self.output.nameValue($('Id'), record.id);
      self.output.nameValue($('Name'), record.name);
      self.output.nameValue($('Type'), resourceInfo.resourceType);
      self.output.nameValue($('Location'), record.location);
      self.output.nameValue($('TTL'), record.properties.ttl);
      self.output.nameValue($('Tags'), tagUtils.getTagsInfo(record.tags));
      if (!__.isEmpty(record.properties.aRecords)) {
        self.output.header($('A records'));
        for (var aRecordNum in record.properties.aRecords) {
          var aRecord = record.properties.aRecords[aRecordNum];
          self.output.nameValue($('IPv4 address'), aRecord.ipv4Address, 4);
        }
        self.output.data($(''), '');
      }

      if (!__.isEmpty(record.properties.aaaaRecords)) {
        self.output.header($('AAAA records'));
        for (var aaaaRecordNum in record.properties.aaaaRecords) {
          var aaaaRecord = record.properties.aaaaRecords[aaaaRecordNum];
          self.output.nameValue($('IPv6 address'), aaaaRecord.ipv6Address, 4);
        }
        self.output.data($(''), '');
      }

      if (!__.isEmpty(record.properties.cnameRecord)) {
        self.output.header($('CNAME record'));
        self.output.nameValue($('CNAME'), record.properties.cnameRecord.cname, 2);
        self.output.data($(''), '');
      }

      if (!__.isEmpty(record.properties.mxRecords)) {
        self.output.header($('MX records'));
        for (var mxRecordNum in record.properties.mxRecords) {
          var mxRecord = record.properties.mxRecords[mxRecordNum];
          self.output.nameValue($('Preference'), mxRecord.preference, 4);
          self.output.nameValue($('Mail exchange'), mxRecord.exchange, 4);
        }
        self.output.data($(''), '');
      }

      if (!__.isEmpty(record.properties.nsRecords)) {
        self.output.data($('NS records'));
        for (var nsRecordNum in record.properties.nsRecords) {
          var nsRecord = record.properties.nsRecords[nsRecordNum];
          self.output.nameValue($('Name server domain name'), nsRecord.nsdname, 4);
        }
        self.output.data($(''), '');
      }

      if (!__.isEmpty(record.properties.srvRecords)) {
        self.output.header($('SRV records'));
        for (var srvRecordNum in record.properties.srvRecords) {
          var srvRecord = record.properties.srvRecords[srvRecordNum];
          self.output.nameValue($('Priority'), srvRecord.priority, 4);
          self.output.nameValue($('Weight'), srvRecord.weight, 4);
          self.output.nameValue($('Port'), srvRecord.port, 4);
          self.output.nameValue($('Target'), srvRecord.target, 4);
        }
        self.output.data($(''), '');
      }

      if (!__.isEmpty(record.properties.txtRecords)) {
        self.output.header($('TXT records'));
        for (var txtRecordNum in record.properties.txtRecords) {
          var txtRecord = record.properties.txtRecords[txtRecordNum];
          self.output.nameValue($('Text'), txtRecord.value, 4);
        }
        self.output.data($(''), '');
      }

      if (!__.isEmpty(record.properties.soaRecord)) {
        var soaRecord = record.properties.soaRecord;
        self.output.header($('SOA record'));
        self.output.nameValue($('Email'), soaRecord.email, 2);
        self.output.nameValue($('Expire time'), soaRecord.expireTime, 2);
        self.output.nameValue($('Host'), soaRecord.host, 2);
        self.output.nameValue($('Serial number'), soaRecord.serialNumber, 2);
        self.output.nameValue($('Minimum TTL'), soaRecord.minimumTtl, 2);
        self.output.nameValue($('Refresh time'), soaRecord.refreshTime, 2);
        self.output.nameValue($('Retry time'), soaRecord.retryTime, 2);
        self.output.nameValue($(''), '');
      }

      if (!__.isEmpty(record.properties.ptrRecords)) {
        self.output.header($('PTR records'));
        for (var ptrRecordNum in record.properties.ptrRecords) {
          var ptrRecord = record.properties.ptrRecords[ptrRecordNum];
          self.output.nameValue($('PTR domain name'), ptrRecord.ptrdname, 4);
        }
        self.output.data($(''), '');
      }
    });
  }

});

module.exports = DnsRecordSet;