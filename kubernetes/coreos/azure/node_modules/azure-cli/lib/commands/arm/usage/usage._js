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

var util = require('util');

var profile = require('../../../util/profile');
var utils = require('../../../util/utils');

var $ = utils.getLocaleString;

exports.init = function (cli) {
    var log = cli.output;

    var usage = cli.category('usage')
      .description($('Command to view your aggregated Azure usage data'));

  usage.command('list [reportedStartTime] [reportedEndTime]')
      .description($('List the usage aggregates for a provided time range'))
      .option('--reportedStartTime <datetime>', $('The start of the time range to retrieve data for, in UTC format.'))
      .option('--reportedEndTime <datetime>', $('The end of the time range to retrieve data for, in UTC format.'))
      .option('--granularity <daily/hourly>', $('Value is either daily (default) or hourly to tell the API how to return the results grouped by day or hour.'))
      .option('--showDetails <bool>', $('When set to true (default), the aggregates are broken down into the instance metadata which is more granular.'))
      .option('--continuationToken <url>', $('Retrieved from previous calls, this is the bookmark used for progress when the responses are paged.'))
      .option('--subscription <subscription>', $('the subscription identifier'))
      .execute(function (reportedStartTime, reportedEndTime, options, _) {
    if (!reportedStartTime) {
	  reportedStartTime = cli.interaction.promptIfNotGiven($('reportedStartTime: '), reportedStartTime, _);
    }
    if (!reportedEndTime) {
	  reportedEndTime = cli.interaction.promptIfNotGiven($('reportedEndTime: '), reportedEndTime, _);
    }

    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.createUsageManagementClient(subscription);
    var progress = cli.interaction.progress($('Listing usage aggregates'));
    
    var result;
    try {
      result = client.usageAggregates.get(reportedStartTime, reportedEndTime, options.granularity, options.showDetails, options.continuationToken, _);
    } finally {
      progress.end();
    }
    
    cli.interaction.formatOutput(result.usageAggregations, function (data) {
      if (data.length > 0) {
        log.table(data, function (row, item) {
          row.cell($('Usage Start '), item.properties.usageStartTime);
          row.cell($('Usage End '), item.properties.usageEndTime);
          row.cell($('Meter Category '), item.properties.meterCategory);
          row.cell($('Meter Name '), item.properties.meterName);
          row.cell($('Quantity '), item.properties.quantity + ' ' + item.properties.unit);
        });
      }
      else {
        log.info(util.format($('No usage aggregates found for that time period.')));
      }
    });
    
    cli.interaction.formatOutput(result, function (data) {
      if (data.nextLink !== undefined) {
        log.info('continuationToken for continued results: ' + data.nextLink);
      }
    });

  });
};

