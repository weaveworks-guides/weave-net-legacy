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

var __ = require('underscore');
var fs = require('fs');
var utils = require('../../util/utils');
var profile = require('../../util/profile');
var azureCommon = require('azure-common');
var hdiHelper = require('../../util/hdinsightHelper');
var azureUtil = azureCommon.util;

var $ = utils.getLocaleString;

var UserInteractor = function (cli) {
  var self = this;
  this.cli = cli;
  this.log = cli.output;
  this.progress = null;

  function logErrorAndData(err, data) {
    self.cli.interaction.formatOutput(data, function (outputData) {
      self.log.error(err);
      self.cli.interaction.logEachData('HDInsight Cluster', outputData);
    });
  }

  this.logErrorAndData = logErrorAndData;

  this.checkpoint = function () { };

  function verifyCompat(creationObject, version) {
    if (!creationObject || !creationObject.version || !__.isNumber(creationObject.version)) {
      return false;
    }
    // If the file has a newer version than this library we will not use it.
    if (creationObject.version > version) {
      return false;
    }
    // If the file has the same major version as this library we can use it.
    if (parseInt(creationObject.version, 10) === parseInt(version, 10)) {
      return true;
    }
    // Otherwise the major version of the file is less than this library.
    // That denotes a breaking change in the library and we can not use the file.
    return false;
  }

  this.verifyCompat = verifyCompat;

  function logError(err) {
    self.cli.interaction.formatOutput(err, function () {
      self.log.error(err);
    });
  }

  this.logError = logError;

  function logData(msg, data) {
    self.cli.interaction.formatOutput(data, function (outputData) {
      self.cli.interaction.logEachData(msg, outputData);
    });
  }

  this.logData = logData;

  function logList(list) {
    self.cli.interaction.formatOutput(list, function (outputData) {
      if (outputData.length === 0) {
        self.log.info('No HDInsight clusters exist');
      } else {
        self.log.table(list, function (row, item) {
          row.cell('Name', item.Name);
          row.cell('Location', item.Location);
          row.cell('State', item.State);
        });
      }
    });
  }

  this.logList = logList;

  function promptIfNotGiven(message, value, _) {
    return self.cli.interaction.promptIfNotGiven(message, value, _);
  }

  this.promptIfNotGiven = promptIfNotGiven;

  function startProgress(message) {
    self.progress = self.cli.interaction.progress(message);
  }

  this.startProgress = startProgress;

  function endProgress() {
    self.progress.end();
  }

  this.endProgress = endProgress;

  function writeConfig(filePath, config) {
    var data = JSON.stringify(config);
    fs.writeFileSync(filePath, data);
  }

  this.writeConfig = writeConfig;

  function readConfig(filePath) {
    var data = fs.readFileSync(filePath);
    return JSON.parse(data);
  }

  this.readConfig = readConfig;
};

