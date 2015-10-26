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

var util = require('util');
var url = require('url');

var async = require('async');
var __ = require('underscore');

var profile = require('../../../util/profile');
var utils = require('../../../util/utils');
var validate = require('../../../util/validation');
var cacheUtils = require('../../../util/cacheUtils');

/*jshint camelcase:false*/
var child_process = require('child_process');

var $ = utils.getLocaleString;

function WebsitesClient(cli, subscription) {
  this.cli = cli;
  this.subscription = subscription;
  this.hostNameSuffix = null;
}

__.extend(WebsitesClient, {
  getSiteName: function (name, slot) {
    if (slot && !WebsitesClient.isProductionSlot(slot)) {
      return util.format('%s(%s)', name, slot);
    } else {
      return name;
    }
  },

  parseSiteName: function (name) {
    var regExp = /\(([^)]+)\)/;
    var matches = regExp.exec(name);

    if (matches && matches.length > 0) {
      var slot = matches[matches.length - 1];
      name = name.replace(util.format('(%s)', slot), '');

      if (!WebsitesClient.isProductionSlot(slot)) {
        return { name: name, slot: slot };
      } else {
        return { name: name };
      }
    } else {
      return { name: name };
    }
  },

  getSiteHostName: function (name, slot) {
    if (slot && !WebsitesClient.isProductionSlot(slot)) {
      return util.format('%s-%s', name, slot);
    } else {
      return name;
    }
  },

  isProductionSlot: function (slot) {
    return utils.ignoreCaseEquals(slot, this.getProductionSlotName());
  },

  isStagingSlot: function (slot) {
    return utils.ignoreCaseEquals(slot, this.getStagingSlotName());
  },

  getProductionSlotName: function () {
    return 'production';
  },

  getStagingSlotName: function () {
    return 'staging';
  }
});

