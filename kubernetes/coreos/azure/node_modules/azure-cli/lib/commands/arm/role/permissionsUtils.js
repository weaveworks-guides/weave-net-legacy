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

exports.getPermissionDetails = function (permissions) {
  var actions = [];
  var notActions = [];
  for (var i = 0; i < permissions.length; i++) {
    actions = actions.concat(permissions[i].actions);
    notActions = notActions.concat(permissions[i].notActions);
  }

  return {
    actions: actions.join(),
    notActions: notActions.join()
  };
};
