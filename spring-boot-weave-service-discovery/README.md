---
layout: guides
title: Automatically Discover Containerized Microservices
description: Deploy containerized microservices to Weave Net.
tags: vagrant, spring, java, ubuntu, microservices
permalink: /guides/language/java/framework/spring/index.html
shorttitle: Weave Run & Dockerized Spring Apps
sidebarpath: /start/micro/dockerspring
sidebarweight: 20
---

In this tutorial you will learn how to use [`weavedns`](http://docs.weave.works/weave/latest_release/weavedns.html) to automatically discover services on a Weave container network.  You will deploy several Spring-based microservices to Docker containers and then discover those microservices using `weavedns` without requiring any modifications to the code.

You will: 

1. Use Vagrant to set up the Unbuntu host and install Docker
2. Launch the microservices, consisting of a Tomcat application server and a Java Servlet, created with the Spring Framework into a Docker container.
3. Use `weavedns` to discover the container on the Weave network.

This tutorial requires no progamming, but it does require some UNIX skills. This example should take about 15 minutes to complete. 

>Note: This example is derived from the official [_'Spring Boot with Docker'_](https://spring.io/guides/gs/spring-boot-docker/) guide.

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

This tutorial uses Vagrant to provision and set up your host it:  

 * downloads and configures the Ubuntu image on Virtualbox.
 * downloads and installs Docker.
 * downloads the Spring-based microservice.
 * downloads Weave from DockerHub.
 
For more information about Vagrant, refer to the [Vagrant documentation](http://vagrantup.com).

For a more manual set up of a Virtualbox host with Weave Net, see the guide [Getting Started with Weave and Docker on Ubuntu](/networking-docker-containers-with-weave-on-ubuntu/).

~~~bash
cd guides/spring-boot-weave-service-discovery
vagrant up
~~~

Downloading and configuring the components used in this example may take a few minutes depending on the speed of your network connection. 

Once the set up of the host is complete, you can check its status using:

~~~bash
vagrant status
~~~

The IP addresses used for this demo are as follows:

~~~bash
172.17.8.101    weave-gs-01
~~~

####Weave and DNS

The [weavedns](http://docs.weave.works/weave/latest_release/weavedns.html) service answers name queries on a Weave network. `weavedns` provides a simple way for containers to find each other by giving them hostnames and telling the other containers to connect to those names.

####Weave and Automatic IP Address Management

[Weave Automatic IP Address Management (IPAM)](http://docs.weave.works/weave/latest_release/ipam.html) automatically assigns containers IP addresses that are unique across the network. With Weave IPAM you can easily add more containers to your network, ensuring that each container receives a unique IP.

## Launching Weave

To begin this tutorial, ssh on to the host, and then launch Weave Net:

~~~bash
vagrant ssh
weave launch
~~~

Weave Net checks locally to see if an image has been downloaded, if it doesn't find one, then the latest version of Weave Net is downloaded from Dockerhub and installed onto the host.

Next, set up Weave Net's environment: 

~~~bash
eval "$(weave env)"
~~~

To install and launch Weave Net manually on the host:

~~~bash

 vagrant ssh
 $ sudo -s
 # curl -L git.io/weave -o /usr/local/bin/weave
 # chmod a+x /usr/local/bin/weave
 # weave launch
 # eval "$(weave env)"

~~~ 


>Note: In this guide commands were run directly on the host, but you can also run Docker commands from your local machine on the remote host by configuring the docker client to use the [Weave Docker API
Proxy](http://docs.weave.works/weave/latest_release/proxy.html). The Weave Docker API Proxy allows you to use the official docker client, and it will also attach any booted containers to the weave network. To enable the proxy, first install Weave on to your local machine, run `weave launch` and then set the environment by running `eval "$(weave env)"`

## What Just Happened

Weave Net is running on the host, and ready to discover any containers deployed to it.  

Type `weave status` to check that all of Weave Net's componenets are running:

~~~bash
$ weave status

       Version: 1.4.5

       Service: router
      Protocol: weave 1..2
          Name: 8e:6b:63:18:74:c8(weave-gs-01)
    Encryption: disabled
 PeerDiscovery: enabled
       Targets: 0
   Connections: 0
         Peers: 1

       Service: ipam
     Consensus: idle
         Range: 10.32.0.0-10.47.255.255
 DefaultSubnet: 10.32.0.0/12

       Service: dns
        Domain: weave.local.
           TTL: 1
       Entries: 0

       Service: proxy
       Address: unix:///var/run/weave/weave.sock
       
        Service: plugin
     DriverName: weave
~~~

## Deploying Docker Containers

Now you are ready to deploy the spring application into a Docker container and run it on the Weave Net network. The spring application is a simple `Hello Weave!` app. The Docker container was pre-built for this example, and if you want to build your own container, refer to the `README.md` file located in `/demo`. 

Since both weaveDNS and IP Address Automatic Management (IPAM) are launched as a part of the Weave Net, you only need to provide the name of the container and the hostname that you wish to use. The weaveDNS service automatically detects any DNS requests and adds them to the Weave Network without your intervention.

Next deploy the Docker container with the Tomcat application server and the hello world java application:

~~~bash
vagrant ssh weave-gs-01
eval "$(weave env)"

docker run -d -h spring-hello.weave.local weaveworks/gs-spring-boot-docker
~~~

The microservices are launched into a docker container and is available on the private Weave network. 

Running `docker ps` should show output similar to this: 

~~~bash
$docker ps

CONTAINER ID        IMAGE                              COMMAND                  CREATED              STATUS              PORTS               NAMES
159af19247c1        weaveworks/gs-spring-boot-docker   "/w/w java -Djava.sec"   7 seconds ago        Up 6 seconds                            ecstatic_shockley
e3e3e7ee6e05        weaveworks/plugin:1.4.5            "/home/weave/plugin"     About a minute ago   Up About a minute                       weaveplugin
6af32e5c30ae        weaveworks/weaveexec:1.4.5         "/home/weave/weavepro"   About a minute ago   Up About a minute                       weaveproxy
433fd378a330        weaveworks/weave:1.4.5             "/home/weave/weaver -"   About a minute ago   Up About a minute                       weave
     
~~~


## Connecting To Your Application

Launch a containerized curl command onto the network. Curl will return a message from the Tomcat application server that is listening on Port 8080:

~~~bash
vagrant ssh weave-gs-01
eval $(weave env)
CONTAINER=$(docker run -d -ti -h ubuntu.weave.local weaveworks/weave-gs-ubuntu-curl)
docker exec -ti $CONTAINER "/bin/bash"
~~~

Press return to see the prompt for this container.  From this container, you can connect to the endpoint, and then make a request to the spring-hello service by entering:

~~~bash
curl http://spring-hello.weave.local:8080/
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

You have used Weave and Docker to provide service discovery for a Spring based application.

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).


##For Further Reading
 * [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
 * [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
 * [Naming and Discovery](http://docs.weave.works/weave/latest_release/features.html#naming-and-discovery)
 * [Address Allocation](http://docs.weave.works/weave/latest_release/features.html#addressing)
