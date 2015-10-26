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
var async = require('async');
var fs = require('fs');
var path = require('path');
var request = require('request');
var sizeOf = require('image-size');
var tv4 = require('tv4');

var fmt = require('util').format;
var $ = require('../../../../../util/utils').getLocaleString;

var constants = require('./packagingConstants');

//
// Deployment template schemas are split across multiple files, and we need them added
// to the validator in advance. Get the list of templates from the validator, then
// download them all and set them up in the validator.
//
function downloadExternalDeploymentTemplateSchemas(initialDownloadUris, failedSchemaUris, done) {
  if (_.isFunction(failedSchemaUris)) {
    done = failedSchemaUris;
    failedSchemaUris = [];
  }

  var urlsToDownload = initialDownloadUris.concat(_.difference(tv4.getMissingUris(), failedSchemaUris));
  if (urlsToDownload.length === 0) {
    return done();
  }

  async.each(urlsToDownload, function (uri, next) {
    request.get(uri, function (err, response, body) {
      // If download fails, just skip, don't fail everything
      // Will result in less validation, but should be fine otherwise
      if (!err && response.statusCode === 200) {
        tv4.addSchema(uri, JSON.parse(body.trim()));
      } else {
        failedSchemaUris.push(uri);
      }
      next();
    });
  }, function () {
    // Loop back around until we've tried to download everything
    downloadExternalDeploymentTemplateSchemas([], failedSchemaUris, done);
  });
}

//
// We also have a set of local schemas in the schemas directory. These have their
// id properties set. Loop through and load them all.
//
function loadLocalSchemas(done) {
  fs.readdir(path.join(__dirname, 'schemas'), function (err, files) {
    if (err) { return done(err); }
    try {
      files.forEach(function (fileName) {
        var schemaPath = path.join('./schemas', fileName);
        // path.join strips out explicit leading '.'. We need it for require, so add it back in.
        schemaPath = ('./' + schemaPath).replace('\\', '/');
        var schema = require(schemaPath);
        tv4.addSchema(schema);
      });
      done();
    } catch (e) {
      done(e);
    }
  });
}

//
// This file contains the various functions used to validate apiapp packages.
// The convention for each validator is of the form:
//    function validator(path, function(err, errors))
//
// Where path = the path of the root of the package directory
// err = any unhandled exception caused by the validation (should always be null/undefined)
// errors = array of error messages if validation fails. If validation succeeds, return an empty array.
//

//
// Infrastructure - compose a set of validators into one validation function
// that runs and composes all the given validator functions.
//
function composedValidator() {
  var validators = _.toArray(arguments);

  return function(packageDir, callback) {
    async.map(validators, function (validator, next) {
      validator(packageDir, next);
    }, function (err, results) {
      if (err) { return callback(err); }
      return callback(null, _.flatten(results));
    });
  };
}

//
// File validators have a slightly different signature:
// function(packageDir, filename, callback)
//   where: packageDir is the top level package directory
//          filename is the full path to the file to validate
//
// The directoryValidator function creates a composed validator that runs
// the given file validator over all files in the given directory.
//
function directoryValidator(rootPath, fileValidator) {
  return function (packageDir, callback) {
    var dirPath = path.join(packageDir, rootPath);
    fs.exists(dirPath, function (exists) {
      if (!exists) { return callback(null, []); }

      fs.readdir(dirPath, function (err, files) {
        if (err) { return callback(err); }

        async.map(files, function (f, next) {
            fileValidator(packageDir, path.join(dirPath, f), next);
          },
          function (err, results) {
            if (err) { return callback(err); }
            return callback(null, _.flatten(results));
          }
        );
      });
    });
  };
}

// Constructor function for json schema validation. Checks that file is
// legitimate json and schema valid if it exists. If it doesn't exist no error.
function isJsonSchemaValid(packageRelativePath, filename, schema) {
  var validator = fileIsJsonSchemaValid(schema);
  return function (packageDir, callback) {
    var jsonPath = path.join(packageDir, packageRelativePath, filename);
    validator(packageDir, jsonPath, callback);
  };
}

