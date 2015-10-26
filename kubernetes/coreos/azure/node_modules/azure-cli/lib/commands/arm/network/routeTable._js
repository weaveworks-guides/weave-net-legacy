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
var constants = require('./constants');
var $ = utils.getLocaleString;
var tagUtils = require('../tag/tagUtils');
var resourceUtils = require('../resource/resourceUtils');
var VNetUtil = require('../../../util/vnet.util');

function RouteTable(cli, networkResourceProviderClient) {
  this.networkResourceProviderClient = networkResourceProviderClient;
  this.vnetUtil = new VNetUtil();
  this.output = cli.output;
  this.interaction = cli.interaction;
}

__.extend(RouteTable.prototype, {
  create: function (resourceGroupName, routeTableName, location, options, _) {
    var self = this;
    var routeTable = self.get(resourceGroupName, routeTableName, _);

    if (routeTable) {
      throw new Error(util.format($('A route table with name "%s" already exists in the resource group "%s"'), routeTableName, resourceGroupName));
    }

    var parameters = self._parseRouteTable(location, options);

    var progress = self.interaction.progress(util.format($('Creating route table "%s"'), routeTableName));
    try {
      self.networkResourceProviderClient.routeTables.createOrUpdate(resourceGroupName, routeTableName, parameters, _);
    } finally {
      progress.end();
    }
    self.show(resourceGroupName, routeTableName, options, _);
  },

  show: function (resourceGroupName, routeTableName, options, _) {
    var self = this;
    var routeTable = self.get(resourceGroupName, routeTableName, _);

    self.interaction.formatOutput(routeTable, function (routeTable) {
      if (!routeTable) {
        self.output.warn(util.format($('A route table with name "%s" not found'), routeTableName));
      } else {
        var resourceInfo = resourceUtils.getResourceInformation(routeTable.id);
        self.output.nameValue($('Id'), routeTable.id);
        self.output.nameValue($('Name'), routeTable.name);
        self.output.nameValue($('Type'), resourceInfo.resourceType);
        self.output.nameValue($('Location'), routeTable.location);
        self.output.nameValue($('Provisioning state'), routeTable.provisioningState);
        self.output.nameValue($('Tags'), tagUtils.getTagsInfo(routeTable.tags));

        if (routeTable.subnets.length > 0) {
          self.output.header($('Subnets'));
          routeTable.subnets.forEach(function (subnet) {
            self.output.nameValue($('Id'), subnet.id, 2);
          });
        }

        if (routeTable.routes.length > 0) {
          self.output.header($('Routes'));
          routeTable.routes.forEach(function (route) {
            self.output.nameValue($('Name'), route.name, 2);
            self.output.nameValue($('Address prefix'), route.addressPrefix, 2);
            self.output.nameValue($('Next hop type'), route.nextHopType, 2);
            self.output.nameValue($('Next hop IP address'), route.nextHopIpAddress, 2);
            self.output.data('');
          });
        }
      }
    });
  },

  list: function (resourceGroupName, options, _) {
    var self = this;
    var progress = self.interaction.progress(('Looking up route tables'));

    var routeTables;
    try {
      routeTables = self.networkResourceProviderClient.routeTables.list(resourceGroupName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(routeTables.routeTables, function (data) {
      if (data.length === 0) {
        self.output.warn($('No route tables found'));
      } else {
        self.output.table(data, function (row, routeTable) {
          row.cell($('Name'), routeTable.name);
          row.cell($('Location'), routeTable.location);
          row.cell($('Routes number'), routeTable.routes.length);
          row.cell($('Subnets number'), routeTable.subnets.length);
        });
      }
    });
  },

  delete: function (resourceGroupName, routeTableName, options, _) {
    var self = this;
    var routeTable = self.get(resourceGroupName, routeTableName, _);

    if (!routeTable) {
      throw new Error(util.format($('Route table "%s" not found in the resource group "%s"'), routeTableName, resourceGroupName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete route table "%s"? [y/n] '), routeTableName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting route table "%s"'), routeTableName));
    try {
      self.networkResourceProviderClient.routeTables.deleteMethod(resourceGroupName, routeTableName, _);
    } finally {
      progress.end();
    }
  },

  get: function (resourceGroupName, routeTableName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up route table "%s"'), routeTableName));
    var routeTable;
    try {
      routeTable = self.networkResourceProviderClient.routeTables.get(resourceGroupName, routeTableName, _);
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      } else {
        throw e;
      }
    } finally {
      progress.end();
    }
    return routeTable.routeTable;
  },

  update: function (resourceGroupName, routeTableName, parameters, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Updating route table "%s"'), routeTableName));
    try {
      self.networkResourceProviderClient.routeTable.createOrUpdate(resourceGroupName, routeTableName, parameters, _);
    } finally {
      progress.end();
    }
  },

  createRoute: function (resourceGroupName, routeTableName, routeName, options, _) {
    var self = this;

    var parameters = self._parseRoute(routeName, options, _);
    var route = self.getRoute(resourceGroupName, routeTableName, routeName, _);
    if (route) {
      throw new Error(util.format($('A route with name "%s" already exists in a route table "%s"'), routeName, routeTableName));
    }

    var progress = self.interaction.progress(util.format($('Creating route "%s" in a route table "%s"'), routeName, routeTableName));
    try {
      self.networkResourceProviderClient.routes.createOrUpdate(resourceGroupName, routeTableName, routeName, parameters, _);
    } finally {
      progress.end();
    }
    self.showRoute(resourceGroupName, routeTableName, routeName, options, _);
  },

  setRoute: function (resourceGroupName, routeTableName, routeName, options, _) {
    var self = this;
    var parameters = self._parseRoute(routeName, options, _);

    var route = self.getRoute(resourceGroupName, routeTableName, routeName, _);
    if (!route) {
      throw new Error(util.format($('A route with name "%s" not found'), routeName));
    }

    if (options.addressPrefix) route.addressPrefix = parameters.addressPrefix;
    if (options.nextHopType) route.nextHopType = parameters.nextHopType;
    if (options.nextHopIpAddress) route.nextHopIpAddress = parameters.nextHopIpAddress;

    self.updateRoute(resourceGroupName, routeTableName, routeName, route, _);
    self.showRoute(resourceGroupName, routeTableName, routeName, options, _);
  },

  listRoutes: function (resourceGroupName, routeTableName, options, _) {
    var self = this;
    var progress = self.interaction.progress(('Looking up routes'));

    var routes;
    try {
      routes = self.networkResourceProviderClient.routes.list(resourceGroupName, routeTableName, _);
    } finally {
      progress.end();
    }

    self.interaction.formatOutput(routes.routes, function (data) {
      if (data.length === 0) {
        self.output.warn(util.format($('No routes defined for the route table "%s"'), routeTableName));
      } else {
        self.output.table(data, function (row, route) {
          row.cell($('Name'), route.name);
          row.cell($('Address prefix'), route.addressPrefix);
          row.cell($('Next hop type'), route.nextHopType);
          row.cell($('Next hop IP address'), route.nextHopIpAddress || '');
        });
      }
    });
  },

  showRoute: function (resourceGroupName, routeTableName, routeName, options, _) {
    var self = this;
    var route = self.getRoute(resourceGroupName, routeTableName, routeName, _);

    self.interaction.formatOutput(route, function (route) {
      if (!route) {
        self.output.warn(util.format($('A route with name "%s" not found'), routeName));
      } else {
        self.output.nameValue($('Id'), route.id);
        self.output.nameValue($('Name'), route.name);
        self.output.nameValue($('Provisioning state'), route.provisioningState);
        self.output.nameValue($('Next hop type'), route.nextHopType);
        self.output.nameValue($('Next hop IP address'), route.nextHopIpAddress);
        self.output.nameValue($('Address prefix'), route.addressPrefix);
      }
    });
  },

  deleteRoute: function (resourceGroupName, routeTableName, routeName, options, _) {
    var self = this;

    var route = self.getRoute(resourceGroupName, routeTableName, routeName, _);
    if (!route) {
      throw new Error(util.format($('A route with name "%s" not found'), routeName));
    }

    if (!options.quiet && !self.interaction.confirm(util.format($('Delete route "%s"? [y/n] '), routeName), _)) {
      return;
    }

    var progress = self.interaction.progress(util.format($('Deleting route "%s"'), routeName));
    try {
      self.networkResourceProviderClient.routes.deleteMethod(resourceGroupName, routeTableName, routeName, _);
    } finally {
      progress.end();
    }
  },

  getRoute: function (resourceGroupName, routeTableName, routeName, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Looking up route "%s" in route table "%s"'), routeName, routeTableName));
    var route;
    try {
      route = self.networkResourceProviderClient.routes.get(resourceGroupName, routeTableName, routeName, _);
    } catch (e) {
      if (e.statusCode === 404) {
        return null;
      } else {
        throw e;
      }
    } finally {
      progress.end();
    }
    return route.route;
  },

  updateRoute: function (resourceGroupName, routeTableName, routeName, parameters, _) {
    var self = this;
    var progress = self.interaction.progress(util.format($('Updating route "%s" in route table "%s"'), routeName, routeTableName));
    try {
      self.networkResourceProviderClient.routes.createOrUpdate(resourceGroupName, routeTableName, routeName, parameters, _);
    } finally {
      progress.end();
    }
  },

  _parseRouteTable: function (location, options) {
    var parameters = {
      location: location
    };

    if (options.type) {
      parameters.type = options.type;
    }

    if (options.tags) {
      parameters.tags = tagUtils.buildTagsParameter(null, options);
    }
    return parameters;
  },

  _parseRoute: function (routeName, options, _) {
    var self = this;
    var route = {};

    if (options.addressPrefix) {
      var prefixValidationResult = self.vnetUtil.parseIPv4Cidr(options.addressPrefix);
      if (prefixValidationResult.error) {
        throw new Error($('address prefix must be in CIDR format'));
      }
      route.addressPrefix = prefixValidationResult.ipv4Cidr;
    }

    if (options.nextHopType) {
      route.nextHopType = utils.verifyParamExistsInCollection(constants.route.nextHopType,
        options.nextHopType, 'next hop type');

      if (utils.ignoreCaseAndSpaceEquals(options.nextHopType, constants.route.nextHopType[0]) && !options.nextHopIpAddress) {
        options.nextHopIpAddress = self.interaction.promptIfNotGiven($('Next hop ip address: '), options.nextHopIpAddress, _);
      }
    }

    if (options.nextHopIpAddress) {
      var ipValidationResult = self.vnetUtil.parseIPv4(options.nextHopIpAddress);
      if (ipValidationResult.error) {
        throw new Error(util.format($('next hop ip address "%s" is not valid'), options.nextHopIpAddress));
      }
      route.nextHopIpAddress = options.nextHopIpAddress;
    } else if (utils.ignoreCaseAndSpaceEquals(options.nextHopType, constants.route.nextHopType[0])) {
      throw new Error($('--next-hop-ip-address cannot be Null or Empty when --next-hop-type is VirtualAppliance'));
    }

    return route;
  }

});

module.exports = RouteTable;