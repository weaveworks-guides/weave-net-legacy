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

In this Part 1  "Launching Weave Net with Docker Machine" the basics of launching a container network with Weave Net is introduced. In [Part 2 "Using Weave With Docker Machine and Swarm](/part-2-using-weave-with-docker-machine-and-swarm/), you will learn how to configure a basic [Docker Swarm Cluster](https://docs.docker.com/swarm/) and use Weave Net to discover containers within it. In [Part 3 "Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave"](/part-3-creating-and-scaling-multi-host-docker-deployment-with-swarm-and-compose-using-weave/), you will take what you learned in Parts 1 and 2 and use [Docker Compose](https://docs.docker.com/compose/) and Weave Net to launch a two-tier application spread across three VMs. 

[Docker Machine](https://docs.docker.com/machine/) makes it simple to create Docker hosts (VMs) on your computer, on cloud providers or within your own data center. It creates servers, installs Docker on them, and then it configures the Docker client to talk to them.

Weave Net simplifies networking Docker containers across hosts by automatically allocating unique IP addresses to containers. It also allows you to find the IP of any container through either a DNS query or by using its name and it does this without requiring an external database (cluster store).

In Part 1 of this tutorial, you will:

  1. Install Docker Machine and Weave Net
  2. Launch Weave Net on to a single VM on VirtualBox
  3. Deploy a basic _"Hello, Weave!"_ application
  4. Use Weave's built-in "microDNS" server to discover the Weave-attached Docker containers on the network
  5. Communicate with your app and send a message from one container to another using shell commands

This example uses very simple UNIX tools, doesn't require any programming skills and takes about 10 minutes to complete.

## What You Will Use

  - [Weave Net](http://weave.works)
  - [Docker & Docker Machine](https://docs.docker.com)

## Before You Begin

If you are using OS X or Windows, install [Docker Toolbox](https://www.docker.com/toolbox), which provides all of the tools you need to complete this guide.

For other operating systems, install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at least the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

## Installing Weave Net

Download the latest version of `weave`and then clone the guides directory. If you do not have ownership of the `/usr/local/bin` directory, you may need to preface the commands with `sudo`:

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

and then, verify that everything is installed correctly:

~~~bash
docker info
~~~

Now you are ready to launch the Weave network:

~~~bash
weave launch
~~~

Next set up your environment to use Weave's Docker API Proxy. The Docker API Proxy allows you to use standard Docker commands, and enables you to attach containers to the Weave network and assigns IP addresses to them. An alternative way to attach containers to the Weave network is by using the Docker Plugin (for Docker >= 1.9). In this tutorial, you will be using the Weave Docker API Proxy to attach containers.

To set up the environment for the Weave Docker API Proxy:

~~~bash
eval "$(weave env)"
~~~

Type `weave status` to check that Weave Net is running:

~~~bash

        Version: 1.6.0 (up to date; next check at ......)

        Service: router
       Protocol: weave 1..2
           Name: 8a:a9:91:a6:1f:e9(weave-1)
     Encryption: disabled
  PeerDiscovery: enabled
        Targets: 0
    Connections: 0
          Peers: 1
 TrustedSubnets: none

        Service: ipam
         Status: ready
          Range: 10.32.0.0/12
  DefaultSubnet: 10.32.0.0/12

        Service: dns
         Domain: weave.local.
       Upstream: 200.52.173.109, 200.52.196.246
            TTL: 1
        Entries: 0

        Service: proxy
        Address: tcp://192.168.99.100:12375

        Service: plugin
     DriverName: weave


~~~

Running `weave launch` automatically configures your network, starts the weave router, `weavedns`, and also launches the Docker API proxy and the Weave Docker Plugin. 

>**Note:** If necessary, you can start and stop Weave components independently, see `weave --help` for more information.

Now you are ready to deploy containers and take advantage of weaveDNS to discover containers.

### Deploying Two Containers to the Weave Network

In this example, you are using the Docker API proxy to attach containers to the Weave network. As a reminder, the proxy was configured when you ran `eval$(weave env)`. 

>**Note:** Do not attach containers to the Weave network using both the Weave Docker Networking Plugin and Weave Docker API Proxy simultaneously. Containers run in this way will end up with two Weave network interfaces and two IP addresses. To ensure that the proxy is not being used, do not run eval $(weave env), or docker $(weave config). To attach containers with the Docker Network Plugin, you can use the `--net=weave` flag when using the Docker run command. 

For more information on how to use the Weave Docker Plugin, see ["Integrating Docker via the Network Plugin"](https://www.weave.works/docs/net/latest/plugin/)

The first app to be deployed is called `pingme`. It consists of a simple netcat (aka `nc`) server running on TCP port 4000, and it is configured to send a short message, `Hello, Weave!` to any client that connects to it.

~~~bash
docker run -d --name=pingme \
        gliderlabs/alpine nc -p 4000 -ll -e echo 'Hello, Weave!'
~~~

The second containerized app is called `pinger`. You will launch that app in interactive mode using the `-ti` flag. The `-ti` flag allows you to type and run simple commands within a Docker container.

~~~bash
docker run --name=pinger -ti \
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

This completes Part 1 of this tutorial. If you are not going on to [Part 2](/part-2-using-weave-with-docker-machine-and-swarm/), then you may want to remove the containers and the VM used in this example:

~~~bash
> docker rm -f pingme pinger
> docker-machine rm -f weave-1
~~~

##Conclusions

This tutorial demonstrated how to launch a Weave network using Docker Machine. A simple  _"Hello, Weave!"_ service was deployed to a container that listens on TCP port 4000 for any connections from other containers.

Proceed to [Part 2](/part-2-using-weave-with-docker-machine-and-swarm/), where you will set up multiple Virtual Machines, using Docker Swarm to schedule containers, use [Weave Net](/weave-net/) to provide transparent connectivity across multiple Docker hosts and to automatically discover new containers with weaveDNS without the need of an external cluster store.

Send us your thoughts, comments or issues via [Help and Support](https://www.weave.works/help/).

## Further Reading

  *  [Learn More About Weave](/docs/net/latest/introducing-weave/)
  *  [How Weave Works](/docs/net/latest/how-it-works/)
  *  [Discovering Containers with WeaveDNS](/docs/net/latest/weavedns/)
  *  [Weave Docker API](/docs/net/latest/weave-docker-api/)
 

[ch1]: /part-1-launching-weave-net-with-docker-machine/
[ch2]: /part-2-using-weave-with-docker-machine-and-swarm/
[ch3]: /part-3-creating-and-scaling-multi-host-docker-deployment-with-swarm-and-compose-using-weave/
