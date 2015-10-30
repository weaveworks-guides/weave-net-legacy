## 2015.10.02 Version 0.9.10
* Authorization
  * Fixed display of role assignments display to add and remove certain fields.
  * Added expandPrincipalGroups and includeClassicAdministrators options to role assignment list command
  * Updated all role assignment commands to take in a signInName parameter instead of upn and email and renamed the role parameter to roleName
  * Added new role assignment changelog list command that gives access change history for a subscription
  * Role assignment Get fixes
  * Role Assignment Delete fixes
* Compute
  * Fixed issue #2119
  * Removed support for ASM images in ARM
* Network
  * Fixed issue #2143 in azure network vnet list command
  * Implemented ARM  Load Balancer  Inbound NAT Pools  commands
  * Load Balancer refactoring: constants improved, checking  statusCode  instead of error message, etc.
* Logging
  * Added truncation by default to the silly log capture after 1MB of logs has been captured
  * Added a AZURE_CLI_DISABLE_LOG_CAPTURE environment variable which allows silly log capturing to be disabled
* Resource
  * Update "azure group template" commands to work with newer gallery service.
  * Remove "--gallery-template" arguments from "group" and "group deployment" create commands.
* Storage
  * Update the storage dependency to 0.6.0 to be compatible with Nodejs 4.x
  * Fixed issues #2102, #2103
* KeyVault
  * Updated DNS suffix to correct azurechinacloud dns suffix.
  * Updated keyvault api version to current GA version ('2015-06-01').
* Usage
  * Documented the format of the date parameters and prompted for the dates if they weren't provided
* MFA Login
  * Fixed bad error message when the user logs in with an MSA account
  * Support Login using non organization id such as MSA account, live ids.
* README updates
  * Added Redis Cache in the home page features list
  * Added Docker Azure CLI as an installation option

## 2015.09.11 Version 0.9.9
* Redis Cache
  * Implemented create, set, show, list, list-keys, renew-key and delete commands
* Resource Provider operations
  * Implemented the Resource Provider operations show command
* Compute
  * Added support for IAAS diag and Linux diag extensions.
  * Fixed compute bugs
  * Added test cases for IAAS diagnostics extension.
  * Added test cases to address bug fixes
  * Updated recordings with minor refactoring
  * Implemented Set/Get Diagnostics Profile and Log
* KeyVault
  * Added environment parameter for keyvault dns suffix
* Storage
  * Improved user experience by checking the source size and ensured it doesn't exceed dest object limitation before data transfer
  * Supported AzureChinaCloud environment when the active account is in it
  * Switched from azure-storage-legacy to azure-storage
* Authentication
  * Enabled 2 factor authentication for org-id user accounts **(NOTE: this does not enable Microsoft Service Accounts like @live.com, etc...)**
* Network
  * Fixed network vnet delete when there is only one network
  * Implemented Local Networks Gateways commands
  * ASM: network nsg rule create command can now handle asterisk symbols on linux. Fixed issue #2002
* Authorization
  * Fixed formatting of role commands
* General Fixes
  * Cleaned up test run output by not emitting out errors to the console
  * Wired up code coverage npm 
  * Improved  utils.indexOfCaseIgnore() by making it return  -1  instead of  null  when item not found. Fixed issue #2077.
  * Added a separate VM testlist for ARM

## 2015.08.19 Version 0.9.8
* Storage
  * Update azure-storage to 0.5.0 which supports Azure storage service version 2015-02-21
  * Support append blob
  * Supports share quota and share usage
  * New commands for shared access signatures for shares and files
    * azure storage share sas create [options] [share] [permissions] [expiry] 
    * azure storage file sas create [options] [share] [path] [permissions] [expiry]
  * New commands for share ACL 
    * azure storage share policy create [options] [share] [name]
    * azure storage share policy show [options] [share] [name]
    * azure storage share policy list [options] [share]
    * azure storage share policy set [options] [share] [name]
    * azure storage share policy delete [options] [share] [name] 
  * New commands for file async copy 
    * azure storage file copy start [options] [sourceUri] [destShare]
    * azure storage file copy show [options] [share] [path]
    * azure storage file copy stop [options] [share] [path] [copyid]
  * New commands for CORS (Cross-Origin Resource Sharing)
    * azure storage cors set [options]
    * azure storage cors show [options]
    * azure storage cors delete [options]