var ExecutionProcessor = function (cli) {
  var self = this;
  this.cli = cli;
  this.errorCount = 0;

  this.createHDInsightClusterManagementClient = function (regionCloudServiceName) {
    return utils.getHDInsightClusterManagementClient(regionCloudServiceName, profile.current.getSubscription());
  };

  this.createHDInsightCluster2ManagementClient = function (regionCloudServiceName) {
    return utils.getHDInsightCluster2ManagementClient(regionCloudServiceName, profile.current.getSubscription());
  };

  this.createCluster = function (regionCloudServiceName, clusterName, clusterCreationPayload, _) {
    var hdInsight = self.createHDInsightClusterManagementClient(regionCloudServiceName);
    var result = hdInsight.clusterManagement.create(clusterName, clusterCreationPayload, _);
    return result;
  };

  this.createCluster2 = function (regionCloudServiceName, clusterName, clusterCreationPayload, _) {
    var hdInsight2 = self.createHDInsightCluster2ManagementClient(regionCloudServiceName);
    var result = hdInsight2.clusterManagement.create(clusterName, clusterCreationPayload, _);
    return result;
  };

  this.getCluster = function (regionCloudServiceName, clusterName, _) {
    var hdInsight = self.createHDInsightClusterManagementClient(regionCloudServiceName);
    var result = hdInsight.clusterManagement.get(clusterName, _);
    return result;
  };

  this.getCluster2 = function (regionCloudServiceName, clusterName, _) {
    var hdInsight2 = self.createHDInsightCluster2ManagementClient(regionCloudServiceName);
    var result = hdInsight2.clusterManagement.get(clusterName, _);
    return result;
  };

  this.deleteCluster = function (regionCloudServiceName, clusterName, _) {
    var hdInsight = self.createHDInsightClusterManagementClient(regionCloudServiceName);
    var result = hdInsight.clusterManagement.deleteMethod(clusterName, _);
    return result;
  };

  this.deleteCluster2 = function (regionCloudServiceName, clusterName, _) {
    var hdInsight2 = self.createHDInsightCluster2ManagementClient(regionCloudServiceName);
    var result = hdInsight2.clusterManagement.deleteMethod(clusterName, _);
    return result;
  };

  this.listClusters = function (credentials, _) {
    var hdInsight = self.createHDInsightClusterManagementClient('cloudServiceName');
    var result = hdInsight.clusterManagement.list(_);
    return result;
  };

  this.listClusters2 = function (credentials, _) {
    var hdInsight2 = self.createHDInsightCluster2ManagementClient('cloudServiceName');
    var result = hdInsight2.clusterManagement.list(_);
    return result;
  };

  this.createHDInsightJobManagementClient = function (clusterDnsName, userName, password) {
    return utils.getHDInsightJobManagementClient(clusterDnsName, userName, password);
  };

  this.submitHDInsightHiveJob = function (clusterDnsName, userName, password, parameters, _) {
    var hdInsightJobClient = self.createHDInsightJobManagementClient(clusterDnsName, userName, password);

    var result = hdInsightJobClient.jobManagement.submitHiveJob(parameters, _);
    return result;
  };

  this.submitHDInsightPigJob = function (clusterDnsName, userName, password, parameters, _) {
    var hdInsightJobClient = self.createHDInsightJobManagementClient(clusterDnsName, userName, password);
    var result = hdInsightJobClient.jobManagement.submitPigJob(parameters, _);
    return result;
  };

  this.submitHDInsightMapReduceJob = function (clusterDnsName, userName, password, parameters, _) {
    var hdInsightJobClient = self.createHDInsightJobManagementClient(clusterDnsName, userName, password);
    var result = hdInsightJobClient.jobManagement.submitMapReduceJob(parameters, _);
    return result;
  };

  this.submitHDInsightStreamingMapReduceJob = function (clusterDnsName, userName, password, parameters, _) {
    var hdInsightJobClient = self.createHDInsightJobManagementClient(clusterDnsName, userName, password);
    var result = hdInsightJobClient.jobManagement.submitMapReduceStreamingJob(parameters, _);
    return result;
  };

  this.getHDInsightJob = function (clusterDnsName, userName, password, jobId, _) {
    var hdInsightJobClient = self.createHDInsightJobManagementClient(clusterDnsName, userName, password);
    var result = hdInsightJobClient.jobManagement.getJob(jobId, _);
    return result;
  };

  this.listHDInsightJobs = function (clusterDnsName, userName, password, _) {
    var hdInsightJobClient = self.createHDInsightJobManagementClient(clusterDnsName, userName, password);
    var result = hdInsightJobClient.jobManagement.listJobs(_);
    return result.jobList;
  };
};