// File validator constructor to validate against a specific schema object.
function fileIsJsonSchemaValid(schema) {
  if(_.isString(schema)) {
    schema = tv4.getSchema(schema);
  }
  return function (packageDir, filename, callback) {
    fs.exists(filename, function (exists) {
      if (!exists) { return callback(null, []); }

      fs.readFile(filename, function (err, data) {
        if (err) { return callback(err); }
        var json;
        try {
          json = JSON.parse(data.toString().trim());
        } catch (ex) {
          return callback(null, [
            fmt($('Unable to parse json file %s: line %s: %s'),
              filename, ex.lineNumber, ex.message)
          ]);
        }

        var result = tv4.validateMultiple(json, schema);
        var errors = (result.errors || []).map(function(e) { return fmt('%s: #%s: %s', filename, e.dataPath, e.message); });
        return callback(null, errors);
      });
    });
  };
}

// Helper - read the manifest as parsed JSON from the given package directory
function readManifest(packageDir, callback) {
  var manifestPath = path.join(packageDir, constants.manifestFilename);
  fs.readFile(manifestPath, function (err, data) {
    if (err) { return callback(null, null); }
    try {
      return callback(null, JSON.parse(data.toString().trim()));
    } catch (ex) {
      return callback(null, null);
    }
  });
}

// Does the package directory exist?
function dirExists(packageDir, callback) {
  fs.exists(packageDir, function (exists) {
    var errors = [];
    if (!exists) {
      errors.push(fmt($('Package path %s does not exist'), packageDir));
    }
    callback(null, errors);
  });
}

// Does the manifest file exist in the package directory?
function manifestExists(packageDir, callback) {
  fs.exists(path.join(packageDir, constants.manifestFilename), function (exists) {
    var errors = [];
    if (!exists) {
      errors.push(fmt($('No manifest file apiapp.json in package path %s'), packageDir));
    }
    callback(null, errors);
  });
}

// Is there either an apidef endpoint or a static swagger file?
function hasAtMostOneApiDefinition(packageDir, callback) {
  readManifest(packageDir, function (err, manifest) {
    if (err) { return callback(err); }

    var hasEndpoint = false;

    // Dynamic API definition endpoint given?
    if (manifest && manifest.endpoints && manifest.endpoints.apiDefinition) {
      hasEndpoint = true;
    }

    // Is there a static swagger file?
    var swaggerPath = path.join(packageDir, constants.metadataFolder, constants.apiDefinitionFilename);
    fs.exists(swaggerPath, function (hasStaticFile) {
      if (hasEndpoint && hasStaticFile) {
        return callback(null, [fmt($('Package %s has both dynamic and static api definitions, must only have one'), packageDir)]);
      }
      callback(null, []);
    });
  });
}

function requiredIconsArePresent(packageDir, callback) {
  var iconsPath = path.join(packageDir, constants.iconsFolder);
  fs.exists(iconsPath, function (exists) {
    if (!exists) { return callback(null, []); }

    var requiredIcons = [ 'small.png', 'medium.png', 'large.png', 'wide.png' ];
    var optionalIcons = [ 'hero.png' ];

    fs.readdir(iconsPath, function (err, files) {
      var missingRequiredIcons = _.difference(requiredIcons, files);
      var extraFiles = _.difference(files, requiredIcons.concat(optionalIcons));

      var errors = missingRequiredIcons
        .map(function (ico) { return fmt($('Required icon file %s is not present'), ico); });

      errors = errors.concat(
        extraFiles
          .map(function (f) { return fmt($('Extra file %s found in icons folder'), f); })
      );

      callback(null, errors);
    });
  });
}

