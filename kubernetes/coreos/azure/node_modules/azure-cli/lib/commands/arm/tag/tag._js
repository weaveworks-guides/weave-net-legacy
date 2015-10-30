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
  var tagCommand = cli.category('tag')
    .description($('Commands to manage your resource manager tags'));

  tagCommand.command('create [name] [value]')
    .description($('add a tag'))
    .usage('[options] <name> <value>')
    .option('-n --name <name>', $('Name of the tag. If the tag name doesn\'t exist, create the tag name; ' +
      'Otherwise, add the value to the existing tag name.'))
    .option('--value <value>', $('Value of the tag. If specified, add the tag value to the tag name; ' +
      'Otherwise, keep the tag values unchanged.'))
    .option('--subscription <subscription>', $('The subscription identifier.'))
    .execute(function (name, value, options, _) {
      if (!name) {
        return cli.missingArgument('name');
      }
      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);

      var progress = cli.interaction.progress(util.format($('Creating tag \'%s\''), name));
      try {
        client.tags.createOrUpdate(name, _);
      } finally {
        progress.end();
      }
      
      if (value) {
        progress = cli.interaction.progress(util.format($('Setting tag value \'%s\''), value));
        try {
          client.tags.createOrUpdateValue(name, value, _);
        } finally {
          progress.end();
        }
      }

      var tag;
      try {
        tag = findTag(name, client, _);
        showTagDetails(tag, log);
      } finally {
        progress.end();
      }
    });

  tagCommand.command('delete [name] [value]')
    .description($('Remove an entire tag or a tag value'))
    .usage('[options] <name> <value>')
    .option('-n --name <name>', $('Name of the tag to remove.'))
    .option('--value <value>', $('Value of the tag to remove. If not specified, remove the entire tag. ' +
          'If specified, only remove the tag value.'))
    .option('-q, --quiet', $('If not specified, will prompt for confirmation. If specified, won\'t prompt.'))
    .option('--subscription <subscription>', $('The subscription identifier.'))
    .execute(function (name, value, options, _) {
      if (!name) {
        return cli.missingArgument('name');
      }

      var subscription = profile.current.getSubscription(options.subscription);
      var client = utils.createResourceClient(subscription);


      var promptText = value ? util.format($('Delete tag value \'%s\'? [y/n] '), value)
        : util.format($('Delete entire tag \'%s\'? [y/n] '), name);

      if (!options.quiet && !cli.interaction.confirm(promptText, _)) {
        return;
      }

      var progressText = value ? $('Deleting tag value') : $('Deleting tag');
      var progress = cli.interaction.progress(progressText);
      try {
        if (value) {
          client.tags.deleteValue(name, value, _);
        } else {
          //can't delete a tag with associated values, so delete those values first
          var tag = findTag(name, client, _);
          if (!tag) {
            log.info(util.format($('Tag \'%s\' does not exist.'), name));
            return;
          }
          if (tag.values && tag.values.length) {
            for (var i = 0; i < tag.values.length; i++) {
              var valueEntry = extractValueName(tag.values[i].id);
              if (valueEntry) {
                client.tags.deleteValue(name, valueEntry, _);
              }
            }
          }
          client.tags.deleteMethod(name, _);
        }
      } finally {
        progress.end();
      }
    });

  tagCommand.command('list')
  .description($('Lists the tag information'))
  .option('-d, --details', $('Show tag values information as well.'))
  .option('--subscription <subscription>', $('The subscription identifier.'))
  .execute(function (options, _) {
    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.createResourceClient(subscription);
    var progress = cli.interaction.progress($('Listing tags'));
    
    var tags;
    try {
      tags = getTags(client, _);
    } finally {
      progress.end();
    }

    if (options.details) {
      for (var i = 0; i < tags.length; i++) {
        showTagDetails(tags[i], log);
      }
    } else {
      cli.interaction.formatOutput(tags, function (data) {
        if (data.length === 0) {
          log.info($('No tags are defined'));
        } else {
          log.table(data, function (row, tag) {
            row.cell($('Name'), tag.name);
            row.cell($('Count'), getTagCountInfo(tag.count));
          });
        }
      });
    }
  });

  tagCommand.command('show [name]')
  .description($('Get a tag'))
  .option('-n, --name <name>', $('The tag name.'))
  .option('--subscription <subscription>', $('The subscription identifier.'))
  .execute(function (name, options, _) {
    if (!name) {
      return cli.missingArgument('name');
    }
    var subscription = profile.current.getSubscription(options.subscription);
    var client = utils.createResourceClient(subscription);
    var progress = cli.interaction.progress($('Getting tags'));

    var tags;
    try {
      tags = getTags(client, _);
    } finally {
      progress.end();
    }

    //Server side filtering is not supported, so we do it at the client side.
    var tag;
    for (var i = 0; i < tags.length; i++) {
      if (utils.ignoreCaseEquals(tags[i].name, name)) {
        tag = tags[i];
        break;
      }
    }

    if (tag) {
      showTagDetails(tag, log);
    } else {
      log.info(util.format($('tag \'%s\' does not exist.'), name));
    }
  });

};

function showTagDetails(tag, log) {
  log.data($('Name:  '), tag.name);
  log.data($('Count: '), getTagCountInfo(tag.count));

  if (tag.values && tag.values.length > 0) {
    log.data('');
    log.table(tag.values, function (row, item) {
      row.cell($('Value'), extractValueName(item.id));
      row.cell($('Count'), getTagCountInfo(item.count));
    });
    log.data('');
  } else {
    log.data($('Values:  []'));
    log.data($(''));
  }
}

function getTagCountInfo(tagCount) {
  var count = (tagCount.value || 0).toString();
  if (tagCount.type === 'Partial') {
    count = count + '+';
  }
  return count;
}

function getTags(client, _) {
  var result = client.tags.list(_);
  var tags = result.tags;
  while (result.nextLink) {
    result = client.tags.listNext(result.nextLink, _);
    tags = tags.concat(result.tags);
  }
  return tags;
}

function findTag(name, client, _) {
  var tags = getTags(client, _);
  var tag;
  for (var i = 0; i < tags.length; i++) {
    if (utils.ignoreCaseEquals(tags[i].name, name)) {
      tag = tags[i];
      break;
    }
  }
  return tag;
}

function extractValueName(valueFullName) {
  var valueName;
  if (valueFullName) {
    var index = valueFullName.lastIndexOf('/');
    if (index !== -1) {
      valueName = valueFullName.substring(index + 1);
    }
  }
  return valueName;
}