* ARM
  * Display Outputs section from a template when submitting new deployments
  * group delete command will now block until the resource group is deleted
  * Support for submitting deployments with v2 version of template parameters
  * "azure-arm-resource" package is updated to version 0.10.2
  * Added delete deployment command
* Authorization
  * Role test fixes and authorization package updated to version 0.10.2
  * Added support to display custom roles in role list command
  * Added support to create and set role definitions with custom role
* Network
  * Fixed CIDR validation issues
  * Added support for 'None' next hop type in ARM RouteTable Route
  * Fixed the inability to add a nic in address-pool issue #2013
* General command improvement
  * Fixed service principal login issue on Mac #1958
  * Upgraded adal-node to 0.1.15 to fix '&' in the password issue #1918
  * Documentation updates for using Chinal Cloud fix issue #1995
  * Fixed issues #1894, #1911, #1923
  * Upgraded request library dependency to version 2.52.0
  * Added default Visual Studio nodejs project for xplat cli

## 2015.08.05 Version 0.9.7
* General command improvement
  * Fix the broken "help" command
  * Performance improvement on displaying command help information
  * AutoComplete support on commands options
* Login
  * Retain default account after login
  * Clean up cached tokens of service principal after logout
* ARM
  * Handle group deployment using a template file with BOM
  * Usage
    * Added command to list Azure resource usage information for a subscription
  * VM
    * Tags support for VM create.
    * Handle generation of SSH certs inside 'vm create' and 'vm docker create' commands
    * Added --lun option to 'vm disk attach-new' and 'vm disk attach' commands
    * Added functionality to set data disk name in 'vm disk attach-new' command
  * Network commands 
    * Route Tables
    * NIC

## 2015.07.20 Version 0.9.6
* ASM
  *  Network
    * Added commands to manage routes and route table
    * Added commands to manage local network
    * Added commands to manage application gateway
    * Added commands to manage traffic manager
    * Added commands to manage virtual network gateway
    * Reduced command load time by splitting network commands to separate files
  * Compute
    * Updated VM endpoint command to support probe interval and timeout
    * The endpoint create-multiple command has breaking change due to the accommodation of probe interval and timeout
    * Added support to set remote-subnet for an endpoint ACL rule
    * Added command to fetch deployment event
    * Enhanced docker create vm command to pass certificate CN
  * Site
    * Fixed streamline precompiler issues with azure site commands 

## 2015.06.26 Version 0.9.5
* ARM
  * WebApp
    * Added create, delete, show, list, start, stop and restart commands
  * ApiApp
    * Added create command
  * Key Vault
    * Commands now use Key Vault REST API v2015-06-01
* ASM
  * site
    * Bug fixes for Issues #1666, Added support for PHP version 5.6
    * Remove support PHP version 5.3 for web site options

## 2015.06.05 Version 0.9.4
* ARM
  * Fix group deployment create bug. Users should now be able to successfully submit template deployments

## 2015.05.29 Version 0.9.3
* General Fixes
  * Performance improvement of general command loading
  * Support login with partner tenant
* ARM
  * VM
    * Bug fixes for Issues #1726, #1731, #1761
  * Network
    * Bug fixes for Issues #1763, #1764, #1769, #1770, #1771, #1773, #1775, #1776, #1777, #1780, #1781, #1783
  * Monitoring
    * Moved events client out of Azure rollup into its own package
  * Insights
    * Added last Insights autoscale command
  * ApiApp
    * Added improved UIDefinition constraint validation
* ASM
  * HDInsight
    * Fixed the bug on listCluster command which shows duplicate items
    * Fixed parameter description for storageAccountName
  * VM
    * Bug fixes for Issues #1566, #1600, #1759
    * Chef Extension
      * Implemented new option --delete-chef-config for set-chef extension commands

