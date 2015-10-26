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

var url = require('url');
var fs = require('fs');
var util = require('util');
var GitHubApi = require('github');

var utils = require('../utils');
var $ = utils.getLocaleString;

var WebsitesClient = require('../../commands/asm/websites/websitesclient');

/*jshint camelcase:false*/
var child_process = require('child_process');

exports.createClient = function (cli, name, websitesClient) {
  switch (name) {
  case 'github':
    return new GithubClient(cli, websitesClient);
  case 'git':
    return new GitClient(cli, websitesClient);
  default:
    throw new Error('Invalid client');
  }
};

exports.LinkedRevisionControlClient = LinkedRevisionControlClient;
exports.GithubClient = GithubClient;
exports.GitClient = GitClient;

function LinkedRevisionControlClient(cli, websitesClient) {
  this.cli = cli;
  this.websitesClient = websitesClient;
  this.log = cli.output;
}

/**
* Returns a specific repository based on its github full name.
*
* @param {array}  repositories         The list of github repositories.
* @param {string} remoteFullName       The repository full name.
*
*/
LinkedRevisionControlClient._getRepository = function (repositories, remoteFullName) {
  return repositories.filter(function (repository) {
    return repository.full_name === remoteFullName;
  })[0];
};

/**
* Returns a specific repository based on its github clone uri.
*
* @param {array}  repositories         The list of github repositories.
* @param {string} remoteUri            The repository clone url.
*
*/
LinkedRevisionControlClient._getRepositoryCloneUrl = function (repositories, remoteUri) {
  return repositories.filter(function (repository) {
    return repositoryMatchUri(repository, remoteUri);
  })[0];
};

function repositoryMatchUri (repository, remoteUri) {
  var cleanUri = url.parse(remoteUri);
  // Make sure there is no auth when comparing
  delete cleanUri.auth;
  cleanUri = url.format(cleanUri);

  return repository.clone_url.toLowerCase() === cleanUri.toLowerCase() ||
    repository.html_url.toLowerCase() === cleanUri.toLowerCase() ||
    repository.ssh_url.toLowerCase() === cleanUri.toLowerCase() ||
    repository.git_url.toLowerCase() === cleanUri.toLowerCase();
}

/**
* Determines if the current directory is within a git repository tree.
*/
LinkedRevisionControlClient.prototype.determineIfCurrentDirectoryIsGitWorkingTree = function (context, _) {
  this.log.silly('determineIfCurrentDirectoryIsGitWorkingTree');

  try {
    var isInsideWorkTree = this._exec('git rev-parse --git-dir', _);
    var lines = isInsideWorkTree.stdout + isInsideWorkTree.stderr;
    if (!context.flags) {
      context.flags = { };
    }

    context.flags.isGitWorkingTree = lines.split('\n').some(function (line) {
      return line === '.git';
    });
  } catch (err) {
    context.flags.isGitWorkingTree = false;
  }
};

LinkedRevisionControlClient.prototype.scaffoldGitIgnore = function (_) {
  if (!fs.existsSync('.gitignore')) {
    fs.writeFile('.gitignore', 'node_modules\nazure.err\n*.publishsettings', _);
  }
};

/**
* Initializes a git repository in the current directory.
*/
LinkedRevisionControlClient.prototype.initGitOnCurrentDirectory = function (context, scaffold, _) {
  this.log.silly('initGitOnCurrentDirectoryIfNeeded');
  if (!context.flags.isGitWorkingTree) {
    this.log.info('Executing `git init`');
    this._exec('git init', _);

    context.flags.isGitWorkingTree = true;
  }

  if (scaffold) {
    this.scaffoldGitIgnore(_);
  }
};

LinkedRevisionControlClient.prototype._exec = function (cmd, cb) {
  child_process.exec(cmd, function (err, stdout, stderr) {
    cb(err, {
      stdout: stdout,
      stderr: stderr
    });
  });
};

LinkedRevisionControlClient.prototype._initializeRemoteRepos = function (context, _) {
  var self = this;

  self.log.silly('InitializeRemoteRepo');
  if (!context.flags.siteExists) {
    self.websitesClient.createRepository(context, _);
    context.repo = self.websitesClient.getRepository(context, _);
  } else {
    context.repo = self.websitesClient.getRepository(context, _);
    if (!context.repo) {
      self.websitesClient.createRepository(context, _);
      context.repo = self.websitesClient.getRepository(context, _);
    }
  }

  self.log.silly('context.repo', context.repo);
};

