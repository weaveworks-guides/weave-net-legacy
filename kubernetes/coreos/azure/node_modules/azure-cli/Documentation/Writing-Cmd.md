## Where to put your code
Depends on what mode your cmds in choose appropriate folder:
* In case of Service Management (RDFE): lib\commands\asm
* In case of Resource Manager (CSM): lib\commands\arm

## What your code will look like
* Copy the `sample-service` [folder](./sample-service) under the directory chosen from previous step.
* Look at the `sample-service.sample._js` in the above mentioned folder and replace the word `sample` with your actual entity name (i.e. storage account) and add code accordingly

## Notes
* For loading performance, the command system has changed to load commands based on metedata of "lib\\plugins.arm.json" or "lib\\plugins.asm.json". This means 2 things to you. 
  * Refresh the metadata by run "node bin/azure --gen ('asm', 'arm' or nothing)" when submit a PR
  * If you are actively developing several commands, continuous refreshing is taxing. You can temporarily remove the metadate files and fall back to dynamic loading, meaing trade away performance for flexible.
* While developing the commands, the command can be executed from the root folder of the cloned repo like this: ```node bin\azure sample create . . .```
  * Once the development of command is complete install the source code from the root folder of your cloned repo at the global location for installing node modules ```npm install . -g```
  * Now you can execute your developed command using azure like this: ```azure sample create . . .```
* Use file extensions `._js` so that you leverage node streamline package to write async code with synchronized coding style. More information about streamline can be found [here](http://blog.rivaliq.com/develop-double-time-node-plus-streamline/) and [here](http://www.stateofcode.com/2011/05/bruno-jouhier/).
* Create util function under the same folder of `sample-service`
* For the new service to onboard, please update utils.js file to add method to create your client and make sure that your service is registered as part of calling this method
* You command will inherit several arguments
  * --subscription : If the user does not provide the subscription then the current subscription from the azureProfile.json will be used to execute the command. This file is saved under ```%USERPROFILE%/.azure``` folder. It acts as a repository of the subscriptions associated with a particular user/account)
  * -vv : verbose and log http traffic to console
  * -h  : provide help information
  * --json: please always verify your command's output format is valid json when this flag is on, so that your tests have a reliable way to assert.

## Command Design Guidelines
* Regular verb usage for basic [CRUD] operations is: 
  * create - create a new entity
  * set - update an existing enity
  * list - list all the entities
  * show - provide more information about the specified entity
  * delete - delete the specified entity
* While creating arguments/parameters for your command, please make sure that the switch name (long version "--username" and short version "-u") does not conflict with already used switches in the same command