## 2015.05.04 Version 0.9.2
* ARM
  * Network
    * Commands to manage DNS Zone and DNS Zone recordset
  * Key Vault
    * Added commands to manage vaults, keys and secrets (azure keyvault)
  * Insights
    * Added commands to handle alerts and alert rules, autoscale events and autoscale settings, list metrics and metrics definitions, and list usage metrics
  * ApiApp
    * Added package create command

## Version 0.9.1
* ARM
  * Virtual machines
    * Support for managing virtual machine resource in CRP stack, this includes commands to
      * Create VM with options to configure availability set and network resources
      * Quick create VM
      * Create docker VM
      * Delete, start, stop, generalize and capture VM
      * Manage VM extensions
      * Manage VM data disks
      * Manage VM images
      * Update VM to add and remove NICs
      * VM instance view
      * VM show commands which supports --depth option to fetch associated resources
      * Reset VM access credentials
  * Network
    * Support for managing network resources in NRP stack, this includes commands to
      * Manage virtual network
      * Manage virtual network subnet
      * Manage load balancer
      * Manage load balancer child resources
        * Probes
        * VIP configuration
        * Address pool
        * load balancing rules
        * Inbount NAT rules
      * Manage NIC
      * Manage PublicIP
      * Manage traffic manager
      * Manage security group
  * Availability set resource in CRP stack
    * Commands to manage availability set
  * Insights
    * Added commands to retrieve event/operation logs from Event Service
*ASM
  * VM
    * Chef Extension
      * Implemented new option --bootstrap-options for set-chef extension commands
  * Mobile
    * Features
        * Added support for AAD Tenants
        * Added support for proxies / fiddler
        * Improved custom domain, certificate, and SSL error handling
    * Issues
        * Fixed 'log is undefined' bug
        * Fixed connection issues with mobile pipeline
    * Test Infrastructure
        * Updated common mobile test infrastructure
        * Refactored mobile tests into separate files
        * Optimized mocked test time run for mobile tests

## 2015.03.27 Version 0.8.17
*  General Fixes
  * Fixed Improper JSON for vm image show #1611
  * Fixed account-affinitygroup show command #1633
  * Fixed an issue in vm export command #1635, #1514
  * Updated kuduscript for website deployment
  * Fixed Sql Server deletion issue in mobile service commands
  * Updated default docker extension version to 0.6
  * Fixed issues in windows and mac installer
* Test Infrastructure Optimization
  * Reduced the time to run mocked tests
  * Every test can be recorded to its individual test file

## 2015.03.04 Version 0.8.16
* VM
  * Feature
    * azure vm extension set-chef
    * azure vm extension get-chef
  * Issue fixes to address the following IAAS related issues
    * azure vm endpoint acl-rule create parser error: --description is incorrectly a bool #1500
    * azure vm create fails for specialized image: Cannot set property 'mediaLink' of undefined #1516
    * Azure vm disk attach properties (such as host-caching) not discoverable #1554
    * Can not copy a image blob between storage accounts #1565
    * -u is used for username as well as blob-url in the vm create command #1566
    * error: undefined is not a function #1575
    * Add support for changing cache policy of attached disk #1583
    * azure vm endpoint create fails with lb-set option #1594
* NETWORK
  * Issue fixes to address the following IAAS related issues
    * network import doesn't pass LocalNetworkSites #1416
    * network vnet create destroys subscription's "local network" #1569
    * azure network vnet create - Error - Cannot read property #1589
* General Fixes
  * use streamline version 0.10.17 to make it work for node version 0.12.0 upward
  * Restricted use of jshint to version <= 2.6.0 due to issues with later versions
  * Fixed issues when azure cli is used via proxy

## 2015.02.17 Version 0.8.15
* Used "Microsoft Azure Client Library for node" version 0.10.4
* Added custom domains functionality to mobile service commands

## 2015.01.22 Version 0.8.14
* Storage
  * Added support for storage "stored access policy" and update storage SDK
  * Added support for creating XIO storage accounts
  * Added support for "Premium_LRS" storage account type