// Higher order function to create validation functions to check that
// a given icon has the required size.
function sizeValidator(iconName, width, height) {
  return function(packageDir, callback) {
    var iconPath = path.join(packageDir, iconName + '.png');
    fs.exists(iconPath, function (exists) {
      if (!exists) { return callback(null, []); }

      sizeOf(iconPath, function (err, dimensions) {
        if (err) {
          return callback(null, [
            fmt($('The file %s is not a valid image format'), iconName + '.png')
          ]);
        }
        var errors = [];
        if (dimensions.width !== width || dimensions.height !== height) {
          errors.push(
            fmt($('The icon %s had dimensions %dx%d, but is required to be %dx%d'),
              iconName + '.png', dimensions.width, dimensions.height, width, height)
          );
        }
        callback(null, errors);
      });
    });
  };
}

// Check that the screenshot directory doesn't have more than five screenshots
function screenshotCountValidator(packageDir, callback) {
  var screenshotsPath = path.join(packageDir, constants.screenshotsFolder);
  fs.exists(screenshotsPath, function (exists) {
    if (!exists) { return callback(null, []); }

    fs.readdir(screenshotsPath, function (err, files) {
      if (err) { return callback(err); }
      var errors = [];
      if (files.length > 5) {
        errors.push(fmt(
          $('The screenshots folder may contain at most 5 files, but this package contains %d files'),
          files.length));
      }
      callback(null, errors);
    });
  });
}

// Validate the size and format for each screenshot
var screenshotWidth = 533;
var screenshotHeight = 324;

function screenshotIsRequiredSize(packageDir, filename, callback) {
  var errors = [];
  try {
    var dimensions = sizeOf(filename);
    if (dimensions.type !== 'png') {
      errors.push(fmt($('File %s is not png format, only png is allowed for screenshots'), filename));
    }
    if (dimensions.width !== screenshotWidth || dimensions.height !== screenshotHeight) {
      errors.push(
        fmt(
          $('The screenshot file \'%s\' must have dimensions %dx%d, but is %dx%d'),
          filename, screenshotWidth, screenshotHeight, dimensions.width, dimensions.height
        )
      );
    }
  } catch(ex) {
    if (ex instanceof TypeError) {
      errors.push($('The file %s is not a valid screenshot image'), filename);
    } else {
      return callback(ex);
    }
  }
  return callback(null, errors);
}

//
// Top level validation function - this runs all the individual validations
// and packages the results up with a nice isValid flag.
//
function validatePackageSource(packageDir, callback) {
  dirExists(packageDir, function (err, existsErrors) {
    if (err || existsErrors.length > 0) {
      // Package directory doesn't exist, just bail now.
      return callback(null, { isValid: false, errors: existsErrors });
    }

    loadLocalSchemas(function (err) {
      if (err) { return callback(err); }
      downloadExternalDeploymentTemplateSchemas([constants.templateSchemaUri], function (err) {
        if (err) { return callback(err); }

        var validators = composedValidator(
          manifestExists,
          isJsonSchemaValid('', constants.manifestFilename, constants.manifestSchema),
          hasAtMostOneApiDefinition,
          isJsonSchemaValid(constants.metadataFolder, constants.apiDefinitionFilename, constants.swaggerSchema),
          requiredIconsArePresent,
          sizeValidator('small', 40, 40),
          sizeValidator('medium', 90, 90),
          sizeValidator('large', 115, 115),
          sizeValidator('wide', 255, 115),
          sizeValidator('hero', 815, 290),
          screenshotCountValidator,
          directoryValidator(constants.screenshotsFolder, screenshotIsRequiredSize),
          // Temporarily commented out until websites fixes their csm json schema doc
          // directoryValidator(constants.templatesFolder, fileIsJsonSchemaValid(constants.templateSchemaUri)),
          isJsonSchemaValid(constants.metadataFolder, constants.uiDefinitionFilename, constants.uiDefinitionSchema)
        );

        validators(packageDir, function (err, errors) {
          if (err) { return callback(err); }
          if (errors.length === 0) {
            return callback(null, { isValid: true});
          }
          return callback(null, {isValid: false, errors: errors });
        });
      });
    });
  });
}

module.exports = validatePackageSource;
