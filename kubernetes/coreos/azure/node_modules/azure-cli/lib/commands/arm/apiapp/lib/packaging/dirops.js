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

// General operations on files and directories that are missing
// from node core.

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var walk = require('walk');

function copyFile(sourcePath, destPath, done) {
  var s = fs.createReadStream(sourcePath).pipe(fs.createWriteStream(destPath));

  var doneOnce = _.once(done);
  s.on('error', function (err) {
      doneOnce(err);
    })
    // streams event for node 0.10+
    .on('finish', function () { doneOnce(); })
    // streams event for node 0.8
    .on('close', function () { doneOnce(); });
}

// Recursive mkdir - makes sure the entire given directory path
// exists.
function ensureDirExists(destPath, done) {
  fs.mkdir(destPath, function (err) {
    if (err) {
      switch (err.code) {
        case 'ENOENT':
          ensureDirExists(path.dirname(destPath), function (err) {
            if (err) { return done(err); }
            fs.mkdir(destPath, done);
          });
          break;

        case 'EEXIST':
          return done();

        default:
          return done(err);
      }
    } else {
      done();
    }
  });
}

// Copies the entire contents of sourcePath to destPath. Ensures
// destpath already exists.
function copyDir(sourcePath, destPath, done) {
  var inProgressCopies = 0;
  var walkDone = false;

  function copyDone(err) {
    if (inProgressCopies === 0 && walkDone) {
      done(err);
    }
  }

  var walker = walk.walk(sourcePath);

  walker.on('file', function (root, stats, next) {
    var fullPathToFile = path.join(root, stats.name);

    // Node 0.10.23's path.relative method has a bug on windows
    // when using unc paths - the starting double backslash screws it up.
    // Stripping off the first backslash works around the bug.
    var source = sourcePath;
    if (source.slice(0, 2) === '\\\\') {
      source = source.slice(1);
    }
    var relativePathToFile = path.relative(source, fullPathToFile);
    var fullPathToDest = path.join(destPath, relativePathToFile);
    ++inProgressCopies;

    ensureDirExists(path.dirname(fullPathToDest), function (err) {
      if (err) {
        --inProgressCopies;
        return copyDone(err);
      }
      copyFile(fullPathToFile, fullPathToDest, function (err) {
        --inProgressCopies;
        copyDone(err);
      });
    });

    next();
  });

  walker.on('end', function () {
    walkDone = true;
    copyDone();
  });
}

// Recursive rmdir which removes a directory and all its contents.
function removeDir(dir, done) {
  // Have to collect directories and delete them at the end
  // so we delete in proper order

  // path.resolve call normalizes forward and backslashes to match path.sep
  // as well as making path absolute.
  dir = path.resolve(dir);

  var dirs = [dir.split(path.sep)];
  var walker = walk.walk(dir);

  walker.on('files', function (root, stats, next) {
    var numFiles = stats.length;
    stats
      .map(function (stat) { return path.join(root, stat.name); })
      .forEach(function (file) {
        fs.unlink(file, function () {
          --numFiles;
          if (numFiles === 0) {
            next();
          }
        });
      });
  })
  .on('directory', function (root, stats, next) {
    var dirPath = path.resolve(path.join(root, stats.name));
    // Sock the directory away for later, split into path sections
    dirs.push(dirPath.split(path.sep));
    next();
  })
  .on('end', function() {
    // Sort the directories via descending path length, then delete them one by one
    // from deepest to shallowest.
    var numDirs = dirs.length;
    dirs
      .sort(function (a, b) { return b.length - a.length; })
      .map(function (d) { return d.join(path.sep); })
      .forEach(function (dir) {
        fs.rmdir(dir, function () {
          --numDirs;
          if (numDirs === 0) {
            done();
          }
        });
      });
  });
}

// Write a file to the given directory, creating directories along the
// way if required.
function writeFile(filepath, content, done) {
  var dirpath = path.dirname(filepath);
  ensureDirExists(dirpath, function (err) {
    if (err) { return done(err); }
    fs.writeFile(filepath, content, done);
  });
}

_.extend(exports, {
  copy: copyFile,
  ensureDirExists: ensureDirExists,
  copyDir: copyDir,
  removeDir: removeDir,
  writeFile: writeFile
});