var hdInsightCommandLine = function (cli, userInteractor, executionProcessor) {
  this.cli = cli;
  this.log = cli.output;
  self = this;
  if (userInteractor) {
    this.user = userInteractor;
  }
  else {
    this.user = new UserInteractor(this.cli);
  }

  if (executionProcessor) {
    this.processor = executionProcessor;
  }
  else {
    this.processor = new ExecutionProcessor(this.cli);
  }

  this.createClusterCommand = function (clusterName, osType, storageAccountName, storageAccountKey, storageContainer, dataNodeCount, headNodeSize, dataNodeSize, location, userName, password, sshUserName, sshPassword, _) {

    clusterName = self.user.promptIfNotGiven($('Cluster name: '), clusterName, _);
    osType = self.user.promptIfNotGiven($('OS type: '), osType, _);
    storageAccountName = self.user.promptIfNotGiven($('storage account url: '), storageAccountName, _);
    storageAccountKey = self.user.promptIfNotGiven($('storage account key: '), storageAccountKey, _);
    storageContainer = self.user.promptIfNotGiven($('storage container name: '), storageContainer, _);
    dataNodeCount = self.user.promptIfNotGiven($('Number of data nodes: '), dataNodeCount, _);
    location = self.user.promptIfNotGiven($('Data center location: '), location, _);
    userName = self.user.promptIfNotGiven($('User name: '), userName, _);
    password = self.user.promptIfNotGiven($('Password: '), password, _);

    var clusterCreationPayload = {};
    if (osType === 'windows') {
      headNodeSize = self.user.promptIfNotGiven($('Head node size (string): '), headNodeSize, _);
      dataNodeSize = self.user.promptIfNotGiven($('Data node size (string): '), dataNodeSize, _);

      var clusterPayload = hdiHelper.createClusterPayloadWindows(clusterName, storageAccountName, storageAccountKey, storageContainer, dataNodeCount, headNodeSize, dataNodeSize, location, userName, password);

      clusterCreationPayload = { 'payload': clusterPayload };
    }
    else if (osType === 'linux') {
      sshUserName = self.user.promptIfNotGiven($('SSH user name: '), sshUserName, _);
      sshPassword = self.user.promptIfNotGiven($('SSH password: '), sshPassword, _);
      var subscriptionId = profile.current.getSubscription().id;

      var cluster2Payload = hdiHelper.createClusterPayloadLinux(clusterName, storageAccountName, storageAccountKey, storageContainer, dataNodeCount, headNodeSize, dataNodeSize, location, userName, password, sshUserName, sshPassword, subscriptionId);

      clusterCreationPayload = { 'payload': cluster2Payload };
    }

    var regionCloudServiceName = azureUtil.getNameSpace(profile.current.getSubscription().id, 'hdinsight', location);

    self.user.startProgress($('Submitting the request to create cluster...'));

    var result;
    if (osType === 'windows') {
      result = self.processor.createCluster(regionCloudServiceName, clusterName, clusterCreationPayload, _);
    }
    else if (osType === 'linux') {
      result = self.processor.createCluster2(regionCloudServiceName, clusterName, clusterCreationPayload, _);
    }
    self.user.endProgress();

    if (self.log.format().json) {
      self.log.json(result);
    }
    else {
      self.log.data($('Cluster ID  :'), result.id);
      self.log.data($('Status      :'), result.status);
    }
  };

  this.showClusterCommand = function (clusterName, osType, options, _) {
    clusterName = self.user.promptIfNotGiven($('Cluster name: '), clusterName, _);
    osType = self.user.promptIfNotGiven($('OS type: '), osType, _);

    var regionCloudServiceName = azureUtil.getNameSpace(profile.current.getSubscription().id, 'hdinsight', 'location');
    self.user.startProgress($('Getting HDInsight cluster details'));

    var cluster;
    if (osType == 'windows') {
      cluster = self.processor.getCluster(regionCloudServiceName, clusterName, _);
    }
    else if (osType == 'linux') {
      cluster = self.processor.getCluster2(regionCloudServiceName, clusterName, _);
    }
    self.user.endProgress();

    if (!cluster.passthroughResponse.data) {
      self.log.data($('Cluster not found.'));
    }
    else {
      var clusterInfo = cluster.passthroughResponse.data;
      if (self.log.format().json) {
        self.log.json(clusterInfo);
      }
      else {
        self.log.data($('HDInsight Cluster Info'));
        self.log.data($('----------------------'));
        self.log.data($('Name          :'), clusterInfo.id || clusterInfo.dnsName);
        self.log.data($('State         :'), clusterInfo.state);
        self.log.data($('Location      :'), clusterInfo.location);
        self.log.data($('Version       :'), clusterInfo.version || clusterInfo.hdiVersion);
      }
    }
  };

  this.listClustersCommand = function (options, _) {
    self.user.startProgress($('Getting HDInsight servers'));
    var result = self.processor.listClusters(options.subscription, _).cloudService;
    self.user.endProgress();

    //construct the object to display
    var clusters = [];
    result.forEach(function (item) {
      item.resources.forEach(function (res) {
        var cluster = {};
        cluster.name = res.name;
        cluster.state = res.state;
        cluster.subState = res.subState;
        cluster.region = item.geoRegion;
        res.outputItems.forEach(function (op) {
          if (op.key === 'OsType') {
            cluster.osType = op.value;
          }
          if (op.key === 'Version') {
            cluster.version = op.value;
          }
        });
        clusters.push(cluster);
      });
    });
    if (result.length === 0) {
      self.log.data($('No clusters found.'));
    }
    else if (self.log.format().json) {
      self.log.json(result);
    }
    else {
      self.cli.interaction.formatOutput(clusters, function (outputData) {
        self.log.table(outputData, function (row, item) {
          row.cell('Name', item.name);
          row.cell('State', item.state);
          row.cell('Substate', item.subState);
          row.cell('Region', item.region);
          row.cell('Version', item.version);
          row.cell('OsType', item.osType || 'Windows Server 2012');
        });
      });
    }
  };

  this.deleteClusterCommand = function (clusterName, location, osType, options, _) {
    clusterName = self.user.promptIfNotGiven($('Cluster name: '), clusterName, _);
    location = self.user.promptIfNotGiven($('Location: '), location, _);
    osType = self.user.promptIfNotGiven($('OS type: '), osType, _);

    var regionCloudServiceName = azureUtil.getNameSpace(profile.current.getSubscription().id, 'hdinsight', location);
    self.user.startProgress($('Deleting HDInsight Cluster'));

    if (osType == 'windows') {
      self.processor.deleteCluster(regionCloudServiceName, clusterName, _);
    }
    if (osType == 'linux') {
      self.processor.deleteCluster2(regionCloudServiceName, clusterName, _);
    }
    self.user.endProgress();
  };

  // START: HDInsight job submission commands
  this.submitHDInsightHiveJobCommand = function (clusterDnsName, userName, password, options, _) {
    clusterDnsName = self.user.promptIfNotGiven($('Cluster name: '), clusterDnsName, _);
    userName = self.user.promptIfNotGiven($('User name: '), userName, _);
    password = self.user.promptIfNotGiven($('Password: '), password, _);
    var parameters = {};
    parameters.userName = userName;
    parameters.enableLog = false;
    parameters.statusDir = '.';
    parameters.query = '';
    parameters.file = '';
    parameters.files = '';
    parameters.defines = '';
    parameters['arguments'] = '';

    if (options.query && options.queryFile) {
      throw new Error($('Either provide the query or queryFile parameter.'));
    }
    if (options.query) {
      parameters.query = options.query;
    }
    if (options.queryFile) {
      parameters.file = options.queryFile;
    }
    if (options.defines) {
      parameters.defines = options.defines;
    }
    if (options['arguments']) {
      parameters['arguments'] = options['arguments'];
    }
    if (options.files) {
      parameters.files = options.files;
    }

    var result = self.processor.submitHDInsightHiveJob(clusterDnsName, userName, password, parameters, _);
    var response = result.jobSubmissionJsonResponse;
    if (self.log.format().json) {
      self.log.json(response);
    }
    self.log.data($('Job Id      :'), response.id);
  };

  this.submitHDInsightPigJobCommand = function (clusterDnsName, userName, password, options, _) {
    clusterDnsName = self.user.promptIfNotGiven($('Cluster name: '), clusterDnsName, _);
    userName = self.user.promptIfNotGiven($('User name: '), userName, _);
    password = self.user.promptIfNotGiven($('Password: '), password, _);
    var parameters = {};
    parameters.userName = userName;
    parameters.query = '';
    parameters.file = '';
    parameters.files = '';
    parameters['arguments'] = '';

    if (options.query && options.queryFile) {
      throw new Error($('Either provide the query or queryFile parameter.'));
    }
    if (options.query) {
      parameters.query = options.query;
    }
    if (options.queryFile) {
      parameters.file = options.queryFile;
    }
    if (options['arguments']) {
      parameters['arguments'] = options['arguments'];
    }
    if (options.files) {
      parameters.files = options.files;
    }
    var result = self.processor.submitHDInsightPigJob(clusterDnsName, userName, parameters, _);

    var response = result.jobSubmissionJsonResponse;
    if (self.log.format().json) {
      self.log.json(response);
    }
    self.log.data($('Job Id      :'), response.id);
  };

  this.submitHDInsightMapReduceJobCommand = function (clusterDnsName, userName, password, options, _) {
    clusterDnsName = self.user.promptIfNotGiven($('Cluster name: '), clusterDnsName, _);
    userName = self.user.promptIfNotGiven($('User name: '), userName, _);
    password = self.user.promptIfNotGiven($('Password: '), password, _);
    var parameters = {};
    parameters.userName = userName;
    parameters['className'] = '';
    parameters.jarFile = '';
    parameters.libJars = '';
    parameters.files = '';
    parameters.defines = '';
    parameters['arguments'] = '';

    if (options.jarFile) {
      parameters.jarFile = options.jarFile;
    }
    if (options.libJars) {
      parameters.libJars = options.libJars;
    }
    if (options.defines) {
      parameters.defines = options.defines;
    }
    if (options['arguments']) {
      parameters['arguments'] = options['arguments'];
    }
    if (options['className']) {
      parameters['className'] = options['className'];
    }
    if (options.files) {
      parameters.files = options.files;
    }
    var result = self.processor.submitHDInsightMapReduceJob(clusterDnsName, userName, password, parameters, _);
    var response = result.jobSubmissionJsonResponse;
    if (self.log.format().json) {
      self.log.json(response);
    }
    self.log.data($('Job Id      :'), response.id);
  };

  this.submitHDInsightStreamingMapReduceJobCommand = function (clusterDnsName, userName, password, options, _) {
    clusterDnsName = self.user.promptIfNotGiven($('Cluster name: '), clusterDnsName, _);
    userName = self.user.promptIfNotGiven($('User name: '), userName, _);
    password = self.user.promptIfNotGiven($('Password: '), password, _);
    var parameters = {};
    parameters.userName = userName;
    parameters['arguments'] = '';
    parameters.mapper = '';
    parameters.reducer = '';
    parameters.combiner = '';
    parameters.cmdenv = '';
    parameters.outputPath = '';
    parameters.files = '';
    parameters.defines = '';
    parameters.inputPath = '';

    if (options.mapper) {
      parameters.mapper = options.mapper;
    }
    if (options.combiner) {
      parameters.combiner = options.combiner;
    }
    if (options.reducer) {
      parameters.reducer = options.reducer;
    }
    if (options.cmdenv) {
      parameters.cmdenv = options.cmdenv;
    }
    if (options.outputPath) {
      parameters.outputPath = options.outputPath;
    }
    if (options.inputPath) {
      parameters.inputPath = options.inputPath;
    }
    if (options.defines) {
      parameters.defines = options.defines;
    }
    if (options['arguments']) {
      parameters['arguments'] = options['arguments'];
    }
    if (options.files) {
      parameters.files = options.files;
    }
    var result = self.processor.submitHDInsightStreamingMapReduceJob(clusterDnsName, userName, password, parameters, _);
    var response = result.jobSubmissionJsonResponse;
    if (self.log.format().json) {
      self.log.json(response);
    }
    self.log.data($('Job Id      :'), response.id);
  };

  this.getHDInsightJobCommand = function (clusterDnsName, userName, password, jobId, _) {
    clusterDnsName = self.user.promptIfNotGiven($('Cluster name: '), clusterDnsName, _);
    userName = self.user.promptIfNotGiven($('User name: '), userName, _);
    password = self.user.promptIfNotGiven($('Password: '), password, _);
    jobId = self.user.promptIfNotGiven($('JobId: '), jobId, _);
    self.user.startProgress($('Listing HDInsight Job details for ' + jobId + ' on ' + clusterDnsName));
    var result = self.processor.getHDInsightJob(clusterDnsName, userName, password, jobId, _);
    self.user.endProgress();

    if (!result.jobDetail) {
      self.log.data($('Job not found.'));
    }
    else {
      var jobInfo = result.jobDetail;
      if (self.log.format().json) {
        self.log.json(jobInfo);
      }
      else {
        self.log.data($('HDInsight Job Info'));
        self.log.data($('------------------'));
        self.log.data($('Job Id      :'), jobInfo.id);
        self.log.data($('Job State   :'), jobInfo.status.state);
      }
    }
  };

  this.listHDInsightJobsCommand = function (clusterDnsName, userName, password, _) {
    clusterDnsName = self.user.promptIfNotGiven($('Cluster name: '), clusterDnsName, _);
    userName = self.user.promptIfNotGiven($('User name: '), userName, _);
    password = self.user.promptIfNotGiven($('Password: '), password, _);
    self.user.startProgress($('Listing HDInsight Jobs for cluster ' + clusterDnsName));
    var jobList = self.processor.listHDInsightJobs(clusterDnsName, userName, password, _);
    self.user.endProgress();
    self.cli.interaction.formatOutput(jobList, function (outputData) {
      if (outputData.length === 0) {
        self.log.data($('No jobs found.'));
      }
      else {
        if (self.log.format().json) {
          self.log.json(outputData);
        }
        else {
          self.log.table(outputData, function (row, item) {
            row.cell('Job Id', item.id);
          });
        }
      }
    });
  };
};

