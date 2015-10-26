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

var fs = require('fs');
var path = require('path');
var util = require('util');
var async = require('async');

var profile = require('../../util/profile');
var utils = require('../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
  var certificates = cli.category('service').category('cert')
    .description($('Commands to manage your Cloud Services certificates'));

  var log = cli.output;

  function getCertificates (serviceName, options, _) {
    var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));

    var certificates = [];
    var progress;

    if (!serviceName) {
      var hostedServices;
      progress = cli.interaction.progress($('Getting cloud services'));
      try {
        hostedServices = service.hostedServices.list(_).hostedServices;
      } finally {
        progress.end();
      }

      if (hostedServices) {
        progress = cli.interaction.progress($('Getting cloud service certificates'));
        try {
          var serviceCertificates = async.map(hostedServices, function (hostedService, callback) {
            service.serviceCertificates.list(hostedService.serviceName, function (err, result) {
              if (err) { return callback(err); }

              for (var certificate in result.certificates) {
                result.certificates[certificate].serviceName = hostedService.serviceName;
              }

              callback(err, result.certificates);
            });
          }, _);

          certificates = certificates.concat.apply(certificates, serviceCertificates);
        } finally {
          progress.end();
        }
      }
    } else {
      progress = cli.interaction.progress($('Getting cloud service certificates'));
      try {
        certificates = service.serviceCertificates.list(serviceName, _).certificates;
      } finally {
        progress.end();
      }

      for (var certificate in certificates) {
        certificates[certificate].serviceName = serviceName;
      }
    }

    return certificates;
  }

  certificates.command('list')
    .description($('List Azure certificates'))
    .option('--serviceName <serviceName>', $('the cloud service name'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (options, _) {
      var certificates = getCertificates(options.serviceName, options, _);

      if (certificates && certificates.length > 0) {
        cli.interaction.formatOutput(certificates, function(outputData) {
          log.table(outputData, function (row, item) {
            row.cell($('Service Name'), item.serviceName);
            row.cell($('Thumbprint'), item.thumbprint);
            row.cell($('Algorithm'), item.thumbprintAlgorithm);
          });
        });
      } else {
        log.info($('No certificates defined'));
      }
    });

  certificates.command('create <dns-name> <file> [password]')
    .usage('[options] <dns-name> <file> [password]')
    .description($('Upload certificate'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (dnsName, file, password, options, _) {
      var dnsPrefix = utils.getDnsPrefix(dnsName);

      var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));

      if (path.extname(file) !== '.pfx') {
        throw new Error('Certificates need to have a pfx extension');
      }

      var certificateOptions = {
        password: password,
        certificateFormat: path.extname(file).split('.')[1],
        data: fs.readFileSync(file)
      };

      var progress = cli.interaction.progress($('Creating certificate'));

      try {
        service.serviceCertificates.create(dnsPrefix, certificateOptions, _);
      } finally {
        progress.end();
      }
    });

  certificates.command('delete <thumbprint>')
    .description($('Delete certificate'))
    .option('-d, --dns-name <name>', $('indicates to only look for certs for this DNS name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(function (thumbprint, options, _) {
      var service = utils.createComputeClient(profile.current.getSubscription(options.subscription));

      var dnsPrefix;
      if (options.dnsName) {
        dnsPrefix = utils.getDnsPrefix(options.dnsName);
      }

      var certificates = getCertificates(dnsPrefix, options, _);

      certificates = certificates.filter(function (certificate) {
        return utils.ignoreCaseEquals(certificate.thumbprint, thumbprint);
      });

      if (certificates && certificates.length > 0) {
        if (!options.quiet && !cli.interaction.confirm(util.format($('Delete certificate with thumbprint %s? [y/n] '), thumbprint), _)) {
          return;
        }

        var progress = cli.interaction.progress($('Deleting certificates'));

        try {
          async.each(certificates, function (certificate, callback) {
            service.serviceCertificates.delete(certificate, callback);
          }, _);
        } finally {
          progress.end();
        }
      } else {
        log.info($('No matching certificates defined'));
      }
    });
};