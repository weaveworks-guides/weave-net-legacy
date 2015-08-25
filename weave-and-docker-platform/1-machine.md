---
layout: guides
title: "Creating Distributed Apps with Weave and Docker"
permalink: /guides/weave-and-docker-platform/machine.html
tags: docker, machine, cli, virtualbox, dns, ipam, hello-weave-app
---

{% include product-vars %}

### ***Launching Weave Net with Docker Machine***

> - **Part 1: Launching Weave Net with Docker Machine**
> - Part 2: [Using Weave with Docker Machine and Swarm][ch2]
> - Part 3: [Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave][ch3]

## What You Will Build

Weave provides a software network optimized for visualizing and communicating with apps distributed within Docker containers. Using tools and protocols that are familiar to you, Weave's network topology lets you to communicate between containerized apps distributed across multiple networks or hosts more quickly and efficiently.

With Weave you focus on developing your application, rather than your infrastructure. As demonstrated in this tutorial, Weave works seamlessly with other tools such as [Docker Machine](https://docs.docker.com/machine/).

[Docker Machine](https://docs.docker.com/machine/) makes it simple to create Docker hosts (VMs) on your computer, on cloud providers or within your own data center. It creates servers, installs Docker on them, then it configures the Docker client to talk to them.

In this Part 1 of _'Creating Distributed Apps with Weave and Docker'_ you will be introduced to the basics of launching a container network with Weave.

Specifically, you will:

  1. Install Docker Machine and Weave
  2. Setup Weave onto a single VM on VirtualBox
  3. Deploy a basic _"Hello, Weave!"_ application
  4. Enable {{ weavedns }} to discover the Weave-attached Docker containers on the network
  5. Communicate with your app and send a message from one container to another using shell commands

This tutorial uses very simple UNIX tools, and it doesn't require any programming skills.

This tutorial will take about 10 minutes to complete.

## What you will use

  - [Weave](http://weave.works)
  - [Docker & Docker Machine](https://docs.docker.com)

## What You Need to Complete Part 1

If you are using OS X or Windows, you can install [Docker Toolbox](https://www.docker.com/toolbox), which provides all the tools you will need.

For other operating systems, you will need to install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

## Let's go!

First, install the `weave` command. Note that if you don't have ownership of the `/usr/local/bin` directory, you may need to preface these commands with `sudo`:

~~~bash
curl -L git.io/weave -o /usr/local/bin/weave
chmod a+x /usr/local/bin/weave
~~~

Next create a Virtual Machine (VM) on the VirtualBox, called `weave-1`, by running:

~~~bash
docker-machine create -d virtualbox weave-1
~~~

Once the VM is running, configure your shell environment by running:

~~~bash
eval "$(docker-machine config weave-1)"
~~~

Verify that everything installed correctly:

~~~bash
docker info
~~~

Now launch the Weave network and automatically launch the Docker API proxy:

~~~bash
weave launch
~~~


Next set up the weave environment for the Docker API proxy:

~~~bash
eval "$(weave env)"
~~~

Check to see that the proxy is running properly:

~~~bash
docker logs weaveproxy
~~~

Running `weave launch` automatically configures your network. Launch starts {{ weavedns }}, making all your containers discoverable and it also sets up a Docker API proxy on the weave network, so that you can manage your containers using standard Docker commands.

Both {{ weavedns }} and {{ weaveproxy }} services can be started and stopped independently, if required.
See [Docker API Proxy](https://github.com/weaveworks/weave/blob/master/site/proxy.md) for more information about the Docker API.

### Launching {{ weaveproxy }} if You are Running OS X

If you are using OS X, you will need to get the TLS settings from the Docker daemon on the host:

~~~bash
tlsargs=$(docker-machine ssh weave-1 \
  "cat /proc/\$(pgrep /usr/local/bin/docker)/cmdline | tr '\0' '\n' | grep ^--tls | tr '\n' ' '")
~~~

View and copy the settings, if necessary:

~~~bash
echo $tlsargs
~~~

then, launch the proxy using the TLS settings you grepped above:

~~~bash
weave launch-proxy $tlsargs
~~~

See [TLS Settings](https://docs.docker.com/articles/https/) for more information about specifying these settings in a production environment.

Next, set up the Weave environment to use the proxy by running:

~~~bash
eval "$(weave env)"
~~~

Check to see that all worked well:

~~~bash
weave status
~~~

and then check the {{ weaveproxy }} logs from Docker to see that proxy is running:

~~~bash
docker logs weaveproxy
~~~

Now you are ready to deploy containers and also use DNS so that the containers can discover each other.

### Deploy Two Containers to the Weave Network

The first app to be deployed is called `pingme`. It consists of a simple netcat (aka `nc`) server running on TCP port 4000, which sends a short message, `Hello, Weave!` to any client that connects to it.

~~~bash
docker run -d --name=pingme \
        gliderlabs/alpine nc -p 4000 -l -e echo 'Hello, Weave!'
~~~

The second containerized app is called `pinger`, and it will be launched interactively using the `-ti` flag, where the container can acccept and run few simple commands.

~~~bash
docker run -e 'affinity:container!=pingme' --name=pinger -ti \
        gliderlabs/alpine sh -l
~~~

Check to see that {{ weavedns }} has registered them:

~~~bash
weave status
~~~

### Interacting with Containerized Apps

First ping one of the containers:

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

## Cleanup

This completes Part 1 of this tutorial. To remove the containers used in this example:

~~~bash
> docker rm -f pingme pinger
~~~

## Summary

This tutorial demonstrated how to launch a Weave network using Docker Machine. A simple  _"Hello, Weave!"_ service was deployed to a container that listens on TCP port 4000 for any connections from other containers.

Most importantly, you should be familiar with the commands you need to use in order to create Virtual Machines and create and start containers on them using the seamlessly integrated Docker API {{ weaveproxy }}.

Proceed to Part 2, where we will look at how to set up multiple Virtual Machines, using Docker Swarm to schedule containers, and most importantly use [Weave Net](/net) to provide transparent connectivity across multiple Docker hosts and [Weave Run](/run) to enable service discovery via DNS.

You can easily adapt these examples and use them as templates in your own implementation. We would be very happy to hear any of your thoughts or issues via [email](help@weave.works) or [Twitter](https://twitter.com/weaveworks).

## Further Reading

  *  [Learn more about Weave](http://weave.works/articles/index.html)
  *  [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
  *  [Docker API](https://github.com/weaveworks/weave/blob/master/site/proxy.md)
  *  [TLS Settings](https://docs.docker.com/articles/https/)

[ch1]: /guides/weave-and-docker-platform/machine.html
[ch2]: /guides/weave-and-docker-platform/machine-and-swarm-with-weave-proxy.html
[ch3]: /guides/weave-and-docker-platform/compose-scalable-swarm-cluster-with-weave.html