LinkedRevisionControlClient.prototype._addRemotesToLocalGitRepo = function (context, _) {
  var self = this;

  if (context.site.slot) {
    context.site.localGitRemote = util.format('azure-%s', context.site.slot);
  } else {
    context.site.localGitRemote = 'azure';
  }

  self.log.silly('addRemoteToLocalGitRepo');
  if (!context.flags.isGitWorkingTree) {
    self.log.info('To create a local git repository to publish to the remote site, please rerun this command with the --git flag: "azure site create ' + ((context.site && context.site.name) || '{site name}') + ' --git".');
    return;
  }

  if (!context.publishingUser) {
    context.publishingUsers = self.websitesClient.getPublishingUsers(context, _);
    context.publishingUser = self.websitesClient.getPublishingUser(context, _);
  }

  self.log.verbose($('Detecting git and local git folder'));
  var remotes = this._exec('git remote', _);
  var azureExists = (remotes.stdout + remotes.stderr).split('\n').some(function (item) {
    return item === context.site.localGitRemote;
  });

  if (azureExists) {
    self.log.verbose(util.format($('Removing existing %s remote alias'), context.site.localGitRemote));
    this._exec(util.format('git remote rm %s', context.site.localGitRemote), _);
  }

  var gitUri = self.websitesClient.getGitUri(context.repo, context.site.name, context.publishingUser);
  self.log.info(util.format($('Executing `git remote add %s %s`'), context.site.localGitRemote, gitUri));
  this._exec(util.format('git remote add %s %s', context.site.localGitRemote, gitUri), _);
  self.log.info(util.format($('A new remote, \'%s\', has been added to your local git repository'), context.site.localGitRemote));
  self.log.info(util.format($('Use git locally to make changes to your site, commit, and then use \'git push %s master\' to deploy to Azure'), context.site.localGitRemote));
};

function GitClient(cli, websitesClient) {
  GitClient.super_.call(this, cli, websitesClient);
}

util.inherits(GitClient, LinkedRevisionControlClient);

GitClient.prototype.init = function (context, _) {
  this.determineIfCurrentDirectoryIsGitWorkingTree(context, _);
  this.initGitOnCurrentDirectory(context, true, _);
};

/*jshint unused:false*/
GitClient.prototype.deploy = function (context, _) {
  var self = this;

  self._initializeRemoteRepos(context, _);
  self._addRemotesToLocalGitRepo(context, _);
};

function GithubClient(cli, websitesClient) {
  GithubClient.super_.call(this, cli, websitesClient);

  this.client = new GitHubApi({ version: '3.0.0' });
}

util.inherits(GithubClient, LinkedRevisionControlClient);

GithubClient.prototype.authenticate = function (context, _) {
  this.ensureCredentials(context, _);

  this.client.authenticate({
    type: 'basic',
    username: context.github.username,
    password: context.github.password
  });
};

GithubClient.prototype.authenticateAuth = function(context, _) {
  this.ensureCredentials(context, _);

  this.client.authenticate({
    type: 'basic',
    username: context.github.username,
    password: context.github.password
  });

  // Get auth token and switch authentication to oauth
  var oauthToken = this.client.oauth.createAuthorization({ user: context.github.username }, _);
  this.client.authenticate({
    type: 'oauth',
    token: oauthToken.token
  });
};

GithubClient.prototype.ensureCredentials = function (context, _) {
  if (!context.github) {
    context.github = { };
  }

  if (!context.github.username || !context.github.password) {
    this.log.help('Enter your github credentials');
  }

  if (!context.github.username) {
    context.github.username = this.cli.interaction.prompt('Username: ', _);
  }

  if (!context.github.password) {
    context.github.password = this.cli.interaction.promptPasswordOnce('Password: ', _);
  }
};

GithubClient.prototype.init = function (context, _) {
  this.authenticate(context, _);

  // Initialize local git artifacts
  this.determineIfCurrentDirectoryIsGitWorkingTree(context, _);

  // Find github repository
  var repositories = this.getRepositories(context.github.username, _);
  if (context.github.repositoryFullName) {
    // Match the repository passed as parameter
    // against the list of github repositories for the current github user
    context.github.repository = LinkedRevisionControlClient._getRepository(repositories, context.github.repositoryFullName);
    if (!context.github.repository) {
      this.log.info('Invalid repository ' + context.github.repositoryFullName);
    }
  } else if (context.flags.isGitWorkingTree && !(context.flags && context.flags.forceRepositorySelection)) {
    // Unless the user forced the command to prompt for repository or passed a repository
    // as a parameter, try to find a github repository as a remote on the local folder
    // before actually prompting
    var remoteUris = this._getRemoteUris(_);

    if (remoteUris.length === 1) {
      context.github.repository = LinkedRevisionControlClient._getRepositoryCloneUrl(repositories, remoteUris[0]);
    } else if (remoteUris.length > 0) {
      // filter repositories to reduce prompt options
      var resultingRepositories = repositories.filter(function (repository) {
        return remoteUris.some(function (remoteUri) {
          return repositoryMatchUri(repository, remoteUri);
        });
      });

      if (resultingRepositories.length > 0) {
        repositories = resultingRepositories;
      }

      if (repositories.length !== remoteUris.length) {
        this.log.info('Some remote URIs were ignored. Currently only public repositories are supported.');
      }

      if (repositories.length === 1) {
        context.github.repository = repositories[0];
      }
    }
  }

  if (!context.github.repository) {
    // If there is no repository already determined, prompt the user to pick one
    this.log.help('Choose a repository (or hit ctrl-c to exit)');
    context.github.repository = repositories[this.cli.interaction.choose(repositories.map(function (repository) {
      return repository.full_name;
    }), _)];
  }
};

