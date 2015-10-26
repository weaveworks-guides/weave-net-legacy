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

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var util = require('util');

var adalAuth = require('../authentication/adalAuth');
var Environment = require('./environment');
var Subscription = require('./subscription');
var publishSettings = require('./publishSettings');
var cacheUtils = require('../cacheUtils');
var log = require('../logging');
var utils = require('../utils');
var $ = utils.getLocaleString;

//
// Profile object - this manages the serialization of environment
// and subscription data for the current user.
//

function Profile() {
  var self = this;
  self.environments = {};
  Environment.publicEnvironments.forEach(function (env) {
    self.addEnvironment(env);
  });
  self.subscriptions = {};

  self.onSubscriptionUpdated = this.save.bind(this);
}

Object.defineProperty(Profile.prototype, 'currentSubscription', {
  enumerable: true,
  get: function () {
    return _.chain(this.subscriptions)
      .values()
      .filter(function (s) { return s.isDefault; })
      .first()
      .value() || null;
  },

  set: function (value) {
    _.values(this.subscriptions)
      .forEach(function (s) { s.isDefault = false; });
    if (value) {
      value.isDefault = true;
    }
  }
});

_.extend(Profile.prototype, {
  addEnvironment: function (env) {
    this.environments[env.name] = env;
  },

  getEnvironment: function (envName) {
    if (!envName) {
      return this.environments.AzureCloud;
    }
    var key = _.keys(this.environments)
      .filter(function (env) { return utils.ignoreCaseEquals(env, envName); })[0];
    return this.environments[key];
  },

  deleteEnvironment: function (environmentOrName) {
    if (_.isString(environmentOrName)) {
      delete this.environments[environmentOrName];
    } else {
      delete this.environments[environmentOrName.name];
    }
  },
  
  //Never use this method as the naming is rather misleading.
  //Use "addOrUpdateSubscription" instead. This method is only
  //used by test framework in generated nock records.
  addSubscription: function (subscription) {
    this.addOrUpdateSubscription(subscription);
  },

  addOrUpdateSubscription: function (subscription) {
    var existingSubscription = _.values(this.subscriptions)
      .filter(function (s) { return s.id === subscription.id; })[0];

    if (existingSubscription) {
      existingSubscription.removeListener('updated', this.onSubscriptionUpdated);

      if (subscription.id!== existingSubscription.id || 
        subscription.tenantId !== existingSubscription.tenantId) {
        delete this.subscriptions[existingSubscription.id];
      }

      existingSubscription.updateFrom(subscription);
      subscription = existingSubscription;
    }

    this.subscriptions[subscription.id] = subscription;
    subscription.on('updated', this.onSubscriptionUpdated);
  },

  deleteSubscription: function (subscriptionId) {
    var subscription = subscriptionId;
    if (_.isString(subscriptionId)) {
      subscription = this.subscriptions[subscriptionId];
    }

    if (subscription.isDefault) {
      var remainingSubscriptions = _.values(this.subscriptions)
        .filter(function (sub) { return sub.id !== subscription.id; });
      if (_.first(remainingSubscriptions)) {
        remainingSubscriptions[0].isDefault = true;
      }
    }

    subscription.removeListener('updated', this.onSubscriptionUpdated);
    delete this.subscriptions[subscription.id];
  },

  logoutUser: function (username, done) {
    var self = this;
    username = adalAuth.normalizeUserName(username);

    // Helper functions to define process of logout
    function usernameMatches(subscription) {
      return utils.ignoreCaseEquals(subscription.user.name, username);
    }

    function defaultGoesLast(subscription) {
      return subscription.isDefault ? 1 : 0;
    }

    function removeTokenOrSubscription(subscription) {
      if (subscription.user) {
        if (subscription.managementCertificate) {
          delete subscription.user;
        } else {
          self.deleteSubscription(subscription.id);
        }
        return true;
      }
      return false;
    }

    function subscriptionsWereRemoved(wasRemoved) {
      return wasRemoved;
    }

    // First, delete cached access tokens
    adalAuth.removeCachedToken(username, null, function (err) {
      var loggedOut = _.chain(_.values(self.subscriptions))
      .filter(usernameMatches)
      .sortBy(defaultGoesLast)
      .map(removeTokenOrSubscription)
      .any(subscriptionsWereRemoved)
      .value();
      done(err, loggedOut);
    });
  },

  getSubscription: function (idOrName, returnAllMatched) {
    var subscriptions = [];
    if (!idOrName) {
      subscriptions.push(this.currentSubscription);
      if (!this.currentSubscription) {
        throw new Error($('There is no current subscription. Please use the azure login command to set your current subscription.'));
      }
    } else {
      //First try to get the subscription from this.subscriptions object where subscriptions are keyed on id.
      //If there is no exact match by Id then we should try to find a subscription matching on name.
      if (this.subscriptions[idOrName]) {
        subscriptions.push(this.subscriptions[idOrName]);
      } else {
        subscriptions = _.values(this.subscriptions).filter(function (s) { return utils.ignoreCaseEquals(s.name, idOrName); });
      }

      if (subscriptions.length === 0) {
        throw new Error(util.format(
          $('The subscription \'%s\' was not found. Please check your spelling, or use the azure login command to set your subscription.'),
          idOrName));
      }
    }
    if (returnAllMatched) {
      return subscriptions;
    }

    return subscriptions[0];
  },

  importPublishSettings: function (fileName) {
    var self = this;
    _.each(publishSettings.import(fileName), function (subData) {
      var newSubscription = new Subscription(subData, self._findEnvironment(subData));
      self.addOrUpdateSubscription(newSubscription);
      if (!self.currentSubscription) {
        newSubscription.isDefault = true;
      }
    });
  },

  saveToStream: function (stream) {
    stream.write(JSON.stringify(this._getSaveData(), null, 4), 'utf8');
    stream.end();
  },

  save: function (fileName) {
    if (!fileName) {
      fileName = defaultProfileFile;
    }

    fs.writeFileSync(fileName, JSON.stringify(this._getSaveData(), null, 4));
  },

  _getSaveData: function () {
    return {
      environments: _.values(this.environments)
        .filter(function (e) { return !e.isPublicEnvironment; })
        .map(function (e) { return e.toJSON(); }),
      subscriptions: _.values(this.subscriptions).map(function (s) { return s.toJSON(); })
    };
  },

  /**
  * Find an environment with a matching management endpoint
  * @param {object} subscriptionData subscription data from publishsettings file
  *
  * @returns corresponding environment object or throws if not found.
  */
  _findEnvironment: function (subscriptionData) {
    var trimmedEndpoint = utils.stringTrimEnd(subscriptionData.managementEndpointUrl, '/');

    var found = _.values(this.environments).filter(function (e) {
      return utils.ignoreCaseEquals(trimmedEndpoint, utils.stringTrimEnd(e.managementEndpointUrl, '/'));
    });
    if (found.length === 0) {
      throw new Error(util.format(
        $('Could not find an environment with management endpoint %s. Create one and import this publishSettings file again.'),
        subscriptionData.managementEndpointUrl));
    }
    return found[0];
  }
});

