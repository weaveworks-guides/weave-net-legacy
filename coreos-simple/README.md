---
layout: guides
title: Networking Docker Containers with Weave on CoreOS
description: How to use a Weave network on CoreOS to communicate with your containerized applications regardless of the host. 
tags: vagrant, coreOS, apache, dns, weave network, weave run
permalink: /guides/weave-docker-coreos-simple.html

shorttitle: Networking Docker Containers with Weave on CoreOS
sidebarpath: /start/wd/coreos
sidebarweight: 15
---

In this example you will use `Weave Net` to provide nework connectivity and service discovery using the [WeaveDNS service](/documentation/net-1.5-weavedns). 

1. You will create a simple containerized web service that runs in on weave-gs-01.
2. On weave-gs-02, we will deploy a second container that enables you to query the web service on weave-gs-01.
3. Run curl to query the _'Hello, Weave!'_ service from the second container.

![Weave and Docker](/images/Simple_Weave.png)

This tutorial uses simple UNIX tools, and it doesn't require any programming skills.

This example will take about 15 minutes to complete.


## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [CoreOS](http://coreos.com)

##Before You Begin

Install and configure the following separately before proceeding:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)


## A Note on CoreOS ##

CoreOS is a new breed of Linux distributions, which is primarily aimed at running container solutions such as 
[Docker](http://docker.com) and [Rocket](https://github.com/coreos/rocket). Emerging distributions in this space include [Snappy](https://developer.ubuntu.com/en/snappy/) from [Canonical](http://canonical.com), [Project Atomic](http://www.projectatomic.io/) from [Redhat](http://redhat.com) and others.

CoreOS is not a general purpose operating system, and may feel somewhat alien if you are more accustomed to 
one of the more established distributions. If you feel more comfortable with a general purpose operating system 
you may prefer to follow our getting started guides on [Ubuntu](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/README.md) or [CentOS](https://github.com/weaveworks/guides/blob/master/centos-simple/README.md).

## Setting Up The Hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

    git clone https://github.com/weaveworks/guides

You will use vagrant to setup and configure two CoreOS hosts and to install Weave. These hosts will be assigned IP addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named `weave-gs-01` and `weave-gs-02`.

    cd ./guides/coreos-simple
    vagrant up

Vagrant pulls down and configures a CoreOS image. This may take a few minutes depending on  the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated during the Vagrant setup, please just hit return at this point.

Once the setup of the hosts is complete you can check their status with

    vagrant status

The IP addresses we use for this demo are

    172.17.8.101 	weave-gs-01
    172.17.8.102 	weave-gs-02

## Installing Weave on CoreOS ##

When you run `vagrant up` the installation of weave is taken care of for you, but it is useful to understand
how this accomplished. CoreOS makes uses of of a "cloud-config" file to do various OS level configurations. You can 
read more about in the [CoreOS Using Cloud Config](https://coreos.com/docs/cluster-management/setup/cloudinit-cloud-config/)
document. 

To install Weave we use a feature of the CoreOS cloud config files called "units" to create a systemd unit which
installs weave. You can review the cloud-config file we used [here](https://github.com/weaveworks/guides/blob/master/coreos-simple/user-data). Systemd is outside the scope of this document, for more information please review [Getting Started With
systemd](https://coreos.com/docs/launching-containers/launching/getting-started-with-systemd/).     
 
##Launching Weave ##

Next you start Weave on each host in turn.

On host `weave-gs-01`

    sudo weave launch

On host `weave-gs-02`

    sudo weave launch 172.17.8.101

Your two hosts are now connected to each other, and any subsequent containers you launch with Weave will be visible to other containers Weave is aware of.

###What Just Happened?

As this is the first time you have launched Weave you

* downloaded a docker image for the Weave router container
* launched that container

On your first host, `weave-gs-01`, you have launched a Weave router container. On your second host, `weave-gs-02`, you launched another Weave router container with the IP address of your first host. This command tells the Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

At this point you have a single container running on each host, which you can see from docker. On either host run

    sudo docker ps

and you will see something similar to:

~~~bash
CONTAINER ID        IMAGE                         COMMAND                CREATED              STATUS              PORTS                                                                                        NAMES
c99b3df707b2        weaveworks/weaveexec:v1.1.0   "/home/weave/weavepr   About a minute ago   Up About a minute                                                                                                weaveproxy          
c546d3c88d70        weaveworks/weave:v1.1.0       "/home/weave/weaver    About a minute ago   Up About a minute   0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp, 10.1.42.1:53->53/tcp, 10.1.42.1:53->53/udp   weave               
~~~

You can see your peered network by using `weave status`

    weave router 0.10.0
    Encryption off
    Our name is da:e1:a3:11:7c:ca(weave-gs-02)
    Sniffing traffic on &{10 65535 ethwe 6a:4b:27:d8:7b:18 up|broadcast|multicast}
    MACs:
    6a:4b:27:d8:7b:18 -> da:e1:a3:11:7c:ca(weave-gs-02) (2015-04-21 17:12:45.822547728 +0000 UTC)
    da:e1:a3:11:7c:ca -> da:e1:a3:11:7c:ca(weave-gs-02) (2015-04-21 17:12:45.822675947 +0000 UTC)
    3a:b6:a1:d5:e7:34 -> da:e1:a3:11:7c:ca(weave-gs-02) (2015-04-21 17:12:45.874775196 +0000 UTC)
    Peers:
    62:03:57:2c:fd:5b(weave-gs-01) (v2) (UID 16942516529400376177)
       -> da:e1:a3:11:7c:ca(weave-gs-02) [172.17.8.102:47965]
    da:e1:a3:11:7c:ca(weave-gs-02) (v2) (UID 3714469127016325760)
       -> 62:03:57:2c:fd:5b(weave-gs-01) [172.17.8.101:6783]
    Routes:
    unicast:
    da:e1:a3:11:7c:ca -> 00:00:00:00:00:00
    62:03:57:2c:fd:5b -> 62:03:57:2c:fd:5b
    broadcast:
    da:e1:a3:11:7c:ca -> [62:03:57:2c:fd:5b]
    62:03:57:2c:fd:5b -> []
    Reconnects:

##Deploying the _'Hello, Weave!'_ Service

Next you will use Weave to run a Docker image containing an Apache webserver. The container you will use
in this example was built for our [Getting started with Weave and Docker on Ubuntu guide](), and is derived 
from an Ubuntu container.

On `weave-gs-01` run

    sudo weave run 10.0.1.1/24 -t -i weaveworks/weave-gs-simple-hw

At this point you have a running Apache server in a Docker container based on Ubuntu.

###About Container Deployment

Weave has launched a pre-built Docker container containing an Apache webserver, and assigned it an address of `10.0.1.1`. The Docker image you are using has been downloaded from the [Docker Hub](https://hub.docker.com/).

The container is registered with Weave and is accessible to other containers registered with Weave across multiple hosts.

##Deploying The Client Container

You now want to create a container on your second host and connect to the webserver in the container on our first host. 
We will use a container we created for our [Getting started with Weave and Docker on CentOS guide](). Containers return a container ID which you will capture to use further on in this example. On `weave-gs-02` run

    CONTAINER=`sudo weave run 10.0.1.2/24 -t -i weaveworks/weave-gs-centos-bash`

Now you attach to your docker container using the `CONTAINER` value we captured earlier, and run a curl command to connect to your hello world service.

    sudo docker attach $CONTAINER

    curl http://10.0.1.1

And you will see a JSON string similar too

    {
        "message" : "Hello World",
        "date" : "2015-02-27 17:30:51"
    }

Now you can exit from the container. As you have finished the command that the container was running (in this case `/bin/bash`) the container also exits.

## Conclusions ##

In this example, we deployed a simple application, that returns a message from a running Apache webserver. With Weave, you quickly deployed two containers to the network residing on different hosts. These containers were made discoverable using [WeaveDNS](/documentation/net-1.5-weavedns), so that applications within containers can communicate with one another. 

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).

##Further Reading

 * [How Weave Works](/documentation/net-1.5-router-topology)
 * [Weave Features](/documentation/net-1.5-features)
