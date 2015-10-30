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

_.extend(exports, {
  manifestSchema: 'http://schema.management.azure.com/schemas/2015-04-15/apiapp.json#',
  swaggerSchema: require('swagger-schema-official/schema.json'),
  templateSchemaUri: 'http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json',
  uiDefinitionSchema: 'http://schema.management.azure.com/schemas/2015-04-15/uiDefinition.json#',
  manifestFilename: 'apiapp.json',
  metadataFolder: 'metadata',
  templatesFolder: 'metadata/deploymentTemplates',
  iconsFolder: 'metadata/icons',
  screenshotsFolder: 'metadata/screenshots',
  contentFolder: 'content',
  relsFolder: '_rels',
  relsFilename: '.rels',
  psmdcpFilename: 'f508f799f16345c0a23a6c3f14e671bc.psmdcp',
  contentTypesFilename: '[Content_Types].xml',
  corePropsFolder: 'package/services/metadata/core-properties',
  apiDefinitionFilename: 'apiDefinition.swagger.json',
  uiDefinitionFilename: 'UIDefinition.json'
});