* Mobile Service
  * Updated restart to only restart service. Add redeploy command to ensure mobile service runtime is using latest.
  * Added new required --push parameter to azure mobile create to specify push mode for node services. Options are legacy and nh.
  * Updated mobile tests for new gcm string and notification hub errors
* Websites
  * Fixed issues in site log set command with storage account option
* VM
  * Fixed azure vm create issue because of required storage account type
* General Fixes
  * Fixed azure login issues in AzureChinaCloud
  * Added location Australia, Australia South East, Japan East, Japan West and East US 2 for resource group
  * Moved azure.err file to user's home directory/.azure/azure.err
  * Fixed managing two subscriptions with same name issue
  * Updated Readme.md with Ubuntu installation instructions

## 2014.12.05 Version 0.8.13
* Upgraded the sites cli to work with latest breaking changes in the Azure Web Sites API.
* Upgraded the storage cli to work with latest breaking changes in the Azure Storage API.
* Added an option to delete SB Namepsace in mobile delete command
* VM
  * Support for capturing VM as VM image
  * Disk host caching while attaching disk
* NETWORK
  * Support for region wise VNet
  * Bug fix: unable to create affinity group as a part of vnet creation
  * Bug fix: don't re-throw 404 error from get network config
* SERVICE
  * Support for internal load balancer

## 2014.11.12 Version 0.8.12
* Fix Mobile CLI Tests and recorded mocks
* Fix for HDInsight commands in Azure China environment
* Storage
  * Updated azure-storage dependency to 0.4.0
  * Improved the blob downloading and uploading speed
* VM
  * VM create command bug fixes
  * Skip zero blocks when uploading fixed VHD
  * Commands to manage virtual machine endpoint ACL
  * Commands to manage virtual machine public IP
  * Support for creating virtual machine from VM image

## 2014.10.27 Version 0.8.11
* Credential store bug fixes
  * Clean credential store on account clear command
  * Remove old credential entries on login
* Storage
  * Add new commands to manage Storage logging properties
      storage logging show [options]
      storage logging set [options]
  * Add new commands to manage Storage metrics properties
      storage metrics show [options]
      storage metrics set [options]
  * Add SAS token support for blob download/copy
* Documentation and helper commands to enable Fiddler tracing

## 2014.10.02 Version 0.8.10
* VM
  * Create and manage VM extensions
  * Create and manage reserved IP addresses
  * Fixed issues in vm image list command
  * Fixed issues in --no-ssh-password parameter handling in vm create command
* Storage
  * SAS support
      azure storage container sas create
      azure storage blob sas create
      azure storage table sas create
      azure storage queue sas create
  * Storage unit test fixes
* Moved the GraphRbacManagementClient in a separate module named 'azure-extra' published to npm
* Fixed issues in token caching mechanism and the azure login command
* Fixed issues in npm install azure-cli on Ubuntu OS
* Fixed website tests
* Fixed the test recording infrastructure

## 2014.09.10 Version 0.8.8
* Role-based access control support
  *  Query role definition
      Azure role list
  *  Manage role assignment
      azure role assignment create
      azure role assignment list/show
      azure role assignment delete
  *  Query Azure AD object
      azure AD user list/show
      azure AD group list/show
      azure AD group member list
      azure AD SP list/show
  *  Show user's permissions
      azure group list/show
      azure resource list/show
* Active Directory service principal login support in Azure Resource Manager mode
      azure login --service-principal -tenant
* Storage
  *  Azure File Service support
      azure storage share create
      azure storage share list/show
      azure storage share delete
      azure storage directory create
      azure storage directory delete
      azure storage file upload
      azure storage file download
      azure storage file list
      azure storage file delete
  *  Azure Blob Service improvements
      azure storage blob copy start
      azure storage blob copy stop
      azure storage blob copy show
  *  Azure Table Service support
      azure storage table create
      azure storage table list/show
      azure storage table delete
  *  Azure Queue Service Support
      azure storage queue create
      azure storage queue list/show
      azure storage queue delete
  *  Switched storage library to Azure storage module

