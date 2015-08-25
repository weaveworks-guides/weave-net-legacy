---
layout: guides
title: "Service Discovery with Weave for Dockerized Spring Apps"
description: |
  In this example we will demonstrate how Weave allows you to quickly deploy a containerised
  microservice based Java application, developed in Spring with simple service discovery using
  Weave Run. No modifications are required to your application.
tags: weave, docker, cli, vagrant, virtualbox, dns, ipam, spring, java, ubuntu, microservices, http
permalink: /guides/language/java/framework/spring/index.html

---


## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example we will demonstrate how Weave allows you to quickly deploy a microservice
based application, developed in Spring with simple service discovery using [Weave Run](/run). No modifications
are required to your application.

We have derived this example from the official [_'Spring Boot with Docker'_](https://spring.io/guides/gs/spring-boot-docker/) guide.

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)
* [Vagrant](http://vagrantup.com)
* [Git](http://git-scm.com/downloads)
* [Spring](http://spring.io)
* [Java](http://openjdk.java.net/)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Spring, Docker and Ubuntu, and we make use
of VirtualBox and Vagrant to allow you to run this entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](http://weave.works/guides/about/vagrant.html)

## What you will do ##

You will use Weave to provide service discovery for a simple Spring based application. Your containers
are all launched using standard docker commands, with no special invocations or code modifications required.

## Configuring and setting up your hosts ##

All of the code for this example is available on [github](http://github.com/weaveworks/buides), and you first clone the getting started repository.

~~~bash
git clone http://github.com/weaveworks/guides
~~~

You will use Vagrant to setup and configure an Ubuntu host, install Docker and other components needed for this demo. We make use of Vagrant's functionality to download the base docker images we will be using, and we then install Weave. If you would like to work through the installation steps please review our [getting started guide](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/README.md) for a more manual example.

~~~bash
cd guides/spring-boot-weave-service-discovery
vagrant up
~~~

Vagrant will pull down and configure an Ubuntu image, this may take a few minutes depending on the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com). If you are thinking about a cup of coffee, now may be a good point to get one.

Once the setup of the host is complete you can check its status with

~~~bash
vagrant status
~~~

The IP addresses we use for this demo are

~~~bash
172.17.8.101    weave-gs-01
~~~

## Introducing WeaveDNS ##

[WeaveDNS](http://docs.weave.works/weave/latest_release/weavedns.html) answers name queries in a Weave network. WeaveDNS provides a simple way for containers to find each other: just give them hostnames and tell other containers to connect to those names.

## Introducting Weave Automatic IP Address Management ##

[Weave Automatic IP Address Management (IPAM)](http://docs.weave.works/weave/latest_release/ipam.html) automatically assigns containers IP addresses that are unique across the network. Weave IPAM allows you to easily add more containers to your network and takes care of ensuring each container has a unique IP so you don't have too.

## Launching Weave for our example ##

In order to start our example we first first lauch Weave on our host.

~~~bash
vagrant ssh weave-gs-01
weave launch && weave launch-dns && weave launch-proxy
~~~

## What has happened ##

At this point you have launched Weave on your host, and created an overlay network which also provides DNS.

Logging into your host and typing `weave status` will give you output similar to below

~~~bash
vagrant@weave-gs-02:~$ weave status
weave router 1.0.2
Our name is fe:7f:a5:4f:44:02(weave-gs-02)
Encryption off
Peer discovery on
Sniffing traffic on &{10 65535 ethwe 32:c0:13:fd:5b:73 up|broadcast|multicast}
MACs:
32:c0:13:fd:5b:73 -> fe:7f:a5:4f:44:02(weave-gs-02) (2015-08-24 06:31:05.381168359 +0000 UTC)
06:9f:08:a3:6f:b9 -> fe:7f:a5:4f:44:02(weave-gs-02) (2015-08-24 06:31:05.771771126 +0000 UTC)
fe:7f:a5:4f:44:02 -> fe:7f:a5:4f:44:02(weave-gs-02) (2015-08-24 06:31:06.366766554 +0000 UTC)
5a:ff:9a:bc:d1:b6 -> fe:7f:a5:4f:44:02(weave-gs-02) (2015-08-24 06:31:17.09406896 +0000 UTC)
Peers:
fe:7f:a5:4f:44:02(weave-gs-02) (v0) (UID 2496789595893685527)
Routes:
unicast:
fe:7f:a5:4f:44:02 -> 00:00:00:00:00:00
broadcast:
fe:7f:a5:4f:44:02 -> []
Direct Peers:
Reconnects:

Allocator range [10.128.0.0-10.192.0.0)
Owned Ranges:
  10.128.0.0 -> fe:7f:a5:4f:44:02 (weave-gs-02) (v1)
Allocator default subnet: 10.128.0.0/10

weave DNS 1.0.2
Listen address :53
Fallback DNS config &{[10.0.2.3] [overplay] 53 1 5 2}

Local domain weave.local.
Interface &{14 65535 ethwe 5a:ff:9a:bc:d1:b6 up|broadcast|multicast}
Zone database:


weave proxy is running
~~~

## Launching our Containers ##

Next we launch our spring container on our host. Our spring container is a very simple Hello World
application. If you wish to build the container your self please refer to the README in the demo
directory.

As we have enabled both WeaveDNS and Weaves Automatic IP Address Management we only need to provide
the name of our container and the hostname we wish to use. You will notice that we use the same
hostname on each container. WeaveDNS automatically detects this DNS requests

~~~bash
vagrant ssh weave-gs-01
eval $(weave proxy-env)
docker run -d -h spring-hello.weave.local fintanr/sd-weave-spring
docker run -d -h spring-hello.weave.local fintanr/sd-weave-spring
~~~

## What has happened ##

At this point you have launched your microservice, but without needing it to register
with any service discovery mechanism. Weave takes care of all of this behind the scenes for you
and your application is now accessible to any port

## Connecting to your application ##

Next we will launch a container with curl on the same network, and from there

~~~bash
vagrant ssh weave-gs-01
eval $(weave proxy-env)
CONTAINER=$(docker run -d -ti -h ubuntu.weave.local fintanr/weave-gs-ubuntu-curl)
docker exec -ti $CONTAINER "/bin/bash"
~~~

In this container lets connect to our endpoint, and make a request to our spring-hello service.

~~~bash
curl spring-hello.weave.local
~~~

This will give you output such as

~~~bash
Hello, Weave!
~~~

## Summary ##

You have used Weave and Docker to provide service discovery for a Spring based application.
