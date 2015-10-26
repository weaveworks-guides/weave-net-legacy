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

// Camel case checks disabled because the identifier secret_ops is part of spec and can't be changed.
/*jshint camelcase:false */

var util = require('util');

var profile = require('../../../util/profile');
var utils = require('../../../util/utils');
var kvUtils = require('./kv-utils');
var kvLegacy = require('./kv-legacy');

var $ = utils.getLocaleString;

exports.init = function(cli) {
  var log = cli.output;

  var secret = cli.category('keyvault').category('secret')
    .description($('Commands to manage secrets in the Azure Key Vault service'));

  secret.command('list [vault-name]')
    .description($('Lists secrets of a vault'))
    .usage('[--vault-name] <vault-name> [options]')
    .option('-u, --vault-name <vault-name>', $('the vault name'))
    .execute(function(vaultName, options, _) {

      ///////////////////////
      // Parse arguments.  //
      ///////////////////////

      log.verbose('arguments: ' + JSON.stringify({
        vaultName: vaultName,
        options: options
      }));

      options.vaultName = options.vaultName || vaultName;

      if (!options.vaultName) {
        return cli.missingArgument('vault-name');
      }

      ////////////////////////////////////////////
      // Create the client and list secrets.       //
      ////////////////////////////////////////////

      var client = createClient(options);

      var secrets = [];
      var progress = cli.interaction.progress(util.format($('Loading secrets of vault %s'), options.vaultUri));
      try {
        var result = client.secrets.list(options.vaultUri, null, _);
        for (;;) {
          if (result.value && result.value.length) {
            secrets = secrets.concat(result.value);
          }
          if (!result.nextLink) {
            break;
          }
          log.verbose(util.format($('Found %d secrets, loading more'), secrets.length));
          result = client.secrets.listNext(result.nextLink, _);
        }
      } finally {
        progress.end();
      }

      log.table(secrets, showSecretRow);

      log.info(util.format($('Found %d secrets'), secrets.length));
    });

  secret.command('list-versions [vault-name] [secret-name]')
    .description($('Lists secret versions'))
    .usage('[--vault-name] <vault-name> [[--secret-name] <secret-name>] [options]')
    .option('-u, --vault-name <vault-name>', $('the vault name'))
    .option('-s, --secret-name <secret-name>', $('lists only versions of this secret'))
    .execute(function(vaultName, secretName, options, _) {

      ///////////////////////
      // Parse arguments.  //
      ///////////////////////

      log.verbose('arguments: ' + JSON.stringify({
        vaultName: vaultName,
        secretName: secretName,
        options: options
      }));

      options.vaultName = options.vaultName || vaultName;
      options.secretName = options.secretName || secretName;

      if (!options.vaultName) {
        return cli.missingArgument('vault-name');
      }

      ////////////////////////////////////////////
      // Create the client and list secrets.       //
      ////////////////////////////////////////////

      var client = createClient(options);

      var secrets;
      var progress;
      if (!options.secretName) {
        secrets = [];
        progress = cli.interaction.progress(util.format($('Loading secrets of vault %s'), options.vaultUri));
        try {
          var result = client.secrets.list(options.vaultUri, null, _);
          for (;;) {
            var items = result.value;
            if (items && items.length) {
              for (var i = 0; i < items.length; ++i) {
                var secretIdentifier = kvUtils.parseSecretIdentifier(items[i].id);
                var secretVersions = getSecretVersions(client, secretIdentifier.vaultUri, secretIdentifier.name, _);
                secrets = secrets.concat(secretVersions);
              }
            }
            if (!result.nextLink) {
              break;
            }
            log.verbose(util.format($('Found %d secrets, loading more'), secrets.length));
            result = client.secrets.listNext(result.nextLink, _);
          }
        } finally {
          progress.end();
        }
      } else {
        progress = cli.interaction.progress(util.format($('Loading secrets of vault %s'), options.vaultUri));
        try {
          secrets = getSecretVersions(client, options.vaultUri, options.secretName, _);
        } finally {
          progress.end();
        }
      }

      log.table(secrets, showSecretRow);

      log.info(util.format($('Found %d secrets'), secrets.length));
    });

  secret.command('set [vault-name] [secret-name] [secret-value]')
    .description($('Stores a secret on the vault'))
    .usage('[--vault-name] <vault-name> [--secret-name] <secret-name> [--value] <secret-value> [options]')
    .option('-u, --vault-name <vault-name>', $('the vault name'))
    .option('-s, --secret-name <secret-name>', $('name of the secret to be created; if already exists, a new secret version is created'))
    .option('-s, --value <secret-value>', $('the secret value'))
    .option('--enabled <boolean>', $('tells if the secret should be enabled; valid values: [false, true]; default is true'))
    .option('-e, --expires <datetime>', $('expiration time of secret, in UTC format'))
    .option('-n, --not-before <datetime>', $('time before which secret cannot be used, in UTC format'))
    .option('-t, --tags <tags>', $('Tags to set on the secret. Can be multiple in the format \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
    .execute(function(vaultName, secretName, value, options, _) {

      ///////////////////////
      // Parse arguments.  //
      ///////////////////////

      var secretVersion; // must be undefined on this command.
      parseSecretPropertiesArguments(vaultName, secretName, secretVersion, value, options, true);

      /////////////////////////////////////////////////
      // Perform the request.                        //
      /////////////////////////////////////////////////

      var client = createClient(options);

      var request = {
        value: options.value,
        attributes: {
          enabled: options.enabled,
          nbf: options.notBefore,
          exp: options.expires
        },
        tags: options.tags
      };

      log.verbose('request: ' + JSON.stringify(request));

      var secret;
      var secretIdentifier = getSecretIdentifier(options);
      var progress = cli.interaction.progress(util.format($('Creating secret %s'), secretIdentifier));
      try {
        secret = client.secrets.set(secretIdentifier, request, _);
      } finally {
        progress.end();
      }

      showSecret(secret);
    });

  secret.command('set-attributes [vault-name] [secret-name] [secret-version]')
    .description($('Changes attributes of an existing secret'))
    .usage('[--vault-name] <vault-name> [--secret-name] <secret-name> [[--secret-version] <secret-version>] [options]')
    .option('-u, --vault-name <vault-name>', $('the vault name'))
    .option('-s, --secret-name <secret-name>', $('name of the secret to be modified'))
    .option('-r, --secret-version <secret-version>', $('the version to be modified; if ommited, modifies only the most recent'))
    .option('--enabled <boolean>', $('if informed, command will change the enabled state; valid values: [false, true]'))
    .option('-e, --expires <datetime>', $('if informed, command will change secret expiration time; must be a date in UTC format or null'))
    .option('-n, --not-before <datetime>', $('if informed, command will change time before which secret cannot be used; must be a date in UTC format or null'))
    .option('-t, --tags <tags>', $('Tags to set on the secret. Can be multiple in the format \'name=value\'. Name is required and value is optional. For example, -t tag1=value1;tag2'))
    .option('--reset-tags', $('remove previously existing tags; can combined with --tags'))
    .execute(function(vaultName, secretName, secretVersion, options, _) {

      ///////////////////////
      // Parse arguments.  //
      ///////////////////////

      // Detect informed parameters.
      var informed = {
        enabled: options.enabled || false,
        expires: options.expires || false,
        notBefore: options.notBefore || false,
        secretOps: options.secretOps || false,
        tags: options.tags || false,
        resetTags: options.resetTags || false
      };

      parseSecretPropertiesArguments(vaultName, secretName, secretVersion, null, options, false);

      //////////////////////////////////////////////////////
      // Deal with tags. Load existing vault, if needed.  //
      //////////////////////////////////////////////////////

      var client = createClient(options);

      var secret;
      var secretIdentifier = getSecretIdentifier(options);

      if (informed.tags) {

        // Some tags were informed.

        if (!informed.resetTags) {

          // We must read existing tags and add the new ones.
          log.info(util.format($('Getting secret %s'), secretIdentifier));
          secret = client.secrets.get(secretIdentifier, _);
          var currentTags = secret.tags;
          if (!currentTags) {
            // Defend against undefined.
            currentTags = {};
          }
          options.tags = kvUtils.mergeTags(currentTags, options.tags);

        }

      } else {

        // No tags informed.

        if (informed.resetTags) {

          // Clear all tags ignoring existing one.
          informed.tags = true;
          options.tags = {};

        }

      }

      ////////////////////////////////////////////////////////////
      // Build the request based on informed parameters.        //
      ////////////////////////////////////////////////////////////

      var request = {
        attributes: {}
      };

      if (informed.secretOps) request.secret_ops = options.secretOps;
      if (informed.enabled) request.attributes.enabled = options.enabled;
      if (informed.notBefore) request.attributes.nbf = options.notBefore;
      if (informed.expires) request.attributes.exp = options.expires;
      if (informed.tags) request.tags = options.tags;

      /////////////////////////////////////////////////
      // Send the request.                           //
      /////////////////////////////////////////////////

      log.verbose('request: ' + JSON.stringify(request, null, ' '));

      var progress = cli.interaction.progress(util.format($('Updating secret %s'), secretIdentifier));
      try {
        secret = client.secrets.update(secretIdentifier, request, _);
      } finally {
        progress.end();
      }

      showSecret(secret);
    });

  secret.command('show [vault-name] [secret-name] [secret-version]')
    .description($('Shows a vault secret'))
    .usage('[--vault-name] <vault-name> [--secret-name] <secret-name> [[--secret-version] <secret-version>] [options]')
    .option('-u, --vault-name <vault-name>', $('the vault name'))
    .option('-s, --secret-name <secret-name>', $('the secret name'))
    .option('-r, --secret-version <secret-version>', $('the secret version; if ommited, uses the most recent'))
    .execute(function(vaultName, secretName, secretVersion, options, _) {

      ///////////////////////
      // Parse arguments.  //
      ///////////////////////

      log.verbose('arguments: ' + JSON.stringify({
        vaultName: vaultName,
        secretName: secretName,
        secretVersion: secretVersion,
        options: options
      }));

      options.vaultName = options.vaultName || vaultName;
      options.secretName = options.secretName || secretName;
      options.secretVersion = options.secretVersion || secretVersion;

      if (!options.vaultName) {
        return cli.missingArgument('vault-name');
      }

      if (!options.secretName) {
        return cli.missingArgument('secret-name');
      }

      /////////////////////////
      // Send the request.   //
      /////////////////////////

      var client = createClient(options);

      var secretIdentifier = getSecretIdentifier(options);
      var progress = cli.interaction.progress(util.format($('Getting secret %s'), secretIdentifier));
      try {
        secret = client.secrets.get(secretIdentifier, _);
      } finally {
        progress.end();
      }

      showSecret(secret);
    });

  secret.command('delete [vault-name] [secret-name]')
    .description($('Deletes a secret from the vault'))
    .usage('[--vault-name] <vault-name> [--secret-name] <secret-name> [options]')
    .option('-u, --vault-name <vault-name>', $('the vault name'))
    .option('-s, --secret-name <secret-name>', $('the secret name'))
    .option('-q, --quiet', $('quiet mode (do not ask for delete confirmation)'))
    .option('-p, --pass-thru', $('outputs the deleted secret'))
    .execute(function(vaultName, secretName, options, _) {

      ///////////////////////
      // Parse arguments.  //
      ///////////////////////

      log.verbose('arguments: ' + JSON.stringify({
        vaultName: vaultName,
        secretName: secretName,
        options: options
      }));

      options.vaultName = options.vaultName || vaultName;
      options.secretName = options.secretName || secretName;

      if (!options.vaultName) {
        return cli.missingArgument('vault-name');
      }

      if (!options.secretName) {
        return cli.missingArgument('secret-name');
      }

      if (!options.quiet && !cli.interaction.confirm(util.format($('Delete secret %s from vault %s? [y/n] '), options.secretName, options.vaultName), _)) {
        throw new Error($('Aborted by user'));
      }

      /////////////////////////
      // Send the request.   //
      /////////////////////////

      var client = createClient(options);

      var secret;
      var secretIdentifier = getSecretIdentifier(options);
      var progress = cli.interaction.progress(util.format($('Deleting secret %s'), secretIdentifier));
      try {
        secret = client.secrets.deleteMethod(secretIdentifier, _);
      } finally {
        progress.end();
      }

      if (options.passThru) {
        showSecret(secret);
      }
    });

  function createClient(options) {
    var subscription = profile.current.getSubscription(options.subscription);
    log.verbose(util.format($('Using subscription %s (%s)'), subscription.name, subscription.id));
    options.vaultUri = 'https://' + options.vaultName + subscription.keyVaultDnsSuffix;
    var newClient = utils.createKeyVaultClient(subscription, options.vaultUri);
    // The new client returns high-level objects, we need low-level JSON objects for CLI.
    return new kvLegacy.KeyVaultClient(newClient._internalClient);
  }

  function getSecretIdentifier(options) {
    var id = options.vaultUri + '/secrets/' + options.secretName;
    if (options.secretVersion) {
      id += '/' + options.secretVersion;
    }
    return id;
  }

  function parseSecretPropertiesArguments(vaultName, secretName, secretVersion, value, options, requireValue) {

    log.verbose('arguments: ' + JSON.stringify({
      vaultName: vaultName,
      secretName: secretName,
      secretVersion: secretVersion,
      value: value,
      options: options
    }));

    options.vaultName = options.vaultName || vaultName;
    options.secretName = options.secretName || secretName;
    options.secretVersion = options.secretVersion || secretVersion;
    options.value = options.value || value;

    if (!options.vaultName) {
      return cli.missingArgument('vault-name');
    }

    if (!options.secretName) {
      return cli.missingArgument('secret-name');
    }

    if (requireValue && !options.value) {
      return cli.missingArgument('value');
    }

    options.expires = kvUtils.parseDateArgument('expires', options.expires, null);
    options.notBefore = kvUtils.parseDateArgument('not-before', options.notBefore, null);
    options.enabled = kvUtils.parseBooleanArgument('enabled', options.enabled, true);
    options.tags = kvUtils.parseTagsArgument('tags', options.tags);

  }

  function getSecretVersions(client, vaultUri, secretName, _) {

    log.verbose(util.format($('Loading versions of secret %s'), secretName));

    var secrets = [];
    var result = client.secrets.listVersions(vaultUri, secretName, null, _);
    for (;;) {
      var items = result.value;
      if (items && items.length) {
        secrets = secrets.concat(items);
      }
      if (!result.nextLink) {
        break;
      }
      log.verbose(util.format($('Found %d versions, loading more'), secrets.length));
      result = client.secrets.listVersionsNext(result.nextLink, _);
    }

    return secrets;
  }

  function showSecret(secret) {
    cli.interaction.formatOutput(secret, function(secret) {
      secret.attributes = kvUtils.getAttributesWithPrettyDates(secret.attributes);
      utils.logLineFormat(secret, log.data);      
    });
  }

  function showSecretRow(row, item) {
    var identifier = kvUtils.parseSecretIdentifier(item.id);
    // The vault is the same, so we don't show.
    // row.cell($('Vault'), identifier.vaultUri);
    row.cell($('Name'), identifier.name);
    if (identifier.version) {
      row.cell($('Version'), identifier.version);
    }
    row.cell($('Enabled'), item.attributes.enabled);
    var attributes = kvUtils.getAttributesWithPrettyDates(item.attributes);
    row.cell($('Not Before'), attributes.nbf || '');
    row.cell($('Expires'), attributes.exp || '');
    row.cell($('Created'), attributes.created);
    row.cell($('Updated'), attributes.updated);
    row.cell($('Tags'), kvUtils.getTagsInfo(item.tags));
  }

};