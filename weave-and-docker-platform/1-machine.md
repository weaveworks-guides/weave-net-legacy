---
layout: guides
title: "Part 1: Launching Weave Net with Docker Machine"
permalink: /guides/weave-and-docker-platform/weavenetwork.html
description: Launching a weave network to manage your distributed containerized applications
tags: weave network, docker, docker machine, cli, virtualbox, dns, ipam

shorttitle: "Part 1 of 3: Launching Weave Net With Docker Machine"
sidebarpath: /start/dist/weavedocmach
sidebarweight: 15
---

{% include product-vars %}


> - **Part 1: Launching Weave Net with Docker Machine**
> - Part 2: [Using Weave with Docker Machine and Swarm][ch2]
> - Part 3: [Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave][ch3]

## What You Will Build


 In this Part 1 of _'Launching Weave Net with Docker Machine'_ you will be introduced to the basics of launching a container network with Weave.

[Docker Machine](https://docs.docker.com/machine/) makes it simple to create Docker hosts (VMs) on your computer, on cloud providers or within your own data center. It creates servers, installs Docker on them, and then it configures the Docker client to talk to them.

In Part 1 of this tutorial, you will:

  1. Install Docker Machine and Weave
  2. Launch Weave on to a single VM on VirtualBox
  3. Deploy a basic _"Hello, Weave!"_ application
  4. Enable {{ weavedns }} to discover the Weave-attached Docker containers on the network
  5. Communicate with your app and send a message from one container to another using shell commands

This example uses very simple UNIX tools, and doesn't require any programming skills.

This will take about 10 minutes to complete.

## What You Will Use

  - [Weave](http://weave.works)
  - [Docker & Docker Machine](https://docs.docker.com)

## What You Need to Complete Part 1

If you are using OS X or Windows, you can install [Docker Toolbox](https://www.docker.com/toolbox), which provides all of the tools you need to complete this guide.

For other operating systems, please install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

## Installing Weave

First get the latest version of `weave`and clone the guides directory. If you do not have ownership of the `/usr/local/bin` directory, you may need to preface these commands with `sudo`:

~~~bash
curl -L git.io/weave -o /usr/local/bin/weave
chmod a+x /usr/local/bin/weave
~~~

Next create a Virtual Machine (VM) on the VirtualBox, called `weave-1`, by running:

~~~bash
docker-machine create -d virtualbox weave-1
~~~

With the VM running, configure your shell environment by typing:

~~~bash
eval "$(docker-machine env weave-1)"
~~~

and then, verify that everything installed correctly:

~~~bash
docker info
~~~

Now you are ready to launch the Weave network:


~~~bash
weave launch
~~~

Next set up the weave environment for the Docker API proxy:

~~~bash
eval "$(weave env)"
~~~

Check to see that all components of the Weave network are running:

~~~bash
weave status

Version: v1.2

       Service: router
      Protocol: weave 1..2
          Name: 02:44:da:ef:69:dd(weave-1)
    Encryption: disabled
 PeerDiscovery: enabled
       Targets: 0
   Connections: 0
         Peers: 1

       Service: ipam
     Consensus: deferred
         Range: [10.32.0.0-10.48.0.0)
 DefaultSubnet: 10.32.0.0/12

       Service: dns
        Domain: weave.local.
           TTL: 1
       Entries: 0

       Service: proxy
       Address: tcp://192.168.99.100:12375
~~~

Running `weave launch` automatically configures your network, and it starts the weave router, which launches the {{ weavedns }} service. `weave launch` also sets up a Docker API proxy on the weave network, so that you can manage your containers using standard Docker commands from your local machine.

>Note: Both {{ weavedns }} and {{ weaveproxy }} services can also be started independently, if required, see `weave --help` for more information.

See the [Weave Docker API Proxy documentation](https://github.com/weaveworks/weave/blob/master/site/proxy.md) for more information about the `Weave Docker API`.

Now you are ready to deploy containers and also use DNS so that the containers can discover each other.

### Deploy Two Containers to the Weave Network

The first app to be deployed is called `pingme`. It consists of a simple netcat (aka `nc`) server running on TCP port 4000, which sends a short message, `Hello, Weave!` to any client that connects to it.

~~~bash
docker run -d --name=pingme \
        gliderlabs/alpine nc -p 4000 -ll -e echo 'Hello, Weave!'
~~~

The second containerized app is called `pinger`, and it will be launched in interactive mode using the `-ti` flag, so that the container can accept and run few simple commands.

~~~bash
docker run -e 'affinity:container!=pingme' --name=pinger -ti \
        gliderlabs/alpine sh -l
~~~

Ping one of the containers:

~~~bash
pinger:/# ping -c3 pingme.weave.local
~~~

~~~bash
PING pingme.weave.local (10.128.0.1): 56 data bytes
64 bytes from 10.128.0.1: seq=0 ttl=64 time=0.100 ms
64 bytes from 10.128.0.1: seq=1 ttl=64 time=0.114 ms
64 bytes from 10.128.0.1: seq=2 ttl=64 time=0.111 ms

--- pingme.weave.local ping statistics ---
3 packets transmitted, 3 packets received, 0% packet loss
round-trip min/avg/max = 0.100/0.108/0.114 ms
~~~

Test if pinger responds on TCP port 4000 as expected:

~~~bash
pinger:/# echo "What's up?" | nc pingme.weave.local 4000
~~~

Returns,

~~~bash
Hello, Weave!
~~~

Type 'exit' to exit the `pinger` container.

## Cleanup

This completes Part 1 of this tutorial. If you are not going on to Part 2, then you may want to remove the containers and the VM used in this example:

~~~bash
> docker rm -f pingme pinger
> docker-machine rm -f weave-1
~~~

##Conclusions

This tutorial demonstrated how to launch a Weave network using Docker Machine. A simple  _"Hello, Weave!"_ service was deployed to a container that listens on TCP port 4000 for any connections from other containers.

You should now be familiar with the commands you need to use in order to create Virtual Machines and also those used to create and start containers on them through the Docker API {{ weaveproxy }}.

Proceed to Part 2, where we will set up multiple Virtual Machines, using Docker Swarm to schedule containers, use [Weave Net](/net) to provide transparent connectivity across multiple Docker hosts and use [Weave Run](/run) to enable service discovery via DNS.

You can easily adapt these examples and use them as templates in your own implementation.  We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).

## Further Reading

  *  [Learn more about Weave](http://weave.works/articles/index.html)
  *  [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
  *  [Docker API](https://github.com/weaveworks/weave/blob/master/site/proxy.md)
  *  [TLS Settings](https://docs.docker.com/articles/https/)

[ch1]: /guides/weave-and-docker-platform/weavenetwork.html
[ch2]: /guides/weave-and-docker-platform/using-weave-with-machine-and-swarm.html
[ch3]: /guides/weave-and-docker-platform/compose-scalable-swarm-cluster-with-weave.html
