# Getting started with Weave and Docker on Ubuntu - preinstalled example #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will be creating a simple application running in a container on one host. Your service provides a JSON message containing hello world and a date - we call this your hello world service. In your second container, running on a seperate host, you use curl to query the hello world service.

![Weave and Docker](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/Simple_Weave.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker and Ubuntu, and we make use of VirtualBox and Vagrant to allow you to run the entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

You are also provided with a script to setup the demo, if you would like to work through a manual example please
see our more detailed [getting started guide](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/README.md).

## Setting up our hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

```bash
git clone http://github.com/weaveworks/guides
```

You will use vagrant to setup and configure two Ubuntu hosts, install Docker and install weave. These hosts will be assigned IP addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named `weave-gs-01` and `weave-gs-02`.

```bash
cd guides/ubuntu-all-in-one
vagrant up
```

Vagrant will pull down and configure an ubuntu image, this may take a few minutes depending on the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated during the Vagrant setup, please just hit return at this point.

Once the setup of the hosts is complete you can check their status with

```bash
vagrant status
```

The IP addresses we use for this demo are

```bash
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-02
```

## Launching Weave and your demo containers  ##

Execute the script `launch-simple-demo.sh`

This script will

* launch Weave on each of your hosts 
* launch a container with a simple hello world webserver in weave-gs-02 (CONTAINER1) with an IP address of 10.3.1.1
* launch a container containing curl you will use to connect to CONTAINER1 on weave-gs-01 with an IP address of 10.3.1.2

On your first host, `weave-gs-01`, you now have a Weave router container. On your second host, `weave-gs-02`, you have launched another Weave router container with the IP address of your first host. This command tells the Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.


## Connecting to our container ##

Connect to the your first host, weave-gs-01, on which we are running the curl container.

```bash
vagrant ssh weave-gs-01
```

Connect to the container in which we   

```
CONTAINER=$(sudo docker ps | grep weave-gs-ubuntu-curl | awk '{print $1}')
sudo docker attach $CONTAINER
curl 10.3.1.1
```

You will see output similar to the output listed below from the container on your second host. 

```javascript
{
    "message" : "Hello World",
    "date" : "2015-03-13 15:03:52"
}
```

## Summary ##

You have now used Weave to quickly deploy an application across two hosts using containers.
