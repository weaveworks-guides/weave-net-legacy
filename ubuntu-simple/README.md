---
layout: guides
title: Getting started with Weave and Docker on Ubuntu
description: How to manage containers with a Weave network across hosts.  
keywords: weave, docker, containers, networking, software defined networking, dockerfile, ubuntu, apache, php
permalink: /guides/weave-docker-ubuntu-simple.html
---

## What You Will Build ##

Weave provides a software network optimized for visualizing and communicating with applications distributed within Docker containers. Using tools and protocols that are familiar to you, Weave's network topology lets you to communicate between containerized apps distributed across multiple networks or hosts more quickly and efficiently.

With Weave you focus on developing your application, rather than your infrastructure.  As demonstrated in this tutorial, Weave works seamlessly with other tools such as Vagrant.  Vagrant provides an easy way to provision, and set up your hosts. Once provisioned this example, will deploy both {{ Weave Net }} and {{ Weave Run }} to provide nework connectivity and service discovery using DNS. 

Specifically, in this example:

1. You will create a simple application running in two containers on separate hosts. 
2. Provide a JSON message and a date, to the '_hello world service_'. 
3. Use curl to query the hello world service from the second container.

![Weave and Docker](/guides/images/Simple_Weave.png)

This tutorial uses simple UNIX tools, and it doesn't require any programming skills. 

This example will take about 15 minutes to complete.

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)

## What You Need to Complete This Guide ##

You will need to install and configure the following separately before proceeding:

* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

##Let's Go! ##

The code for this example is available on github. Clone the getting started repository:

~~~bash
git clone http://github.com/weaveworks/guides
~~~

You will use vagrant to setup and configure two Ubuntu hosts and install Docker. These hosts will be assigned IP addresses to a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named `weave-gs-01` and `weave-gs-02`.

~~~bash
cd guides/ubuntu-simple
vagrant up
~~~