## 2014.08.04 Version 0.8.7
* Fixed issues with vm commands (vm image, vm docket create)
* Added support for A8, A9 vm sizes in vm create command
* Fixed user logout scenario issues and bumped up the credential size
* Rebranding from Windows Azure to Microsoft Azure
* Test fixes

## 2014.07.16 Version 0.8.6
* Store user credentials in the windows credential store
* Azure Resource Manager Tags (in arm mode)
  * azure tag create/list/show/delete
  * tags parameter in azure group create/set and azure resource create/set
  * tags parameter in azure group list and azure resource list
* Support PHP version 5.5 for web site options

## 2014.07.07 Version 0.8.5
* Active directory authentication support for
  * azure vm
  * azure vnet
  * azure mobile
* Command to create docker VM in azure
  * azure vm docker create
* Store active drectory token in key chain on Mac

## 2014.05.30 Version 0.8.4
* Active directory support for AzureChinaCloud
* Bug fixes for AzureChinaCloud endpoints
* Dropped support for Node version 0.6
* Test system improvements

## 2014.05.07 Version 0.8.3
* Bug fixes
* Engineering and infrastructure improvements

## 2014.04.10 Version 0.8.2
* Hotfix to correct issue with azure mobile create command

## 2014.04.03 Version 0.8.0
* Azure Resource Manager commands (preview)
  * "azure config" mode to switch mode between service management and resource manager.
  * Resource groups
    * azure group create/list/show/delete
    * azure group log show
  * Templates
    * azure group template list/show/download/validate
  * Deployments
    * azure group deployment create/list/show
  * Resources
    * azure resource create/set/list/show/delete
* Azure Active Directory authentication with Organizational ID
  * Log in directly from the command line using Organizational ID (create one for free in your subscription)
    * azure login/logout
  * Doesn't work with the following commands for now
    * azure vm
    * azure network
    * azure mobile

## 2014.01.20 - version 0.7.5
* Added web site slots support
* Added web jobs support
* CloudInit support for Ubuntu VM via "azure vm create -d"
* Multiple bugfixes

## 2013.11.13 - version 0.7.4
* azure site set --web-socket --disable-web-socket to enable/disable WebSocket
* azure site set --remote-debugging --disable-remote-debugging --remote-debugging-version to enable/disable/set remote debugging for .NET application.
* azure site set --managed-pipeline-mode to choose between Classic and Integrated.
* Multiple bugfixes

## 2013.10.18 - version 0.7.3
* #961 - Fixed issue with site connection strings
* #712 - Add support for VM shutdown on stop
* #876 - Improve azure site show appearance
* #966 - Fixed issue with incorrect service endpoint being used from publish settings
* #987 - Fix issue with "azure site download" on windows
* #925 - Making "azure site create" show template based error instead of generic one
* #963 - Update kudu script module to version 0.1.5
* Upgrade to latest SDK (which uses generated website wrappers)
* Supports the new high-memory A5 instance size (2 cores, 14GB RAM)

## 2013.09.24 - version 0.7.2
* Multiple bugfixes

## 2013.08.26 - version 0.7.1
* Added blob storage commands
  * azure storage blob list
  * azure storage blob show
  * azure storage blob upload
  * azure storage blob download
  * azure storage blob delete
* Added azure account cert export
* Multiple bug fixes

## 2013.07.31 - version 0.7.0
* Added network commands
* Added more site commands
  * azure site set
  * azure site cert
  * azure site connectionstring
  * azure site defaultdocument
  * azure site domain
  * azure site handler
* Improved site list to show locations
* Renamed azure site config (will be removed in a future version) to azure site appsettings
* Renamed azure account storage (will be removed in a future version) to azure storage account
* Reduced CLI generic help
* Added bash auto-complete support for commands and categories
* Fixed generic options (--json and --verbose) to only show up where they work
* Improved and updated setup experience
* Multiple bug fixes and test infrastructure improvement

## 2013.07.15 - version 0.6.18
* Added website diagnostics configuration command
  * azure site log set
* Added more storage container commands
  * azure storage container show
  * azure storage container create
  * azure storage container set
  * azure storage container delete
* Multiple fixes
* Made module global by default
* Added scenario tests

