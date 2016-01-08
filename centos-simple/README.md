---
layout: guides
title: Networking Docker Containers with Weave on CentOS
description: Use Weave on CentOS to communicate with your containerized applications regardless of the host. 
tags: vagrant, centos, apache, php, weave network, weave run
permalink: /guides/weave-docker-centos-simple.html

shorttitle: Networking Docker Containers with Weave on CentOS
sidebarpath: /start/wd/centos
sidebarweight: 15
---

In this example you will use `Weave Net` to provide nework connectivity and service discovery using the [`weavedns service`](http://docs.weave.works/weave/latest_release/weavedns.html). 

In this example:

1. You will create a simple containerized web service that runs on weave-gs-01.
2. On weave-gs-02, we will deploy a second container that enables you to query the web service on weave-gs-01.
3. Run curl to query the _'Hello, Weave!'_ service from the second container.

![Weave and Docker](/guides/images/Simple_Weave.png)

This tutorial uses simple UNIX tools, and it doesn't require any programming skills.

This example will take about 15 minutes to complete.


## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [CentOS](http://http://centos.org/)

##Before You Begin

Install and configure the following separately before proceeding:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

## Setting Up The Hosts

All of the code for this example is available on github. To begin, clone the getting started repository.

~~~bash
git clone https://github.com/weaveworks/guides
~~~

Vagrant is used to set up and configure the two CentOS hosts and to install Docker. The hosts will be assigned IP addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and will be named `weave-gs-01` and `weave-gs-02`.

~~~bash
cd ./guides/centos-simple
vagrant up
~~~

Vagrant pulls down and configures a CentOS image. This may take a few minutes depending on the speed of your network connection. For information about Vagrant refer to the [Vagrant Documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated during the Vagrant setup, just hit return at this point.

Once the hosts are set up, check their status using:

~~~bash
    vagrant status
~~~

The IP addresses we use for this demo are: 

~~~bash
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-02
~~~

## Installing Weave ##

Now you are ready to install Weave on to each host [using a separate terminal for each host](http://weave.works/guides/about/vagrant.html#general-usage-pattern).

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

We provide the commands to install Weave as part of this getting started guide, but in practice these steps would be automated.

## Launching Weave

Next start Weave on each host:

On host `weave-gs-01`

~~~bash
     weave launch
~~~

On host `weave-gs-02`

~~~bash
    weave launch 172.17.8.101
~~~

The two hosts are now connected to each other, and any subsequent containers launched on to the Weave network will be visible to any other containers that Weave is aware of.

### What Just Happened?

Since this is the first time launching Weave you have downloaded several docker images containing the Weave components: Weave Router, WeaveDNS, Weave Docker API Proxy and the Docker Network Plugin.

>Note: See [Weave Plugin](http://docs.weave.works/weave/latest_release/plugin.html) for information on configuring and setting this up. 

On the first host, `weave-gs-01`, you launched a Weave router container. On the second host, `weave-gs-02`, you launched another Weave router container using the IP address of your first host. This command tells the Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

At this point you have Weave containers running on each host, which you can see from docker by running the following from either host: 
~~~bash
    docker ps
~~~
where you will see something similar to the following:

~~~bash
5175974bf5ef        weaveworks/weaveexec:1.4.1   "/home/weave/weavepro"   19 seconds ago      Up 17 seconds                           weaveproxy
5abd69d62682        weaveworks/weave:1.4.1       "/home/weave/weaver -"   20 seconds ago      Up 18 seconds                           weave
~~~

Run `weave status` to view the peered hosts:

~~~bash
    $ weave status

 Version: 1.4.1

        Service: router
       Protocol: weave 1..2
           Name: e2:de:2e:93:9d:96(weave-gs-02)
     Encryption: disabled
  PeerDiscovery: enabled
        Targets: 1
    Connections: 1 (1 established)
          Peers: 2 (with 2 established connections)
 TrustedSubnets: none

        Service: ipam
         Status: idle
          Range: 10.32.0.0-10.47.255.255
  DefaultSubnet: 10.32.0.0/12

        Service: dns
         Domain: weave.local.
       Upstream: 10.0.2.3
            TTL: 1
        Entries: 0

        Service: proxy
        Address: unix:///var/run/weave/weave.sock
~~~

##Deploying the _'Hello, Weave!'_ Service

Next you will use Weave to run a Docker image containing an Apache webserver.  Details on how this container was created using docker are available [here](https://github.com/weaveworks/guides/blob/master/centos-simple/DockerfileREADME.md).

On `weave-gs-01` run

~~~bash
    weave run 10.0.1.1/24 -t -i weaveworks/weave-gs-centos-hw
~~~~

You should now have an Apache server running in a Docker container.

###About Container Deployment

Weave has launched a pre-built Docker container containing an Apache webserver, and assigned it an address of `10.0.1.1`. The Docker image you are using has been downloaded from the [Docker Hub](https://hub.docker.com/).

The container is registered with `WeaveDNS` and is accessible to other containers registered with Weave across multiple hosts.

##Deploying The Client Container

Next, create a container on your second host and connect to the webserver in the container on our first host. 

On `weave-gs-02` run:
~~~bash
    CONTAINER=`weave run 10.0.1.2/24 -t -i weaveworks/weave-gs-centos-bash`
~~~

Attach to the docker container using the `CONTAINER` value we captured earlier, and then run a curl command to connect to your hello world service.

~~~bash
    docker attach $CONTAINER
~~~

Press return 

~~~bash
    curl http://10.0.1.1
~~~

And you will see the following JSON message returned:

~~~bash
    {
        "message" : "Hello World",
        "date" : "2015-09-30 17:05:00"
    }
~~~

You can now exit from the container and since you finished the command in which the container was running (in this case `/bin/bash`), the container also exits.

##Cleaning Up The VMs

To remove the VMs you just created: 

~~~bash
Vagrant destroy
~~~

## Conclusions ##

In this example, we deployed a simple application, that returns a message from a running Apache webserver. With Weave, you quickly deployed two containers to the network residing on different hosts. These containers were made discoverable using `Weave Net` and its `weavedns` service, so that applications within containers can communicate with one another. 

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).

##Further Reading

 * [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
 * [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
 * [Weave Plugin](http://docs.weave.works/weave/latest_release/plugin.html)
 * [`weavedns service`](http://docs.weave.works/weave/latest_release/weavedns.html)
