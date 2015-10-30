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

var $ = utils.getLocaleString;

exports.init = function(cli) {
  var internallb = cli.category('service').category('internal-load-balancer')
    .description($('Commands to manage internal load balancers for your Cloud Service Deployment'));

  var log = cli.output;

  internallb.command('list [serviceName]')
    .description($('List internal load balancers for a cloud service deployment'))
    .usage('[options] [serviceName]')
    .option('-r, --serviceName <serviceName>', $('the cloud service name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(serviceName, options, _) {
      serviceName = cli.interaction.promptIfNotGiven($('Cloud Service name: '), serviceName, _);

      var computeClient = utils.createComputeClient(profile.current.getSubscription(options.subscription));
      var progress = cli.interaction.progress($('Getting cloud service deployment'));
      var deployment;
      try {
        deployment = computeClient.deployments.getBySlot(serviceName, 'Production', _);
      } finally {
        progress.end();
      }

      var loadBalancers = deployment.loadBalancers ? deployment.loadBalancers : [];
      cli.interaction.formatOutput(loadBalancers, function(outputData) {
        if (outputData.length === 0) {
          log.info($('No internal load balancers defined'));
        } else {
          log.table(outputData, function(row, item) {
            var getfrontendIpConfigProperty = function(propertyName) {
              if (!item.frontendIPConfiguration) {
                return '';
              }

              if (!item.frontendIPConfiguration[propertyName]) {
                return '';
              }

              return item.frontendIPConfiguration[propertyName];
            };

            row.cell($('Name'), item.name);
            row.cell($('Type'), getfrontendIpConfigProperty('type'));
            row.cell($('SubnetName'), getfrontendIpConfigProperty('subnetName'));
            row.cell($('StaticVirtualNetworkIPAddress'), getfrontendIpConfigProperty('staticVirtualNetworkIPAddress'));
          });
        }
      });
    });

  internallb.command('add [serviceName] [internalLBName]')
    .usage('[options] [serviceName] [internalLBName]')
    .description($('Add an internal load balancer for a cloud service deployment'))
    .option('-r, --serviceName <serviceName>', $('the cloud service name'))
    .option('-n, --internalLBName <internalLBName>', $('the internal load balancer name'))
    .option('-t, --subnet-name <name>', $('the name of the subnet in the virtual network that the load balancer uses'))
    .option('-a, --static-virtualnetwork-ipaddress <ip-address>', $('specific virtual IP address that the load balancer uses from the subnet in the virtual network'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(serviceName, internalLBName, options, _) {
      serviceName = cli.interaction.promptIfNotGiven($('Cloud Service name: '), serviceName, _);
      internalLBName = cli.interaction.promptIfNotGiven($('Internal Load Balancer name: '), internalLBName, _);

      var computeClient = utils.createComputeClient(profile.current.getSubscription(options.subscription));
      var progress = cli.interaction.progress($('Getting cloud service deployment'));
      var deployment;
      try {
        deployment = computeClient.deployments.getBySlot(serviceName, 'Production', _);
      } finally {
        progress.end();
      }

      var internalLoadBalancerConfig = {
        name: internalLBName,
        frontendIPConfiguration: {
          type: 'Private'
        }
      };

      if (options.staticVirtualnetworkIpaddress) {
        if (!options.subnetName) {
          throw new Error($('--subnet-name is required when --static-virtualnetwork-ipaddress is specified'));
        }

        internalLoadBalancerConfig.frontendIPConfiguration.staticVirtualNetworkIPAddress = options.staticVirtualnetworkIpaddress;
      }

      if (options.subnetName) {
        internalLoadBalancerConfig.frontendIPConfiguration.subnetName = options.subnetName;
      }

      progress = cli.interaction.progress($('Adding internal load balancer'));
      try {
        computeClient.loadBalancers.create(serviceName, deployment.name, internalLoadBalancerConfig, _);
      } finally {
        progress.end();
      }
    });

  internallb.command('delete [serviceName] [internalLBName]')
    .usage('[options] [serviceName] [internalLBName]')
    .description($('Delete an internal load balancer for a cloud service deployment'))
    .option('-r, --serviceName <serviceName>', $('the cloud service name'))
    .option('-n, --internalLBName <internalLBName>', $('the internal load balancer name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(serviceName, internalLBName, options, _) {
      serviceName = cli.interaction.promptIfNotGiven($('Cloud Service name: '), serviceName, _);
      internalLBName = cli.interaction.promptIfNotGiven($('Internal Load Balancer name: '), internalLBName, _);

      var computeClient = utils.createComputeClient(profile.current.getSubscription(options.subscription));
      var progress = cli.interaction.progress($('Getting cloud service deployment'));
      var deployment;
      try {
        deployment = computeClient.deployments.getBySlot(serviceName, 'Production', _);
      } finally {
        progress.end();
      }

      loadBalancer = findLoadBalancer(deployment.loadBalancers, internalLBName);
      if (loadBalancer) {
        if (!options.quiet && !cli.interaction.confirm(util.format($('Delete internal load balancer with name %s? [y/n] '), internalLBName), _)) {
          return;
        }

        progress = cli.interaction.progress($('Deleting internal load balancer'));
        try {
          computeClient.loadBalancers.deleteMethod(serviceName, deployment.name, loadBalancer.name, _);
        } finally {
          progress.end();
        }
      } else {
        log.info($('No matching internal load balancer defined'));
      }
    });

  internallb.command('set [serviceName] [internalLBName]')
    .description($('Update internal load balancer of a cloud service deployment'))
    .option('-r, --serviceName <serviceName>', $('the cloud service name'))
    .option('-n, --internalLBName <internalLBName>', $('the internal load balancer name'))
    .option('-t, --subnet-name <name>', $('the name of the subnet in the virtual network that the load balancer uses'))
    .option('-a, --static-virtualnetwork-ipaddress <ip-address>', $('specific virtual IP address that the load balancer uses from the subnet in the virtual network'))
    .option('-d, --remove-subnet', $('remove subnet entry if it is already defined for the internal load balancer'))
    .option('-e, --remove-vnetip', $('remove virtual network IP address if it is already defined for the internal load balancer'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function(serviceName, internalLBName, options, _) {

      if (!options.subnetName && !options.staticVirtualnetworkIpaddress && !options.removeSubnet && !options.removeVnetip) {
        throw new Error($('one of the optional argument --subnet-name, --static-virtualnetwork-ipaddress, --remove-subnet or --remove-vnetip is required'));
      }

      if (options.removeSubnet) {
        if (options.subnetName || options.staticVirtualnetworkIpaddress) {
          throw new Error($('--subnet-name or --static-virtualnetwork-ipaddress are not allowed when --remove-subnet is specified'));
        }
      }

      if (options.removeVnetip) {
        if (options.staticVirtualnetworkIpaddress) {
          throw new Error($('--static-virtualnetwork-ipaddress not allowed when --remove-vnetip is specified'));
        }
      }

      serviceName = cli.interaction.promptIfNotGiven($('Cloud Service name: '), serviceName, _);
      internalLBName = cli.interaction.promptIfNotGiven($('Internal Load Balancer name: '), internalLBName, _);

      var computeClient = utils.createComputeClient(profile.current.getSubscription(options.subscription));
      var progress = cli.interaction.progress($('Getting cloud service deployment'));
      var deployment;

      try {
        deployment = computeClient.deployments.getBySlot(serviceName, 'Production', _);
      } finally {
        progress.end();
      }

      loadBalancer = findLoadBalancer(deployment.loadBalancers, internalLBName);

      if (loadBalancer) {
        if (options.removeSubnet) {
          loadBalancer.frontendIPConfiguration.subnetName = null;
          loadBalancer.frontendIPConfiguration.staticVirtualNetworkIPAddress = null;
        }

        if (options.removeVnetip) {
          loadBalancer.frontendIPConfiguration.staticVirtualNetworkIPAddress = null;
        }

        if (options.subnetName) {
          loadBalancer.frontendIPConfiguration.subnetName = options.subnetName;
        }

        if (options.staticVirtualnetworkIpaddress) {
          if (!loadBalancer.frontendIPConfiguration.subnetName) {
            throw new Error($('no existing subnet defined for this internal load balancer, --subnet-name is required to set static virtual network ip address'));
          }

          loadBalancer.frontendIPConfiguration.staticVirtualNetworkIPAddress = options.staticVirtualnetworkIpaddress;
        }
        progress = cli.interaction.progress($('Updating internal load balancer'));
        try {
          computeClient.loadBalancers.update(serviceName, deployment.name, loadBalancer.name, loadBalancer, _);
        } finally {
          progress.end();
        }
      } else {
        log.info($('No matching internal load balancer defined'));
      }
    });

    function findLoadBalancer(loadBalancers, internalLBName) {
      loadBalancers = loadBalancers ? loadBalancers : [];
      var loadBalancer;
      for (var j = 0; j < loadBalancers.length; j++) {
        if (utils.ignoreCaseEquals(loadBalancers[j].name, internalLBName)) {
          loadBalancer = loadBalancers[j];
          break;
        }
      }
      return loadBalancer;
    }
};
