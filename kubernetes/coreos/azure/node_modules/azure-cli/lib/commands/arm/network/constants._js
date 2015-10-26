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
  protocols: ['Tcp', 'Udp', '*'],
  accessModes: ['Allow', 'Deny'],
  directionModes: ['Inbound', 'Outbound'],
  priorityBounds: [100, 4096],
  portBounds: [0, 65535],
  statuses: ['Enabled', 'Disabled'],
  trafficRoutingMethods: ['Performance', 'Weighted', 'Priority'],
  monitorProtocols: ['http', 'https'],

  NSG_DEFAULT_PROTOCOL: 'Tcp',
  NSG_DEFAULT_SOURCE_PORT: 80,
  NSG_DEFAULT_DESTINATION_PORT: 80,
  NSG_DEFAULT_SOURCE_ADDRESS_PREFIX: '*',
  NSG_DEFAULT_DESTINATION_ADDRESS_PREFIX: '*',
  NSG_DEFAULT_ACCESS: 'Allow',
  NSG_DEFAULT_DIRECTION: 'Inbound',
  NSG_DEFAULT_PRIORITY: 100,
  NSG_DEFAULT_DETAIL_LEVEL: 'Full',

  TM_DEFAULT_LOCATION: 'global',
  TM_DEFAULT_PROFILE_STATUS: 'Enabled',
  TM_DEFAULT_ROUTING_METHOD: 'Performance',
  TM_DEFAULT_TIME_TO_LIVE: 300,
  TM_DEFAULT_MONITOR_PROTOCOL: 'http',
  TM_DEFAULT_MONITOR_PORT: {'http': '80', 'https': 443},
  TM_VALID_ENDPOINT_STATUSES: ['Enabled', 'Disabled'],
  TM_VALID_ENDPOINT_TYPES: ['externalEndpoint'],

  DNS_RS_DEFAULT_LOCATION: 'global',
  DNS_RS_TYPES: ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'SRV', 'TXT', 'SOA', 'PTR'],
  DNS_RS_DEFAULT_TYPE: 'A',
  DNS_RS_DEFAULT_TTL: 4,

  lb: {
    defPort: 80,
    defProtocol: 'tcp',
    defFloatingIp: false,
    defTimeout: 4,
    protocols: ['tcp', 'udp']
  },

  route: {
    nextHopType: ['VirtualAppliance', 'VirtualNetworkGateway', 'VNETLocal', 'Internet', 'None']
  },

  vpnGateway: {
    type: ['RouteBased', 'PolicyBased', 'Dedicated'],
    connection: ['Ipsec', 'Dedicated', 'VpnClient', 'Vnet2Vnet']
  },

  toRange: function (array) {
    return '[' + array[0] + '-' + array[1] + ']';
  }
};
