var util = require('util');
var exec = require('child_process').exec,
    child;

var result = {};
child = exec('azure config mode asm', {maxBuffer: 1000*1024}, function (error, stdout, stderr) {
  console.log(stdout);
  child = exec('azure help --json', {maxBuffer: 1000*1024}, function (error, stdout, stderr) {
    var data = JSON.parse(stdout);
    parse(data);
    if (error) {
      console.log('exec error: ' + error);
    }
    child = exec('azure config mode arm', {maxBuffer: 1000*1024}, function (error, stdout, stderr) {
      console.log(stdout);
      child = exec('azure help --json', {maxBuffer: 1000*1024}, function (error, stdout, stderr) {
        var data = JSON.parse(stdout);
        parse(data);
        if (error) {
          console.log('exec error: ' + error);
        }
        var cmds = Object.keys(result);
        console.log(util.inspect(cmds, {depth: null}));
        console.log("The total number of commands for xplat-cli in asm and arm mode is: " + cmds.length);
      });
    });
  });
});

function parse(cmdObj) {
  if (cmdObj) {
    Object.keys(cmdObj).forEach(function(key) {
      if (key === 'commands') {
        cmdObj[key].forEach(function(element) {
          result[element.name] = element.name;
        });
      }
      else {
        parse(cmdObj[key]);
      }
    });
  }
}