---
layout: guides
title: Load Balancing With Weave Run
tags: vagrant, ubuntu, load balancing, REST, round robin DNS
permalink: /guides/weave-docker-loadbalancing-simple.html

shorttitle: Load Balancing with Weave Run
sidebarpath: /start/load/run
sidebarweight: 18
---


In this example, we demonstrate how you can use {{Weave Net}} and {{Weave Run}} to load balance an application without doing any modifications to the application's code. We will deploy a simple go-based REST server that listens for and then outputs the IP address of each container on the weave network. In addition to this, we show how Weave implements load balancing using [round robin DNS](https://en.wikipedia.org/wiki/Round-robin_DNS).

Specifically, you will:

1. Deploy six containers with a go-based [REST](http://rest.elkstein.org/) webservice.
2. Return the IP address of each container from the webservice using `curl`.
3. Load balance six containers across two hosts on a weave network.

This example uses very simple UNIX tools, and doesn’t require any programming skills.

This tutorial will take approximately 10 minutes to complete.

![Simple Loadbalancing with Weave](/guides/images/Weave_LoadBalance.png)

## What You Will Use ##

You will work with Weave and Docker on Ubuntu. This guide uses Vagrant and Virtualbox, and can be run on your personal system.

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)
* [Git](http://git-scm.com/downloads)

## Before You Begin ##

Please ensure the following are installed before you begin this exercise. 

* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)


## Setting Up & Configuring the Hosts ##

The code used in this example is available on [github](https://github.com/weaveworks/guides).

Clone the getting started repository:

    git clone https://github.com/weaveworks/guides

A Vagrant script (`Vagrantfile`) automates the provisioning of the hosts. It downloads and configures two Ubuntu hosts, then it pulls the docker images and installs those onto the hosts. Finally, the latest version of Weave is downloaded and also installed. More information about Vagrant can be found in the [Vagrant documentation](http://vagrantup.com).

>>For an example of a manual Weave setup, refer to the guide, [Using Weave & Docker on Ubuntu](http://weave.works/guides/weave-docker-ubuntu-simple.html).

Change to the weave-loadbalance subdirectory and run vagrant: 

~~~bash
    cd guides/weave-loadbalance
    vagrant up
~~~

Wait for Vagrant to pull and configure the Ubuntu image.  Depending on the speed of your network connection, this may take a few minutes.  If you are thinking about a cup of coffee, now may be a good point to get one.

Check that the VMs are running:

~~~bash
    vagrant status
~~~

The IP addresses we use for this demo are

~~~bash
    172.17.8.101    weave-gs-01
    172.17.8.102    weave-gs-02
~~~

### Launching The Weave Network ##

Next, launch Weave on both hosts using the `--ipalloc-range` option. This option enables Weave to allocate addresses on a particular subnet. 

~~~bash
    vagrant ssh weave-gs-01
    weave launch --ipalloc-range 10.2.0.1/16

    vagrant ssh weave-gs-02
    weave launch --ipalloc-range 10.2.0.1/16 172.17.8.101
~~~

The weave network with all three components are launched on to both hosts.
If you don't want to manually ssh on to each host, you can automate this process by running `setup-weave.sh`.

#### About Weavedns and Automatic IP Management

The `weavedns` service answers name queries on a Weave container network and provides a simple way for containers to find each other: just give them hostnames and then tell any other containers to connect to those names. Unlike Docker ‘links’, `weavedns` requires no code changes and it also works across hosts. 

See [Automatic Discovery with Weavedns](http://docs.weave.works/weave/latest_release/weavedns.html) for information about how the `weavedns` service works

[Weave Automatic IP Address Management (IPAM)](http://docs.weave.works/weave/latest_release/ipam.html) automatically assigns any new containers a unique IP address across the network. With Weave IPAM you can easily add more containers to your network, without having to worry about manually assigning each a unique IP.

####Checking the Weave Network

At this point, the Weave network connected the two hosts as peers. Also `weavedns` and Weave IPAM,  both of which were launched with the weave router are standing by to discover and assign IPs to any running containers on the network.

Log on to either one of the hosts and type `weave status` to view the Weave components:  


~~~bash
       Version: v1.1.0

       Service: router
      Protocol: weave 1..2
          Name: 8e:27:80:b1:19:85(weave-gs-01)
    Encryption: disabled
 PeerDiscovery: enabled
       Targets: 0
   Connections: 1 (1 established)
         Peers: 2 (with 2 established connections between them)

       Service: ipam
     Consensus: deferred
         Range: 10.2.0.0-10.2.255.255
 DefaultSubnet: 10.2.0.0/16

       Service: dns
        Domain: weave.local.
           TTL: 1
       Entries: 0

       Service: proxy
       Address: unix:///var/run/weave.sock
~~~

## Launching The Containers

Now you are ready to launch a containerized simple REST webservice. The REST server listens for the IP addresses of any other containers on the Weave network. 

With both WeaveDNS and Weave IPAM enabled, only the name of the container along with the hostname that you want to use is needed. In this instance, the same hostname is used for each container. 

Weave IPAM assigns each container a unique IP, WeaveDNS then detects them, and adds an entry for each: 

>>Ensure that you've run `eval "$(weave env)"` to configure Weave's environment before launching and running any of your containers. 

~~~bash
    vagrant ssh weave-gs-01
    eval "$(weave env)"
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch

    vagrant ssh weave-gs-02
    eval "$(weave env)"
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
~~~

You can also use this script `launch-demo-containers.sh` to launch all six containers.

To check the status of your containers, run `docker ps`  Also, you may want to run `weave status dns` to ensure that the containers have been discovered by `weavedns`.

## What Just Happened

At this point six containers with the REST service have been launched on the hosts. The containers have
been allocated IP addresses and appear to other applications as a single endpoint. 

## Connecting to Your Application

Next run a container with `curl` to query the myip service: 

~~~bash
    vagrant ssh weave-gs-01
    eval $(weave env)
    CONTAINER=$(docker run -d -ti -h ubuntu.weave.local weaveworks/weave-gs-ubuntu-curl)
    docker exec -ti $CONTAINER "/bin/bash"
~~~

From the interactive container, connect to the endpoint, and then make a request to the myip service.


~~~bash
    for i in `seq 1 20`; do curl loadbalance.weave.local/myip; done
~~~


This will produce the following output:

~~~bash
    root@ubuntu:/# for i in `seq 1 20`; do curl lb.weave.local/myip; done
    10.2.128.2
    fe80::9421:2bff:fec1:6d09
    
    10.2.128.2
    fe80::9421:2bff:fec1:6d09
    
    10.2.0.4
    fe80::4838:e2ff:fef1:246f
    
    10.2.128.3
    fe80::f0b0:1eff:fe57:f322
    
    10.2.128.3
    fe80::f0b0:1eff:fe57:f322
    
    10.2.0.2
    fe80::3c60:1fff:feee:644a
    ....
~~~

Notice that requests are balanced equally among all 6 containers running across the hosts (`10.2.0.x` are from `weave-gs-01`, and `10.2.128.x` are from `weave-gs-02`).

##Cleanup

To remove the hosts from your machine:

~~~bash
Vagrant destroy weave-gs-01

Vagrant destroy weave-gs-02
~~~


##Summary

You have used Weave and Docker to deploy a simple load balanced application.

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).

###Find Out More

* [Automatic Discovery with weavedns](https://github.com/weaveworks/weave/blob/master/site/weavedns.md)
* [Weave - Weaving Containers into Applications](https://github.com/weaveworks/weave)
* [Documentation Home Page](http://docs.weave.works/weave/latest_release/)