Vagrant pulls down and configures the ubuntu images. This may take a few minutes depending on the speed of your network connection. For more information on how Vagrant works, please refer to the [Vagrant documentation](http://vagrantup.com).

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

## Installing Weave ##

Now install Weave on each host:

~~~bash
vagrant ssh weave-gs-01
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod a+x /usr/local/bin/weave
~~~

~~~bash
vagrant ssh weave-gs-02
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod a+x /usr/local/bin/weave
~~~~

We provide the commands to install Weave as part of this getting started guide, but in practice you could automate this step for each host.

## Using Weave ##

Next start Weave on each host and create a peer connection:

On host `weave-gs-01`

~~~bash
sudo weave launch
sudo weave launch-dns
~~~

On host `weave-gs-02`

~~~bash
sudo weave launch 172.17.8.101
sudo weave launch-dns
~~~

Your two hosts are now connected to each other, and any subsequent containers you launch with Weave will be visible to any other containers that the Weave network is aware of.

### What Just Happened? ###

Since this is the first time launching Weave you: 

* downloaded a docker image for the Weave router container and then launched that container
* downloaded a docker image for `weavedns` and then launched that container

On host, `weave-gs-01`, the Weave router container was launched. On host, `weave-gs-02`, an additional Weave router container with the IP address of your first host was launched. Launching Weave with the IP address of the first container, informs Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

In addition to these two weavedns service discovery containers were also launched. 

At this point you should have two Weave containers running on each host. 

To see them, run the following command from either host:

~~~bash
sudo docker ps
~~~

where you should see something similar to the following:

~~~bash
    CONTAINER ID        IMAGE                       COMMAND                CREATED             STATUS              PORTS                                            NAMES
    e3fba94a35fc        weaveworks/weavedns:1.0.2   "/home/weave/weavedn   57 seconds ago      Up 56 seconds       10.1.42.1:53->53/udp                             weavedns
    dd3878af6307        weaveworks/weave:1.0.2      "/home/weave/weaver    16 minutes ago      Up 16 minutes       0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave
~~~

View the peered network by running `weave status`

~~~bash
sudo weave status

weave router 1.0.2
Our name is 72:24:c2:00:01:5a(weave-gs-02)
Encryption off
Peer discovery on
Sniffing traffic on &{10 65535 ethwe ee:08:d8:0e:ec:cb up|broadcast|multicast}
MACs:
6a:0d:0a:55:3f:a1 -> 72:24:c2:00:01:5a(weave-gs-02) (2015-08-21 20:09:26.761668678 +0000 UTC)
8a:2b:ec:2a:b7:0f -> a6:e9:63:3e:d2:dd(weave-gs-01) (2015-08-21 20:07:45.075079927 +0000 UTC)
f2:86:dc:cc:9a:43 -> 72:24:c2:00:01:5a(weave-gs-02) (2015-08-21 20:09:06.151707913 +0000 UTC)
Peers:
a6:e9:63:3e:d2:dd(weave-gs-01) (v2) (UID 13063150984085781788)
   -> 72:24:c2:00:01:5a(weave-gs-02) [172.17.8.102:51443]
72:24:c2:00:01:5a(weave-gs-02) (v2) (UID 10318206013728323935)
   -> a6:e9:63:3e:d2:dd(weave-gs-01) [172.17.8.101:6783]
Routes:
unicast:
72:24:c2:00:01:5a -> 00:00:00:00:00:00
a6:e9:63:3e:d2:dd -> a6:e9:63:3e:d2:dd
broadcast:
a6:e9:63:3e:d2:dd -> []
72:24:c2:00:01:5a -> [a6:e9:63:3e:d2:dd]
Direct Peers: 172.17.8.101
Reconnects:

Allocator range [10.128.0.0-10.192.0.0)
Owned Ranges:
  10.128.0.0 -> 72:24:c2:00:01:5a (weave-gs-02) (v5)
  10.160.0.0 -> a6:e9:63:3e:d2:dd (weave-gs-01) (v2)
Allocator default subnet: 10.128.0.0/10

weave DNS 1.0.2
Listen address :53
Fallback DNS config &{[10.0.2.3] [] 53 1 5 2}

Local domain weave.local.
Interface &{14 65535 ethwe 6a:0d:0a:55:3f:a1 up|broadcast|multicast}
Zone database:

~~~

## Deploying the Hello World Service ##

Next, use Weave to run a Docker image containing an Apache webserver.  Details on how this container was created using docker are available [here](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/DockerfileREADME.md).

On `weave-gs-01` run

~~~bash
sudo docker run --name=web1 -t -i fintanr/weave-gs-simple-hw
~~~

You now have a running Apache server in a Docker container. To view it: 

~~~bash
sudo docker ps
~~~

### What Just Happened?

Weave launched a pre-built Docker image containing an Apache webserver, named it "web1", and assigned it an IP address. The Docker image you are using has been downloaded from the [Docker Hub](https://hub.docker.com/).

The container is registered with Weave and is accessible to other containers registered with Weave across multiple hosts.

### Creating our client container

Next you want to create a container on your second host and connect to the webserver in the container on our first host. We will use another prebuilt container, `fintanr/weave-gs-ubuntu-curl` for this example. 

Containers return a container ID which you will capture to use further on in this example. 

On `weave-gs-02` run:

~~~bash
sudo docker run -t -i fintanr/weave-gs-ubuntu-curl`
~~~

The Ubuntu Docker image you are using here is the same image that we based our Apache Docker image on,
with the addition of curl:

~~~bash
curl http://web1
~~~

And you will see the JSON string return the following:

~~~bash
{
  "message" : "Hello World",
  "date" : "2015-02-16 15:02:57"
}
~~~

Exit from the container by typing `exit`. And since you finished the command in which the container was running (in this case `/bin/bash`), the container also exits.

## Summary ##

In this example, we deployed a simple application, that returns a message from a running Apache Server. With Weave, you quickly deployed two containers to the network residing on different hosts. These containers were made discoverable using {{ Weave Run }}, so that applications are able to communicate with one another. 

## Further Reading

 * [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
 * [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
