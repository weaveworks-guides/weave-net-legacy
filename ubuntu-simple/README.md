---
layout: guides
title: Networking Docker Containers with Weave on Ubuntu
description: How to manage containers with a Weave network across hosts.
tags: vagrant, ubuntu, apache, php
permalink: /guides/weave-docker-ubuntu-simple.html

shorttitle: Networking Docker Containers with Weave on Ubuntu
sidebarpath: /start/wd/ubuntu
sidebarweight: 15

---


This example demonstrates how [WeaveDNS](/documentation/net-1.5-weavedns) automatically discovers services on a `Weave` container network.

In this example, you will:

1. Create a simple containerized web service that runs on weave-gs-01.
2. Deploy `curl` into a second container on `weave-gs-02`.
3. Use curl to query the _'Hello, Weave!'_ service from the second container on one host to another host.

![Weave and Docker on Ubuntu](/guides/images/Simple_Weave.png)

This tutorial uses simple UNIX tools, and it doesn't require any programming skills.

This example requires no programming skills and will take about 15 minutes to complete.

## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)

##Before You Begin

Install and configure the following separately before proceeding:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

##Setting Up The Hosts

The code for this example is available on github. Clone the getting started repository:

~~~bash
git clone https://github.com/weaveworks/guides
~~~

This example uses Vagrant to set up and configure two Ubuntu hosts and install Docker. These hosts are assigned IP addresses to a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and are named `weave-gs-01` and `weave-gs-02`.

~~~bash
cd ./guides/ubuntu-simple
vagrant up
~~~

Vagrant downloads and configures the Ubuntu images. This may take a few minutes depending on the speed of your network connection. For more information on how Vagrant works, refer to the [Vagrant documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated during the Vagrant setup. You can bypass this step by pressing return.

Once the hosts are set up, check their status:

~~~bash
vagrant status
~~~

The IP addresses we use for this demo are:

~~~bash
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-02
~~~

##Installing Weave

Install `Weave` on to each host [using a separate terminal for each host](http://weave.works/guides/about/vagrant.html#general-usage-pattern):

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
~~~

The commands to install `Weave` are provided as part of this getting started guide, but in practice you would automate this step for each host.

##Launching Weave

Now launch `Weave` on each host and create a peer connection by passing the IP of one host to another:

On host `weave-gs-01`

~~~bash
root@weave-gs-01:~# weave launch
~~~

On host `weave-gs-02`

~~~bash
root@weave-gs-02:~# weave launch 172.17.8.101 
~~~

Your two hosts are now connected to each other, and any subsequent containers you launch with `Weave` are visible to any other containers that the `Weave` network is aware of.

To view the running `Weave` components and their peers:

~~~bash
root@weave-gs-02:~# weave status

Version: v1.1.0

       Service: router
      Protocol: weave 1..2
          Name: de:df:fc:24:72:69(weave-gs-02)
    Encryption: disabled
 PeerDiscovery: enabled
       Targets: 1
   Connections: 1 (1 established)
         Peers: 2 (with 2 established connections between them)

       Service: ipam
     Consensus: deferred
         Range: 10.32.0.0-10.47.255.255
 DefaultSubnet: 10.32.0.0/12

       Service: dns
        Domain: weave.local.
           TTL: 1
       Entries: 0

       Service: proxy
       Address: unix:///var/run/weave.sock
~~~


### What Just Happened?


At this point several `Weave` containers are running on each host. To see them, run the following command from either host:

~~~bash
root@weave-gs-01:~# docker ps
~~~

where you should see something similar to the following:

~~~bash
CONTAINER ID        IMAGE                         COMMAND                CREATED             STATUS              PORTS  
3f09ad57ee8e        weaveworks/weaveexec:v1.1.0   "/home/weave/weavepr   3 minutes ago       Up 3 minutes                                                                                                     weaveproxy          
78476d7404c5        weaveworks/weave:v1.1.0       "/home/weave/weaver    3 minutes ago       Up 3 minutes        10.1.42.1:53->53/tcp, 10.1.42.1:53->53/udp, 0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave      
~~~

Your network is also peered, and can be viewed by running:  `weave status`

## Building & Deploying the _'Hello, Weave!'_ Service

Next, build an Apache webserver container image and use `Weave` to run it.

On `weave-gs-01` run

~~~bash
root@weave-gs-01:~# docker build -t php-example /vagrant
root@weave-gs-01:~# eval "$(weave env)"
root@weave-gs-01:~# docker run -d --name=hello-app php-example
~~~

You now have a running Apache server in a Docker container. `Weave` records a DNS record and also automatically gives it the name `hello-app`.

To view it:

~~~bash
root@weave-gs-01:~# docker ps
~~~

###About Container Deployment

`Weave` launched a pre-built Docker image containing an Apache webserver, named it `hello-app`, and then assigned it an IP address. The Docker image is downloaded from the [Docker Hub](https://hub.docker.com/).

The container is registered with `Weave` and is accessible to other containers registered with `Weave` across multiple hosts.

## Creating the Client Container

Next deploy a container to `weave-gs-02` and make it available to the `hello-app` webserver, running on the first host.  A docker container at `weaveworks/guide-tools` is launched to illustrate this.

On `weave-gs-02` run:

~~~bash
root@weave-gs-02:~# eval "$(weave env)"
root@weave-gs-02:~# docker run weaveworks/guide-tools curl -s http://hello-app
~~~

JSON returns:

~~~bash
{
"message" : "Hello World",
    "date" : "2015-09-30 17:05:00"
}
~~~

##Cleaning Up The VMs

To remove the VMs you just created: 

~~~bash
vagrant destroy
~~~

##Conclusions

In this example, we deployed a simple application, that returns a message from a running Apache webserver. With `Weave`, you quickly deployed two containers to the network residing on different hosts. These containers were made discoverable using `weavedns`, so that applications within containers can communicate with one another. 

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).


## Further Reading

 * [How Weave Works](/documentation/net-1.5-router-topology)
 * [Weave Features](/documentation/net-1.5-features)
