---
layout: guides
title: How to Use Docker Compose with Weave Net
---

Docker Compose is a tool used to configure multiple container apps. A Docker Compose file configures your application's services and with a single command creates and starts services. Depending on how you are using Weave Net, whether through the Docker API Proxy or by using the Weave Docker Plugin, the configuration of the Docker Compose file differs. This guide provides an overview of the different ways in which  networking can be configured and also examples of the compose file when using Weave Net. 

The following topics are discussed: 

  * [What You Will Use](#what-use)
  * [Before You Begin](#before)
  * [Attaching Containers to a Weave Network](#attaching-containers)
  * [Docker Compose and the Weave Net Docker API Proxy](#setup-proxy)
     * [Docker Compose File for the Weave Docker API Proxy](#compose-proxy)
  * [Docker Compose and the Weave Net Docker Plugin](#setup-plugin)
    * [Docker Compose File Variants and the Weave Net Docker Plugin](#compose-plugin)

##<a name="what-use"></a>What You Will Use

* [Weave](http://weave.works)
* [Weave Scope](http://weave.works/scope/index.html)
* [Docker](http://docker.com)
* [Docker Compose](https://www.docker.com/docker-compose)

##<a name="before"></a>Before You Begin

If you are using Windows, you can install [Docker for Windows](https://docs.docker.com/engine/installation/windows/), and if you are on a Mac, install [Docker for Mac](https://docs.docker.com/engine/installation/mac/) which provides all of the tools you need to complete this guide.

For other operating systems, please install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.8.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at least the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)


##<a name="attaching-containers"></a>Attaching Containers to a Weave Network
 
 There are three ways to attach containers to a Weave network (which method to use is 
 entirely up to you):
 
 **1.** The Weave Net Docker API Proxy. See [Setting Up the Weave Net Docker API Proxy](#weave-api-proxy).  
 
 **2.**  The Docker Network Plugin framework. The Docker Network Plugin is used when 
 Docker containers are started with the --net flag, for example: 
 
 `docker run --net <docker-run-options>`
 
 **Where,** 
 
  * `<docker-run-options>` are the [docker run options](https://docs.docker.com/engine/reference/run/) 
  you give to your container on start 
 
 Note that if a Docker container is started with the --net flag, then the Weave Docker API Proxy
 is automatically disabled and is not used to attach containers. See [Integrating Docker via the Network Plugin](plugin.md).
 
 **3.** A third method uses `weave run` commands to attach containers. This method also
 does not use the Weave Docker API Proxy. 
 
 See [Launching Containers With Weave Run (without the Proxy)](/site/weave-docker-api/launching-without-proxy.md).
 

##<a name="setup-proxy"></a>Docker Compose and the Weave Net Docker API Proxy


The following is a simple setup that shows how to configure docker-compose for Weave Net across two hosts using the Docker API proxy. You will launch the alpine using Docker Compose and then run 'ping' to test the connectivity between the two hosts. 

**1.** Create two hosts on Virtualbox with docker machine: 

~~~bash
docker-machine create -d virtualbox weave-net-demo-01
docker-machine create -d virtualbox weave-net-demo-02
~~~

**2.** In order to peer hosts on Weave Net, obtain the IP address of one of the VMs you just created: 

~~~bash
docker-machine ip weave-net-demo-02
~~~

Make a note of the IP address that appears. 

**3.** Install and then launch Weave Net onto both VMs:

~~~bash
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod +x /usr/local/bin/weave
weave launch <host-02-ip>
~~~

**4.** Setup the environment to run the Weave Docker API proxy: 

~~~bash
eval $(weave env)
~~~

With the Weave environment set up, you can run regular Docker commands on the same command line from which you created VMs. If you are attaching containers to the Weave Network, this step is mandatory, unless you've opted to use the Weave Net Docker Plugin which is described in part XX. 

**5.** Run the docker compose file and direct each app to a host: 

~~~bash
cd proxy-compose
docker-compose up -d pingme on weave-net-demo-01 
docker-compose up -d pinger on weave-net-demo-02
~~~

###<a name="compose-proxy"></a>Docker Compose File for the Weave Docker API Proxy###

The network_mode is set to "bridge" for this mode. 

~~~bash
version: '2'

services:
 ping:
    image: alpine
    container_name: pingme
    command: nc -p 4000 -ll -e echo 'Hello, Weave!'
    network_mode: "bridge"
    
 ping:
    image: alpine
    container_name: pinger
    command: sh -l
    hostname: hello.weave.local
    network_mode: "bridge"
~~~

###<a name="compose-plugin"></a>Docker Compose File Variants and the Weave Net Docker Plugin

If you are using the plugin, there are several different ways in which to setup your Docker Compose file. Which method you use, depends on your application's requirements: 

1. Using "networks: - weave" and "dns: ..." and "dns_search: ..." service stanzas and "networks: weave: external: true" networks stanza. This uses the default 'weave' network for everything. It doesn't require a docker cluster and it uses weaveDNS.

2. Using "networks: default: driver: weave". This places all containers on a user-defined network and it uses the 'weave' driver. It assumes that you have a Docker cluster. This method uses Docker's DNS.

3. Using "networks: - {name}" service stanzas and "networks: {name} driver: weave" network stanza. Similar to number 2 but has the ability to place containers on different/multiple networks. This method requires a docker cluster and it uses weaveDNS.
4. 
##<a name="setup-plugin"></a>Docker Compose and the Weave Net Docker Plugin

**1.** Create two virtual machines with Docker-Machine and then obtain the IP of one of the machines. As described in steps 1 and 2 [above].

**2.** To ensure that you are running the Weave Net Docker Plugin, launch Weave in the usual manner: 

~~~bash
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod +x /usr/local/bin/weave
weave launch <host-02-ip>
~~~

And then do not run eval `$(weave env)`. In fact, if you were launching containers manually with Docker run commands, using the `--net` flag automatically disables the proxy and Weave Net attaches containers to the Weave Net Docker Plugin network interface. 