__.extend(WebsitesClient.prototype, {
  enableApplicationDiagnostic: function (name, output, properties, callback) {
    this.setApplicationDiagnosticsSettings(name, output, true, properties, callback);
  },

  disableApplicationDiagnostic: function (name, output, properties, callback) {
    this.setApplicationDiagnosticsSettings(name, output, false, properties, callback);
  },

  setApplicationDiagnosticsSettings: function (name, output, setFlag, properties, callback) {
    var self = this;
    var context = {
      subscription: self.subscription,
      site: {
        name: name
      }
    };

    self.cli.category('site').lookupSiteNameAndWebSpace(context, function (err) {
      if (err) { return callback(err); }

      self.cli.category('site').ensureRepositoryUri(context, function (err, repositoryUri) {
        if (err) { return callback(err); }

        if (repositoryUri) {
          self.getDiagnosticsSettings(context, function (err, settings) {
            if (err) { return callback(err); }

            if (!output && setFlag) {
              throw new Error($('Invalid trace output'));
            }

            if (!output || output.toLowerCase() === 'file') {
              settings.AzureDriveEnabled = setFlag;
              if (setFlag) {
                settings.AzureDriveTraceLevel = properties.level;
              }
            }

            if (!output || output.toLowerCase() === 'storage') {
              settings.AzureTableEnabled = setFlag;

              if (setFlag) {
                settings.AzureTableTraceLevel = properties.level;

                var storageTableName = 'CLOUD_STORAGE_ACCOUNT';
                var storageAccountName = properties.storageAccount;

                // Missing set connection string.
                self.getStorageServiceConnectionString(storageAccountName, function (err, connectionString) {
                  if (err) { return callback(err); }
                  
                  //number 3 denotes type 'Custom'
                  self.setConnectionString(name, storageTableName, connectionString, 3, function (err) {
                    if (err) { return callback(err); }

                    self.updateDiagnosticsSettings(context, settings, callback);
                  });
                });
              } else {
                self.updateDiagnosticsSettings(context, settings, callback);
              }
            } else {
              self.updateDiagnosticsSettings(context, settings, callback);
            }
          });
        } else {
          self.cli.output.error($('Repository is not setup'));
          callback(new Error($('Repository is not setup')));
        }
      });
    });
  },

  getStorageServiceConnectionString: function (name, callback) {
    var self = this;

    var storageService = self.createStorageClient();

    storageService.storageAccounts.get(name, function (err, properties) {
      if (err) { return callback(err); }

      storageService.storageAccounts.getKeys(name, function (err, keys) {
        if (err) { return callback(err); }

        var connectionString = util.format('AccountName=%s;AccountKey=%s;BlobEndpoint=%s;QueueEndpoint=%s;TableEndpoint=%s',
          name,
          keys.primaryKey,
          properties.storageAccount.properties.endpoints[0],
          properties.storageAccount.properties.endpoints[1],
          properties.storageAccount.properties.endpoints[2]);

        callback(null, connectionString);
      });
    });
  },

  setConnectionString: function (name, key, value, connectionStringType, callback) {
    var self = this;
    var context = {
      subscription: self.subscription,
      site: {
        name: name
      }
    };

    var siteCategory = self.cli.category('site');
    siteCategory.lookupSiteNameAndWebSpace(context, function (err) {
      if (err) { return callback(err); }

      siteCategory.doSiteConfigGet(context, function (err, config) {
        if (err) { return callback(err); }

        var connectionString;
        if (config.connectionStrings) {
          connectionString = config.connectionStrings.filter(function (c) {
            return utils.ignoreCaseEquals(c.name, key);
          })[0];
        } else {
          config.connectionStrings = [];
        }

        if (connectionString) {
          connectionString.connectionString = value;
          connectionString.name = key;
          connectionString.type = connectionStringType;
        } else {
          config.connectionStrings.push({
            connectionString: value,
            name: key,
            type: connectionStringType
          });
        }

        siteCategory.doSiteConfigPUT(config, context, callback);
      });
    });
  },

  getDiagnosticsSettings: function (context, _) {
    var self = this;

    var service = this.createWebsiteExtensionsClient(context, _);

    var progress = self.cli.interaction.progress($('Getting diagnostic settings'));
    try {
      return service.diagnostics.getSettings(_).settings;
    } finally {
      progress.end();
    }
  },

  updateDiagnosticsSettings: function (context, settings, _) {
    var self = this;

    var service = this.createWebsiteExtensionsClient(context,_ );

    var progress = self.cli.interaction.progress($('Updating diagnostic settings'));
    try {
      return service.diagnostics.updateSettings({ settings: settings }, _);
    } finally {
      progress.end();
    }
  },

  createStorageClient: function() {
    return utils.createStorageClient(profile.current.getSubscription(this.subscription));
  },

  createWebsiteManagementService: function (subscription, callback) {
    return utils.createWebsiteClient(profile.current.getSubscription(this.subscription), callback);
  },

  createWebsiteExtensionsClient: function (context, _) {
    var service = utils.createWebSiteExtensionsClient(
      WebsitesClient.getSiteHostName(context.site.name, context.site.slot),
      this.getHostNameSuffix(context.subscription, _),
      context.repositoryAuth.split(':')[0],
      context.repositoryAuth.split(':')[1]);
    service.baseUri = context.repositoryUri;

    return service;
  },

  createSite: function (subscription, webspace, site, _) {
    var self = this;

    if (site.hostNames) {
      self.cli.output.info(util.format($('Creating a new web site at %s'), site.hostNames));
    }

    self.cli.output.verbose('Subscription', subscription);
    self.cli.output.verbose('Webspace', webspace);
    self.cli.output.verbose('Site', site.name);

    if (site.slot) {
      self.cli.output.verbose('Slot', site.slot);
    }

    var service = self.createWebsiteManagementService(subscription, _);
    var progress = self.cli.interaction.progress($('Sending site information'));

    try {
      var result = service.webSites.create(webspace, site, _).webSite;
      self.cli.output.info(util.format($('Created website at %s'), result.hostNames));
      self.cli.output.verbose('Site', result);

      var siteName = WebsitesClient.getSiteName(site.name, site.slot);
      cacheUtils.saveSite(subscription, siteName, result, _);
      return result;
    } catch (err) {
      utils.logError(self.cli.output, $('Failed to create site'), err);

      if (err.messagetemplate) {
        var errormessageargs = [];
        if (err.parameters && err.parameters['a:string']) {
          if (__.isArray(err.parameters['a:string'])) {
            errormessageargs = err.parameters['a:string'];
          } else {
            errormessageargs = [ err.parameters['a:string'] ];
          }
          errormessageargs.unshift($(err.messagetemplate.replace(/\{.*?\}/g, '%s')));
          throw new Error(new Error(util.format.apply(err.messagetemplate, errormessageargs)));
        } else {
          throw new Error(err.messagetemplate);
        }
      } else if (typeof err.message !== 'string') {
        throw new Error($('Invalid service request'));
      } else {
        throw err;
      }
    } finally {
      progress.end();
    }
  },

  createRepository: function (options, callback) {
    var self = this;

    self.cli.output.info($('Initializing remote Azure repository'));
    self.cli.output.verbose('Subscription', options.subscription);
    self.cli.output.verbose('Webspace', options.site.webspace);
    self.cli.output.verbose('Site', options.site.name);

    var progress = self.cli.interaction.progress($('Updating site information'));
    self.createWebsiteManagementService(options.subscription, function (err, service) {
      if (err) {
        return callback(err);
      }
      var siteName = WebsitesClient.getSiteName(options.site.name, options.site.slot);
      service.webSites.createRepository(options.site.webspace, siteName, function (err, result) {
        progress.end();
        if (err) {
          utils.logError(self.cli.output, $('Failed to initialize repository'), err);
        } else {
          self.cli.output.info($('Remote azure repository initialized'));
        }
        return callback(err, result);
      });
    });
  },

  getRepository: function (options, _) {
    var self = this;

    var siteData = self.getSite(options, _);
    return self.getRepositoryUri(siteData);
  },

  deleteRepository: function (options, callback) {
    var self = this;

    self.cli.output.verbose('Subscription', options.subscription);
    self.cli.output.verbose('Webspace', options.site.webspace);
    self.cli.output.verbose('Site', options.site.name);

    var progress = self.cli.interaction.progress($('Updating site information'));
    self.createWebsiteManagementService(options.subscription, function (err, service) {
      if (err) {
        return callback(err);
      }
      var siteName = WebsitesClient.getSiteName(options.site.name, options.site.slot);
      service.webSites.deleteRepository(options.site.webspace, siteName, function (err, result) {
        progress.end();
        if (err) {
          utils.logError(self.cli.output, $('Failed to delete repository'), err);
        } else {
          self.cli.output.info($('Repository deleted'));
        }

        return callback(err, result);
      });
    });


  },

  syncRepository: function(options, callback) {
    var self = this;

    self.cli.output.verbose('Subscription', options.subscription);
    self.cli.output.verbose('Webspace', options.site.webspace);
    self.cli.output.verbose('Site', options.site.name);

    var progress = self.cli.interaction.progress($('Sync site repository'));

    var siteName = WebsitesClient.getSiteName(options.site.name, options.site.slot);

    // TODO: this is using the old wrapper as the new one does not have the sync repository.
    var oldService = utils.createWebsiteManagementService(profile.current.getSubscription(self.subscription), self.cli.output);
    oldService.syncSiteRepository(options.site.webspace, siteName, function (err, result) {
        progress.end();
        if (err) {
          utils.logError(self.cli.output, $('Failed to sync repository'), err);
        } else {
          self.cli.output.info($('Repository sync completed'));
        }
        return callback(err, result);
      });
  },

  getSpaces: function (options, _) {
    var self = this;
    self.cli.output.verbose('Subscription', options.subscription);

    var progress = self.cli.interaction.progress($('Getting locations'));
    try {
      var service = self.createWebsiteManagementService(options.subscription, _);
      var spaces = service.webSpaces.list(_).webSpaces;
      cacheUtils.saveSpaces(options, spaces, _);
      return spaces;
    } catch(err) {
      var message = err.Message;
      if (typeof message === 'string' && message.indexOf('Access is denied.') >= 0) {
        self.cli.output.error($('Please use the Microsoft Azure portal to create your first web website'));
        self.cli.output.error($('You can do so by following these steps:'));
        self.cli.output.error($('1. At the bottom of the page, click on New > Web Site > Quick Create'));
        self.cli.output.error($('2. Type a valid site name in the URL field'));
        self.cli.output.error($('3. Click on "Create Web Site"'));
        self.cli.output.error($('4. Once the site has been created, click on the site name'));
        self.cli.output.error($('5. Click on "Set up Git publishing" or "Reset deployment credentials" and setup a publishing username and password. Use those credentials for all new websites you create'));

        if (confirm($('Launch browser to portal now? [y/n] '), _)) {
          self.cli.output.help($('Launching portal'));
          var href = profile.current.getSubscription().getPortalUrl();
          self.cli.interaction.launchBrowser(href, _);
        }
      }

      throw err;
    } finally {
      progress.end();
    }
  },

  getSites: function (context, _) {
    var self = this;
    self.cli.output.verbose('Subscription', context.subscription);

    var progress;
    var service = self.createWebsiteManagementService(context.subscription, _);

    self.ensureSpaces(context, _);

    progress = self.cli.interaction.progress($('Getting sites'));
    try {
      var result = async.map(context.spaces,
        function (webspace, _) {
          return service.webSpaces.listWebSites(webspace.name, {
            propertiesToInclude: [
              'repositoryuri',
              'publishingpassword',
              'publishingusername'
            ]
          }, _).webSites;
        },
        _);

      var sites = [];

      result.forEach(function (item) {
        sites = sites.concat(item);
      });

      self.cli.output.json('verbose', sites);
      cacheUtils.saveSites(context.subscription, sites, _);
      return sites;
    }
    finally {
      progress.end();
    }
  },

  getSite: function (options, _) {
    validate.validateArgs('getSite', function (v) {
      v.object(options, 'options');
      v.object(options.site, 'options.site');
      v.string(options.site.name, 'options.site.name');
      v.string(options.site.webspace, 'options.site.webspace');
    });

    var self = this;

    var service = self.createWebsiteManagementService(options.subscription, _);

    var result;
    var progress = self.cli.interaction.progress($('Getting site information'));

    try {
      var siteName = WebsitesClient.getSiteName(options.site.name, options.site.slot);
      result = service.webSites.get(options.site.webspace, siteName, {
        propertiesToInclude: [ 'repositoryuri', 'publishingpassword', 'publishingusername' ]
      }, _).webSite;

      self.cli.output.verbose('Site', result);
      cacheUtils.saveSite(options.subscription, siteName, result, _);
    } catch (err) {
      utils.logError(self.cli.output, $('Failed to get site info'), err);
      if (err.Code === 'NotFound') {
        return cacheUtils.deleteSite(options.subscription, siteName, function () {
          throw err;
        });
      } else {
        throw err;
      }
    } finally {
      progress.end();
    }
    return result;
  },

  getSiteInstances: function (options, _) {
    validate.validateArgs('getSiteInstances', function (v) {
      v.object(options, 'options');
      v.object(options.site, 'options.site');
      v.string(options.site.name, 'options.site.name');
      v.string(options.site.webspace, 'options.site.webspace');
    });

    var self = this;

    var service = self.createWebsiteManagementService(options.subscription, _);

    var result;
    var progress = self.cli.interaction.progress($('Getting site instances information'));

    try {
      var siteName = WebsitesClient.getSiteName(options.site.name, options.site.slot);
      result = service.webSites.getInstanceIds(options.site.webspace, siteName, _);

      self.cli.output.verbose('Instance Ids', result);
    } catch (err) {
      utils.logError(self.cli.output, $('Failed to get site instances info'), err);
      throw err;
    } finally {
      progress.end();
    }

    return result.instanceIds;
  },

  updateSite: function (site, options, _) {
    var self = this;

    var progress = self.cli.interaction.progress($('Updating site information'));

    try {
      var service = self.createWebsiteManagementService(options.subscription, _);
      return service.webSites.update(options.site.webspace, WebsitesClient.getSiteName(options.site.name, options.site.slot), site, _);
    } finally {
      progress.end();
    }
  },

  getSiteConfiguration: function (options, callback) {
    var self = this;
    var progress = self.cli.interaction.progress($('Getting site config information'));

    var siteName = WebsitesClient.getSiteName(options.site.name, options.site.slot);
    self.createWebsiteManagementService(options.subscription, function (err, service) {
      if (err) {
        return callback(err);
      }
      service.webSites.getConfiguration(options.site.webspace, siteName, function (err, result) {
        progress.end();
        if (err) {
          utils.logError(self.cli.output, $('Failed to get site config info'), err);
        } else {
          self.cli.output.verbose('SiteConfig', result);
        }
        return callback(err, result);
      });
    });
  },

  updateSiteConfiguration: function (config, options, _) {
    var self = this;

    var progress = self.cli.interaction.progress($('Updating site config information'));

    try {
      var service = self.createWebsiteManagementService(options.subscription, _);

      var siteName = WebsitesClient.getSiteName(options.site.name, options.site.slot);
      return service.webSites.updateConfiguration(options.site.webspace, siteName, config, _);
    } finally {
      progress.end();
    }
  },

  getAvailableLocations: function (options, _) {
    var self = this;

    self.cli.output.verbose('Subscription', options.subscription);

    var progress = self.cli.interaction.progress($('Getting locations'));
    try {
      var service = self.createWebsiteManagementService(options.subscription, _);

      // Fetch locations that are "online"
      var locations = service.webSpaces.listGeoRegions(_).geoRegions;
      var result = locations.map(function (location) {
        return {
          name: location.name,
          webSpace: utils.webspaceFromName(location.name)
        };
      });

      // Fetch webspaces that were previously used
      var webspaces = service.webSpaces.list(_).webSpaces;
      webspaces.forEach(function (webspace) {
        if (!result.some(function (loc) {
          return loc.webSpace === webspace.name;
        })) {
          result.push({
            name: webspace.geoRegion,
            webSpace: webspace.name
          });
        }
      });

      // Remove duplicates - resource groups create multiple webspaces in
      // the same locations

      result = __.uniq(result, function (item) { return item.name; });
      return result;
    } finally {
      progress.end();
    }
  },

  getPublishingUsers: function (options, _) {
    var self = this;

    var progress = self.cli.interaction.progress($('Getting user information'));
    try {
      try {
        var service = self.createWebsiteManagementService(options.subscription, _);
        var publishingUsers = service.webSpaces.listPublishingUsers(_).users;

        self.cli.output.verbose($('PublishingUsers'), publishingUsers);
        return publishingUsers;
      }
      catch (e) {
        return [ '', '' ];
      }
    }
    finally {
      progress.end();
    }
  },

  getHostNameSuffix: function (subscription, _) {
    var self = this;
    if (!self.hostNameSuffix) {
      subscription = profile.current.getSubscription(subscription);
      var subscriptionId = subscription.id;
      if (subscriptionId) {
        var websiteManagementService = self.createWebsiteManagementService(subscriptionId, _);
        var hostNameSuffix = websiteManagementService.webSpaces.getDnsSuffix(_);

        this.hostNameSuffix = hostNameSuffix.dnsSuffix || subscription.hostNameSuffix;
      } else {
        this.hostNameSuffix = subscription.hostNameSuffix;
      }
    }
    return this.hostNameSuffix;
  },

  portalGitInitInstruction: function (context, _) {
    var self = this;

    self.cli.output.help($('You must create your git publishing credentials using the Microsoft Azure portal'));
    self.cli.output.help($('Please follow these steps in the portal:'));
    self.cli.output.help($('1. In the menu on the left select "Web Sites"'));
    self.cli.output.help(util.format($('2. Click on the site named "%s" or any other site'), ((context.site && context.site.name) || '{site name}')));
    self.cli.output.help($('3. Click on "Set up Git publishing" or "Reset deployment credentials" and setup a publishing username and password. Use those credentials for all new websites you create'));
    if (context.git) {
      self.cli.output.help($('4. Back in the console window, rerun this command by typing "azure site create {site name} --git"'));
    }

    if (self.cli.interaction.confirm($('Launch browser to portal now? [y/n] '), _)) {
      self.cli.output.help($('Launching portal'));
      var href = profile.current.getSubscription().getPortalUrl();
      self.cli.interaction.launchBrowser(href, _);
    }
  },

  getPublishingUser: function (context, _) {
    var self = this;

    function fallbackToPortal(_) {
      // For co-admin accounts the user still has to go the portal
      self.portalGitInitInstruction(context, _);
      throw new Error($('Git credentials needs to be setup on the portal'));
    }

    var administratorSlots = context.publishingUsers.map(function (user) {
      return user.name;
    });

    var administrators = administratorSlots.filter(function (item) {
      return typeof item === 'string' && item.length <= 64;
    });

    if (administratorSlots.length === 1 && administrators.length === 1) {
      // If it is not a co-admin account (there's 1 user defined and only 1 slot for admins)
      return administrators[0];
    }

    self.cli.output.help($('Please provide the username for Git deployment'));

    if (administratorSlots.length === 1) {
      // For non co-admin accounts, it's possible to create git credentials
      self.cli.output.help($('If you are a new git user under this subscription, please also provide a password'));
    } else if (administrators.length === 0) {
      fallbackToPortal(_);
    }

    var username = self.cli.interaction.prompt($('Publishing username: '), _);

    if (administrators.length === 0) {
      try {
        var password = self.cli.interaction.promptPassword($('Publishing password: '), _);
        var websiteManagementService = self.createWebsiteManagementService(context.subscription, _);
        websiteManagementService.webSpaces.createPublishingUser(username, password, { publishingUserName: username, publishingPassword: password }, _);
      } catch (e) {
        fallbackToPortal(_);
      }
    }

    return username;
  },

  getRepositoryUri: function (siteData) {
    if (siteData.siteProperties && siteData.siteProperties.properties) {
      for (var property in siteData.siteProperties.properties) {
        if (utils.ignoreCaseEquals(property, 'RepositoryUri')) {
          if (typeof siteData.siteProperties.properties[property] === 'string') {
            if (!utils.stringEndsWith(siteData.siteProperties.properties[property], '/')) {
              // Make sure there is a trailing slash
              siteData.siteProperties.properties[property] += '/';
            }

            return siteData.siteProperties.properties[property];
          } else {
            return null;
          }
        }
      }
    }

    return null;
  },

  getRepositoryAuthData: function (siteData) {
    var userName, password;
    for (var property in siteData.siteProperties.properties) {
      if (utils.ignoreCaseEquals(property, 'PublishingUsername')) {
        userName = siteData.siteProperties.properties[property];
      } else if (utils.ignoreCaseEquals(property, 'PublishingPassword')) {
        password = siteData.siteProperties.properties[property];
      }
    }
    return {
      username: userName,
      password: password
    };
  },

  getRepositoryAuth: function (siteData) {
    var data = this.getRepositoryAuthData(siteData);
    return data.username && (data.username + ':' + data.password);
  },

  getGitUri: function (repositoryUri, siteName, auth) {
    var repoUrl = url.parse(repositoryUri);

    if (auth) {
      repoUrl.auth = auth;
    }

    var sitePath = siteName + '.git';

    if (!utils.stringEndsWith(repoUrl.path, '/')) {
      // Make sure trailing slash exists
      repoUrl.path += '/';
    }
    repoUrl.path += sitePath;

    if (!utils.stringEndsWith(repoUrl.pathname, '/')) {
      // Make sure trailing slash exists
      repoUrl.pathname += '/';
    }
    repoUrl.pathname += sitePath;

    return url.format(repoUrl);
  },

  ensureRepositoryUri: function (context, _) {
    var self = this;

    var siteData = self.lookupSiteNameAndWebSpace(context, _);
    var repositoryUri = siteData && self.getRepositoryUri(siteData);
    if (!repositoryUri) {
      siteData = self.getSite(context, _);
      repositoryUri = self.getRepositoryUri(siteData);
    }

    if (repositoryUri) {
      context.repositoryAuth = self.getRepositoryAuth(siteData);
      context.repositoryUri = repositoryUri;
    }

    return repositoryUri;
  },

  lookupSiteName: function (context, _) {
    var self = this;

    if (context.site.name !== undefined) {
      // no need to read further
      return;
    }

    var cfg = self.readConfig(_);
    if (cfg && cfg.name) {
      // using the name from current location
      context.site.name = cfg.name;
      if (cfg.slot !== undefined && cfg.slot !== 'undefined') {
        context.site.slot = cfg.slot;
      }

      context.site.webspace = cfg.webspace;
      return;
    }

    context.site.name = self.cli.interaction.prompt($('Web site name: '), _);
    context.site.slot = self.cli.interaction.prompt($('Web site slot [enter for none]: '), _);

    if (!context.site.name) {
      throw new Error($('Invalid site name'));
    }
  },

  lookupSiteWebSpace: function (context, _) {
    validate.validateArgs('lookupSiteWebSpace', function (v) {
      v.object(context, 'context');
      v.object(context.site, 'context.site');
      v.string(context.site.name, 'context.site.name');
    });

    var self = this;

    var siteName = WebsitesClient.getSiteName(context.site.name, context.site.slot);

    self.cli.output.verbose(util.format($('Attempting to locate site '), siteName));
    var sites = self.getSites(context, _);
    for (var index in sites) {
      if (utils.ignoreCaseEquals(sites[index].name, siteName)) {
        self.cli.output.verbose(util.format($('Site located at %s'), sites[index].webSpace));
        context.site.webspace = sites[index].webSpace;
      }
    }

    if (context.site.webspace === undefined) {
      throw new Error(util.format($('Unable to locate site named %s'), siteName));
    }
  },

  lookupSiteNameAndWebSpace: function (context, _) {
    var self = this;

    self.lookupSiteName(context, _);

    var siteName = WebsitesClient.getSiteName(context.site.name, context.site.slot);
    var cache = cacheUtils.readSite(context.subscription, siteName, _);
    if (cache || context.site.webspace) {
      context.site.webspace = (cache && cache.webSpace) || context.site.webspace;
      return cache;
    }

    self.lookupSiteWebSpace(context, _);

    return context;
  },

  ensureSpaces: function (context, _) {
    var self = this;
    if (!context.spaces) {
      if (!context.skipCache) {
        context.spaces = cacheUtils.readSpaces(context, _);
      }

      if (!context.spaces || !context.spaces.length) {
        context.spaces = self.getSpaces(context, _);
      }
    }
  },

  /////////////////
  // config and settings

  readConfig: function (_) {
    var self = this;

    return {
      name: self.readConfigValue('azure.site.name', _),
      slot: self.readConfigValue('azure.site.slot', _),
      webspace: self.readConfigValue('azure.site.webspace', _)
    };
  },

  writeConfig: function (cfg, _) {
    var self = this;

    self.writeConfigValue('azure.site.name', cfg.name, _);
    if (cfg.slot) {
      self.writeConfigValue('azure.site.slot', cfg.slot, _);
    }

    self.writeConfigValue('azure.site.webspace', cfg.webspace, _);
  },

  readConfigValue: function (name, _) {
    var self = this;

    try {
      var result = exec('git config --get ' + name, _);
      return (result.stdout + result.stderr).trim();
    }
    catch (err) {
      self.cli.output.silly($('Unable to read config'), err);
      return '';
    }
  },

  writeConfigValue: function (name, value, _) {
    exec('git config ' + name + ' ' + value, _);
  }
});

/////////////////
// helper methods

function exec(cmd, cb) {
  /*jshint camelcase:false*/
  child_process.exec(cmd, function (err, stdout, stderr) {
    cb(err, {
      stdout: stdout,
      stderr: stderr
    });
  });
}

module.exports = WebsitesClient;