var path = require('path');
var fs = require('fs');

var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

walk(path.join(__dirname, '../lib/commands'), function (err, files) {
  var results = [];

  files.forEach(function (file) {
    if (path.extname(file) === '.js' || path.extname(file) === '._js') {
      var content = fs.readFileSync(file).toString();

      var startIndex = 0;
      var found;
      do {
        foundIndex = content.indexOf('$(', startIndex);

        if (foundIndex >= 0) {
          var bracketCount = 0;
          var stop = false;
          for (var i = foundIndex + '$('.length; !stop && i < content.length; i++) {
            if (content[i] === '(') {
              bracketCount++;
            } else if (content[i] === ')') {
              if (bracketCount === 0) {
                var match = content.substr(foundIndex + 3, (i - foundIndex) - 4);
                match = match.replace(/\\'/g, '\'').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
                results.push(match);
                startIndex = i;
                stop = true;
              } else {
                bracketCount--;
              }
            }
          }
        }
      } while (foundIndex > 0);
    }
  });

  var sortedKeys = results.sort();
  var labels = {};
  sortedKeys.forEach(function (label) {
    labels[label] = label;
  });

  fs.writeFileSync(path.join(__dirname, '../lib/locales/en-us.json'), JSON.stringify(labels, null, 4));
});