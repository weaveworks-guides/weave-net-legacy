---
layout: guides
title: "Automatic Service Discovery with Weave Run for Dockerized Spring Apps"
description: Deploy a Java microservice application developed with Spring to a Docker Container and then use Weave Run to automatically discover its service.
tags: vagrant, dns, spring, java, ubuntu, microservices
permalink: /guides/language/java/framework/spring/index.html
shorttitle: Weave Run & Dockerized Spring Apps
sidebarpath: /start/micro/dockerspring
sidebarweight: 20
---


## What You Will Build ##

This example demonstrates how to use [Weave Run](http://weave.works/run/index.html) to automatically find services deployed to the Weave network.  You will deploy a docker container with a microservice created with Spring  and then discover that microservice through DNS without requiring any code modifications to the application.

Specifically, in this tutorial you will: 

1. Use Vagrant to set up the Unbuntu host and install docker
1. Launch a microservice created with Spring into Docker containers.
2. Use `Weave Run` to provide automatic service discovery for a simple Spring based application. 

This tutorial requires no progamming, but it does require some UNIX skills. This example should take about 15 minutes to complete. 

Note: This example is derived from the official [_'Spring Boot with Docker'_](https://spring.io/guides/gs/spring-boot-docker/) guide.

## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)
* [Git](http://git-scm.com/downloads)
* [Spring](http://spring.io)
* [Java](http://openjdk.java.net/)

##Before You Begin

Ensure that you have following installed and configured for your operating system:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](http://weave.works/guides/about/vagrant.html)

##Configuring and Setting Up Your Hosts

To begin, clone the Weaveworks/Guides repository:

~~~bash
git clone https://github.com/weaveworks/guides
~~~

This example uses Vagrant to provision and setup your host, it:  

 * sets up and configures the Ubuntu image on Virtualbox.
 * downloads and installs Docker.
 * downloads and installs the Spring-based microservice.
 
If you would like to see a more manual set up of a Virtualbox host with Weave, please review [Getting Started with Weave and Docker on Ubuntu](http://http://weave.works/guides/weave-docker-ubuntu-simple.html).

~~~bash
cd guides/spring-boot-weave-service-discovery
vagrant up
~~~

Downloading and configuring the components used in this example may take a few minutes depending on the speed of your network connection. 

For more information about Vagrant, refer to the [Vagrant documentation](http://vagrantup.com).

Once the set up of the host is complete, check its status:

~~~bash
vagrant status
~~~

The IP addresses used for this demo are as follows:

~~~bash
172.17.8.101    weave-gs-01
~~~

###Weave and DNS

The [Weavedns](http://docs.weave.works/weave/latest_release/weavedns.html) service answers name queries on a Weave network. `weavedns` provides a simple way for containers to find each other by giving them hostnames and telling the other containers to connect to those names.

###Weave and Automatic IP Address Management

[Weave Automatic IP Address Management (IPAM)](http://docs.weave.works/weave/latest_release/ipam.html) automatically assigns containers IP addresses that are unique across the network. With Weave IPAM you can easily add more containers to your network, ensuring that each container has a unique IP.

## Launching Weave

To begin the example, ssh on to the host, and then launch the Weave Network:

~~~bash
vagrant ssh weave-gs-01
weave launch
~~~

Weave checks locally to see if an image has been downloaded, if it doesn't find one, then Weave is downloaded and installed onto the host.

Next, set up Weave's environment: 

~~~bash
eval "$(weave env)"
~~~

>>>Note: In this guide commands were run directly on the host, but you can also run docker commands from your local machine on the remote host by configuring the docker client to use the [Weave Docker API
Proxy](http://docs.weave.works/weave/latest_release/proxy.html). The Weave Docker API Proxy allows you to use the official docker client, and it will also attach any booted
containers to the weave network. To enable the proxy, first install Weave on to your local machine, run `weave launch` and then set the environment by running `eval "$(weave env)"`

## What Just Happened

The Weave network launched on your host, and is ready to discover containers. 

Type `weave status` to see that all of Weave's componenets are running:

~~~bash
$ weave status

       Version: 1.1.1

       Service: router
      Protocol: weave 1..2
          Name: 8e:6b:63:18:74:c8(weave-gs-01)
    Encryption: disabled
 PeerDiscovery: enabled
       Targets: 0
   Connections: 0
         Peers: 1

       Service: ipam
     Consensus: deferred
         Range: [10.32.0.0-10.48.0.0)
 DefaultSubnet: 10.32.0.0/12

       Service: dns
        Domain: weave.local.
           TTL: 1
       Entries: 0

       Service: proxy
       Address: unix:///var/run/weave/weave.sock
~~~

## Deploying Docker Containers

Now you are ready to deploy the spring application into a docker container on the host. The spring application is a simple `Hello Weave!` application. The docker container is pre-built for this example, but if you would like to build your own container, refer to the `README` file located in  in the demo sub-directory of this guide. 

Since both {{ weavedns }} and Automatic IP Address Management are launched as a part of the Weave Network, you only need to provide the name of the container and the hostname you wish to use. Notice that the same hostname is used for each container. {{ weavedns }} automatically detects any DNS requests and adds them to the Weave Network without your intervention.

~~~bash
vagrant ssh weave-gs-01
eval "$(weave env)"

docker run -d -h spring-hello.weave.local weaveworks/spring-microservices-example 
docker run -d -h spring-hello.weave.local weaveworks/spring-microservices-example 
~~~

You just launched the microservice into a two different docker containers and have made them available on the Weave Network on any port.

Running `docker ps` should show output similar to this: 

~~~bash
$docker ps

CONTAINER ID        IMAGE                        COMMAND                CREATED             STATUS              PORTS                                                                                        NAMES
eaf0501aef7c        weaveworks/sd-weave-spring   "/w/w java -Djava.se   2 minutes ago       Up 2 minutes                                                                                                     trusting_thompson   
0c747bc4e083        weaveworks/sd-weave-spring   "/w/w java -Djava.se   2 minutes ago       Up 2 minutes                                                                                                     goofy_bell          
fdf6b3d4ce4a        weaveworks/weaveexec:1.1.1   "/home/weave/weavepr   17 minutes ago      Up 17 minutes                                                                                                    weaveproxy          
1d9fe3a94df8        weaveworks/weave:1.1.1       "/home/weave/weaver    17 minutes ago      Up 17 minutes       10.1.42.1:53->53/tcp, 10.1.42.1:53->53/udp, 0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave               
~~~


## Connecting To Your Application

Next launch a containerized curl command on the same network:

~~~bash
vagrant ssh weave-gs-01
eval $(weave env)
CONTAINER=$(docker run -d -ti -h ubuntu.weave.local weaveworks/weave-gs-ubuntu-curl)
docker exec -ti $CONTAINER "/bin/bash"
~~~

Press return to see the prompt for this container.  From this container, you can connect to the endpoint, and make a request to the spring-hello service by entering:

~~~bash
curl spring-hello.weave.local
~~~

This returns the following:

~~~bash
Hello, Weave!
~~~

##Cleaning Up the VMs

To clean up the VMs run: 

~~~bash
vagrant destroy
~~~

##Conclusions

You have used Weave and Docker to provide service discovery for a Spring based application. You can easily adapt this example and use it as a template for your own implementation. 

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).


##For Further Reading
 * [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
 * [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
 * [Naming and Discovery](http://docs.weave.works/weave/latest_release/features.html#naming-and-discovery)
 * [Address Allocation](http://docs.weave.works/weave/latest_release/features.html#addressing)
