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

var profile = require('../../util/profile');
var utils = require('../../util/utils');

var allowAzureRuleName = 'AllowAllWindowsAzureIps';
var allowAzureRuleIp = '0.0.0.0';

var azureCommon = require('azure-common');
var SqlAzureConstants = azureCommon.Constants.SqlAzureConstants;

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var log = cli.output;

  var sql = cli.category('sql')
    .description($('Commands to manage your SQL Server accounts'));

  var server = sql.category('server')
    .description($('Commands to manage your SQL Server database servers'));

  server.command('create [administratorLogin] [administratorPassword] [location]')
    .description($('Create a database server'))
    .usage('[options] <administratorLogin> <administratorPassword> <location>')
    .option('--administratorLogin <administratorLogin>', $('the new administrator login'))
    .option('--administratorPassword <administratorPassword>', $('the new administrator password'))
    .option('--location <location>', $('the location'))
    .option('--defaultFirewallRule', $('Add a firewall rule allowing access from Microsoft Azure'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (administratorLogin, administratorPassword, location, options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));
      var managementService = utils.createManagementClient(profile.current.getSubscription(options.subscription));

      administratorLogin = cli.interaction.promptIfNotGiven($('New Administrator login: '), administratorLogin, _);
      administratorPassword = cli.interaction.promptPasswordIfNotGiven($('New administrator password: '), administratorPassword, _);
      location = cli.interaction.chooseIfNotGiven($('Location: '), $('Getting locations'), location,
          function (cb) {
            managementService.locations.list(function (err, result) {
              if (err) { return cb(err); }

              cb(null, result.locations.map(function (location) { return location.name; }));
            });
          }, _);

      var progress = cli.interaction.progress($('Creating SQL Server'));
      var serverName;
      try {
        serverName = sqlService.servers.create({
          administratorUserName: administratorLogin,
          administratorPassword: administratorPassword,
          location: location
        }, _).serverName;
      } finally {
        progress.end();
      }

      if (options.defaultFirewallRule) {
        progress = cli.interaction.progress(util.format($('Creating %s firewall rule'), allowAzureRuleName));
        sqlService.firewallRules.create(serverName, {
          name: allowAzureRuleName,
          startIPAddress: allowAzureRuleIp,
          endIPAddress: allowAzureRuleIp
        }, _);
        progress.end();
      }
      cli.interaction.formatOutput({ name: serverName }, function(outputData) {
        log.data($('Server Name'), outputData.name);
      });
    });

  server.command('show [serverName]')
    .description($('Show server details'))
    .usage('[options] <serverName>')
    .option('--serverName <serverName>', $('the SQL Server name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));

      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);

      var progress = cli.interaction.progress($('Getting SQL server'));
      var servers;
      try {
        servers = sqlService.servers.list(_).servers;
      } finally {
        progress.end();
      }

      var server = servers.filter(function (server) {
        return utils.ignoreCaseEquals(server.name, serverName);
      })[0];

      cli.interaction.formatOutput(server, function(outputData) {
        if(!outputData) {
          log.error($('Server not found'));
        } else {
          cli.interaction.logEachData('SQL Server', server);
        }
      });
    });

  server.command('list')
    .description($('List the servers'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));
      var progress = cli.interaction.progress($('Getting SQL server'));
      var servers;
      try {
        servers = sqlService.servers.list(_).servers;
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(servers, function(outputData) {
        if(outputData.length === 0) {
          log.info($('No SQL Servers exist'));
        } else {
          log.table(servers, function (row, item) {
            row.cell($('Name'), item.name);
            row.cell($('Location'), item.location);
          });
        }
      });
    });

  server.command('delete [serverName]')
    .description($('Delete a server'))
    .usage('[options] <serverName>')
    .option('--serverName <serverName>', $('the SQL Server name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));

      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete server %s? [y/n] '), serverName), _)) {
        return;
      }

      var progress = cli.interaction.progress($('Removing SQL Server'));
      try {
        sqlService.servers.deleteMethod(serverName, _);
      } finally {
        progress.end();
      }
    });

  var firewallrule = sql.category('firewallrule')
    .description($('Commands to manage your SQL Server firewall rules'));

  firewallrule.command('create [serverName] [ruleName] [startIPAddress] [endIPAddress]')
    .description($('Create a firewall rule for a SQL Server'))
    .usage('[options] <serverName> <ruleName> <startIPAddress> <endIPAddress>')
    .option('--serverName <serverName>', $('the SQL Server name'))
    .option('--ruleName <ruleName>', $('the firewall rule name'))
    .option('--startIPAddress <startIPAddress>', $('the starting IP address for the firewall rule'))
    .option('--endIPAddress <endIPAddress>', $('the ending IP address for the firewall rule'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, ruleName, startIPAddress, endIPAddress, options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));

      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);
      ruleName = cli.interaction.promptIfNotGiven($('Rule name: '), ruleName, _);
      startIPAddress = cli.interaction.promptIfNotGiven($('Start IP address: '), startIPAddress, _);

      if (endIPAddress || !startIPAddress) {
        endIPAddress = cli.interaction.promptIfNotGiven($('End IP Address: '), endIPAddress, _);
      } else {
        // Assume end ip address matches start ip address if the later was explicitly passed but not the former
        endIPAddress = startIPAddress;
      }

      try {
        var progress = cli.interaction.progress($('Creating Firewall Rule'));
        try {
          sqlService.firewallRules.create(serverName, {
            name: ruleName,
            startIPAddress: startIPAddress,
            endIPAddress: endIPAddress
          }, _);
        } finally {
          progress.end();
        }
      } catch (e) {
        if (e.code === 'ResourceNotFound') {
          e.message = $('SQL Server and/or firewall rule not found');
        } else {
          e.message = e.message.replace(/[R|r]esource/g, 'SQL Server and/or firewall rule');
        }

        throw e;
      }
    });

  firewallrule.command('show [serverName] [ruleName]')
    .description($('Show firewall rule details'))
    .usage('[options] <serverName> <ruleName>')
    .option('--serverName <serverName>', $('the SQL Server name'))
    .option('--ruleName <ruleName>', $('the firewall rule name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, ruleName, options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));

      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);
      ruleName = cli.interaction.promptIfNotGiven($('Rule name: '), ruleName, _);

      try {
        var progress = cli.interaction.progress($('Getting firewall rule'));
        var rules;
        try {
          rules = sqlService.firewallRules.list(serverName, _).firewallRules;
        } finally {
          progress.end();
        }

        var rule = rules.filter(function (rule) {
          return utils.ignoreCaseEquals(rule.name, ruleName);
        })[0];

        cli.interaction.formatOutput(rule, function(outputData) {
          if(!outputData) {
            log.error($('Firewall Rule not found'));
          } else {
            cli.interaction.logEachData($('Firewall rule'), rule);
          }
        });
      } catch (e) {
        if (e.code == 'ResourceNotFound'|| utils.stringStartsWith(e.message, 'Resource with the name')) {
          throw new Error($('SQL Server and/or firewall rule not found'));
        } else {
          // rethrow
          throw e;
        }
      }
    });

  firewallrule.command('list [serverName]')
    .description($('List the firewall rules'))
    .usage('[options] <serverName>')
    .option('--serverName <serverName>', $('the SQL Server name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));

      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);

      var progress = cli.interaction.progress($('Getting firewall rules'));
      try {
        var rules = sqlService.firewallRules.list(serverName, _).firewallRules;
        cli.interaction.formatOutput(rules, function(outputData) {
          if(outputData.length === 0) {
            log.info($('No Firewall Rules exist'));
          } else {
            log.table(outputData, function (row, item) {
              row.cell($('Name'), item.name);
              row.cell($('Start IP address'), item.startIPAddress);
              row.cell($('End IP address'), item.endIPAddress);
            });
          }
        });
      } catch (e) {
        if (e.code == 'ResourceNotFound'|| utils.stringStartsWith(e.message, 'Resource with the name')) {
          throw new Error($('SQL Server and/or firewall rule not found'));
        } else {
          // rethrow
          throw e;
        }
      } finally {
        progress.end();
      }
    });

  firewallrule.command('delete [serverName] [ruleName]')
    .description($('Delete a firewall rule'))
    .usage('[options] <serverName> <ruleName>')
    .option('--serverName <serverName>', $('the SQL server name'))
    .option('--ruleName <ruleName>', $('the firewall rule name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, ruleName, options, _) {
      var sqlService = utils.createSqlClient(profile.current.getSubscription(options.subscription));

      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);
      ruleName = cli.interaction.promptIfNotGiven($('Rule name: '), ruleName, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete rule %s? [y/n] '), ruleName), _)) {
        return;
      }

      var progress = cli.interaction.progress($('Removing firewall rule'));
      try {
        sqlService.firewallRules.deleteMethod(serverName, ruleName, _);
      } catch (e) {
        if (e.code == 'ResourceNotFound'|| utils.stringStartsWith(e.message, 'Resource with the name')) {
          throw new Error($('SQL Server and/or firewall rule not found'));
        } else {
          // rethrow
          throw e;
        }
      } finally {
        progress.end();
      }
    });

  var db = sql.category('db')
    .description($('Commands to manage your SQL Server databases'));

  db.command('create [serverName] [databaseName] [administratorLogin] [administratorPassword] [collationName] [edition] [maxSizeInGB]')
    .description($('Create a database'))
    .usage('[options] <serverName> <databaseName> <administratorLogin> <administratorPassword> [collationName] [edition] [maxSizeInGB]')
    .option('--serverName <serverName>', $('the SQL server name'))
    .option('--databaseName <databaseName>', $('the database name'))
    .option('--administratorLogin <administratorLogin>', $('the administrator login'))
    .option('--administratorPassword <administratorPassword>', $('the administrator password'))
    .option('--collationName <collationName>', $('the database collation name'))
    .option('--edition <edition>', $('the database edition'))
    .option('--maxSizeInGB <maxSizeInGB>', $('the database maximum size in GB'))
    .option('--location <location>', $('the location'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, databaseName, administratorLogin, administratorPassword, collationName, edition, maxSizeInGB, options, _) {
      var sqlManagementService = utils.createSqlClient(profile.current.getSubscription(options.subscription));

      var useAdminCredentials = administratorLogin || administratorPassword;

      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);
      databaseName = cli.interaction.promptIfNotGiven($('Database name: '), databaseName, _);

      if (useAdminCredentials) {
        administratorLogin = cli.interaction.promptIfNotGiven($('Administrator login: '), administratorLogin, _);
        administratorPassword = cli.interaction.promptPasswordOnceIfNotGiven($('Administrator password: '), administratorPassword, _);
      }
      collationName = collationName;
      edition = edition;
      maxSizeInGB = maxSizeInGB;

      var createFunc;

      var createOptions = setDefaultDbCreationOptions({
        name: databaseName,
        edition: edition,
        maximumDatabaseSizeInGB: maxSizeInGB,
        collationName: collationName
      });

      if (useAdminCredentials) {
        var sqlService = createSqlService(serverName, administratorLogin, administratorPassword);

        createOptions.maxSizeInGB = createOptions.maximumDatabaseSizeInGB;
        delete createOptions.maximumDatabaseSizeInGB;

        createFunc = function (callback) {
          sqlService.createServerDatabase(databaseName, createOptions, callback);
        };
      } else {
        createFunc = function (callback) {
          sqlManagementService.databases.create(serverName, createOptions, callback);
        };
      }

      var progress = cli.interaction.progress($('Creating SQL Server Database'));
      try {
        createFunc(_);
      } catch (e) {
        if (e.code == 'ENOTFOUND') {
          throw new Error($('SQL Server not found'));
        } else {
          // rethrow
          throw e;
        }
      } finally {
        progress.end();
      }
    });

  db.command('list [serverName] [administratorLogin] [administratorPassword]')
    .description($('List the databases'))
    .usage('[options] <serverName> <administratorLogin> <administratorPassword>')
    .option('--serverName <serverName>', $('the SQL server name'))
    .option('--administratorLogin <administratorLogin>', $('the administrator login'))
    .option('--administratorPassword <administratorPassword>', $('the administrator password'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, administratorLogin, administratorPassword, options, _) {
      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);
      administratorLogin = cli.interaction.promptIfNotGiven($('Administrator login: '), administratorLogin, _);
      administratorPassword = cli.interaction.promptPasswordOnceIfNotGiven($('Administrator password: '), administratorPassword, _);

      var sqlService = createSqlService(serverName, administratorLogin, administratorPassword);

      var progress = cli.interaction.progress($('Getting SQL server databases'));
      var databases;
      try {
        databases = sqlService.listServerDatabases(_);
      } finally {
        progress.end();
      }

      cli.interaction.formatOutput(databases, function(outputData) {
        if(outputData.length === 0) {
          log.info($('No SQL Server Databases exist'));
        } else {
          log.table(outputData, function (row, item) {
            row.cell($('Name'), item.Name);
            row.cell($('Edition'), item.Edition);
            row.cell($('Collation'), item.CollationName);
            row.cell($('MaxSizeInGB'), item.MaxSizeGB);
          });
        }
      });
    });

  db.command('show [serverName] [databaseName] [administratorLogin] [administratorPassword]')
    .description($('Show database details'))
    .usage('[options] <serverName> <databaseName> <administratorLogin> <administratorPassword>')
    .option('--serverName <serverName>', $('the SQL server name'))
    .option('--databaseName <databaseName>', $('the database name'))
    .option('--administratorLogin <administratorLogin>', $('the administrator login'))
    .option('--administratorPassword <administratorPassword>', $('the administrator password'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, databaseName, administratorLogin, administratorPassword, options, _) {
      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);
      databaseName = cli.interaction.promptIfNotGiven($('Database name: '), databaseName, _);
      administratorLogin = cli.interaction.promptIfNotGiven($('Administrator login: '), administratorLogin, _);
      administratorPassword = cli.interaction.promptPasswordOnceIfNotGiven($('Administrator password: '), administratorPassword, _);

      var sqlService = createSqlService(serverName, administratorLogin, administratorPassword);
      var database = getDatabase(sqlService, databaseName, _);

      cli.interaction.formatOutput(database, function(outputData) {
        if(!outputData) {
          log.error($('Database not found'));
        } else {
          delete outputData['_'];
          cli.interaction.logEachData('Database', outputData);
        }
      });
    });

  db.command('delete [serverName] [databaseName] [administratorLogin] [administratorPassword]')
    .description($('Delete a database'))
    .usage('[options] <serverName> <databaseName> <administratorPassword>')
    .option('--serverName <serverName>', $('the SQL server name'))
    .option('--databaseName <databaseName>', $('the database name'))
    .option('--administratorLogin <administratorLogin>', $('the administrator login'))
    .option('--administratorPassword <administratorPassword>', $('the administrator password'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (serverName, databaseName, administratorLogin, administratorPassword, options, _) {
      serverName = cli.interaction.promptIfNotGiven($('Server name: '), serverName, _);
      databaseName = cli.interaction.promptIfNotGiven($('Database name: '), databaseName, _);
      administratorLogin = cli.interaction.promptIfNotGiven($('Administrator login: '), administratorLogin, _);
      administratorPassword = cli.interaction.promptPasswordOnceIfNotGiven($('Administrator password: '), administratorPassword, _);

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete database %s? [y/n] '), databaseName), _)) {
        return;
      }

      var sqlService = createSqlService(serverName, administratorLogin, administratorPassword);
      var database = getDatabase(sqlService, databaseName, _);

      if (database) {
        var progress = cli.interaction.progress($('Removing database'));
        sqlService.deleteServerDatabase(database.Id, _);
        progress.end();
      } else {
        throw new Error(util.format($('Database with name "%s" does not exist'), databaseName));
      }
    });

  function createSqlService(serverName, administratorLogin, administratorPassword) {
    return utils.createSqlService(serverName, administratorLogin, administratorPassword);
  }

  function setDefaultDbCreationOptions(opts) {
    if (!opts.edition) {
      opts.edition = SqlAzureConstants.WEB_EDITION;
    }

    if (!opts.maximumDatabaseSizeInGB) {
      if (opts.edition === SqlAzureConstants.WEB_EDITION) {
        opts.maximumDatabaseSizeInGB = SqlAzureConstants.WEB_1GB;
      } else {
        opts.maximumDatabaseSizeInGB = SqlAzureConstants.BUSINESS_10GB;
      }
    }

    if (!opts.collationName) {
      opts.collationName = SqlAzureConstants.DEFAULT_COLLATION_NAME;
    }

    return opts;
  }

  function getDatabase(sqlService, databaseName, _) {
    var progress = cli.interaction.progress($('Getting SQL server databases'));
    var databases;

    try {
      databases = sqlService.listServerDatabases(_);
    } finally {
      progress.end();
    }

    return databases.filter(function (database) {
      return utils.ignoreCaseEquals(database.Name, databaseName);
    })[0];
  }
};