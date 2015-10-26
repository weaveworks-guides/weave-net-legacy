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

module.exports = {
  nsg: {
    protocols: ['Tcp', 'Udp', '*'],
    action: ['Allow', 'Deny'],
    type: ['Inbound', 'Outbound'],
    prefix: ['INTERNET', 'VIRTUAL_NETWORK', 'AZURE_LOADBALANCER'],
    levelDef: 'Full',
    prefixDef: '*',
    portMin: 0,
    portMax: 65535,
    portDef: 80,
    priorityMin: 100,
    priorityMax: 4096
  },

  vpnGateway: {
    type: ['StaticRouting', 'DynamicRouting'],
    sku: ['Default', 'HighPerformance']
  },

  appGateway: {
    settings: {
      protocol: ['Http'],
      port: [0, 65535],
      affinity: ['Disabled', 'Enabled']
    },
    ip: {
      type: ['Private']
    },
    sizes: ['Small', 'Medium', 'Large', 'ExtraLarge', 'A8'],
    defaultInstanceCount: 1
  },

  route: {
    nextHopType: ['VirtualAppliance', 'VPNGateway']
  },

  trafficManager: {
    protocols: ['http', 'https'],
    loadBalancingMethods: ['performance', 'failover', 'roundrobin'],
    ports: [1, 65535],
    port: 80,
    ttl: 30,
    verb: 'GET',
    protocol: 'https',
    loadBalancingMethod: 'Performance',
    statusCode: 200,
    interval: 30,
    timeout: 10,
    numberOfFailures: 3,
    endpoints: {
      types: ['TrafficManager', 'CloudService', 'AzureWebsite', 'Any'],
      statuses: ['Enabled', 'Disabled']
    }
  }
};