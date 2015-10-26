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

var _ = require('underscore');
var JSZip = require('jszip');
var fs = require('fs');
var path = require('path');
var tmp = require('tmp');
var util = require('util');
var walk = require('walk');
var xmlbuilder = require('xmlbuilder');

var constants = require('./packagingConstants');
var dirops = require('./dirops');

function createPackage(sourcePath, destFile, done) {
  tmp.dir({ unsafeCleanup: true }, function (err, stagingPath) {
    if (err) { return done(err); }
    populateStagingDir(sourcePath, stagingPath, function (err) {
      if (err) { return done(err); }

      zipStagingDir(stagingPath, destFile, done);
    });
  });
}

// Given a temporary directory and a source path, fill in the
// contents of the directory to be zipped up.
function populateStagingDir(sourcePath, stagingPath, done) {
  readManifest(sourcePath, function (err, manifest) {
    if (err) { return done(err); }

    createNuspec(stagingPath, manifest, function (err) {
      if (err) { return done(err); }

      copyContents(sourcePath, stagingPath, function (err) {
        if (err) { return done(err); }

        populateNupkgContent(manifest, stagingPath, done);
      });
    });
  });
}

var toSlashedPath = path.sep === '\\' ? windowsToUnixPath : _.identity;

function zipStagingDir(contentPath, outputFile, done) {
    var zip = new JSZip();
    var err = null;
    var walker = walk.walk(contentPath);
    walker.on('file', function (root, stat, next) {
        if (!err) {
          var filePath = path.join(root, stat.name);
          var relativePath = toSlashedPath(path.relative(contentPath, root));
          fs.readFile(filePath, function (readErr, data) {
            if (readErr) { err = readErr; return; }
            var zipPath = path.join(relativePath, stat.name).split(path.sep).join('/');
            zip.file(zipPath, data, { binary: true });
            next();
          });
        } else {
          next();
        }
      })
      .on('end', function () {
        if (!err) {
          var content = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE'});
          fs.writeFile(outputFile, content, function (writeErr) {
            if (writeErr) { err = writeErr; }
            done(err);
          });
        } else {
          done(err);
        }
      });
}

// If we've got a windows style path on a windows system,
// convert the path to forward slashes
function windowsToUnixPath(p) {
  return p.split(path.sep).join('/');
}

function readManifest(sourcePath, done) {
  var manifestPath = path.join(sourcePath, constants.manifestFilename);
  fs.readFile(manifestPath, function (err, data) {
    if (err) { return done(err); }
    try {
      var manifest = JSON.parse(data.toString().trim());
      return done(null, manifest);
    } catch (ex) {
      // If we got here manifest parsing failed.
      return done(ex);
    }
  });
}

function createNuspec(stagingPath, manifest, done) {
  var nuspecContent = createNuSpecXml(manifest);
  fs.writeFile(path.join(stagingPath, nuspecFileName(manifest)), nuspecContent, done);
}

function copyContents(sourcePath, stagingPath, done) {
  var contentPath = path.join(stagingPath, constants.contentFolder);
  dirops.copyDir(sourcePath, contentPath, done);
}

function nuspecFileName(manifest) {
  return util.format('%s.%s.nuspec', manifest.namespace, manifest.id);
}

function populateNupkgContent(manifest, stagingPath, done) {
  gatherExtensions(stagingPath, function (err, extensions) {
    if (err) { return done(err); }

    dirops.writeFile(path.join(stagingPath, constants.relsFolder, constants.relsFilename),
      createRelsXml(manifest), function (err) {
        if (err) { return done(err); }

        dirops.writeFile(path.join(stagingPath, constants.corePropsFolder, constants.psmdcpFilename),
          createCorePropertiesXml(manifest), function (err) {
            if (err) { return done(err); }

            fs.writeFile(path.join(stagingPath, constants.contentTypesFilename), createContentTypesXml(extensions), done);
          }
        );
      }
    );
  });
}

function gatherExtensions(stagingPath, done) {
  var walker = walk.walk(stagingPath);
  var extensions = {};
  walker.on('file', function (root, stats, next) {
      var ext = path.extname(stats.name);
      // Remove leading '.' from extension
      ext = ext.slice(1);
      // Don't save empty extension
      if (ext) {
        extensions[ext] = 1;
      }
      next();
    })
    .on('end', function () {
      done(null, Object.keys(extensions));
    });
}


