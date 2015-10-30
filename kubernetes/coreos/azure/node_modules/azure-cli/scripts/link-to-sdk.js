var path = require('path');
var exec = require('child_process').exec;

var linkToPrivateRepo = (process.argv[2] && process.argv[2].indexOf('pr') === 0);

var servicePackages = [
  'computeManagement',
  'gallery',
  'management',
  'monitoring',
  'networkManagement',
  'resourceManagement',
  'scheduler',
  'schedulerManagement',
  'serviceBusManagement',
  'sqlManagement',
  'storageManagement',
  'subscriptionManagement',
  'webSiteManagement',
  'authorizationManagement',
  'extra',
  'hdinsight',
  'apiAppManagement'
];

//
// This script assumes that the node sdk is sitting next to
// the xplat cli on the file system. If not, change the
// below variable to point to it.
//

var root = '../' +  (linkToPrivateRepo ? 'azure-sdk-for-node-pr' : 'azure-sdk-for-node');

var packagesToLink = [ 'lib/common' ].concat(servicePackages.map(function (p) { return 'lib/services/' + p; })).concat('');

var commands = packagesToLink.map(function (path) {
  return 'npm link ' + root + '/' + path;
});

function executeCmds(cmds) {
  if (cmds.length > 0) {
    var current = cmds.shift();
    cwd = path.join(__dirname, '/../');

    exec(current, { cwd: cwd }, function (err, stdout, stderr) {
      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.log(stderr);
      }

      if (err) {
        console.log(err);
      } else {
        executeCmds(cmds);
      }
    });
  }
}

executeCmds(commands);
