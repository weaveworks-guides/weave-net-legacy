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
var util = require('util');

var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

function NetworkPublicIP(cli, networkResourceProviderClient, resourceGroupName, params) {
  this.cli = cli;
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.resourceGroupName = resourceGroupName;
  this.params = params;
}

__.extend(NetworkPublicIP.prototype, {
    _parsePublicIPCreateParams: function (params, _) {
      if (utils.stringIsNullOrEmpty(params.publicipName)) {
        params.publicipName = this.cli.interaction.prompt($('Enter public IP name: '), _);
      }

      if (utils.stringIsNullOrEmpty(params.publicipDomainName)) {
        params.publicipDomainName = this.cli.interaction.prompt($('Enter public IP domain name: '), _);
      }

      if (utils.stringIsNullOrEmpty(params.location)) {
        params.location = this.cli.interaction.prompt($('Enter location: '), _);
      }

      var createRequestProfile = {
        dnsSettings: {
          domainNameLabel:  params.publicipDomainName
        },
        location: params.location
      };

      if (params.publicipIdletimeout) {
        var timeoutAsInt = utils.parseInt(params.publicipIdletimeout);
        if (isNaN(timeoutAsInt) || timeoutAsInt === 0) {
          throw new Error($('publicipIdletimeout is an optional parameter but when it is specified it must be an integer'));
        }
        createRequestProfile.idleTimeoutInMinutes = timeoutAsInt;
      }

      var supportedAllocationTypes = ['Dynamic'];
      if (!utils.stringIsNullOrEmpty(params.publicipAllocationmethod)) {
        createRequestProfile.publicIpAllocationMethod  = utils.verifyParamExistsInCollection(supportedAllocationTypes,
          params.publicipAllocationmethod,
          'publicipAllocationmethod');
      } else {
        createRequestProfile.publicIpAllocationMethod = supportedAllocationTypes[0];
      }

      return createRequestProfile;
    },

    hasAnyPubIPParameters: function (params) {
      var allPublicIPParams = [
        params.publicipName,
        params.publicipDomainname,
        params.publicipIdletimeout,
        params.publicipAllocationmethod];

      return utils.atLeastOneParameIsSet(allPublicIPParams);
    },

    createPublicIPIfRequired: function(_) {
      if (utils.stringIsNullOrEmpty(this.params.publicipName)) {
        this.params.publicipName = this.cli.interaction.prompt($('Enter public IP name: '), _);
      }

      if (utils.stringIsNullOrEmpty(this.params.location)) {
        this.params.location = this.cli.interaction.prompt($('Enter location: '), _);
      }

      var publicipInfo = this.getPublicIPInfoByName(this.resourceGroupName, this.params.publicipName, _);
      if (publicipInfo.profile) {
        if (!utils.ignoreCaseAndSpaceEquals(publicipInfo.profile.location, this.params.location)) {
          throw new Error(util.format($('A PublicIP with name "%s" already exists in another region "%s"'), publicipInfo.profile.name, publicipInfo.profile.location));
        }

        this.cli.output.info(util.format($('Found an existing PublicIP "%s"'), publicipInfo.profile.name));
      } else {
        this.cli.output.info(util.format($('PublicIP with given name "%s" not found, creating a new one'), publicipInfo.publicipName));
        var createRequestProfile = this._createNewPublicIP(publicipInfo.resourceGroupName, this.params, _);
        // Once created, pull the NIC so we get it's resource ID
        publicipInfo = this.getPublicIPInfoByName(publicipInfo.resourceGroupName, publicipInfo.publicipName, _);
        publicipInfo.createdNew = true;
        publicipInfo.createRequestProfile = createRequestProfile;
      }

      return publicipInfo;
    },

    getPublicIPInfoById: function (referenceUri, _) {
      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      return this.getPublicIPInfoByName(resourceInfo.resourceGroupName, resourceInfo.resourceName, _);
    },

    getPublicIPInfoByName: function (resourceGroupName, publicipName, _) {
      var publicipInfo = {
        publicipName: publicipName,
        resourceGroupName: resourceGroupName,
        createdNew: false,
        createRequestProfile: {},
        profile: null
      };

      var publicIP = this._getPublicIP(resourceGroupName, publicipName, _);
      if (publicIP) {
        publicipInfo.profile = publicIP.publicIpAddress;
      }

      return publicipInfo;
    },

    getPublicIPByIdExpanded: function (referenceUri, depth, memoize, dependencies, _) {
      referenceUri = referenceUri.toLowerCase();
      if (memoize[referenceUri]) {
        return memoize[referenceUri];
      }

      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      var expandedPublicIP = this.getPublicIPByNameExpanded(resourceInfo.resourceGroupName, resourceInfo.resourceName, depth, memoize, dependencies, _);
      return expandedPublicIP;
    },

    getPublicIPByNameExpanded: function (resourceGroupName, publicipName, depth, memoize, dependencies, _) {
      var publicIP = this._getPublicIP(resourceGroupName, publicipName, _);
      var expandedPublicIP = this._expandPublicIP(publicIP, depth, memoize);
      return expandedPublicIP;
    },

    _expandPublicIP: function (publicIP, depth, memoize) {
      if (depth === 0 || publicIP === null) {
        return publicIP;
      }

      if (depth !== -1) {
        depth--;
      }

      var pIP = publicIP.publicIpAddress;
      var referenceUri = pIP.id.toLowerCase();

      memoize[referenceUri] = publicIP;
      // PublicIP is one of the leaf there is no more expandable connected resources references.
      return memoize[referenceUri];
    },

    _getPublicIP: function (resourceGroupName, publicipName, _) {
      var progress = this.cli.interaction.progress(util.format($('Looking up the public ip "%s"'), publicipName));
      try {
        var publicIP = this.networkResourceProviderClient.publicIpAddresses.get(resourceGroupName, publicipName, _);
        return publicIP;
      } catch (e) {
        if (e.code === 'ResourceNotFound') {
          return null;
        }
        throw e;
      } finally {
        progress.end();
      }
    },

    _createNewPublicIP: function (resourceGroupName, params, _) {
      var createRequestProfile = this._parsePublicIPCreateParams(params, _);
      var progress = this.cli.interaction.progress(util.format($('Creating public ip "%s"'), params.publicipName));
      try {
        this.networkResourceProviderClient.publicIpAddresses.createOrUpdate(resourceGroupName, params.publicipName, createRequestProfile,  _);
        return createRequestProfile;
      } finally {
        progress.end();
      }
    },

    buildIdFromParams: function () {
      return ('/resourceGroups/'+ this.resourceGroupName + '/providers/Microsoft.Network/publicIPAddresses/' + this.params.publicipName).toLocaleLowerCase();
    }
  }
);

module.exports = NetworkPublicIP;