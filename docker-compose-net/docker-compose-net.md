---
layout: guides
title: How to Use Docker Compose with Weave Net
---

Docker Compose is used to configure multiple containers. A Docker Compose file configures your application's services and with a single command `docker compose up` creates and starts services. Depending on how you are using Weave Net, whether through the Docker API Proxy or by using the Weave Docker Plugin, the syntax of the Docker Compose file differs. This guide provides an overview of the different ways in which networking can be configured and also provides examples of the Docker Compose files for Weave Net. 

The following topics are discussed: 

  * [What You Will Use](#what-use)
  * [Before You Begin](#before)
  * [Attaching Containers to a Weave Network](#attaching-containers)
  * [Docker Compose and the Weave Net Docker API Proxy](#setup-proxy)
     * [Docker Compose File Syntax for the Weave Docker API Proxy](#compose-proxy)
  * [Docker Compose and the Weave Net Docker Plugin](#setup-plugin)
    * [Docker Compose File Syntax and the Weave Net Docker Plugin](#compose-plugin)

##<a name="what-use"></a>What You Will Use

* [Weave Net](https://wwww.weave.works) to network your containers across multiple hosts. 
* [Weave Scope](https://www.weave.works/scope/index.html) to visualize containers and to verify that everything is working correctly.
* [Docker](https://www.docker.com/) to containize your applications. 
* [Docker Compose](https://www.docker.com/docker-compose) to start multiple connected containers as a single unit. 

##<a name="before"></a>Before You Begin

If you are using OS X or Windows, install [Docker Toolbox](https://www.docker.com/toolbox), which provides all of the tools you need to complete this guide.

For other operating systems, install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at least the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

##<a name="attaching-containers"></a>Docker Compose and Attaching Containers to a Weave Network 
 
 There are two different ways that you can attach containers to a Weave network when using Compose (which method to use is 
 entirely up to you):
 
 **1.** The Weave Net Docker API Proxy. With the Weave Net proxy enabled, you can run normal Docker and Docker Compose commands through the proxy and have the resulting containers automatically configured with Weave networking and service discovery (automatic registration in WeaveDNS). If automatic registration and service discovery for containers are required with minimal configuration, then use the Weave Net Docker API Proxy. 
 
The Weave Net Docker API Proxy also allows you to run more than one network at once.
 
This method is enabled after the proxy environment is set up after Weave is launched: 
 
`eval $(weave env)`
 
 See [Integrating Docker via the API Proxy](https://www.weave.works/docs/net/latest/weave-docker-api/).

 **2.**  The Docker Network Plugin framework. If this method is chosen, Docker containers are attached to a Weave network using the Docker Plugin API and since you are using the Docker API framework, weaveDNS is not enabled.

To use the Weave Docker Network Plugin run Docker containers with the `--net` flag, for example: 

`docker run --net <docker-run-options>`

**Where,** 

  * `<docker-run-options>` are the [docker run options](https://docs.docker.com/engine/reference/run/) 
  you give to your container on start 

See [Integrating Docker via the Network Plugin](https://www.weave.works/docs/net/latest/features/#plugin).


##<a name="setup-proxy"></a>Docker Compose and the Weave Net Docker API Proxy


The following is a simple setup that shows how to configure Docker Compose for Weave Net across two hosts using the Docker API proxy. You will launch the alpine container using Docker Compose and then run 'ping' to test the connectivity between the two hosts. 

**1.** Clone the getting started repository:

~~~bash
git clone https://github.com/weaveworks/guides
~~~

**2.** Create two hosts on Virtualbox with docker machine in two different terminal windows: 

~~~bash
docker-machine create -d virtualbox weave-compose-01
eval $(docker-machine env weave-compose-01)
~~~

And, in a new terminal window, create the other VM: 

~~~bash
docker-machine create -d virtualbox weave-compose-02
eval $(docker-machine env weave-compose-02)
~~~

**3.** In order to peer hosts on Weave Net, the IP address of one of the VMs you just created must be known beforehand: 

~~~bash
docker-machine ip weave-compose-02
~~~

Make a note of the IP address that appears. 

**4.** Install and then launch Weave Net onto both VMs. From one terminal window launch Weave Net: 

~~~bash
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod +x /usr/local/bin/weave
weave launch
~~~

And in a second terminal launch Weave Net onto the other host, and pass the IP of the first host to it: 

~~~bash
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod +x /usr/local/bin/weave
weave launch <ip address host-02>
~~~

**5.** Setup the environment to run the Weave Docker API proxy in one terminal and then do the same for the other terminal: 

~~~bash
eval $(docker-compose env machine weave-compose-01)
eval $(weave env)
~~~

~~~bash
eval $(docker-compose env machine weave-compose-02)
eval $(weave env)
~~~

With the Weave Net proxy environment set up, you can run regular Docker commands on the same command line from which you created VMs. If you are attaching containers to the Weave Network, and you want to use weaveDNS to automatically discover containers, then this step is mandatory. 

**6.** Run the Docker Compose file and direct each service to a host: 

~~~bash
cd proxy-compose
docker-compose up -d pingme
~~~

Next, switch to the second terminal, and change to the proxy-compose sub-directory and run the compose file from there:

~~~bash
cd proxy-compose
docker-compose up -d pinger 
~~~

**7.** If all has went well, you should see 'Hello, Weave!' printed on your command line. Pingme will keep responding to the command sent by Pinger for 3600 seconds. You have connnected containers to the Weave network with the Weave Docker API Proxy, and as a result, containers were automatically connected and networked. 



###<a name="compose-proxy"></a>Docker Compose File Syntax for the Weave Docker API Proxy###

If you are using the Weave Docker API Proxy to connect containers, the network_mode is set to "bridge" for this mode. This tells Docker not to use any special networking for these containers, which results in the Weave Docker API Proxy being able to do its work to configure the containers on the Weave Network.

~~~bash
version: '2'

services:
 pingme:
    image: alpine
    container_name: pingme
    command: sleep 3600
    command: nc -p 4000 -ll -e echo 'Hello, Weave!'
    network_mode: "bridge"
    
 pinger:
    image: alpine
    container_name: pinger
    command: ping pingme.weave.local
    hostname: hello.weave.local
    network_mode: "bridge"
~~~


##<a name="setup-plugin"></a>Docker Compose and the Weave Net Docker Plugin

**1.** Clone the Guides directory (if you haven't done so already) and then create two virtual machines with Docker-Machine and then obtain the IP of one of the machines. As described in steps 1 and 2 [above](#setup-proxy).

**2.** To ensure that you are running the Weave Net Docker Plugin, launch Weave in one terminal: 

~~~bash
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod +x /usr/local/bin/weave
weave launch
~~~

And in a second terminal launch Weave on to the other host, and pass the IP of the first host to it: 

~~~bash
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod +x /usr/local/bin/weave
weave launch <ip address host-02>
~~~

Do not run eval `$(weave env)`. 


**3.** Change to the `compose-plugin` directory,  run the docker compose file, and reference the other host: 

~~~bash
cd compose-plugin
docker-compose up -d pingme
~~~

In the second terminal, change to the compose-plugin directory and run: 

~~~bash
cd compose-plugin
docker-compose up -d pinger
~~~

**4.** If all has went well, you should see 'Hello, Weave!' printed on your command line. Pingme will keep responding to the command sent by Pinger for 3600 seconds. 

###<a name="compose-plugin"></a>Docker Compose File Syntax for the Weave Docker Plugin

To use the Weave Docker Plugin, set `driver` to `weavemesh` and leave `networks` and `default` empty. This tells Docker to use the Weave Docker Network Plugin, which is called `weavemesh`.

~~~bash
version: '2'

services:
 pingme:
    image: alpine
    container_name: pingme
    command: sleep 3600
    command: nc -p 4000 -ll -e echo 'Hello, Weave!'
    networks:
    default:
    driver: weavemesh
    
 pinger:
    image: alpine
    container_name: pinger
    command: ping pingme.weave.local
    hostname: hello.weave.local
    networks:
    default:
    driver: weavemesh
~~~

###Cleaning Up The VMs

To tear down the hosts you just created: 

~~~bash
docker-machine kill weave-compose-01
docker-machine kill weave-compose-02
~~~

###Help and Support

If you have any questions, thoughts or feedback, we'd love to hear from you. You can contact us via [Help and Support](https://www.weave.works/help/index.html).

**Further Reading**

 * [Docker Network Plugin](https://www.weave.works/docs/net/latest/features/#plugin)
 * [Integrating Docker via the API Proxy](https://www.weave.works/docs/net/latest/weave-docker-api/)



