var __ = require('underscore');
var util = require('util');
var tagUtils = require('../tag/tagUtils');

var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

function AvailabilitySet(cli, serviceClients, resourceGroupName, params) {
    this.cli = cli;
    this.serviceClients = serviceClients;
    this.computeManagementClient = serviceClients.computeManagementClient;
    this.resourceGroupName = resourceGroupName;
    this.params = params;
}

__.extend(AvailabilitySet.prototype, {
    _parseAvailSetCreateParams: function (params) {
      if (!utils.allParamsAreSet([params.availsetName, params.location])) {
        throw new Error($('To create new availability set the parameters availsetName and location are required'));
      }

      var tags = {};
      if (params.availsetTags) {
        tags = tagUtils.buildTagsParameter(tags, { tags: params.availsetTags });
      }

      var createRequestProfile = {
          name: params.availsetName,
          location: params.location,
          tags: tags
      };

      return createRequestProfile;
    },

    createAvailSetIfRequired: function(_) {
      if (utils.stringIsNullOrEmpty(this.params.availsetName)) {
        throw new Error($('The parameters availsetName is required'));
      }

      if (utils.stringIsNullOrEmpty(this.params.location)) {
        throw new Error($('The parameter location is required'));
      }

      var availsetInfo = {
        availsetName: this.params.availsetName,
        createdNew: false,
        createRequestProfile: {},
        profile: {}
      };

      var availSet = this.getAvailSet(this.resourceGroupName, this.params.availsetName, _);
      if (availSet) {
        if (!utils.ignoreCaseAndSpaceEquals(availSet.availabilitySet.location, this.params.location)) {
          throw new Error(util.format($('An Availability set with name "%s" already exists in another region "%s"'), this.params.availsetName, availSet.availabilitySet.location));
        }

        this.cli.output.info(util.format($('Found an Availability set "%s"'), this.params.availsetName));
        var connectedVMRefs = availSet.availabilitySet.virtualMachinesReferences;
        if (connectedVMRefs instanceof Array) {
          var expectedVMId = '/resourceGroups/' + this.resourceGroupName + '/providers/Microsoft.Compute/virtualMachines/' + this.params.vmName;
          for (var i = 0 ; i < connectedVMRefs.length; i++) {
            if (utils.stringEndsWith(connectedVMRefs[i].referenceUri, expectedVMId, true)) {
              throw new Error(util.format($('A VM with name "%s" (reference "%s") is already in the availability set "%s"'), this.params.vmName, connectedVMRefs[i].referenceUri, this.params.availsetName));
            }
          }
        }

        availsetInfo.profile = availSet.availabilitySet;
        return availsetInfo;
      }

      this.cli.output.info(util.format($('Availability set with given name not found "%s", creating a new one'), this.params.availsetName));
      availsetInfo.createRequestProfile = this.createNewAvailSet(this.resourceGroupName, this.params, _);
      availsetInfo.createdNew = true;
      availSet = this.getAvailSet(this.resourceGroupName, this.params.availsetName, _);
      availsetInfo.profile = availSet.availabilitySet;
      return availsetInfo;
    },

    getAvailSetByIdExpanded: function (referenceUri, depth, memoize, dependencies, _) {
      referenceUri = referenceUri.toLowerCase();
      if (memoize[referenceUri]) {
        return memoize[referenceUri];
      }

      var resourceInfo = utils.parseResourceReferenceUri(referenceUri);
      var expandedAvailSet = this.getAvailSetByNameExpanded(resourceInfo.resourceGroupName, resourceInfo.resourceName, depth, memoize, dependencies, _);
      return expandedAvailSet;
    },

    getAvailSetByNameExpanded: function (resourceGroupName, availsetName, depth, memoize, dependencies, _) {
      var availSet = this.getAvailSet(resourceGroupName, availsetName, _);
      var expandedAvailSet = this._expandAvailSet(availSet, depth, memoize, dependencies, _);
      return expandedAvailSet;
    },

    getAvailSet: function (resourceGroupName, availsetName, _) {
      var progress = this.cli.interaction.progress(util.format($('Looking up the availability set "%s"'), availsetName));
      try {
        var availSet = this.computeManagementClient.availabilitySets.get(resourceGroupName, availsetName, _);
        return availSet;
      } catch (e) {
        if (e.code === 'ResourceNotFound') {
          return null;
        }
        throw e;
      } finally {
        progress.end();
      }
    },

    getAvailList: function (resourceGroupName, _) {
      var availSets;
      var progress = this.cli.interaction.progress($('Getting availiability sets'));
      try {
        availSets = this.computeManagementClient.availabilitySets.list(resourceGroupName, _);
      } finally {
        progress.end();
      }

      return availSets;
    },

    deleteAvailSet: function (resourceGroupName, availsetName, _) {
      var progress = this.cli.interaction.progress(util.format($('Deleting the availability set "%s"'), availsetName));
      try {
        this.computeManagementClient.availabilitySets.deleteMethod(resourceGroupName, availsetName, _);
      } finally {
        progress.end();
      }
    },

    hasAnyAvailSetParameters: function(params) {
      var allAvailSetParams = [ params.availsetName ];
      return utils.atLeastOneParameIsSet(allAvailSetParams);
    },

    createNewAvailSet: function (resourceGroupName, params, _) {
      var createRequestProfile = this._parseAvailSetCreateParams(params);
      var progress = this.cli.interaction.progress(util.format($('Creating availability set "%s"'), params.availsetName));
      try {
        this.computeManagementClient.availabilitySets.createOrUpdate(resourceGroupName, createRequestProfile,  _);
        return createRequestProfile;
      } finally {
        progress.end();
      }
    },

    _expandAvailSet: function (availSet, depth, memoize, dependencies, _) {
      if (depth === 0 || availSet === null) {
        return availSet;
      }

      if (depth !== -1) {
        depth--;
      }

      var availabilitySet = availSet.availabilitySet;
      var referenceUri = availabilitySet.id.toLowerCase();
      memoize[referenceUri] = availSet;

      if (availabilitySet.virtualMachinesReferences instanceof Array) {
        for (var i = 0; i < availabilitySet.virtualMachinesReferences.length; i++) {
          var vmReference =  availabilitySet.virtualMachinesReferences[i];
          var vmReferenceId = vmReference.referenceUri.toLowerCase();
          if (!memoize[vmReferenceId]) {
            // expand related resource only if it is not expanded before in the chain
            vmReference.expanded = dependencies.virtualMachine.getVMByIdExpanded(vmReferenceId, depth, memoize, dependencies, _);
          }
        }
      }

      return memoize[referenceUri];
    }
});

module.exports = AvailabilitySet;