function createNuSpecXml(manifest) {
  var root = xmlbuilder.create('package', {version: '1.0', encoding: 'utf-8'});
  var metadata = root.ele('metadata');
  metadata.ele('id', util.format('%s.%s', manifest.namespace, manifest.id));
  metadata.ele('version', manifest.version);
  metadata.ele('authors', manifest.author);
  metadata.ele('description', manifest.summary);
  if (manifest.title) {
    metadata.ele('title', manifest.title);
  }
  if (manifest.license && manifest.license.url) {
    metadata.ele('licenseUrl', manifest.license.url);
  }
  var requireAcceptance = !!(manifest.license && manifest.license.requireAcceptance);
  metadata.ele('requireLicenseAcceptance', requireAcceptance.toString());
  if (manifest.copyright) {
    metadata.ele('copyright', manifest.copyright);
  }

  metadata.ele('tags', (manifest.tags || []).join(' '));

  var dependencies = metadata.ele('dependencies');
  var manifestDependencies = manifest.dependencies || [];
  manifestDependencies.forEach(function (d) {
    dependencies.ele('dependency')
      .att('id', d.id)
      .att('version', d.version);
  });
  return root.end({ pretty: true });
}

function createRelsXml(manifest) {
  var ns = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var root = xmlbuilder.create('Relationships', { version: '1.0', encoding: 'utf-8'})
    .att('xmlns', ns);
  root.ele('Relationship')
    .att('Id', 'Rb3d926de4249447a')
    .att('Target', '/' + manifest.namespace + '.' + manifest.id + '.nuspec')
    .att('Type', 'http://schemas.microsoft.com/packaging/2010/07/manifest');
  root.ele('Relationship')
    .att('Id', 'Rd3836e2db0264407')
    .att('Target', '/package/services/metadata/core-properties/f508f799f16345c0a23a6c3f14e671bc.psmdcp')
    .att('Type', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties');

  return root.end({pretty: true});
}

function createCorePropertiesXml(manifest) {
  var nsCore = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
  var nsXsi = 'http://www.w3.org/2011/XMLSchema-instance';
  var nsDc = 'http://purl.org/dc/elements/1.1/';
  var nsDcTerms = 'http://purl.org/dc/terms/';

  var root = xmlbuilder.create('coreProperties', { version: '1.0', encoding: 'utf-8'})
    .att('xmlns:dc', nsDc)
    .att('xmlns:dcterms', nsDcTerms)
    .att('xmlns:xsi', nsXsi)
    .att('xmlns', nsCore);


  root.ele('dc:creator', manifest.author);
  root.ele('dc:description', manifest.summary);
  root.ele('dc:identifier', manifest.namespace + '.' + manifest.id);
  root.ele('version', manifest.version);
  root.ele('dc:language', '');
  root.ele('keywords', (manifest.tags || []).join(','));
  root.ele('dc:title', manifest.title);

  return root.end({pretty: true});
}

function createContentTypesXml(extensions) {
  var ns = 'http://schemas.openxmlformats.org/package/2006/content-types';
  var root = xmlbuilder.create('Types', { version: '1.0', encoding: 'utf-8'})
    .att('xmlns', ns);

  root.ele('Default')
    .att('ContentType', 'application/vnd.openxmlformats-package.relationships+xml')
    .att('Extension', 'rels');

  root.ele('Default')
    .att('ContentType', 'application/vnd.openxmlformats-package.core-properties+xml')
    .att('Extension', 'psmdcp');

  extensions.forEach(function (ext) {
    root.ele('Default')
      .att('ContentType', 'application/octet')
      .att('Extension', ext);
  });

  return root.end({pretty: true});
}

function defaultPackageName(sourcePath, done) {
  readManifest(sourcePath, function (err, manifest) {
    if (err) { return done(err); }
    done(null, util.format('%s.%s.%s.nupkg', manifest.namespace, manifest.id, manifest.version));
  });
}

_.extend(exports, {
  createPackage: createPackage,
  defaultPackageName: defaultPackageName
});
