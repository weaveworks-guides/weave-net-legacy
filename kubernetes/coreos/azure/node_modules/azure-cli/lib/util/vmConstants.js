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

exports = module.exports;

var VMConstants = {
  EXTENSIONS: {
    TYPE: 'Microsoft.Compute/virtualMachines/extensions',

    IAAS_DIAG_VERSION: '1.4',
    LINUX_DIAG_VERSION: '2.0',
    LINUX_DIAG_NAME: 'LinuxDiagnostic',
    IAAS_DIAG_NAME: 'IaaSDiagnostics',
    LINUX_DIAG_PUBLISHER: 'Microsoft.OSTCExtensions',
    IAAS_DIAG_PUBLISHER: 'Microsoft.Azure.Diagnostics',

    DOCKER_PORT: 2376,
    DOCKER_VERSION_ARM: '1.0',
    DOCKER_VERSION_ASM: '1.*',
    DOCKER_NAME: 'DockerExtension',
    DOCKER_PUBLISHER: 'Microsoft.Azure.Extensions',

    LINUX_ACCESS_VERSION: '1.1',
    LINUX_ACCESS_NAME: 'VMAccessForLinux',
    LINUX_ACCESS_PUBLISHER: 'Microsoft.OSTCExtensions',
    WINDOWS_ACCESS_VERSION: '2.0',
    WINDOWS_ACCESS_NAME: 'VMAccessAgent',
    WINDOWS_ACCESS_PUBLISHER: 'Microsoft.Compute'
  }
};

module.exports = VMConstants;
