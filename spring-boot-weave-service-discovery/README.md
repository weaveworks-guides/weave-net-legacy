---
layout: guides
title: "Automatic Service Discovery with Weave Run for Dockerized Spring Apps"
description: Deploy a Java microservice application developed with Spring to a Docker Container and then use Weave Run to automatically discover its service.
tags: vagrant, dns, spring, java, ubuntu, microservices
permalink: /guides/language/java/framework/spring/index.html

---


## What you will build ##

Weave is a software network optimized for visualizing and communicating with apps distributed among Docker containers. Using tools and protocols that are familiar to you, Weave's network provides a way for you to communicate between containerized apps distributed across multiple networks or hosts more quickly and efficiently. With Weave you focus on developing your application, rather than your infrastructure.

This example shows how to use [Weave Run](http://weave.works/run/index.html) to automatically find services deployed to the Weave network.  You will deploy a docker container with a microservice created with Spring  and then discover that microservice through DNS without requiring any modifications to the application.

Specifically, in this tutorial you will: 

1. Use Vagrant to setup the Unbuntu host and to install docker
1. Launch a microservice created with Spring into Docker containers.
2. Use `Weave Run` to provide automatic service discovery for a simple Spring based application. 

This tutorial requires no progamming, but it does require some UNIX skills. This example should take about 15 minutes to complete. 

Note: This example is derived from the official [_'Spring Boot with Docker'_](https://spring.io/guides/gs/spring-boot-docker/) guide.

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)
* [Git](http://git-scm.com/downloads)
* [Spring](http://spring.io)
* [Java](http://openjdk.java.net/)

## What You Need to Complete This Guide

Ensure that you have following installed and configured for your operating system:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](http://weave.works/guides/about/vagrant.html)

## Configuring and Setting Up Your Hosts

To begin, clone the Weaveworks/Guides repository:

~~~bash
git clone http://github.com/weaveworks/guides
~~~

This example uses Vagrant to provision and setup your host, it:  

 * setups and configures the Ubuntu image on Virtualbox
 * downloads and installs Docker
 * downloads and installs the microservice created with Spring
 
 To work with a manual setup of a Virtualbox host and Weave, please review [Getting Started with Weave and Docker on Ubuntu](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/README.md).

~~~bash
cd guides/spring-boot-weave-service-discovery
vagrant up
~~~

Vagrant downloads and configures the components used in this example. This may take a few minutes depending on the speed of your network connection. For more information about Vagrant, refer to the [Vagrant documentation](http://vagrantup.com).

Once the setup of the host is complete, check its status:

~~~bash
vagrant status
~~~

The IP addresses used for this demo are as follows:

~~~bash
172.17.8.101    weave-gs-01
~~~

## Weave and DNS

The [Weavedns](http://docs.weave.works/weave/latest_release/weavedns.html) service answers name queries on a Weave network. {{ Weavedns }} provides a simple way for containers to find each other by giving them hostnames and telling the other containers to connect to those names.

## Weave and Automatic IP Address Management

[Weave Automatic IP Address Management (IPAM)](http://docs.weave.works/weave/latest_release/ipam.html) automatically assigns containers IP addresses that are unique across the network. With Weave IPAM you can easily add more containers to your network, ensuring that each container has a unique IP.

## Launching Weave

To begin the example, download and launch Weave on the host.

~~~bash
vagrant ssh weave-gs-01
weave launch && weave launch-dns && weave launch-proxy
~~~

Weave checks locally to see if an image has been downloaded, if it doesn't find one, then Weave is downloaded and installed onto the host.

Setup Weave's environment: 

~~~bash
eval $(weave proxy-env)
~~~

## What Just Happened

The Weave network launched on your host, and with it DNS is also configured. 

SSH onto the host and type `weave status` to see that Weave is running:

~~~bash
vagrant@weave-gs-01:~$ weave status
weave router 1.0.2
Our name is a2:ff:45:94:61:d8(weave-gs-01)
Encryption off
Peer discovery on
Sniffing traffic on &{10 65535 ethwe a6:6c:05:23:38:9a up|broadcast|multicast}
MACs:
a6:6c:05:23:38:9a -> a2:ff:45:94:61:d8(weave-gs-01) (2015-08-27 19:01:10.339311994 +0000 UTC)
da:da:67:ab:65:ed -> a2:ff:45:94:61:d8(weave-gs-01) (2015-08-27 19:01:10.718857347 +0000 UTC)
a2:ff:45:94:61:d8 -> a2:ff:45:94:61:d8(weave-gs-01) (2015-08-27 19:01:10.974794319 +0000 UTC)
3e:b5:7d:e8:79:52 -> a2:ff:45:94:61:d8(weave-gs-01) (2015-08-27 19:01:19.953922745 +0000 UTC)
Peers:
a2:ff:45:94:61:d8(weave-gs-01) (v0) (UID 10676184706133401375)
Routes:
unicast:
a2:ff:45:94:61:d8 -> 00:00:00:00:00:00
broadcast:
a2:ff:45:94:61:d8 -> []
Direct Peers:
Reconnects:

Allocator range [10.128.0.0-10.192.0.0)
Owned Ranges:
  10.128.0.0 -> a2:ff:45:94:61:d8 (weave-gs-01) (v1)
Allocator default subnet: 10.128.0.0/10

weave DNS 1.0.2
Listen address :53
Fallback DNS config &{[10.0.2.3] [] 53 1 5 2}

Local domain weave.local.
Interface &{14 65535 ethwe 3e:b5:7d:e8:79:52 up|broadcast|multicast}
Zone database:


weave proxy is running

~~~

## Deploying the Docker Containers

Now you are ready to deploy the spring application into a docker container on the host. The spring application is a simple `Hello World`
application. The docker container is pre-built for this example, but if you would like to build your own container, refer to the `README` file located in  in the demo sub-directory of this guide. 

Since both {{ weavedns }} and Automatic IP Address Management are launched as a part of the Weave Network, you only need to provide
the name of the container and the hostname you wish to use. Notice that the same hostname is used for each container. {{ Weavedns }} automatically detects any DNS requests and it adds them to the Weave Network.

~~~bash
vagrant ssh weave-gs-01
eval $(weave proxy-env)
docker run -d -h spring-hello.weave.local fintanr/sd-weave-spring
docker run -d -h spring-hello.weave.local fintanr/sd-weave-spring
~~~

You just launched the microservice into a docker container without registering it with a service discovery mechanism. Weave takes care of Service Discovery seamlessly without your intervention.  With Weave your service is available on any port. 

Running `docker ps` should show output similar to this: 

~~~bash
CONTAINER ID        IMAGE                        COMMAND                CREATED             STATUS              PORTS                                            NAMES
28027951b9c4        fintanr/sd-weave-spring      "/w/w java -Djava.se   6 seconds ago       Up 5 seconds                                                         desperate_ritchie   
4b5ea0c3e855        fintanr/sd-weave-spring      "/w/w java -Djava.se   26 seconds ago      Up 25 seconds                                                        kickass_jones       
cd2173d2f18d        weaveworks/weaveexec:1.0.2   "/home/weave/weavepr   11 minutes ago      Up 11 minutes                                                        weaveproxy          
ed5c939d9b70        weaveworks/weavedns:1.0.2    "/home/weave/weavedn   11 minutes ago      Up 11 minutes       10.1.42.1:53->53/udp                             weavedns            
5f9b44ca496e        weaveworks/weave:1.0.2       "/home/weave/weaver    11 minutes ago      Up 11 minutes       0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave               

~~~


## Connecting to your application

Next launch a container using curl on to the same network:

~~~bash
vagrant ssh weave-gs-01
eval $(weave proxy-env)
CONTAINER=$(docker run -d -ti -h ubuntu.weave.local fintanr/weave-gs-ubuntu-curl)
docker exec -ti $CONTAINER "/bin/bash"
~~~

In this container you can connect to the endpoint, and make a request to the spring-hello service.

~~~bash
curl spring-hello.weave.local
~~~

This will give you the following output:

~~~bash
Hello, Weave!
~~~

## Summary

You have used Weave and Docker to provide service discovery for a Spring based application. You can easily adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [email](mailto:help@weave.works) or [Twitter](https://twitter.com/weaveworks)


##For Further Reading
 * [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
 * [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
 * [Naming and Discovery](http://docs.weave.works/weave/latest_release/features.html#naming-and-discovery)
 * [Address Allocation](http://docs.weave.works/weave/latest_release/features.html#addressing)
