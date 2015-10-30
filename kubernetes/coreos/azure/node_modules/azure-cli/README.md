# Microsoft Azure Xplat-CLI for Windows, Mac and Linux

[![NPM version](https://badge.fury.io/js/azure-cli.png)](http://badge.fury.io/js/azure-cli) [![Build Status](https://travis-ci.org/Azure/azure-xplat-cli.png?branch=master)](https://travis-ci.org/Azure/azure-xplat-cli)

This project provides a cross-platform command line interface for developers and IT administrators to develop, deploy and manage Microsoft Azure applications.

## Features

* Accounts
    * Azure Active Directory authentication for Organizational ID
    * Download and import Azure publish settings
    * List imported Azure subscriptions
    * Select current subscription
    * Manage Azure environments
    * Create and manage affinity groups
    * Export management certificate
* Storage
    * Create and manage Storage Accounts
    * Create and manage container, blob and ACL
* Websites
    * Create and manage Microsoft Azure websites
    * Download site log files and get real time log streaming
    * Manage Deployments
    * Configure GitHub integration
    * Create, manage and swap slots
    * Create and manage WebJobs
* Virtual machines
    * Create and manage Windows and Linux Virtual machines
    * Create and manage VM endpoints
    * Create and manage Virtual Machine Images
    * Create and manage certificates
    * CloudInit for Ubuntu VM
    * Create and manage Docker host virtual machines
    * Create and manage VM extensions
* Network
    * Import and export network configuration
    * Create and manage virtual network
    * Create and manage DNS server
    * Create and manage reserved IP addresses
* Mobile Services
    * Create and manage Mobile Services
    * Manage tables, scripts, and configuration
    * Access logs
    * Access data
    * Add custom domains and enable SSL
* Service Bus
    * Create and manage Service Bus namespaces
* SQL Database
    * Create and manage SQL Servers, Firewall rules and Databases
* Resource Manager
    * Manage resource groups and deployments
    * Query and download gallery templates
    * Manage individual resources
* Key Vault
    * Create and manage vaults, assign permissions to vaults
    * Create and manage vault keys, import PEM files into a vault key, obtain key backups
    * Create and manage secrets, set and retrieve secret values
* Redis Cache
    * Create and manage Redis Caches
    * List or Renew authentication keys

## Installation

### Install from npm

You can install the azure-cli npm package directly.
```bash
npm install -g azure-cli
```

### Install on Ubuntu
The Xplat-CLI requires Node.js. Installation varies slightly by Ubuntu version.

**Ubuntu 14.04 Trusty Tahr**

On Ubuntu 14, the Node.js package is called nodejs-legacy. The npm package is installed first to get the Node Package Manager used to install the CLI.

```bash
sudo apt-get install nodejs-legacy
sudo apt-get install npm
sudo npm install -g azure-cli
```
**Ubuntu 12.04 Precise Pangolin**

On Ubuntu 12, the version of Node.js available in the default package manager is too old. You can use the Personal Package Archive feature to install the current binary distribution. First, install the curl package to easily retrieve the install script.

```bash
sudo apt-get install curl
curl -sL https://deb.nodesource.com/setup | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g azure-cli
```

### Install on a Docker Host

In a Docker host, run:  
```bash
sudo docker run -it microsoft/azure-cli 
```

### Pre-compiled installers

* [Windows](http://aka.ms/webpi-azure-cli)
* [Mac](http://aka.ms/mac-azure-cli) 
* [Linux](http://aka.ms/linux-azure-cli)

### Download Source Code

You can also install the Azure Xplat-CLI from sources using **git**  and **npm**.

```bash
git clone https://github.com/Azure/azure-xplat-cli.git
cd ./azure-xplat-cli
npm install
bin/azure <command>
```

### Configure auto-complete

Auto-complete is supported for Mac and Linux.

To enable it in zsh, run:

```bash
echo '. <(azure --completion)' >> .zshrc
```

To enable it in bash, run:

```bash
azure --completion >> ~/azure.completion.sh
echo 'source ~/azure.completion.sh' >> ~/.bash_profile
```

## Get Started

* First, get authenticated with Microsoft Azure. For details, read [this article](http://azure.microsoft.com/en-us/documentation/articles/xplat-cli/).
  * Option 1: Login with your Organizational account. Azure Active Directory authentication is used in this case. No management certificate is needed. **Note**: Authentication with a Microsoft account is not supported at this time. You can create a free Organizational account in the Azure portal for use in the CLI.
  * Option 2: Download and import a publish settings file which contains a management certificate.

If you use both mechanisms on the same subscription, Azure Active Directory authentication will be used by default. If you want to go back to management certificate authentication, please use ``azure logout``, which will remove the Azure Active Directory information and bring management certificate authentication back in.

#### Login directly from xplat-cli (Azure Active Directory authentication)

```bash
# This will prompt for your password in the console
azure login -u <your organizational ID email address>

# use the commands to manage your services/applications
azure site create --location "West US" mywebsite
```

#### Use publish settings file (Management certificate authentication)

```bash
# Download a file which contains the publish settings information of your subscription.
# This will open a browser window and ask you to log in to get the file.
azure account download

# Import the file you just downloaded.
# Notice that the file contains credential of your subscription so you don't want to make it public
# (like check in to source control, etc.).
azure account import <file location>

# Use the commands to manage your services/applications
azure site create --location "West US" mywebsite
```

### azure cli with China Cloud
```bash
# This will log you into the China Cloud environment.
# You can use same set of commands to manage your service/applications
azure login -u <your organizational ID email address> -e AzureChinaCloud
```

### azure cli on Ubuntu
If you want to run xplat cli on Ubuntu, then you should install **nodejs-legacy** instead of **nodejs**. For more information please check the following links:
- [why there is a problem with nodejs installation on ubuntu](http://stackoverflow.com/questions/14914715/express-js-no-such-file-or-directory/14914716#14914716)
- [how to solve the nodejs installation problem on ubuntu](https://github.com/expressjs/keygrip/issues/7)

Please perform the installation steps in following order:
```bash
sudo apt-get install nodejs-legacy
sudo apt-get install npm
sudo npm install -g azure-cli
```

## 2 Modes

Starting from 0.8.0, we are adding a separate mode for Resource Manager. You can use the following command to switch between the

* Service management: commands using the Azure service management API
* Resource manager: commands using the Azure Resource Manager API

They are not designed to work together.

```bash
azure config mode asm # service management
azure config mode arm # resource manager
```

**For more details on the commands, please see the [command line tool reference](http://go.microsoft.com/fwlink/?LinkId=252246&clcid=0x409) and this [How to Guide](http://azure.microsoft.com/en-us/documentation/articles/xplat-cli/)**

## Docker

Usage is the same as `vm create` command:

    azure vm docker create [options] <dns-name> <image> <user-name> [password]

This command only supports Ubuntu 14.04+ and CoreOS based images. Docker is configured on the VM using HTTPS as described here: https://docs.docker.com/articles/https/ By default, generated TLS certificates are placed in the `~/.docker` directory, and Docker is configured to run on port 2376. These can be configured using new options:

    -dp, --docker-port [port]              Port to use for docker [2376]
    -dc, --docker-cert-dir [dir]           Directory containing docker certs [~/.docker/]
	
After the VM is created. It can be used as a Docker host with the `-H` option or `DOCKER_HOST` environment variable.

    docker --tls -H tcp://<my-host>.cloudapp.net:2376 info

Note: To run docker commands on windows make sure ssl agent is installed.
	
## Error Diagnostic

### use the -vv option to see the actual REST requests on the console.
```bash
azure site create --location "West US" mytestsite -vv
```

### Use web debugging proxy
Say, use 'Fiddler', setup the following environment variables before execute commands.

```bash
set NODE_TLS_REJECT_UNAUTHORIZED=0
set HTTPS_PROXY=http://127.0.0.1:8888
```

## Running Tests

See [this page for instructions](https://github.com/Azure/azure-xplat-cli/wiki/Running-Tests) that describe how to run the test suite.

## Learn More
For documentation on how to host Node.js applications on Microsoft Azure, please see the [Microsoft Azure Node.js Developer Center](http://www.windowsazure.com/en-us/develop/nodejs/).

## Contribute Code or Provide Feedback

If you would like to become an active contributor to this project please follow the instructions provided in [Microsoft Azure Projects Contribution Guidelines](http://windowsazure.github.com/guidelines.html).

Please send pull requests only to the **Dev branch**. Please make sure that you have checked in tests and recorded them live for your contribution. **Pull requests without sufficient tests will not be accepted.**

If you encounter any bugs with the library please file an issue in the [Issues](https://github.com/Azure/azure-xplat-cli/issues) section of the project.