module.exports = hdInsightCommandLine;

hdInsightCommandLine.init = function (cli) {
  var self = new hdInsightCommandLine(cli);

  var hdInsight = cli.category('hdinsight')
    .description($('Commands to manage HDInsight clusters and jobs'));

  var cluster = hdInsight.category('cluster')
    .description($('Commands to manage HDInsight clusters'));

  cluster.command('create [clusterName] [osType] [storageAccountName] [storageAccountKey] [storageContainer] [dataNodeCount] [headNodeSize] [dataNodeSize] [location] [userName] [password] [sshUserName] [sshPassword]')
    .description($('Create a cluster'))
    .usage('[options] <clusterName> <osType> <storageAccountName> <storageAccountKey> <storageContainer> <dataNodeCount> <headNodeSize> <dataNodeSize> <location> <userName> <password> <sshUserName> <sshPassword>')
    .option('--clusterName <clusterName>', $('HDInsight cluster name'))
    .option('--osType <osType>', $('HDInsight cluster operating system - \'windows\' or \'linux\''))
    .option('--storageAccountName <storageAccountName>', $('Storage account url to use for default HDInsight storage'))
    .option('--storageAccountKey <storageAccountKey>', $('Key to the storage account to use for default HDInsight storage'))
    .option('--storageContainer <storageContainer>', $('Container in the storage account to use for HDInsight default storage'))
    .option('--dataNodeCount <dataNodeCount>', $('Number of data nodes to use for the cluster'))
    .option('--headNodeSize <headNodeSize>', $('NOTE: Head node size for the cluster (only allowed for \'windows\' ostype)'))
    .option('--dataNodeSize <dataNodeSize>', $('NOTE: Data node size for the cluster (only allowed for \'windows\' ostype)'))
    .option('--location <location>', $('Data center location for the cluster'))
    .option('--userName <userName>', $('Cluster username'))
    .option('--password <password>', $('Cluster password'))
    .option('--sshUserName <sshUserName>', $('SSH username'))
    .option('--sshPassword <sshPassword>', $('SSH password'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.createClusterCommand);

  cluster.command('delete [clusterName] [location] [osType]')
    .description($('Delete a cluster'))
    .usage('[options] <clusterName> <location> <osType>')
    .option('--clusterName <clusterName>', $('Cluster name'))
    .option('--location <location>', $('Cluster location'))
    .option('--osType <osType>', $('Cluster OS type'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.deleteClusterCommand);

  cluster.command('show [clusterName] [osType]')
    .description($('Show cluster details'))
    .usage('[options] <clusterName> <osType>')
    .option('--clusterName <clusterName>', $('the HdInsight cluster name'))
    .option('--osType <osType>', $('the HdInsight cluster operating system: windows OR linux'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.showClusterCommand);

  cluster.command('list')
    .description($('List the clusters'))
    .execute(self.listClustersCommand);

  // START: HDInsight job management commands
  var job = hdInsight.category('job')
      .description($('Commands to manage HDInsight jobs'));

  job.command('hive_create [clusterDnsName] [userName] [password]')
    .description($('Submits a Hive job to an HdInsight cluster'))
    .usage('[options] <clusterDnsName> <userName> <password>')
    .option('--clusterDnsName <clusterDnsName>', $('Fully qualified cluster DNS name. Example: mycluster.azurehdinsight.net'))
    .option('--userName <userName>', $('User name for the cluster'))
    .option('--password <password>', $('Password for the cluster'))
    .option('--query <query>', $('The Hive query string to be executed'))
    .option('--queryFile <queryFile>', $('The path to a file that contains the Hive query to be executed; this parameter and the [query] parameter are mutually exclusive'))
    .option('--arguments <arguments>', $('A comma separated string of arguments to be passed to the Hive job. For example: "a1,a2,a3"'))
    .option('--defines <defines>', $('A key/value pair of Hadoop configuration values to be set during the Hive job execution. For example: "k1=v1,k2=v2"'))
    .option('--files <files>', $('A comma separated string of file paths required for the Hive job to execute. For example: "f1/f2/f3,f4/f5,f6"'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.submitHDInsightHiveJobCommand);

  /*job.command('pig_create [clusterDnsName] [userName] [password] [query]')
    .description($('Submits a Pig job to an HdInsight cluster'))
    .usage('[options] <clusterDnsName> <userName> <password> <query>')
    .option('--clusterDnsName <clusterDnsName>', $('Fully qualified cluster DNS name. Example: mycluster.azurehdinsight.net'))
    .option('--userName <userName>', $('User name for the cluster'))
    .option('--password <password>', $('Password for the cluster'))
    .option('--query <query>', $('The Pig query string to be executed'))
    .option('--queryFile <queryFile>', $('The path to a file that contains the Pig query to be executed; this and the [query] parameter are mutually exclusive'))
    .option('--arguments <arguments>', $('A comma separated string of arguments to be passed to the Pig job. For example: "a1,a2,a3"'))
    .option('--files <files>', $('A comma separated string of file paths required for the Pig job to execute. For example: "f1/f2/f3,f4/f5,f6"'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.submitHDInsightPigJobCommand);*/

  job.command('mr_create [clusterDnsName] [userName] [password] [className] [jarFile]')
    .description($('Submits a MapReduce job to an HdInsight cluster'))
    .usage('[options] <clusterDnsName> <userName> <password> <className> <jarFile>')
    .option('--clusterDnsName <clusterDnsName>', $('Fully qualified cluster DNS name. Example: mycluster.azurehdinsight.net'))
    .option('--userName <userName>', $('User name for the cluster'))
    .option('--password <password>', $('Password for the cluster'))
    .option('--className <className>', $('Name of the job class in the job JAR file'))
    .option('--jarFile <jarFile>', $('The fully qualified name of the JAR file that contains the code and dependencies of the MapReduce job'))
    .option('--arguments <arguments>', $('A comma separated string of arguments to be passed to the MapReduce job. For example: "a1,a2,a3"'))
    .option('--defines <defines>', $('A key/value pair of Hadoop configuration values to be set during the MapReduce job execution. For example: "k1=v1,k2=v2"'))
    .option('--files <files>', $('A comma separated string of file paths required for the MapReduce job to execute. For example: "f1/f2/f3,f4/f5,f6"'))
    .option('--libJars <libJars>', $('The Jar library references for the MapReduce job'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.submitHDInsightMapReduceJobCommand);

  job.command('mr_streaming_create [clusterDnsName] [userName] [password] [mapper] [reducer]')
    .description($('Submits a Streaming MapReduce job to an HdInsight cluster'))
    .usage('[options] <clusterDnsName> <userName> <password> <mapper> <reducer>')
    .option('--clusterDnsName <clusterDnsName>', $('Fully qualified cluster DNS name. Example: mycluster.azurehdinsight.net'))
    .option('--userName <userName>', $('User name for the cluster'))
    .option('--password <password>', $('Password for the cluster'))
    .option('--arguments <arguments>', $('A comma separated string of arguments to be passed to the Streaming MapReduce job. For example: "a1,a2,a3"'))
    .option('--cmdenv <cmdEnv>', $('Comma separated key/value pairs of environment variables that should be set during the Streaming MapReduce job execution on data nodes'))
    .option('--mapper <combiner>', $('Mapper executable name for the Streaming MapReduce job'))
    .option('--reducer <reducer>', $('Reducer executable name for the Streaming MapReduce job'))
    .option('--combiner <combiner>', $('Combiner executable name for the Streaming MapReduce job'))
    .option('--defines <defines>', $('A comma separated key/value pair of Hadoop configuration values to be set during the Streaming MapReduce job execution. For example: "k1=v1,k2=v2"'))
    .option('--files <files>', $('A comma separated string of file paths required for the Streaming MapReduce job to execute. For example: "f1/f2/f3,f4/f5,f6"'))
    .option('--inputPath <inputPath>', $('Location of the input files for the Streaming MapReduce job'))
    .option('--outputPath <outputPath>', $('Location of the output files for the Streaming MapReduce job'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.submitHDInsightStreamingMapReduceJobCommand);

  job.command('show [clusterDnsName] [userName] [password] [jobId]')
    .description($('Retrieves the details of the specified job from an HDInsight cluster'))
    .usage('[options] <clusterDnsName> <userName> <password> <jobId>')
    .option('--clusterDnsName <clusterDnsName>', $('Fully qualified cluster DNS name. Example: mycluster.azurehdinsight.net'))
    .option('--userName <userName>', $('User name for the cluster'))
    .option('--password <password>', $('Password for the cluster'))
    .option('--jobId <jobId>', $('The Id of the job for which the details need to be retrieved'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.getHDInsightJobCommand);

  job.command('list [clusterDnsName] [userName] [password]')
    .description($('Retrieves the list of jobs from the specified HDInsight cluster'))
    .usage('[options] <clusterDnsName> <userName> <password>')
    .option('--clusterDnsName <clusterDnsName>', $('Fully qualified cluster DNS name. Example: mycluster.azurehdinsight.net'))
    .option('--userName <userName>', $('User name for the cluster'))
    .option('--password <password>', $('Password for the cluster'))
    .option('-s, --subscription <id>', $('the subscription id'))
    .execute(self.listHDInsightJobsCommand);
  // END: HDInsight job management commands
};