---
layout: guides
title: Using Weave Net for Load Balancing 
tags: vagrant, ubuntu, load balancing, REST, round robin DNS
permalink: /guides/weave-docker-loadbalancing-simple.html

---

In this example, you will use `Weave Net` to load balance your app. Weave Net implements load balancing using [round robin DNS](https://en.wikipedia.org/wiki/Round-robin_DNS) and can be run without making any modifications to the application's code. 

You will deploy a simple go-based REST server that listens for and then outputs the IP address of each container deployed to the Weave network. 

You will:

1. Deploy six containers with a go-based [REST](http://rest.elkstein.org/) webservice.
2. Return the IP address of each container from the webservice using `curl`.
3. Load balance six containers across two hosts on a Weave network.

![Simple Loadbalancing with Weave](/guides/images/Weave_LoadBalance.png)

## What You Will Use ##

You will work with Weave and Docker on Ubuntu, and it uses Vagrant and Virtualbox, which can be run on your personal system.

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)
* [Git](http://git-scm.com/downloads)

## Before You Begin ##

Ensure that the following are installed before you begin: 

* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)


## Setting Up & Configuring the Hosts ##

The code used in this example is available on [github](https://github.com/weaveworks/guides).

Clone the guides repository:

    git clone https://github.com/weaveworks/guides

A Vagrant script (`Vagrantfile`) automates the provisioning of the hosts. It downloads and configures two Ubuntu hosts, pulls the Docker images and then installs them onto the hosts. Finally, the latest version of Weave Net is downloaded and installed. For more information about Vagrant see the [Vagrant documentation](http://vagrantup.com).

>**Note:** For instructions on how to manually set up Weave Net, refer to the guide, [Networking Docker Containers with Weave on Ubuntu](https://www.weave.works/guides/networking-docker-containers-with-weave-on-ubuntu/).

Change to the weave-loadbalance subdirectory and run vagrant: 

~~~bash
    cd guides/weave-loadbalance
    vagrant up
~~~

Wait for Vagrant to pull and configure the Ubuntu image.  Depending on the speed of your network connection, this may take a few minutes.  

Check that the VMs are running:

~~~bash
    vagrant status
~~~

The IP addresses used in this demo are:

~~~bash
    172.17.8.101    weave-gs-01
    172.17.8.102    weave-gs-02
~~~

### Launching Weave Net ##

Next, launch Weave Net onto both hosts and pass the `--ipalloc-range` option. This command option allocates Weave Net to a particular subnet. 

~~~bash
    vagrant ssh weave-gs-01
    weave launch --ipalloc-range 10.2.0.1/16

    vagrant ssh weave-gs-02
    weave launch --ipalloc-range 10.2.0.1/16 172.17.8.101
~~~

Weave Net should be deployed to the hosts using the address range that were explicitly assigned to the host with the `--ipalloc-range`.

The `setup-weave.sh` script automates this process for you as well.

#### About weavedns and Automatic IP Management

`weavedns` answers name queries on a Weave network and also provides a simple way for containers to find each other. Just assign the containers hostnames and then tell any other containers to connect to another one using those names. 

Unlike Docker ‘ambassador links’, `weavedns` requires no code changes and it also works across hosts. 

See [Discovering Containers with WeaveDNS](/documentation/net-1.5-weavedns) for information about how the weavedns service works.

[Weave Automatic IP Address Management (IPAM)](/documentation/net-1.5-ipam) automatically assigns any new containers a unique IP address across the network. With Weave IPAM you can add more containers to the network without having to worry about manually assigning each a unique IP.

####Checking the Weave Network

The two hosts should now be peered with one another on the Weave network. Weavedns and Weave IPAM are also standing by to discover and assign IPs to any running containers on the network.

Log on to either one of the hosts and type `weave status` to view the Weave Net components:  


~~~bash
       Version: 1.4.5

        Service: router
       Protocol: weave 1..2
           Name: 8e:6a:36:12:ad:d9(weave-gs-02)
     Encryption: disabled
  PeerDiscovery: enabled
        Targets: 1
    Connections: 1 (1 established)
          Peers: 2 (with 2 established connections)
 TrustedSubnets: none

        Service: ipam
         Status: ready
          Range: 10.2.0.0-10.2.255.255
  DefaultSubnet: 10.2.0.0/16

        Service: dns
         Domain: weave.local.
       Upstream: 10.0.2.3
            TTL: 1
        Entries: 7

        Service: proxy
        Address: unix:///var/run/weave/weave.sock

        Service: plugin
     DriverName: weave

~~~

## Launching Containers

Next, you will launch a simple containerized REST webservice. This REST server will listen for the IP addresses of any other containers on the Weave network. 

With both weavedns and Automatic IP Address Management (IPAM) enabled, only the name of the container along with the hostname that you want to use is required. In this instance, the same hostname is used for each container, but you could also use different hostnames. 

IPAM assigns each container a unique IP, and weavedns detects them, and adds an entry to the DNS registry: 

>**Note:** Ensure that you run `eval $(weave env)` to configure Weave Net's environment before you launch containers. 

~~~bash
    vagrant ssh weave-gs-01
    eval $(weave env)
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch

    vagrant ssh weave-gs-02
    eval $(weave env)
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
    docker run -d -h loadbalance.weave.local weaveworks/myip-scratch
~~~

You can also use this script `launch-demo-containers.sh` to launch all six containers.

To check the status of your containers, run `docker ps`  Also, you may want to run `weave status dns` to ensure that the containers have been discovered by weavedns.

## What Just Happened?

At this point, six REST service containers have been launched on the hosts. The containers have been allocated IP addresses and they appear to other applications as a single endpoint. 

## Connecting to Your Application

Run a container with `curl` to query the myip service: 

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


This produces the following output:

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

Notice that requests are balanced equally among all six containers running across the hosts (`10.2.0.x` are from `weave-gs-01`, and `10.2.128.x` are from `weave-gs-02`).

##Cleanup

To remove the hosts from your machine:

~~~bash
Vagrant destroy weave-gs-01

Vagrant destroy weave-gs-02
~~~


##Summary

You have used Weave Net and Docker to deploy a simple load balanced application.

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](https://www.weave.works/help/).

###Find Out More

* [Automatic Discovery with weavedns](https://github.com/weaveworks/weave/blob/master/site/weavedns.md)
* [Weave - Weaving Containers into Applications](https://github.com/weaveworks/weave)
* [Documentation Home Page](/docs)
