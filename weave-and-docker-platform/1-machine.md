---
layout: guides
title: "1. Using Weave with Docker Machine"
permalink: /guides/weave-and-docker-platform/chapter1/machine.html
tags: docker, machine, cli, virtualbox, dns, ipam, hello-weave-app
---

> ### ***Creating distributed applications with Weave and the Docker platform***
>
> - Chapter 2: [Using Weave with Docker Machine via proxy][ch2]
> - Chapter 3: [Using Weave with Docker Machine and Swarm][ch3]
> - Chapter 4: [Creating and scaling multi-host Docker deployment with Swarm and Compose using Weave][ch4]

Weave allows you to focus on developing your application, rather than your infrastructure, and it works great with tools
like [Docker Machine](https://docs.docker.com/machine/). Here you will learn how to get started, you can then proceed to
a more advanced setup with Swarm and later Compose in following chapters of this guide.

## What you will build

[Docker Machine](https://docs.docker.com/machine/) makes it really easy to create Docker hosts (VMs) on your computer, on
cloud providers and inside your own data center. It creates servers, installs Docker on them, then configures the Docker
client to talk to them.

By following this chapter you will learn how to use Docker Machine with Weave, which you will need in order to progress
with further chapters in this guide. Here you will go through a few simple steps to setup Weave on a single VirtualBox
VM, it is really quite simple. You will deploy a basic _"Hello, Weave!"_ application and then use WeaveDNS to access it
from a Weave-attached Docker container. This chapter uses very simple UNIX tools, hence no programming skills are required.

## What you will use

  - [Weave](http://weave.works)
  - [Docker & Machine](http://docker.com)

## What you will need to complete this chapter

  - 10-15 minutes
  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

If you are using OS X, then you can install these tools with Homebrew like this:

    brew install docker docker-machine

For other operating systems, please refer to links above.

If you haven't yet installed VirtualBox, be sure to follow [installation instructions for your OS](https://www.virtualbox.org/wiki/Downloads).

## Let's go!

### Launch

First, you will need to obtain Weave script.

    curl -OL git.io/weave
    chmod +x ./weave

Now, you should create a VM with

    docker-machine create -d virtualbox weave-1

Once the VM is up, you need to point Weave at this VM by setting `DOCKER_CLIENT_ARGS` environment variable.

    export DOCKER_CLIENT_ARGS=$(docker-machine config weave-1)

You can verify all is well by running

    docker $DOCKER_CLIENT_ARGS info

Next, you should proceed to setup Weave network

    ./weave launch
    ./weave launch-dns 10.53.1.1/16

<div class="alert alert-warning">
You can optionally double check if all worked well by running <code>./weave status</code>.
</div>

Now you are all set to deploy containers with Weave and use DNS for containers to discover each other!

### Deploy

Let's now run a couple of very simple containers.

First, let's run a container named `pingme.weave.local`. It consists of a simple netcat (aka `nc`) server running on TCP
port 4000 and sending a short `Hello, Weave!` message to each client that connects to it.

    > ./weave run --with-dns --name=c1 -h pingme.weave.local gliderlabs/alpine nc -p 4000 -lk -e echo 'Hello, Weave!'
    e4978c68dec348b6515f4b6671bc094f4f8cd08a1b60491c7f47e63775c6b3b0

And, second container we will call `pinger.weave.local`, we will use it interactively (hence `-ti` flags) to run a few
simple command that will confirm that netcat server is accessible via `pingme.weave.local` DNS name and functions as expected.

    > ./weave run --with-dns --name=c2 -ti -h pinger.weave.local gliderlabs/alpine sh -l
    655a63506d01595c4aa04a486be854ba713371f9bdbb72c59b87b3245abfeca5

As we will use this container interactively, we will need to attach it first with `docker attach` and be sure to hit
return/enter key to get the prompt.

    > docker $DOCKER_CLIENT_ARGS attach c2

First, let's ping the other container by it's DNS name

    pinger:/# ping -c3 pingme.weave.local
    PING pingme.weave.local (10.128.0.1): 56 data bytes
    64 bytes from 10.128.0.1: seq=0 ttl=64 time=0.158 ms
    64 bytes from 10.128.0.1: seq=1 ttl=64 time=0.161 ms
    64 bytes from 10.128.0.1: seq=2 ttl=64 time=0.062 ms

    --- pingme.weave.local ping statistics ---
    3 packets transmitted, 3 packets received, 0% packet loss
    round-trip min/avg/max = 0.062/0.127/0.161 ms

Great, now let's see if it responds on TCP port 4000

    pinger:/# echo "What's up?" | nc pingme.weave.local 4000
    Hello, Weave!
    pinger:/#

We can exit the test container now.

    pinger:/# exit

And, as all worked well, let's get rid of both containers by running

    > docker $DOCKER_CLIENT_ARGS rm -f c1 c2
    c1
    c2

Next, we could probably do something a bit more fancy, but for that we will need to introduce a few more concepts in the
[next chapter][ch2].

## Cleanup

Unless you proceed to the [next chapter][ch2] right away, you probably want to remove the VM we have created here.

    docker-machine rm -f weave-1

## Summary

In this short chapter we have learned how to use Weave with Docker Machine and deployed a simple _"Hello, Weave!"_ service.
Most importantly, you should now know all the commands you need understand in order to create a VM and start containers
on it remotely. In [the next chapter of this guide][ch2], we will look at how to setup Weave with proxy allowing you to
use Docker API directly.

[ch1]: /guides/weave-and-docker-platform/chapter1/machine.html
[ch2]: /guides/weave-and-docker-platform/chapter2/machine-with-weave-proxy.html
[ch3]: /guides/weave-and-docker-platform/chapter3/machine-and-swarm-with-weave-proxy.html
[ch4]: /guides/weave-and-docker-platform/chapter4/compose-scalable-swarm-cluster-with-weave.html
