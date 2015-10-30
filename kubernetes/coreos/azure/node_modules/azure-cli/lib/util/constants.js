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

var Constants = {
  API_VERSIONS: {
    ASM: 'asm',
    ARM: 'arm'
  },

  /**
  * Constant default http port.
  *
  * @const
  * @type {string}
  */
  DEFAULT_HTTP_PORT: 80,

  /**
  * Constant default https port.
  *
  * @const
  * @type {string}
  */
  DEFAULT_HTTPS_PORT: 443,

  /**
  * Constant client ID used by the CLI
  *
  * @const
  * @type {string}
  */
  XPLAT_CLI_CLIENT_ID: '04b07795-8ddb-461a-bbee-02f9e1bf7b46',

  /**
  * Constant xml2js 1.0 metadata marker.
  *
  * @const
  * @type {string}
  */
  XML_METADATA_MARKER: '@',

  /**
  * Constant xml2js 1.0 value marker.
  *
  * @const
  * @type {string}
  */
  XML_VALUE_MARKER: '#',

  /**
  * Constant max file size allowed for custom data.
  *
  * @const
  * @type {integer}
  */
  CUSTOM_DATA_FILE_SIZE: 65535,

  Namespaces: {
    Arrays: 'http://schemas.microsoft.com/2003/10/Serialization/Arrays',
    WindowsAzure: 'http://schemas.microsoft.com/windowsazure',
    XMLSchema: 'http://www.w3.org/2001/XMLSchema-instance'
  },

  AAD_COMMON_TENANT: 'common'
};

module.exports = Constants;