## 2013.06.20 - version 0.6.17
* HDInsight commands
* Added cucumber tests
* Multiple fixes to support Azure China
* Multiple VM fixes
* New azure site repository sync command to sync the deployment of a website
* New azure mobile recover command to recover of an unhealthy mobile service
* Command to list Microsoft Azure Storage container
  * azure storage container list

## 2013.05.13 - version 0.6.16
* Fixed issue with registered resources on account import.
* Fixed jsHint errors.
* Multiple fixes to support different REST endpoints / environments.
* Dinamicaly fetch locations for websites instead of hardcoding them.
* Fixed issues around first website creation to enable this scenario more easily.

## 2013.04.21 - version 0.6.15
* Locked package.json dependencies to patch versions.

## 2013.04.03 - version 0.6.14
* Adding node 0.10 support.
* Fixed issue when importing publishsettings files for a brand new Azure account.

## 2013.03.19 - version 0.6.13
* Switch "azure site repository delete" to use the new api.  Old api will be deprecated in 08/13 and users using old SDK will need upgrade.
* Adding support for creating and deleting affinity groups
* Changed the option names to --description and --affinity-group on the storage command
* "azure site scale" - change the scaling mode of websites

## 2013.03.12 - Version 0.6.12
* Added constraint to package.json to restrict to node versions < 0.9.

## 2012.12.12 - Version 0.6.11
* "azure sql" - manage Azure SQL Server servers, databases and firewall rules
* "azure site log tail" - realtime streaming logs over Microsoft Azure.
* "azure mobile script upload" - now supports shared and scheduler scripts #179
* "azure mobile show" - now displays scale information #139
* "azure mobile scale" - allows managing scale out for your mobile app #139
* "azure mobile job" - allows managing scheduled jobs #78
* "azure mobile data truncate" - allows truncating mobile tables #164
* "azure site deploymentscript" - bunch of fixes

## 2012.12.22 - Version 0.6.10
* Fix require issue with unix based systems
* Fix issue with deployment scripts

## 2012.12.12 - Version 0.6.9
* "azure portal" - replaces "azure vm portal" and "azure site portal".
* "azure mobile" - Manages Azure Mobile Services
* "azure sb namespace" - Manages Service Bus namespaces
* "azure site deploymentscript" - Generates deployment scripts for customizing your website deployment
* "azure vm create -o" - Create VMs using community/OSS images
* "azure vm endpoint create-multiple" - Create multiple VM endpoints in one shot.

## 2012.11.20 - Version 0.6.8
* Initial release of stand alone CLI.
* New commands for managing storage accounts
* Support for new .publishsettings file format
* Several bug fixes for github repos.

========== CLI Split =========

## 2012.10.15 Version 0.6.7
 * Adding connection strings support for storage and service bus
 * Fixing issue with EMULATED and explicit variables making the later more relevant
 * Adding Github support
 * Adding website application settings support

## 2012.10.12 Version 0.6.6
 * Using fixed version of commander.js to avoid bug in commander.js 1.0.5

## 2012.10.01 Version 0.6.5
 * Bugfixing

## 2012.09.18 Version 0.6.4
 * Multiple Bugfixes around blob streaming

## 2012.09.09 Version 0.6.3
 * Fixing issue with xml2js

## 2012.08.15 Version 0.6.2
 * Multiple Bugfixes

## 2012.07.02 Version 0.6.1
 * Multiple Bugfixes
 * Adding subscription setting and listing functionality.

## 2012.06.06 Version 0.6.0
 * Adding CLI tool
 * Multiple Bugfixes

## 2012.04.19 Version 0.5.3
 * Service Runtime Wrappers
 * Multiple Bugfixes
 * Unit tests converted to mocha and code coverage made easy through JSCoverage

## 2012.02.10 Version 0.5.2
 * Service Bus Wrappers
 * Storage Services UT run against a mock server.
 * Node.exe version requirement lowered to raise compatibility.
 * Multiple Bugfixes

## 2011.12.14 Version 0.5.1
 * Multiple bug fixes

## 2011.12.09 Version 0.5.0
 * Initial Release
