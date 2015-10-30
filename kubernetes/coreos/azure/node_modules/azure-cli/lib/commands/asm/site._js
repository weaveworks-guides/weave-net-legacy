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

var async = require('async');
var util = require('util');

var profile = require('../../util/profile');
var utils = require('../../util/utils');

var cacheUtils = require('../../util/cacheUtils');
var kuduscript = require('kuduscript');

var WebsitesClient = require('./websites/websitesclient');

var linkedRevisionControl = require('../../util/git/linkedrevisioncontrol');
var validation = require('../../util/validation');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var site = cli.category('site')
    .description($('Commands to manage your Web Sites'));

  var getSiteLocation = function (locations, site) {
    var webspace = locations.filter(function (l) {
      return utils.ignoreCaseEquals(l.name, site.webSpace);
    })[0];

    if (webspace) {
      return webspace.geoRegion;
    }

    // Should not really happen, but if it fails to find the webspace, show its name
    return site.webSpace;
  };

  site.command('list [name]')
        .description($('List your web sites'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id
          };

          context.skipCache = true;
          ensureSpaces(context, _);
          var sites = site.doSitesGet(context, _);

          if (name) {
            sites = sites.filter(function (s) {
              var currentSiteName = WebsitesClient.parseSiteName(s.name);
              return utils.ignoreCaseEquals(currentSiteName.name, name);
            });
          }

          cli.interaction.formatOutput(sites, function (data) {
            if (data.length > 0) {
              log.table(data, function (row, item) {
                var parsedName = WebsitesClient.parseSiteName(item.name);
                row.cell($('Name'), parsedName.name);
                row.cell($('Slot'), parsedName.slot ? parsedName.slot : '');
                row.cell($('Status'), item.state);
                row.cell($('Location'), getSiteLocation(context.spaces, item));
                row.cell($('SKU'), item.sku);
                row.cell($('URL'), item.hostNames);
              });
            } else {
              log.info($('No sites created yet. You can create new sites using "azure site create" or through the portal'));
            }
          });
        });

  site.command('set [name]')
        .description($('Set configuration options for your web site [name]'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('--net-version <net-version>', $('the .NET version. Valid options are v3.5 and v4.5'))
        .option('--php-version <php-version>', $('the PHP version. Valid options are off, v5.4, v5.5 and v5.6'))
        .option('--platform <platform>', $('the platform. Valid options are x86 and x64'))
        .option('-w, --web-socket', $('use this flag to enable web sockets'))
        .option('-W, --disable-web-socket', $('use this flag to disable web sockets'))
        .option('-r, --remote-debugging', $('use this flag to enable remote debugging'))
        .option('-R, --disable-remote-debugging', $('use this flag to disable remote debugging'))
        .option('-d, --remote-debugging-version <remote-debugging-version>', $('the version of remote debugging. It\'s either VS2012 or VS2013. This parameter is only valid when remote debugging is on.'))
        .option('-m, --managed-pipeline-mode <managed-pipeline-mode>', $('the mode for managed pipeline. valid values are Classic and Integrated.'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
      var parsedSiteName = WebsitesClient.parseSiteName(name);
      var context = {
        subscription: profile.current.getSubscription(options.subscription).id,
        site: {
          name: parsedSiteName.name,
          slot: options.slot ? options.slot : parsedSiteName.slot
        }
      };

      if (options.netVersion) {
        validation.isValidEnumValue(options.netVersion, [ '3.5', '4.5' ]);
      }

      if (options.phpVersion) {
        validation.isValidEnumValue(options.phpVersion, [ 'off', '5.4', '5.5', '5.6' ]);
      }

      if (options.platform) {
        validation.isValidEnumValue(options.platform, [ 'x86', 'x64' ]);
      }

      if (options.remoteDebuggingVersion && !options.remoteDebugging) {
        throw new Error($('remote-debugging-version can only be set if remote-debugging is also used'));
      }

      site.lookupSiteNameAndWebSpace(context, _);
      var siteConfigurations = {};

      if (options.netVersion) {
        siteConfigurations.netFrameworkVersion = options.netVersion === '3.5' ? 'v2.0' : 'v4.0';
      }

      if (options.phpVersion) {
        if (options.phpVersion.toLowerCase() === 'off') {
          options.phpVersion = ' ';
        }

        siteConfigurations.phpVersion = options.phpVersion;
      }

      if (options.platform) {
        siteConfigurations.use32BitWorkerProcess = (options.platform === 'x86') ? 'true' : 'false';
      }

      if (options.webSocket || options.disableWebSocket) {
        siteConfigurations.webSocketsEnabled = (options.webSocket === true).toString();
      }

      if (options.remoteDebugging || options.disableRemoteDebugging) {
        siteConfigurations.remoteDebuggingEnabled = (options.remoteDebugging === true).toString();
      }

      if (options.remoteDebuggingVersion) {
        validation.isValidEnumValue(options.remoteDebuggingVersion, [ 'VS2012', 'VS2013' ]);
        siteConfigurations.remoteDebuggingVersion = options.remoteDebuggingVersion.toLowerCase() === 'vs2012' ? 'VS2012' : 'VS2013';
      }

      if (options.managedPipelineMode) {
        validation.isValidEnumValue(options.managedPipelineMode, [ 'Integrated', 'Classic' ]);
        siteConfigurations.managedPipelineMode = options.managedPipelineMode.toLowerCase() === 'integrated' ? 'Integrated' : 'Classic';
      }

      if (Object.getOwnPropertyNames(siteConfigurations) === 0) {
        throw new Error($('Command needs to perform at least one configuration change'));
      }

      site.doSiteConfigPUT(siteConfigurations, context, _);
    });

  // Handle deployment script command (azure site deploymentscript)
  var deploymentScriptCommand = site.command('deploymentscript');
  kuduscript.addDeploymentScriptOptions(deploymentScriptCommand);
  deploymentScriptCommand.execute(function (name, options, _) {
    for (var option in deploymentScriptCommand.optionValues) {
      deploymentScriptCommand[option] = deploymentScriptCommand.optionValues[option];
    }

    kuduscript.deploymentScriptExecute(name, deploymentScriptCommand, log, function () { cli.interaction.confirm.apply(cli.interaction, arguments); } , _);
  });

  site.command('create [name]')
        .description($('Create a web site'))
        .option('--location <location>', $('the geographic region to create the website'))
        .option('--hostname <hostname>', $('the custom host name to use'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('--git', $('Configure git on web site and local folder'))
        .option('--gitusername <gitusername>', $('the publishing username for git'))
        .option('--github', $('Configure github on web site and local folder'))
        .option('--githubusername <username>', $('the github username'))
        .option('--githubpassword <password>', $('the github password'))
        .option('--githubrepository <repository>', $('the github repository full name (i.e. user/repository)'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (nameArg, options, _) {
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            git: options.git,
            site: {
              name: nameArg,
              location: options.location,
              hostname: options.hostname
            },
            flags: { }
          };

          if (!WebsitesClient.isProductionSlot(options.slot)) {
            context.site.slot = options.slot;
          }

          if (options.git && options.github) {
            throw new Error($('Please run the command with either --git or --github options. Not both'));
          }

          if (options.git) {
            context.publishingUser = options.gitusername;
          } else if (options.github) {
            context.github = {
              username: options.githubusername,
              password: options.githubpassword,
              repositoryFullName: options.githubrepository
            };
          }

          var websiteClient = new WebsitesClient(cli, context.subscription);

          // Start by creating the site
          promptForSiteName(_);

          determineIfSiteAndSlotExists(_);

          if (!context.flags.siteExists && context.site.slot) {
            throw new Error($('Can\'t create a slot for a site that does not exist'));
          }

          promptForLocation(_);

          if (utils.stringIsNullOrEmpty(context.site.location)) {
            throw new Error($('Invalid location'));
          }

          if (context.site.slot) {
            createSiteSlot(_);
          } else {
            createSite(_);
          }

          // Init git / github linking
          if (options.git || options.github) {
            if (options.github) {
              context.lvcClient = linkedRevisionControl.createClient(cli, 'github', websiteClient);
            } else if (options.git) {
              context.lvcClient = linkedRevisionControl.createClient(cli, 'git', websiteClient);
            }

            context.lvcClient.init(context, _);

            // Scaffold
            utils.copyIisNodeWhenServerJsPresent(log, '.', _);
            updateLocalConfigWithSiteName(_);
            context.lvcClient.deploy(context, _);
          } else {
            // Make sure there is a gitignore with publishsettings if we are within
            // a git repository
            context.lvcClient = linkedRevisionControl.createClient(cli, 'git', websiteClient);
            context.lvcClient.determineIfCurrentDirectoryIsGitWorkingTree(context, _);

            if (context.flags.isGitWorkingTree) {
              context.lvcClient.scaffoldGitIgnore(_);
            }
          }

          function promptForSiteName(_) {
            log.silly('promptForSiteName');
            if (context.site.name === undefined) {
              log.help($('Need a site name'));
              context.site.name = cli.interaction.prompt($('Name: '), _);
            }
          }

          function determineIfSiteAndSlotExists(_) {
            log.silly('determineIfSiteAndSlotExists');
            var sites = site.doSitesGet(context, _);

            var siteHits = sites.filter(function (item) {
              return utils.ignoreCaseEquals(item.name, context.site.name);
            });

            if (siteHits.length === 1) {
              log.info($('Updating existing site'));
              context.flags.siteExists = true;
              if (context.site.webspace === undefined) {
                context.site.webspace = siteHits[0].webSpace;
                log.verbose(util.format($('Existing site location is %s'), context.site.webspace));
              } else {
                ensureSpaces(context, _);
                var displayNameMatches = context.spaces.filter(function (space) {
                  return space.GeoRegion === context.site.webspace;
                })[0];

                if (displayNameMatches && displayNameMatches.Name !== siteHits[0].WebSpace) {
                  throw new Error(util.format($('Expected location %s but was %s'), context.site.webspace, displayNameMatches.GeoRegion));
                }
              }
            }

            if (context.site.slot) {
              var slotHits = sites.filter(function (item) {
                return utils.ignoreCaseEquals(item.name, WebsitesClient.getSiteName(context.site.name, context.site.slot));
              });

              if (slotHits.length === 0) {
                if (siteHits.length === 1) {
                  log.info($('Adding slot to existing site'));

                  if (context.site.webspace === undefined) {
                    context.site.webspace = siteHits[0].webSpace;
                    log.verbose(util.format($('Existing site location is %s'), context.site.webspace));
                  } else {
                    ensureSpaces(context, _);
                    var displaySlotNameMatches = context.spaces.filter(function (space) {
                      return space.GeoRegion === context.site.webspace;
                    })[0];

                    if (displaySlotNameMatches && displaySlotNameMatches.Name !== siteHits[0].WebSpace) {
                      throw new Error(util.format($('Expected location %s but was %s'), context.site.webspace, displaySlotNameMatches.GeoRegion));
                    }
                  }
                }
              } else {
                context.flags.siteSlotExists = true;
              }
            }
          }

          function promptForLocation(_) {
            log.silly('promptForLocation');
            ensureSpaces(context, _);

            var locations = site.doAvailableLocationsGet(context, _);
            var location = null;

            if (!context.site.location && !context.site.webspace) {
              log.help($('Choose a location'));
              location = locations[cli.interaction.choose(locations.map(function (location) {
                return location.name;
              }), _)];
            } else if (context.site.location) {
              // Map user-provided value to GeoRegion display name, if unique match exists
              location = locations.filter(function (loc) {
                return utils.ignoreCaseEquals(loc.name, context.site.location);
              })[0];
            } else {
              location = locations.filter(function (loc) {
                return utils.ignoreCaseEquals(loc.webSpace, context.site.webspace);
              })[0];
            }

            if (!location) {
              throw new Error($('Invalid location'));
            }

            context.site.location = location.name;
            context.site.webspace = location.webSpace;
          }

          function updateLocalConfigWithSiteName(_) {
            log.silly('updateLocalConfigWithSiteName');
            if (context.flags.isGitWorkingTree) {
              var cfg = websiteClient.readConfig(_);
              cfg.name = context.site.name;
              cfg.slot = context.site.slot || WebsitesClient.getProductionSlotName();
              cfg.webspace = context.site.webspace;
              websiteClient.writeConfig(cfg, _);
            }
          }

          function createSite(_) {
            log.silly('createSite');
            if (!context.flags.siteExists) {
              var site = {
                name: context.site.name,
                webSpaceName: context.site.webspace,
                webSpace: {
                  name: context.site.webspace,
                  geoRegion: context.site.location,
                  plan: 'VirtualDedicatedPlan'
                },
                serverFarm: ''
              };

              var websiteAddress = context.site.name + '.' + websiteClient.getHostNameSuffix(context.subscription, _);
              if (context.site.hostNames) {
                site.hostNames.push(websiteAddress);
              } else if (websiteAddress) {
                site.hostNames = [ websiteAddress ];
              }

              return websiteClient.createSite(context.subscription, context.site.webspace, site, _);
            }
          }

          function createSiteSlot(_) {
            log.silly('createSiteSlot');
            if (context.site.slot && !context.flags.siteSlotExists) {
              var site = {
                name: WebsitesClient.getSiteName(context.site.name, context.site.slot),
                webSpaceName: context.site.webspace,
                serverFarm: ''
              };

              return websiteClient.createSite(context.subscription, context.site.webspace, site, _);
            }
          }
        });

  var location = site.category('location')
        .description($('Commands to manage your Web Site locations'));

  location.command('list')
        .description($('List locations available for your account'))
        .execute(function (options, _) {
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id
          };

          var locations = site.doAvailableLocationsGet(context, _);
          log.table(locations, function (row, item) {
            row.cell($('Name'), item.name);
          });
        });

  site.command('browse [name]')
        .description($('Open your web site in a browser'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
          var parsedSiteName = WebsitesClient.parseSiteName(name);
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            site: {
              name: parsedSiteName.name,
              slot: options.slot ? options.slot : parsedSiteName.slot
            }
          };

          var cache = site.lookupSiteNameAndWebSpace(context, _);
          var siteData = cache || site.doSiteGet(context, _);

          if (siteData && siteData.hostNames && siteData.hostNames.length > 0) {
            var href = 'http://' + siteData.hostNames[0];
            cli.interaction.launchBrowser(href, _);
          } else {
            throw new Error(util.format('Site %s does not exist or has no hostnames', name));
          }
        });

  site.command('show [name]')
        .description($('Show details for a web site'))
        .option('-d, --details', $('show additional site details'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
          var parsedSiteName = WebsitesClient.parseSiteName(name);
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            site: {
              name: parsedSiteName.name,
              slot: options.slot ? options.slot : parsedSiteName.slot
            }
          };

          var websiteClient = new WebsitesClient(cli, context.subscription);
          site.lookupSiteNameAndWebSpace(context, _);

          log.info($('Showing details for site'));
          log.verbose($('Parameters'), context);

          var result = async.parallel([
            function (_) { return site.doSiteGet(context, _); },
            function (_) { return site.doSiteConfigGet(context, _); }
          ], _);

          var repositoryUri = websiteClient.getRepositoryUri(result[0]);
          var gitUri = repositoryUri ? websiteClient.getGitUri(repositoryUri, context.site.name) : 'none';

          var settings = [];
          var diagnosticsSettings = {};

          if (repositoryUri) {
            try {
              site.ensureRepositoryUri(context, _);
              settings = site.category('repository').doSettingsGet(context, _);
              diagnosticsSettings = websiteClient.getDiagnosticsSettings(context, _);
            } catch (e) {
              // Do nothing if not possible to get SCM settings
              log.verbose('SCM Error', e.message.toString());
            }
          }

          var siteInstances;
          try {
            siteInstances = site.doSiteInstancesGet(context, _);
          } catch (e) {
            // Temporary workaround for issue where slots are not supported with this API (yet).
            siteInstances = [];
          }

          if (log.format().json) {
            var data = {
              site: result[0],
              config: result[1],
              gitRepositoryUri: gitUri,
              settings: settings,
              diagnosticsSettings: diagnosticsSettings,
              instances: siteInstances
            };

            log.json(data);
          } else {
            var showProperty = function (source, name, property, defaultValue) {
              if (source[property]) {
                log.data(name, source[property].toString());
                delete source[property];
              } else if(defaultValue) {
                log.data(name, defaultValue);
              } else {
                log.data(name, '');
              }
            };

            // General site data
            context.skipCache = true;
            ensureSpaces(context, _);

            log.data('');
            showProperty(result[0], $('Web Site Name: '), 'name');
            log.data($('SKU:     '), result[0].sku);
            showProperty(result[0], $('Enabled:       '), 'enabled');
            showProperty(result[0], $('Availability:  '), 'availabilityState');
            showProperty(result[0], $('Last Modified: '), 'lastModifiedTimeUtc', $('Never'));
            log.data($('Location:      '), getSiteLocation(context.spaces, result[0]));

            // Host Names
            if (result[0].hostNames && result[0].hostNames.length > 0) {
              log.data('');
              log.table(result[0].hostNames, function (row, s) {
                row.cell($('Host Name'), s);
              });
            }

            delete result[0].hostNames;

            // SSL Host Names
            if (result[0].sslCertificates && result[0].sslCertificates.length > 0) {
              log.data('');
              log.table(Object.keys(result[0].sslCertificates), function (row, certificate) {
                for (var hostname in certificate.hostNames) {
                  row.cell($('SSL Host Names'), hostname);
                }
              });
            }

            delete result[0].sslCertificates;

            // Instances
            if (siteInstances && siteInstances.length > 0) {
              log.data('');
              log.table(siteInstances, function (row, instanceId) {
                row.cell($('Instance Id'), instanceId);
              });
            }

            // App Settings
            if (result[1].appSettings && Object.keys(result[1].appSettings).length > 0) {
              log.data('');
              log.table(Object.keys(result[1].appSettings), function (row, s) {
                row.cell($('App Setting'), s);
                row.cell($('Value'), result[1].appSettings[s]);
              });
            }

            delete result[1].appSettings;

            // Default Documents
            if (result[1].defaultDocuments && result[1].defaultDocuments.length > 0) {
              log.data('');
              log.table(result[1].defaultDocuments, function (row, s) {
                row.cell($('Default Documents'), s);
              });
            }

            delete result[1].defaultDocuments;

            // Platform & Frameworks
            log.data('');
            log.data($('Platform & Frameworks'));
            log.data($('---------------------'));
            showProperty(result[1], $('.NET Framework Version:    '), 'netFrameworkVersion');
            showProperty(result[1], $('PHP Version:               '), 'phpVersion');
            log.data($('Work Process:              '), result[1].use32BitWorkerProcess ? '32-bit' : '64-bit');
            showProperty(result[1], $('Worker Count:              '), 'numberOfWorkers');
            log.data($('WebSockets enabled:        '), result[1].webSocketsEnabled ? 'true' : 'false');
            delete result[1].use32BitWorkerProcess;

            // Logging and Diagnostics
            log.data('');
            log.data($('Logging and Diagnostics'));
            log.data($('-----------------------'));
            showProperty(result[1], $('HTTP Logging:  '), 'httpLoggingEnabled');

            // Source Control
            if (result[1].defaultDocuments && result[1].defaultDocuments.length > 0) {
              log.data('');
              log.table(result[1].defaultDocuments, function (row, s) {
                row.cell($('Source Control'), s);
              });
            }

            delete result[1].defaultDocuments;

            if (settings && settings.ScmType) {
              log.data('');
              log.data($('Source Control'));
              log.data($('--------------'));
              log.data($('Type:           '), settings.ScmType);
              log.data($('Git Repository: '), gitUri);
              /*jshint camelcase:false*/
              log.data($('Branch:         '), settings.deployment_branch);
              /*jshint camelcase:true*/
              ['ScmType', 'SCM_GIT_USERNAME', 'deployment_branch'].forEach(function (key) {
                delete settings[key];
              });
            }

            if (options.details) {
              log.data('');
              log.data($('Additional properties and settings'));
              log.data($('----------------------------------'));

              cli.interaction.logEachData($('Site'), result[0]);
              cli.interaction.logEachData($('Config'), result[1]);

              for (var index in settings) {
                log.data($('Settings') + ' ' + index, settings[index]);
              }

              for (var dSetting in diagnosticsSettings) {
                log.data($('Diagnostics Settings ') + dSetting, diagnosticsSettings[dSetting].toString());
              }
            }
          }
        });

  site.command('delete [name]')
        .description($('Delete a web site'))
        .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
          var parsedSiteName = WebsitesClient.parseSiteName(name);
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            site: {
              name: parsedSiteName.name,
              slot: options.slot ? options.slot : parsedSiteName.slot
            }
          };

          if (WebsitesClient.isProductionSlot(options.slot)) {
            delete options.slot;
          }

          site.lookupSiteNameAndWebSpace(context, _);

          if (!options.quiet) {
            if (!context.site.slot) {
              if (!cli.interaction.confirm(util.format('Delete site %s? [y/n] ', context.site.name), _)) {
                return;
              }
            } else if (!cli.interaction.confirm(util.format('Delete site %s in slot %s? [y/n] ', context.site.name, context.site.slot), _)) {
              return;
            }
          }

          var progress = cli.interaction.progress($('Deleting site'));
          try {
            var service = createWebsiteManagementService(context.subscription, _);

            var siteName = WebsitesClient.getSiteName(context.site.name, context.site.slot);
            service.webSites.deleteMethod(context.site.webspace, siteName, {
                deleteMetrics: true,
                deleteEmptyServerFarm: true,
                deleteAllSlots: !options.slot
              }, _);

            cacheUtils.deleteSite(context.subscription, siteName, _);
          } finally {
            progress.end();
          }

          log.info(util.format($('Site %s has been deleted'), context.site.name));
        });

  site.command('swap <name> [slot1] [slot2]')
        .description($('Swap two web site slots'))
        .option('-q, --quiet', $('quiet mode, do not ask for swap confirmation'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, slot1, slot2, options, _) {
          var parsedSiteName = WebsitesClient.parseSiteName(name);
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            site: {
              name: parsedSiteName.name
            }
          };

          if (parsedSiteName.slot) {
            throw new Error($('Slot should not be passed in the site name'));
          }

          site.lookupSiteNameAndWebSpace(context, _);

          var sites = site.doSitesGet(context, _);

          var slots = [];

          sites.forEach(function(s) {
            var currentSiteName = WebsitesClient.parseSiteName(s.name);
            if (utils.ignoreCaseEquals(currentSiteName.name, parsedSiteName.name)) {
              slots.push(currentSiteName.slot || WebsitesClient.getProductionSlotName());
            }
          });

          var verifySlotExists = function (slot) {
            if (!slots.some(function (s) {
              return utils.ignoreCaseEquals(slot, s);
            })) {
              throw new Error(util.format($('The website does not contain a slot named: %s'), slot));
            }
          };

          if (slots.length < 2) {
            throw new Error($('The website must have at least two slots to apply swap'));
          } else if (slots.length > 2 && (!slot1 || !slot2)) {
            throw new Error($('The website has more than 2 slots you must specify which ones to swap'));
          }

          if (slot1) {
            verifySlotExists(slot1);
          }

          if (slot2) {
            verifySlotExists(slot2);
          }

          if (slots.length === 2) {
            // Independently of what the user passed,
            // there's only two slots, so switch those ones
            slot1 = slots[0];
            slot2 = slots[1];
          } else if (utils.ignoreCaseEquals(slot1, slot2)) {
            throw new Error($('Specified slots must be different'));
          }

          if (!options.quiet && !cli.interaction.confirm(util.format($('Swap slot "%s" from site "%s" with slot "%s" ? [y/n] '), slot1, context.site.name, slot2), _)) {
            return;
          }

          var progress = cli.interaction.progress(util.format($('Swapping slot "%s" from site "%s" with slot "%s"'), slot1, context.site.name, slot2));
          try {
            var service = createWebsiteManagementService(context.subscription, _);

            service.webSites.swapSlots(context.site.webspace, context.site.name, slot1, slot2, _);
          } finally {
            progress.end();
          }

          log.info(util.format($('Site "%s" slots has been swapped'), context.site.name));
        });

  site.command('start [name]')
        .description($('Start a web site'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
          var parsedSiteName = WebsitesClient.parseSiteName(name);
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            site: {
              name: parsedSiteName.name,
              slot: options.slot ? options.slot : parsedSiteName.slot
            }
          };

          site.lookupSiteNameAndWebSpace(context, _);

          log.info(util.format($('Starting site %s'), context.site.name));

          site.doSitePUT(context, { state: 'Running' }, _);

          log.info(util.format($('Site %s has been started'), context.site.name));
        });

  site.command('stop [name]')
        .description($('Stop a web site'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
          var parsedSiteName = WebsitesClient.parseSiteName(name);
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            site: {
              name: parsedSiteName.name,
              slot: options.slot ? options.slot : parsedSiteName.slot
            }
          };

          site.lookupSiteNameAndWebSpace(context, _);

          log.info('Stopping site', context.site.name);

          site.doSitePUT(context, { state: 'Stopped' }, _);

          log.info('Site ' + context.site.name + ' has been stopped');
        });

  site.command('restart [name]')
        .description($('Stop and then start a web site'))
        .option('--slot <slot>', $('the name of the slot'))
        .option('-s, --subscription <id>', $('the subscription id'))
        .execute(function (name, options, _) {
          var parsedSiteName = WebsitesClient.parseSiteName(name);
          var context = {
            subscription: profile.current.getSubscription(options.subscription).id,
            site: {
              name: parsedSiteName.name,
              slot: options.slot ? options.slot : parsedSiteName.slot
            }
          };

          site.lookupSiteNameAndWebSpace(context, _);

          log.info(util.format($('Stopping site %s'), context.site.name));
          site.doSitePUT(context, { state: 'Stopped' }, _);

          log.info(util.format($('Site %s has been stopped, restarting'), context.site.name));
          site.doSitePUT(context, { state: 'Running' }, _);
          log.info(util.format($('Site %s has been restarted'), context.site.name));
        });

  // TODO: remove all these "site."" function and just call websiteClient directly.
  site.lookupSiteNameAndWebSpace = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.lookupSiteNameAndWebSpace(options, callback);
  };

  var ensureSpaces = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.ensureSpaces(options, callback);
  };

  site.doRepositoryPost = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.createRepository(options, callback);
  };

  site.doRepositoryGet = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.getRepository(options, callback);
  };

  site.doRepositoryDelete = function(options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.deleteRepository(options, callback);
  };

  site.doRepositorySync = function(options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.syncRepository(options, callback);
  };

  site.ensureRepositoryUri = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.ensureRepositoryUri(options, callback);
  };

  site.doAvailableLocationsGet = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.getAvailableLocations(options, callback);
  };

  site.doSpacesGet = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.getSpaces(options, callback);
  };

  site.doSitesGet = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.getSites(options, callback);
  };

  site.doSiteGet = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.getSite(options, callback);
  };

  site.doSiteInstancesGet = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.getSiteInstances(options, callback);
  };

  site.doSiteConfigGet = function (options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.getSiteConfiguration(options, callback);
  };

  site.doSitePUT = function (options, site, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.updateSite(site, options, callback);
  };

  site.doSiteConfigPUT = function (config, options, callback) {
    var websiteClient = new WebsitesClient(cli, options.subscription);
    return websiteClient.updateSiteConfiguration(config, options, callback);
  };

  function createWebsiteManagementService(subscription, callback) {
    return utils.createWebsiteClient(profile.current.getSubscription(subscription), callback);
  }
};