GithubClient.prototype.deploy = function (context, _) {
  var self = this;

  self._initializeRemoteRepos(context, _);
  self.websitesClient.ensureRepositoryUri(context, _);

  // Add / update hook and trigger it
  context.lvcClient.createOrUpdateHook(context.github.repository.owner.login,
    context.github.repository.name,
    context.repositoryUri,
    context.repositoryAuth,
    _);
};

GithubClient.prototype.getRepositories = function (username, _) {
  var progress = this.cli.interaction.progress('Retrieving repositories');
  var userRepos = [];

  function sortByFullName (repositoryA, repositoryB) {
    return repositoryA.full_name.toLowerCase()
      .localeCompare(repositoryB.full_name.toLowerCase());
  }

  function filterPrivate (repository) {
    return repository['private'] !== true;
  }

  try {
    userRepos = this.client.repos.getFromUser({ user: username }, _)
      .filter(filterPrivate)
      .sort(sortByFullName);

    var orgRepos;
    var orgs = this.client.orgs.getFromUser({ user: username }, _);
    if (orgs) {
      orgRepos = [];
      for (var i in orgs) {
        if (orgs.hasOwnProperty(i)) {
          var org = orgs[i];
          if (org.login) {
            var repos = this.client.repos.getFromOrg({ org: org.login, sort: 'updated', desc: 'desc' }, _);

            orgRepos = orgRepos.concat(repos);
          }
        }
      }
    }
    orgRepos = orgRepos.filter(filterPrivate).sort(sortByFullName);

    userRepos = userRepos.concat(orgRepos);
  } finally {
    progress.end();
  }

  return userRepos;
};

GithubClient.prototype.createOrUpdateHook = function (username, repository, websitesRepositoryUri, websitesRepositoryAuth, _) {
  // Build the current deploy URI for the hook to be created / updated
  var parsedRepositoryUri = url.parse(websitesRepositoryUri);
  parsedRepositoryUri.auth = websitesRepositoryAuth;
  parsedRepositoryUri.pathname = '/deploy';

  // Url format always encoded the auth part and since it is required that the URL matches
  // exactly what the portal also creates, it is required to revert back the encoding of the '$'
  // character to the unencoded form.
  var deployUri = url.format(parsedRepositoryUri).replace('https://%24', 'https://$');

  // Determine if a hook for the same website already existed in the targeted github repository
  var hooks = this.getHooks(username, repository, _);
  var existingHook = hooks.filter(function (hook) {
    if (hook.config) {
      return hook.name === 'web' &&
             url.parse(hook.config.url).hostname.toLowerCase() === parsedRepositoryUri.hostname.toLowerCase();
    }

    return false;
  })[0];

  if (existingHook) {
    // check if full uri is also the same
    if (existingHook.config.url.toLowerCase() !== deployUri.toLowerCase()) {
      existingHook.config.url = deployUri;
      existingHook.user = username;
      existingHook.repo = repository;
      existingHook = this.updateHook(existingHook, _);
      existingHook.user = username;
      existingHook.repo = repository;
      this.testHook(existingHook, _);
    } else {
      this.log.info('Link already established');
    }
  } else {
    // Initialize a new hook
    var newHook = {
      name: 'web',
      user: username,
      repo: repository,
      active: true,
      events: [ 'push' ],
      config: {
        url: deployUri,
        insecure_ssl: '1',
        content_type: 'form'
      }
    };

    newHook = this.createHook(newHook, _);
    newHook.user = username;
    newHook.repo = repository;
    this.testHook(newHook, _);
  }
};

GithubClient.prototype.createHook = function (hook, _) {
  var progress = this.cli.interaction.progress('Creating new hook');

  try {
    return this.client.repos.createHook(hook, _);
  } finally {
    progress.end();
  }
};

GithubClient.prototype.updateHook = function (hook, _) {
  var progress = this.cli.interaction.progress('Updating hook');

  try {
    return this.client.repos.updateHook(hook, _);
  } finally {
    progress.end();
  }
};

GithubClient.prototype.testHook = function (hook, _) {
  var progress = this.cli.interaction.progress('Testing hook');

  try {
    this.client.repos.testHook(hook, _);
  } finally {
    progress.end();
  }
};

GithubClient.prototype.getHooks = function (username, repository, _) {
  var progress = this.cli.interaction.progress('Retrieving website hooks');

  try {
    return this.client.repos.getHooks({
      user: username,
      repo: repository
    }, _);
  } finally {
    progress.end();
  }
};

GithubClient.prototype._getRemoteUris = function (_) {
  var progress = this.cli.interaction.progress('Retrieving local git repositories');
  var remoteUris = [ ];

  try {
    var remotes = this._exec('git remote -v', _);
    remoteUris = (remotes.stdout + remotes.stderr).split('\n')
      .filter(function (line) {
        return line.length > 0;
      })
      .map(function (item) {
        return item.split('\t')[1].split(' ')[0];
      });

    remoteUris = removeDuplicates(remoteUris);
  } finally {
    progress.end();
  }

  return remoteUris;
};

function removeDuplicates (array) {
  return array.filter(function(elem, pos) {
    return array.indexOf(elem) === pos;
  });
}