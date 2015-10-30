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

exports.buildTagsParameter = function (existingTags, options) {
  var tagsParameter = existingTags;

  //the logic below is to address the possible values of the "tags" field in the "options"
  //One unusual field value is the "true" if the parameter is not specified in the command.
  //The likely cause is the 'commander' framework special cases for the pair of parameters 
  //of "--tags" and "--no-tags".
  if ('tags' in options){
    if (options.tags === false){
      tagsParameter = {};
    } else if (options.tags === true) {
      tagsParameter = existingTags;
    } else {
      tagsParameter = {};
      options.tags.split(';').forEach(function (tagValue) {
        var tv = tagValue.split('=');
        if (tv.length === 2) {
          tagsParameter[tv[0]] = tv[1];
        } else {
          tagsParameter[tv[0]] = '';
        }
      });
    }
  }
  return tagsParameter;
};

exports.appendTags = function (obj, tagsToAppend) {
  if (!obj.hasOwnProperty('tags')) obj.tags = {};
  for (var key in tagsToAppend) {
    obj.tags[key] = tagsToAppend[key];
  }
};

exports.populateQueryFilterWithTagInfo = function (tag, parameters) {
  var tv = tag.split('=');
  if (tv.length > 0) {
    parameters['tagName'] = tv[0];
    parameters['tagValue'] = tv[1];//could be undefined, but that is fine.
  }
};

exports.getTagsInfo = function (tags) {
  var tagsInfo = null;
  for (var tagName in tags) {
    if (tagName.indexOf('hidden-related:/') !== 0) {
      var tagEntity = tags[tagName] ? (tagName + '=' + tags[tagName]) : tagName;
      tagsInfo = tagsInfo ? (tagsInfo + ';' + tagEntity) : tagEntity;
    }
  }
  return tagsInfo;
};