//
// Profile loading functions
//

function load(fileNameOrData) {
  var profile = new Profile();
  if (_.isUndefined(fileNameOrData) || fileNameOrData === defaultProfileFile) {
    return loadDefaultProfile(profile);
  } else if (_.isString(fileNameOrData)) {
    return loadProfileFromFile(profile, fileNameOrData);
  } else {
    return loadProfileFromObject(profile, fileNameOrData);
  }
}

function loadDefaultProfile(profile) {
  profile.fileName = defaultProfileFile;
  if (utils.pathExistsSync(defaultProfileFile)) {
    return loadProfileFromFile(profile, defaultProfileFile);
  }
  return profile;
}

function loadProfileFromFile(profile, fileName) {
  profile.fileName = fileName;
  if (!utils.pathExistsSync(fileName)) {
    throw new Error(util.format($('Profile file %s does not exist'), fileName));
  }
  return loadProfileFromObject(profile, JSON.parse(fs.readFileSync(fileName, 'utf8')));
}

function loadProfileFromObject(profile, data) {
  if (data.environments) {
    data.environments.forEach(function (envData) {
      var e = new Environment(envData);
      profile.addEnvironment(e);
    });
  }
  if (data.subscriptions) {
    data.subscriptions.forEach(function (subData) {
      profile.addOrUpdateSubscription(new Subscription(subData, profile.environments[subData.environmentName]));
    });
    if(!profile.currentSubscription && data.subscriptions.length > 0) {
      profile.getSubscription(data.subscriptions[0].id).isDefault = true;
    }
  }
  return profile;
}

function clearAzureDir() {
  function deleteIfExists(file, isDir) {
    if (utils.pathExistsSync(file)) {
      log.silly(util.format($('Removing %s'), file));
      (isDir ? fs.rmdirSync : fs.unlinkSync)(file);
      return true;
    } else {
      log.silly(util.format($('%s does not exist'), file));
    }
  }

  var azureDirectory = utils.azureDir();
  var pemPath = path.join(azureDirectory, 'managementCertificate.pem');
  var publishSettingsFilePath = path.join(azureDirectory, 'publishSettings.xml');

  var isDeleted = deleteIfExists(pemPath);
  isDeleted = deleteIfExists(publishSettingsFilePath) || isDeleted; // in this order only
  isDeleted = utils.clearConfig() || isDeleted;
  isDeleted = cacheUtils.clear() || isDeleted;
  isDeleted = deleteIfExists(defaultProfileFile) || isDeleted;
  isDeleted = deleteIfExists(adalAuth.defaultTokenCacheFile) || isDeleted;
  
  //the folder might still contain some files such as "plugin.json",
  //we leave them there, since they have nothing to do with account management. 

  log.info(isDeleted ? $('Account settings cleared successfully')
      : $('Account settings are already clear'));
}

var defaultProfileFile = path.join(utils.azureDir(), 'azureProfile.json');

var currentProfile = load(defaultProfileFile);

//
// Resource management
//
function toLowerCase(s) { return s.toLowerCase(); }

_.extend(module.exports, {
  load: load,
  defaultProfileFile: defaultProfileFile,
  Profile: Profile,
  Subscription: Subscription,
  Environment: Environment,
  current: currentProfile,
  clearAzureDir: clearAzureDir,
  getSubscription: function (subscription) {
    return currentProfile.getSubscription(subscription);
  },
  providerKeyTransform: toLowerCase
});
