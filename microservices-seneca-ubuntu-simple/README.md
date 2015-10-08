---
layout: guides
title: Microservices with Weave, Docker and Node.js on Ubuntu
description: How to use a Weave network to manage microservices such as Node.js and Seneca on Ubuntu.
tags: vagrant, javascript, node, ubuntu, microservices, dns
permalink: /guides/weave-microservices-docker-nodejs.html
shorttitle: Using Weave & Node.js on Ubuntu
sidebarpath: /start/micro/nodeubuntu
sidebarweight: 50
---

## What you will build ##


This example demonstrates how to create a containerized set of microservices built with [Node.js](http://nodejs.org), and the microservices toolkit for Node.js, [Seneca](http://senecajs.org/).

The example is derived from the Seneca microservices example which is available on 
[github](https://github.com/rjrodger/seneca-examples/tree/master/micro-services).

Specifically, you will: 

1. Provision two VMs with Ubuntu on a VirtualBox using Vagrant. 
2. Install and launch the Weave Network.
3. Deploy three containers each with its own microservice: a web client, a log in and out service and a product offering service (depending on whether the user is logged in or not) between the two VMs.
4. Log into web service to test that containers are communicating.

The example does not require any programming and it will take 15 minutes to complete. 

![Weave, Microservices and Docker](/guides/images/Microservices_Seneca_Weave.png)

## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Seneca](http://senecajs.org)
* [Node.js](http://nodejs.org)
* [Ubuntu](http://ubuntu.com)

## Before You Begin ##

Ensure that the following are installed before you begin this tutorial: 

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

## A Note on Microservices ##

Microservices have emerged as a development pattern in recent times, with companies such as Netfilx, Hubspot and OpenTable adopting the approach. 

But what exactly are Microservices anyway?

A formal definition is hard to come by, but the definitions we have found to be most useful are:

* Microservices are an approach to developing a single application as a suite of small, connected, services ([Martin Fowler](https://twitter.com/martinfowler))
* Microservices are loosely coupled service orientated architecture with bounded contexts ([Adrian Cockcroft](https://twitter.com/adrianco))
* Microservices are small automonous services that work well together ([Sam Newman](https://twitter.com/samnewman))

A common thread throughout all of these definitions is that of small simple services that do one thing very well, and which can be easily combined together. People frequently cite [The Unix Philosophy](http://en.wikipedia.org/wiki/Unix_philosophy) of "small, composable tools" when describing a Microservices architecture.

A discussion on why you should use Microservices is beyond the scope of this guide. For more information see the
articles and presentations by [Martin Fowler and James Lewis](http://martinfowler.com/articles/microservices.html), [Adrian Cockcroft](http://www.slideshare.net/adriancockcroft/dockercon-state-of-the-art-in-microservices) and in the book [Building Microservices](http://shop.oreilly.com/product/0636920033158.do) by Sam Newman.
  
## Setting Up The Hosts ##

The code used for this example is available on [github](http://github.com/weaveworks/guides/microservices-seneca-ubuntu-simple). To begin, please clone the getting started repository.

    git clone https://github.com/weaveworks/guides

You will use Vagrant to set up and configure an Ubuntu host and to install Docker.  If you would like to work through the installation steps please review our [Getting Started With Weave on Ubuntu](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/README.md) where a more manual example is described.

    cd guides/microservices-seneca-ubuntu-simple
    vagrant up

Vagrant pulls down and configures the Ubuntu image. This may take a few minutes depending on the speed of your network connection. For more information on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

Once the setup of the hosts is complete, check their status with:

    vagrant status

The IP addresses used for this demo are:

    172.17.8.101 	weave-gs-01
    172.17.8.102 	weave-gs-02

Vagrant also configures weave-gs-01 to pass traffic from port 80 to localhost port 8080.

##Installing Weave

Install Weave on each host [using a separate terminal for each host](http://weave.works/guides/about/vagrant.html#general-usage-pattern):

~~~bash
vagrant ssh weave-gs-01
vagrant@weave-gs-01:~$ sudo -s
root@weave-gs-01:~# curl -L git.io/weave -o /usr/local/bin/weave
root@weave-gs-01:~# chmod a+x /usr/local/bin/weave
~~~

~~~bash
vagrant ssh weave-gs-02
vagrant@weave-gs-02:~$ sudo -s
root@weave-gs-01:~# curl -L git.io/weave -o /usr/local/bin/weave
root@weave-gs-01:~# chmod a+x /usr/local/bin/weave
~~~~

The commands to install Weave are provided as part of this getting started guide, but in practice you would automate this step for each host.

If you prefer to see the demo right away, refer to [Launching the Demo Application](launching-the-demo-application) where a script is provided that automates the whole process. 

###1. Launch Weave on Each Host

~~~bash
vagrant ssh weave-gs-01
weave launch --ipalloc-range 10.2.1.1/24
~~~

Where `--ipalloc-range` specifies the IP address range to use on the network. 

~~~bash
vagrant ssh weave-gs-02
weave launch 172.17.8.101 --ipalloc-range 10.2.1.2/24
~~~

On the second host, weave is launched by passing the IP address of `weave-gs-01`, to create a peered network. 

To view all weave components and the peered hosts:

~~~bash
vagrant@weave-gs-02:~$ weave status

       Version: 1.1.1

       Service: router
      Protocol: weave 1..2
          Name: ca:93:d9:f8:d0:0b(weave-gs-02)
    Encryption: disabled
 PeerDiscovery: enabled
       Targets: 1
   Connections: 1 (1 established)
         Peers: 2 (with 2 established connections between them)

       Service: ipam
     Consensus: deferred
         Range: [10.2.1.0-10.2.2.0)
 DefaultSubnet: 10.2.1.0/24

       Service: dns
        Domain: weave.local.
           TTL: 1
       Entries: 3

       Service: proxy
       Address: unix:///var/run/weave/weave.sock
~~~


####About `WeaveDNS`

[WeaveDNS](http://docs.weave.works/weave/latest_release/weavedns.html) answers name queries on a Weave network. It provides a simple way for containers to find each other: just give them hostnames and tell other containers to connect to those names. Unlike Docker 'links', WeaveDNS requires no code changes and it also works across hosts.

The seneca code was modified in this example to refer to hostnames. Each container was given a hostname and then uses `weaveDNS` to find the correct container for a request.

###2. Start the Node.js application 

On weave-gs-02: 

~~~bash
root@weave-gs-02:~# eval "$(weave env)"
root@weave-gs-02:weave run --with-dns 10.3.1.2/24 -h user.weave.local weaveworks/seneca_user
~~~

On weave-gs-01:
~~~bash
root@weave-gs-01:~# eval "$(weave env)"
root@weave-gs-01:weave run --with-dns 10.3.1.1/24 -h offer.weave.local weaveworks/seneca_offer
root@weave-gs-01:weave run --with-dns 10.3.1.3/24 -p 80:80 -h web.weave.local weaveworks/seneca_webapp
~~~

### What Just Happened? ###

On the first host, `weave-gs-01`, the Weave containers were launched. On the second host, `weave-gs-02`, another two Weave containers were launched using the IP address of your first host. Passing the IP address of the first host to the second host instructs Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

The Node.js application was then launched.

You should now have multiple containers running on each host, which you can see by running `docker ps` on either host:

~~~bash

    vagrant@weave-gs-01:~$ docker ps
CONTAINER ID        IMAGE                        COMMAND                CREATED             STATUS              PORTS                                                                                        NAMES
287ea2b5f60a        weaveworks/seneca_user       "nodejs /opt/app/ser   3 minutes ago       Up 3 minutes                                                                                                     sleepy_jones        
2c1d61eed533        weaveworks/weaveexec:1.1.1   "/home/weave/weavepr   7 minutes ago       Up 7 minutes                                                                                                     weaveproxy          
bf9414255fc6        weaveworks/weave:1.1.1       "/home/weave/weaver    7 minutes ago       Up 7 minutes        10.1.42.1:53->53/tcp, 10.1.42.1:53->53/udp, 0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave               

~~~


## Microservices Example With Seneca ##

The example is running three different microservices in three different containers, spread across the hosts. To test that all of the services are running properly, point your browser to [http://localhost:8080](http://localhost:8080), where you are presented with a login screen. Login with the username and password u1/U1.

This example is a very simple demonstration of how to use the Seneca framework, the discussion of which is beyond the scope of this guide. For more details refer to the [Seneca website](http://senecajs.org/).

Seneca is written in Javascript using the Node.js libraries. The Dockerfiles used for building the containers in this guide are also included in the [github repo](https://github.com/weaveworks/guides/tree/master/microservices-seneca-ubuntu-simple). 

##Launching The Demo Application ##

The following script is provided which automates deploying the application into the containers. 

    ./launch-senca-demo.sh

## Conclusions ##

You have now used Weave to quickly deploy a simple Node.js microservices application using Docker containers.


##Further Reading


## Credits ##

The seneca example code is adapted from Richard Rodger's of [Nearform](http://nearform.com) [Seneca Microservices example](https://github.com/rjrodger/seneca-examples).
