var __ = require('underscore');
var util = require('util');

var utils = require('../../../util/utils');
var profile = require('../../../util/profile');

var AvailabilitySet = require('./availabilitySet');
var NetworkNic = require('./../vm/networkNic');
var VirtualMachine = require('./../vm/virtualMachine');

var $ = utils.getLocaleString;

function AvailsetClient(cli, subscription) {
  this.cli = cli;
  this.subscription = subscription;
}

__.extend(AvailsetClient.prototype, {
  createAvailSet: function (resourceGroupName, name, location, tags, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var params = {
      availsetName: name,
      location: location,
      availsetTags: tags
    };

    var availSetHelper = new AvailabilitySet(this.cli, serviceClients);
    var availSetResult = availSetHelper.getAvailSet(resourceGroupName, name, _);
    if (availSetResult) {
      throw new Error(util.format($('An availability set with name "%s" already exists in the resource group "%s"'), name, resourceGroupName));
    }

    availSetHelper.createNewAvailSet(resourceGroupName, params, _);
  },

  listAvailSet: function(resourceGroupName, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var availSetHelper = new AvailabilitySet(this.cli, serviceClients);
    var availsetsResult = availSetHelper.getAvailList(resourceGroupName, _);
    var output = this.cli.output;
    this.cli.interaction.formatOutput(availsetsResult.availabilitySets, function (outputData) {
      if (outputData.length === 0) {
        output.warn($('No availability sets found'));
      } else {
        output.table(outputData, function (row, item) {
          row.cell($('Name'), item.name);
          row.cell($('Location'), item.location);
          row.cell($('Update domain count'), item.platformUpdateDomainCount);
          row.cell($('Fault domain count'), item.platformFaultDomainCount);
        });
      }
    });
  },

  showAvailSet: function(resourceGroupName, name, options, _) {
    var output = this.cli.output;
    var isJson = output.format().json;
    var depth = 0; // 0 recurse
    if (isJson) {
      if (options.depth) {
        if (options.depth === 'full') {
          depth = -1; // full recurse
        } else {
          depth = utils.parseInt(options.depth);
          if (isNaN(depth)) {
            throw new Error($('--depth is an optional parameter but when specified it must be an integer (number of times to recurse) or text "full" (idefinite recursion)'));
          }
        }
      }
    } else {
      if (options.depth) {
        output.warn($('--depth paramater will be ignored when --json option is not specified'));
      }
    }

    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);
    var dependencies = {
      availabilitySet: new AvailabilitySet(this.cli, serviceClients),
      virtualMachine: new VirtualMachine(this.cli, serviceClients),
      networkNic: new NetworkNic(this.cli, serviceClients.networkResourceProviderClient)
    };

    var availsetResult = dependencies.availabilitySet.getAvailSetByNameExpanded(resourceGroupName, name, depth, {}, dependencies, _);
    if (availsetResult) {
      var availabilitySet = availsetResult.availabilitySet;
      this.cli.interaction.formatOutput(availabilitySet, function () {
        utils.logLineFormat(availabilitySet, output.data);
      });
    } else {
      if (isJson) {
        output.json({});
      } else {
        output.warn($('No availiability set found'));
      }
    }
  },

  deleteAvailSet: function(resourceGroupName, name, options, _) {
    var subscription = profile.current.getSubscription(this.subscription);
    var serviceClients = this._getServiceClients(subscription);

    var availSetHelper = new AvailabilitySet(this.cli, serviceClients);
    var availsetResult = availSetHelper.getAvailSet(resourceGroupName, name, _);
    if (!availsetResult) {
      throw new Error(util.format($('An availability set with name "%s" not found in the resource group "%s"'), name, resourceGroupName));
    }

    if (!options.quiet && !this.cli.interaction.confirm(util.format($('Delete availability set "%s"? [y/n] '), name), _)) {
      return;
    }

    availSetHelper.deleteAvailSet(resourceGroupName, name, _);
  },

  _getServiceClients: function(subscription) {
    return {
      computeManagementClient: utils.createComputeResourceProviderClient(subscription),
      storageManagementClient: utils.createStorageResourceProviderClient(subscription),
      networkResourceProviderClient: utils.createNetworkResourceProviderClient(subscription)
    };
  }
});

module.exports = AvailsetClient;