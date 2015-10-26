'use strict';

var utils = require('../../../util/utils');
var AvailsetClient = require('./availsetClient');

var $ = utils.getLocaleString;

exports.init = function (cli) {

  var availset = cli.category('availset')
      .description($('Commands to manage your availablilty sets'));

  availset.command('create [resource-group] [name] [location] [tags]')
    .description($('Creates an availability set within a resource group'))
    .usage('[options] <resource-group> <name> <location> [tags]')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the availability set name'))
    .option('-l, --location <location>', $('the location'))
    .option('-t, --tags <tags>', $('the semicolon separated list of tags'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, location, tags, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Availability set name: '), name, _);
      location = cli.interaction.promptIfNotGiven($('Location: '), location, _);
      var availsetClient = new AvailsetClient(cli, options.subscription);
      availsetClient.createAvailSet(resourceGroup, name, location, tags, options, _);
    });

  availset.command('list [resource-group]')
    .description($('Lists the availability sets within a resource group'))
    .usage('[options] <resource-group>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      var availsetClient = new AvailsetClient(cli, options.subscription);
      availsetClient.listAvailSet(resourceGroup, options, _);
    });

  availset.command('show [resource-group] [name]')
    .description($('Gets one availability set within a resource group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resourceGroup>', $('the resource group name'))
    .option('-n, --name <name>', $('the availability set name'))
    .option('-d, --depth <depth>', $('the number of times to recurse, to recurse indefinitely pass "full". (valid only with --json option)'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Availability set name: '), name, _);
        var availsetClient = new AvailsetClient(cli, options.subscription);
        availsetClient.showAvailSet(resourceGroup, name, options, _);
    });

  availset.command('delete [resourceGroup] [name]')
    .description($('Deletes one availability set within a resource group'))
    .usage('[options] <resource-group> <name>')
    .option('-g, --resource-group <resource-group>', $('the resource group name'))
    .option('-n, --name <name>', $('the virtual machine name'))
    .option('-q, --quiet', $('quiet mode, do not ask for delete confirmation'))
    .option('-s, --subscription <subscription>', $('the subscription identifier'))
    .execute(function (resourceGroup, name, options, _) {
      resourceGroup = cli.interaction.promptIfNotGiven($('Resource group name: '), resourceGroup, _);
      name = cli.interaction.promptIfNotGiven($('Availability machine name: '), name, _);
        var availsetClient = new AvailsetClient(cli, options.subscription);
        availsetClient.deleteAvailSet(resourceGroup, name, options, _);
    });

};