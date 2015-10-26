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

var __ = require('underscore');
var util = require('util');

var groupUtils = require('../group/groupUtils');
var permissionsUtils = require('../role/permissionsUtils');
var rbacClients = require('../role/rbacClients');
var profile = require('../../../util/profile');
var resourceUtils = require('./resourceUtils');
var tagUtils = require('../tag/tagUtils');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;
  var withProgress = cli.interaction.withProgress.bind(cli.interaction);

  var resource = cli.category('resource')
    .description($('Commands to manage your resources'));

  resource.command('create [resource-group] [name] [resource-type] [location] [api-version]')
    .description($('Creates a resource in a resource group'))
    .usage('[options] <resource-group> <name> <resource-type> <location> <api-version>')
    .option('-g --resource-group <resource-group>', $('the resource group name'))
    .option('-n --name <name>', $('the resource name'))
    .option('-l --location <location>', $('the location where we will create the resource'))
    .option('-r --resource-type <resource-type>', $('the resource type'))
    .option('-o --api-version <api-version>', $('the API version of the resource provider'))
    .option('--parent <parent>', $('the name of the parent resource (if needed), in path/path/path format'))
    .option('-p --properties <properties>', $('a JSON-formatted string containing properties'))
    .option('-t --tags <tags>', $('Tags to set to the resource group. Can be mutliple. ' +
            'In the format of \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, resourceType, location, apiVersion, options, _) {
      resource.createResource(resourceGroup, name, resourceType, location, apiVersion, options.properties, options, _);
    });

  resource.command('set [resource-group] [name] [resource-type] [properties] [api-version]')
    .usage('[options] <resource-group> <name> <resource-type> <properties> <api-version>')
    .description($('Updates a resource in a resource group without any templates or parameters'))
    .option('-g --resource-group <resource-group>', $('the resource group name'))
    .option('-n --name <name>', $('the resource name'))
    .option('-r --resource-type <resource-type>', $('the resource type'))
    .option('-p --properties <properties>', $('a JSON-formatted string containing properties'))
    .option('-o --api-version <api-version>', $('the API version of the resource provider'))
    .option('--parent <parent>', $('the name of the parent resource (if needed), in path/path/path format'))
    .option('-t --tags <tags>', $('Tags to set to the resource. Can be multiple. ' +
      'In the format of \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
    .option('--no-tags', $('remove all existing tags'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, resourceType, properties, apiVersion, options, _) {
      resource.createResource(resourceGroup, name, resourceType, '', apiVersion, properties, options, _);
    });

  resource.createResource = function (resourceGroup, name, resourceType, location, apiVersion, propertiesParam, options, _) {
    if (!resourceGroup) {
      return cli.missingArgument('resourceGroup');
    } else if (!name) {
      return cli.missingArgument('name');
    } else if (!resourceType) {
      return cli.missingArgument('resourceType');
    } else if (!apiVersion) {
      return cli.missingArgument('apiVersion');
    }

    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.createResourceClient(subscription);

    var identity = {
      resourceName: name,
      resourceProviderNamespace: resourceUtils.getProviderName(resourceType),
      resourceProviderApiVersion: apiVersion,
      resourceType: resourceUtils.getResourceTypeName(resourceType),
      // TODO: parent should be optional in the API. temporary workaround.
      parentResourcePath: __.isString(options.parent) ? options.parent : ''
    };

    var resource = withProgress(util.format($('Getting resource %s'), name),
      function (log, _) {
        return groupUtils.getResource(client, resourceGroup, identity, _);
      }, _);

    resource = resource || {};
    var properties = {};
    if (propertiesParam) {
      properties = JSON.parse(propertiesParam);
    }

    var tags = {};
    tags = tagUtils.buildTagsParameter(tags, options);

    var message = util.format($('Creating resource %s'), name);
    var doneMessage = util.format($('Created resource %s'), name);
    if (resource) {
      message = util.format($('Updating resource %s'), name);
      doneMessage = util.format($('Resource %s is updated'), name);
    }

    var resourceLocation = location || resource.location;
    if (!resourceLocation){
      cli.missingArgument('location');
    }

    var newResource;
    cli.interaction.withProgress(util.format($('Creating resource %s'), name),
      function (log, _) {
        newResource = client.resources.createOrUpdate(resourceGroup,
          identity,
          {
            location: resourceLocation,
            resource: resource,
            properties: properties,
            resourceProviderApiVersion: apiVersion,
            tags: tags
          }, _).resource;
      }, _);

    log.info(doneMessage);
    log.data('');
    showResource(newResource);
  };

  resource.command('list [resource-group]')
    .description($('Lists the resources'))
    .option('-g --resource-group <resource-group>', $('the resource group name'))
    .option('-r --resource-type <resource-type>', $('the resource type'))
    .option('--details', $('show details such as permissions, etc.'))
    .option('-t --tags <tags>', $('Tag to use to filter to the resource group. Can only take 1 tag. ' +
        'In the format of "name=value". Name is required and value is optional. ' +
        'For example, -t tag1 or -t tag1=value1.'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);
      var progress = cli.interaction.progress(util.format($('Listing resources')));

      var resources;
      try {
        var parameters = {};
        if (options) {
          if (options.resourceType) {
            parameters.resourceType = options.resourceType;
          }
          if (options.tags) {
            tagUtils.populateQueryFilterWithTagInfo(options.tags, parameters);
          }
        }

        if (resourceGroup) {
          parameters.resourceGroupName = resourceGroup;
        }

        resources = client.resources.list(parameters, _).resources;
      } finally {
        progress.end();
      }

      if (options.details) {
        var authzClient = rbacClients.getAuthzClient(subscription);
        for (var i = 0; i < resources.length; i++) {
          var resourceInformation = resourceUtils.getResourceInformation(resources[i].id);
          resources[i].permissions = authzClient.permissions.listForResource(resourceInformation.resourceGroup, {
            resourceName: resourceInformation.resourceName,
            resourceType: resourceUtils.getResourceTypeName(resourceInformation.resourceType),
            resourceProviderNamespace: resourceUtils.getProviderName(resourceInformation.resourceType),
            parentResourcePath: resourceInformation.parentResource ? resourceInformation.parentResource : '',
          },
          _).permissions;
        }
      }

      if (resources.length === 0) {
        log.info($('No matched resources were found.'));
      } else {
        log.table(resources, function (row, item) {
          var resourceInformation = resourceUtils.getResourceInformation(item.id);
          row.cell($('Id'), item.id);
          row.cell($('Name'), resourceInformation.resourceName || item.name );
          row.cell($('Resource Group'), resourceInformation.resourceGroup || '');
          row.cell($('Type'), resourceInformation.resourceType || item.type);
          row.cell($('Parent'), resourceInformation.parentResource ?  resourceInformation.parentResource : '');
          row.cell($('Location'), item.location);
          row.cell($('Tags'), tagUtils.getTagsInfo(item.tags));
          if (item.permissions) {
            var permissionDetails = permissionsUtils.getPermissionDetails(item.permissions);
            row.cell($('Actions'), permissionDetails.actions);
            row.cell($('NotActions'), permissionDetails.notActions);
          }
        });
      }
    });

  resource.command('show [resource-group] [name] [resource-type] [api-version]')
    .description($('Gets one resource within a resource group or subscription'))
    .usage('[options] <resource-group> <name> <resource-type> <api-version>')
    .option('-g --resource-group <resource-group>', $('the resource group name'))
    .option('-n --name <name>', $('the resource name'))
    .option('-r --resource-type <resource-type>', $('the resource type'))
    .option('-o --api-version <api-version>', $('the API version of the resource provider'))
    .option('--parent <parent>', $('the name of the parent resource (if needed), in path/path/path format'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, resourceType, apiVersion, options, _) {
      if (!resourceGroup) {
        return cli.missingArgument('resourceGroup');
      } else if (!name) {
        return cli.missingArgument('name');
      } else if (!resourceType) {
        return cli.missingArgument('resourceType');
      } else if (!apiVersion) {
        return cli.missingArgument('apiVersion');
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);
      var authzClient = rbacClients.getAuthzClient(subscription);

      var progress = cli.interaction.progress(util.format($('Getting resource %s'), name));

      var resource;
      try {
        var identity = {
          resourceName: name,
          resourceProviderNamespace: resourceUtils.getProviderName(resourceType),
          resourceProviderApiVersion: apiVersion,
          resourceType: resourceUtils.getResourceTypeName(resourceType),
          // TODO: parent should be optional in the API. temporary workaround.
          parentResourcePath: __.isString(options.parent) ? options.parent : ''
        };

        resource = client.resources.get(resourceGroup, identity, _).resource;
        resource.permissions = authzClient.permissions.listForResource(resourceGroup, identity, _).permissions;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(resource, function (resource) {
        showResource(resource, true);
      });
    });

  resource.command('delete [resource-group] [name] [resource-type] [api-version]')
    .description($('Deletes a resource in a resource group'))
    .usage('[options] <resource-group> <name> <resource-type> <api-version>')
    .option('-g --resource-group <resource-group>', $('the resource group name'))
    .option('-n --name <name>', $('the resource name'))
    .option('-r --resource-type <resource-type>', $('the resource type'))
    .option('-o --api-version <api-version>', $('the API version of the resource provider'))
    .option('--parent <parent>', $('the name of the parent resource (if needed), in path/path/path format'))
    .option('-q, --quiet', $('quiet mode (do not ask for delete confirmation)'))
    .option('--subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, resourceType, apiVersion, options, _) {
      if (!resourceGroup) {
        return cli.missingArgument('resourceGroup');
      } else if (!name) {
        return cli.missingArgument('name');
      } else if (!resourceType) {
        return cli.missingArgument('resourceType');
      } else if (!apiVersion) {
        return cli.missingArgument('apiVersion');
      }

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete resource %s? [y/n] '), name), _)) {
        return;
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);
      var progress = cli.interaction.progress(util.format($('Deleting resource %s'), name));
      try {
        var identity = {
          resourceName: name,
          resourceProviderNamespace: resourceUtils.getProviderName(resourceType),
          resourceProviderApiVersion: apiVersion,
          resourceType: resourceUtils.getResourceTypeName(resourceType),
          // TODO: parent should be optional in the API. temporary workaround.
          parentResourcePath: __.isString(options.parent) ? options.parent : ''
        };

        try {
          client.resources.get(resourceGroup, identity, _);
        } catch (e) {
          throw new Error($('Resource does not exist'));
        }

        client.resources.deleteMethod(resourceGroup, identity, _);
      } finally {
        progress.end();
      }
    });

  function showResource(resource, showDetail) {
    var resourceInformation = resourceUtils.getResourceInformation(resource.id);
    log.data($('Id:       '), resource.id);
    log.data($('Name:     '), resourceInformation.resourceName || resource.name);
    log.data($('Type:     '), resourceInformation.resourceType || resource.type);
    log.data($('Parent:   '), resourceInformation.parentResource || '');
    log.data($('Location: '), resource.location);
    log.data($('Tags:     '), tagUtils.getTagsInfo(resource.tags));
    log.data('');
    if (showDetail) {
      log.data($('Properties:'));
      cli.interaction.logEachData($('Property'), resource.properties);
      log.data('');
      var permissionDetails = permissionsUtils.getPermissionDetails(resource.permissions);
      log.data($('Permissions:'));
      log.data($('  Actions: ') + permissionDetails.actions);
      log.data($('  NotActions: ') + permissionDetails.notActions);
    }
  }
};
