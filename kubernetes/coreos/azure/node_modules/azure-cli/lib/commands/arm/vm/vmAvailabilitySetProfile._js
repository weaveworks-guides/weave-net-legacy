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

var AvailabilitySet = require('./../availabilityset/availabilitySet');

function VMAvailabilitySetProfile(cli, resourceGroupName, params, serviceClients) {
    this.cli = cli;
    this.resourceGroupName = resourceGroupName;
    this.params = params;
    this.serviceClients = serviceClients;
}

__.extend(VMAvailabilitySetProfile.prototype, {
    generateAvailabilitySetProfile: function(_) {
      var availabilitySet = new AvailabilitySet(this.cli, this.serviceClients, this.resourceGroupName, this.params);
      if (!availabilitySet.hasAnyAvailSetParameters(this.params)) {
        return {
          profile: null,
          availSetInfo: null
        };
      }

      var availSetInfo = availabilitySet.createAvailSetIfRequired(_);
      return {
        profile: {
          referenceUri: availSetInfo.profile.id
        },
        availSetInfo: availSetInfo
      };
    }
});

module.exports = VMAvailabilitySetProfile;