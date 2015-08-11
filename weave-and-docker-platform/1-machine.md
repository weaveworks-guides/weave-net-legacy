---
layout: guides
title: "1. Launching Weave Net with Docker Machine"
permalink: /guides/weave-and-docker-platform/chapter1/machine.html
tags: docker, machine, cli, virtualbox, dns, ipam, hello-weave-app
---

>
> - Part 2: [][ch2]
> - Part 3: [Using Weave with Docker Machine and Swarm][ch3]
> - Part 4: [Creating and scaling multi-host Docker deployment with Swarm and Compose using Weave][ch4]

## What You Will Build

Weave allows you to focus on developing your application, rather than your infrastructure and it works seamlessly with other tools
such as [Docker Machine](https://docs.docker.com/machine/). 

[Docker Machine](https://docs.docker.com/machine/) makes it simple to create Docker hosts (VMs) on your computer, on cloud providers or within your own data center. It creates servers, installs Docker on them, then it configures the Docker client to talk to them.

In this part 1 of 'Creating Distributed Apps with Weave and Docker' you will be introduced to the basics of running a containerized network with Weave.  

Specifically, you will:

  1. Install Docker Machine and Weave 
  2. Setup Weave onto a single VM on VirtualBox 
  3. Deploy a basic _"Hello, Weave!"_ application
  4. Access the application from a Weave-attached Docker container on the network.
  5. Communicate with the application through Weaveproxy using the Docker client commands

This guide uses very simple UNIX tools, and doesn't require any programming skills. 

This tutorial will take about 20 minutes to complete.


##What you will use

  - [Weave](http://weave.works)
  - [Docker & Docker-Machine](https://docs.docker.com)

## What You Need to Complete This Chapter

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

If you are using OSX, you need to install Boot2Docker to run Docker. Homebrew installs all of these tools, including Boot2Docker by running:

~~~bash
brew install docker docker-machine
~~~

Note: Check that your brew environment is configured correctly by running `brew doctor`

For other operating systems, please refer to the links above.

If you haven't yet installed VirtualBox, follow the [installation instructions for your OS](https://www.virtualbox.org/wiki/Downloads).

## Let's go!

First, transfer the Weave script and make it executable.

~~~bash
curl -OL git.io/weave
chmod +x ./weave
~~~

Next create a Virtual Machine or a VM on the VirtualBox, called weave-1: 

~~~bash
docker-machine create -d virtualbox weave-1
~~~

Once the VM is running, configure your shell environment by running:
 
~~~bash
eval "$(docker-machine env weave-1)":
~~~

Verify that everything installed correctly:

~~~bash
docker info
~~~

Now launch the Weave network:

~~~bash
./weave launch
~~~

When you run `weave launch` the network automatically starts DNS, and it also sets up a proxy on the weave network. 

To communicate with the docker daemon securely over weaveproxy, you need to set an environment variable which points to the path of the daemon's TLS settings. These were conveniently set for you when you ran 'eval "$(docker-machine env weave-1)". 

Both of these services can be started and stopped independently, if you need to.
See [TLS Settings](https://docs.docker.com/articles/https/) for more information about specifying these settings in a production environment. 

Check to see that all worked well by running: 

~~~bash
./weave status
~~~

Now you are ready to deploy containers and also use DNS so that the containers can discover each other.

### Deploy Two Containers to the Weave Network

The first app to be deployed is called `pingme`. It consists of a simple netcat (aka `nc`) server running on TCP port 4000. Its sends a short message, `Hello, Weave!` to any client that connects to it.

~~~bash
> ./weave run --name=pingme gliderlabs/alpine nc -p 4000 -lk -e echo 'Hello, Weave!'
~~~

The second containerized app is called `pinger`, and it will be launched interactively using the `-ti` flag, where the container can acccept and run few simple commands.

Confirm that the netcat server is accessible via `pingme.weave.local` DNS name and that it functions as expected:


~~~bash
> ./weave run --name=pinger -ti gliderlabs/alpine sh -l
~~~

Next, attach the container with Docker, so that commands can be executed:  

~~~bash
> docker attach pinger
~~~

Press the return/enter key several times until you see the `pinger: /#` prompt

Now, ping the other container using its DNS name:

~~~bash
pinger:/# ping -c3 pingme.weave.local
~~~

where it returns the following: 

     PING pingme.weave.local (10.128.0.1): 56 data bytes
     64 bytes from 10.128.0.1: seq=0 ttl=64 time=0.158 ms
     64 bytes from 10.128.0.1: seq=1 ttl=64 time=0.161 ms
     64 bytes from 10.128.0.1: seq=2 ttl=64 time=0.062 ms
     --- pingme.weave.local ping statistics ---
     3 packets transmitted, 3 packets received, 0% packet loss
     round-trip min/avg/max = 0.062/0.127/0.161 ms

Check that pingme responds on TCP port 4000: 

~~~bash
pinger:/# echo "What's up?" | nc pingme.weave.local 4000

Hello, Weave!

pinger:/#
~~~

Exit the pinger container: 

~~~bash
pinger:/# exit
~~~

##Using Weaveproxy to run Docker Commands

With weaveproxy you can bypass Weave's command line interface and instead manage containers directly on the host using Docker client commands. 

You will be able to run commands on the containers using docker directly: 

~~~bash
>docker exec -i pinger ping -c3 pingme.weave.local
~~~

    PING pingme.weave.local (10.128.0.1): 56 data bytes
    64 bytes from 10.128.0.1: seq=0 ttl=64 time=0.100 ms
    64 bytes from 10.128.0.1: seq=1 ttl=64 time=0.114 ms
    64 bytes from 10.128.0.1: seq=2 ttl=64 time=0.111 ms

    --- pingme.weave.local ping statistics ---
    3 packets transmitted, 3 packets received, 0% packet loss
    round-trip min/avg/max = 0.100/0.108/0.114 ms

Test if it responds on TCP port 4000 as expected

~~~bash
docker exec -i pinger echo "What's up?" | nc pingme.weave.local 4000
~~~

~~~bash
Hello, Weave!
~~~

This completes Part 1 of this tutorial, and you can remove both containers:

~~~bash
> docker-machine rm -f pingme pinger
~~~

~~~bash
pingme
pinger
~~~


## Cleanup

You can remove the VM that docker-machine configured and installed with the following:

~~~bash
docker-machine rm -f weave-1
~~~

## Summary

This section demonstrated how to use Weave with Docker Machine. A simple  _"Hello, Weave!"_ service was deployed to a container that listens on TCP port 4000 for any connections from other containers.

In the part 2 of this tutorial, we will look at how to setup Weave with docker-machine and use Docker Compose to create a scalable swarm cluster with weave.

##Further Reading


[ch3]: /guides/weave-and-docker-platform/chapter3/machine-and-swarm-with-weave-proxy.html
[ch4]: /guides/weave-and-docker-platform/chapter4/compose-scalable-swarm-cluster-with-weave.html
