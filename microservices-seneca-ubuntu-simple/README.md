---
layout: guides
title: Microservices with Weave, Docker and Node.js on Ubuntu
description: How to use a Weave network to manage microservices such as Node.js and Seneca on Ubuntu.
tags: vagrant, javascript, node, ubuntu, microservices, dns
permalink: /guides/weave-microservices-docker-nodejs.html
---

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will create a containerized set of microservices in a commonly used 
toolkit for building microservices in [Node.js](http://nodejs.org), [Seneca](http://senecajs.org/). 
The example you will use here is derived from the Seneca microservices example available on 
[github](https://github.com/rjrodger/seneca-examples/tree/master/micro-services).

![Weave, Microservices and Docker](/guides/images/Microservices_Seneca_Weave.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Seneca](http://senecajs.org)
* [Node.js](http://nodejs.org)
* [Ubuntu](http://ubuntu.com)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker, Node.js and Ubuntu, and we make use of VirtualBox and Vagrant to allow you to run the entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

## A Note on Microservices ##

Microservices have emerged as a development pattern in recent times, with companies such as Netfilx, Hubspot
and OpenTable adopting the approach. But what are Microservices?

A formal definition is hard to come by, but the definitions we have found to be most useful are

* Microservices are an approach to developing a single application as a suite of small, connected, services ([Martin Fowler](https://twitter.com/martinfowler))
* Microservices are loosely coupled service orientated architecture with bounded contexts ([Adrian Cockcroft](https://twitter.com/adrianco))
* Microservices are small automonous services that work well together ([Sam Newman](https://twitter.com/samnewman))

The common thread you see in all of these definitions is that of small simple services that do one thing very well, and
can be easily combined together. People frequently cite [The Unix Philosophy](http://en.wikipedia.org/wiki/Unix_philosophy)
of small, composable tools when describing Microservices.     

A discussion on why you should use Microservices is beyond the scope of this guide, but you can read a lot more in
articles and presentations by [Martin Fowler and James Lewis](http://martinfowler.com/articles/microservices.html), [Adrian Cockcroft](http://www.slideshare.net/adriancockcroft/dockercon-state-of-the-art-in-microservices) and in the book [Building Microservices](http://shop.oreilly.com/product/0636920033158.do) by Sam Newman.
  
## Setting up our hosts ##

All of the code for this example is available on [github](http://github.com/weaveworks/guides/microservices-seneca-ubuntu-simple), and you first clone the getting started repository.

    git clone http://github.com/weaveworks/guides

You will use Vagrant to setup and configure an Ubuntu host and install Docker. We make use of Vagrant's functionality to download the base docker images we will be using, and we then install Weave. If you would like to work through the installation steps please review our [hello world getting started guide](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/README.md) for a more manual example.

    cd guides/microservices-seneca-ubuntu-simple
    vagrant up

Vagrant will pull down and configure an ubuntu image, this may take a few minutes depending on  the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

Once the setup of the hosts is complete you can check their status with

    vagrant status

The IP addresses we use for this demo are

    172.17.8.101 	weave-gs-01
    172.17.8.102 	weave-gs-01

Our Vagrantfile also configures weave-gs-01 to pass traffic from port 80 to localhost port 8080.

## Introducing WeaveDNS ##

[WeaveDNS](https://github.com/zettio/weave/tree/master/weavedns#readme) answers name queries in a Weave network. WeaveDNS provides a simple way for containers to find each other: just give them hostnames and tell other containers to connect to those names. Unlike Docker 'links', this requires no code changes and works across hosts.

In this example we have modified the seneca example code to refer to hostnames. You will be giving each container a hostname and use WeaveDNS to to find the correct container for a request.

## Launching our demo application ##

We have provided a script to launch our containers, and the steps to do it manually are included below.

    ./launch-senca-demo.sh

If you would prefer to launch things manually, follow the steps below

Firstly launch Weave and WeaveDNS on each host

    vagrant ssh weave-gs-01
    sudo weave launch
    sudo weave launch-dns 10.2.1.1/24

    vagrant ssh weave-gs-02
    sudo weave launch 172.17.8.101
    sudo weave launch-dns 10.2.1.2/24

Next we start our Node.js application 
 
    vagrant ssh weave-gs-02
    sudo weave run --with-dns 10.3.1.2/24 -h user.weave.local fintanr/seneca_user

    vagrant ssh weave-gs-01
    sudo weave run --with-dns 10.3.1.1/24 -h offer.weave.local fintanr/seneca_offer
    sudo weave run --with-dns 10.3.1.3/24 -p 80:80 -h web.weave.local fintanr/seneca_webapp

### What has happened? ###

As this is the first time you have launched Weave you

* downloaded a docker image for the Weave router container
* launched that container

On your first host, `weave-gs-01`, you have launched a Weave router container. On your second host, `weave-gs-02`, you launched another Weave router container with the IP address of your first host. This command tells the Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

You then launched the Node.js application 

At this point you have a single container running on each host, which you can see from docker. On either host run

    sudo docker ps

and you will see something similar to (on this case from weave-gs-02)

    vagrant@weave-gs-02:~$ docker ps
    CONTAINER ID        IMAGE                        COMMAND                CREATED             STATUS              PORTS                                            NAMES
    8c7d304a5130        fintanr/seneca_user:latest   "nodejs /opt/app/ser   3 minutes ago       Up 3 minutes                                                         serene_wilson       
    6c2067546fcf        weaveworks/weavedns:0.10.0   "/home/weave/weavedn   3 minutes ago       Up 3 minutes        10.1.42.1:53->53/udp                             weavedns            
    ae46b1ec7b01        weaveworks/weave:0.10.0      "/home/weave/weaver    4 minutes ago       Up 4 minutes        0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave     

You can see your peered network by using `weave status`

    vagrant@weave-gs-02:~$ sudo weave status
    weave router 0.10.0
    Encryption off
    Our name is 22:02:90:da:43:c7(weave-gs-02)
    Sniffing traffic on &{10 65535 ethwe 9a:23:26:22:74:b8 up|broadcast|multicast}
    MACs:
    96:24:95:ef:6a:43 -> 22:02:90:da:43:c7(weave-gs-02) (2015-04-22 10:18:33.650212936 +0000 UTC)
    76:f3:28:b8:df:2f -> 96:29:08:74:25:5a(weave-gs-01) (2015-04-22 10:18:41.457756818 +0000 UTC)
    9a:23:26:22:74:b8 -> 22:02:90:da:43:c7(weave-gs-02) (2015-04-22 10:18:03.258755761 +0000 UTC)
    22:02:90:da:43:c7 -> 22:02:90:da:43:c7(weave-gs-02) (2015-04-22 10:18:03.30600729 +0000 UTC)
    a2:5e:80:79:89:20 -> 22:02:90:da:43:c7(weave-gs-02) (2015-04-22 10:18:03.890434428 +0000 UTC)
    c2:83:69:27:f0:96 -> 22:02:90:da:43:c7(weave-gs-02) (2015-04-22 10:18:18.518841678 +0000 UTC)
    32:4e:b6:49:6d:5a -> 96:29:08:74:25:5a(weave-gs-01) (2015-04-22 10:18:24.817665796 +0000 UTC)
    Peers:
    22:02:90:da:43:c7(weave-gs-02) (v2) (UID 17259012827778123555)
       -> 96:29:08:74:25:5a(weave-gs-01) [172.17.8.101:6783]
    96:29:08:74:25:5a(weave-gs-01) (v2) (UID 16312797204840322867)
       -> 22:02:90:da:43:c7(weave-gs-02) [172.17.8.102:40786]
    Routes:
    unicast:
    22:02:90:da:43:c7 -> 00:00:00:00:00:00
    96:29:08:74:25:5a -> 96:29:08:74:25:5a
    broadcast:
    96:29:08:74:25:5a -> []
    22:02:90:da:43:c7 -> [96:29:08:74:25:5a]
    Reconnects:
    
    
    weave DNS 0.10.0
    Local domain weave.local.
    Listen address :53
    mDNS interface &{14 65535 ethwe c2:83:69:27:f0:96 up|broadcast|multicast}
    Fallback DNS config &{[10.0.2.3] [overplay] 53 1 5 2}
    Zone database:
    8c7d304a5130 10.3.1.2 user-ms.weave.local.

## Our Microservices Example With Seneca ##

The example you are using has three microservices all running in containers. To test that the 
various services are up and running point your browser to [http://localhost:8080](http://localhost:8080). 
You will be greated with a login screen. Login with the username and password u1/U1.

The example itself is a very simple demonstration of how to use the Seneca framework, discussion of which 
is out of scope for this guide. For more details see the [Seneca website](http://senecajs.org/). 

Seneca is written in Node.js, and the Dockerfiles used for building the containers in this guide are also 
included in our [github repo](https://github.com/weaveworks/guides/tree/master/microservices-seneca-ubuntu-simple). 

## Summary ##

You have now used Weave to quickly deploy a simple Node.js microservices application using Docker containers.

## Credits ##

The seneca example code is adapted from Richard Rodger's of [Nearform](http://nearform.com) [Seneca Microservices example](https://github.com/rjrodger/seneca-examples).
