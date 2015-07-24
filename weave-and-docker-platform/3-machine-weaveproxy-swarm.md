---
layout: guides
title: "3. Using Weave with Docker Machine and Swarm"
permalink: /guides/weave-and-docker-platform/chapter3/machine-and-swarm-with-weave-proxy.html

tags: docker, machine, swarm, cli, virtualbox, dns, ipam, proxy, hello-weave-app
---

> ### ***Creating distributed applications with Weave and the Docker platform***
>
> - Chapter 1: [Using Weave with Docker Machine][ch1]
> - Chapter 2: [Using Weave with Docker Machine via proxy][ch2]
> - Chapter 4: [Creating and scaling multi-host Docker deployment with Swarm and Compose using Weave][ch4]

Weave allows you to focus on developing your application, rather than your infrastructure, and it works great with tools
like [Docker Machine](https://docs.docker.com/machine/) and [Swarm](https://docs.docker.com/swarm/). Here you will learn
how to get started with Swarm and Weave, you can then proceed to a more advanced setup with Compose in the final 4th
chapter of this guide.

## What you will build

[Docker Machine](https://docs.docker.com/machine/) makes it really easy to create Docker hosts (VMs) on your computer, on
cloud providers and inside your own data center. It creates servers, installs Docker on them, then configures the Docker
client to talk to them.

[Docker Swarm](http://docs.docker.com/swarm/) is native clustering for Docker. It turns a pool of Docker hosts into a single,
virtual host. You can instruct Machine to provision a Swarm cluster for you, as shown below. This example will demostarate
how to boost the scalability of Swarm cluster using [Weave Net](/net) and enable simple DNS-based container discovery with
[Weave Run](/run).

This 3rd chapter continues from the [2nd][ch2] and [1st][ch1] chapters, which I encourage you to read first.

In this chapter of the guide we will setup a cluster of machines instead of using just one machine, like we did before. There
is only very little you can do with a single VM, and doesn't represent a production system at all. We are also going to automate
this setup with few simple shell scripts.

## What you will use

  - [Weave](http://weave.works)
  - [Docker, Swarm & Machine](http://docker.com)

## What you will need to complete this chapter

  - 15-25 minutes
  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

_If you have followed through [the previous chapter][ch2], you should already have all of these dependencies installed._

If you are using OS X, then you can install these tools with Homebrew like this:

    brew install docker docker-machine

For other operating systems, please refer to links above.

If you haven't yet installed VirtualBox, be sure to follow [installation instructions for your OS](https://www.virtualbox.org/wiki/Downloads).

## Let's go!

Firstly, we need to pick the number of VMs we are going to provision. I've picked 3 as that should be okay to run on most
people's laptops and is enough to showcase Weave. Let's give these VMs names that we can refer to throughout the chapter.

  - `weave-1`
  - `weave-2`
  - `weave-3`

### Setting up Swarm

Having 3 VMs to provision, we will need to chose one that will be our Swarm master first of all, it is natural to pick
`weave-1`, or, as I call it, the head node. So the flow will be like this

  1. create `weave-1` as a Swarm master
  2. create `weave-2` as a Swarm slave
  3. create `weave-3` as a Swarm slave

It is very easy to script this first step and you can find my implementation in [`scripts/1-machine-create.sh`][step1].

### Launching Weave

Next we need to launch Weave on each of these machines. We have see how to do this for one machine in the [previous
chapter][ch2].

As we don't know the IP addresses of all the peers ahead of time, will need to pass `-initpeercount` to `weave launch`,
which should be set to 3, as we are looking to setup a cluster of 3 VMs.

First, on each of the there nodes we need to

  1. launch Weave router with `-initpeercount 3`
  2. launch WeaveDNS on subnet `10.53.1.0/24`
  3. launch proxy with DNS and IPAM enabled and copy of TLS flags from Docker daemon

Then we can connect the cluster with `weave connect $(docker-machine ip weave-1)` for `weave-2` and `weave-3`.

As we shown in the two previous chapters, we can run these commands remotely with the help of `DOCKER_CLIENT_ARGS`.

You can find a working script that implements this in [`scripts/2-weave-launch.sh`][step2].

<div class="alert alert-warning">
<b>Please note</b> that in Weave there is no notion of master/slave or any other roles of the nodes. Here we simply
picked <code>weave-1</code> as a sort of bootstrap node, but we could also pass all IPs or DNS names to <code>weave launch</code>
and thereby also avoid having to set <code>-initpeercount</code> explicitly. However, with Docker Machine on VirtualBox
we do not know the IP addresses and don't have DNS. You should be able to use DNS with one of the cloud drivers, such as
Microsoft Azure or Google Compute Engine.
</div>

### Setting up Swarm agents against Weave proxy

This step is a little bit more involved and I will refrain from covering it in detail, as this is really a work-around to
an [issue in Docker Machine](https://github.com/docker/machine/issues/1334). In essence, currently we have to restart
Swarm agents with a new discovery token and make them register TCP port 12375 for Weave proxy. You can find out how it's
done in [`scripts/3-replace-swarm-agents.sh`][step3].

### Put it all together

First you shoild obtain the repository with

    git clone https://github.com/weaveworks/guides weaveworks-guides
    cd ./weaveworks-guides/weave-and-docker-platform/scripts

Now that we understand how provisioning works, we can run all 3 scripts

    ./1-machine-create.sh
    ./2-weave-launch.sh
    ./3-replace-swarm-agents.sh

Once this is done, let's check what we have

    > docker-machine ls
    NAME      ACTIVE   DRIVER       STATE     URL                         SWARM
    weave-1            virtualbox   Running   tcp://192.168.99.129:2376   weave-1 (master)
    weave-2            virtualbox   Running   tcp://192.168.99.130:2376   weave-1
    weave-3   *        virtualbox   Running   tcp://192.168.99.131:2376   weave-1

So all 3 machines are running, let's look at whether all are in Swarm.

    > docker `docker-machine config --swarm weave-1` info
    Containers: 13
    Strategy: spread
    Filters: affinity, health, constraint, port, dependency
    Nodes: 3
     weave-1: 192.168.99.129:12375
      └ Containers: 5
      └ Reserved CPUs: 0 / 8
      └ Reserved Memory: 0 B / 1.025 GiB
     weave-2: 192.168.99.130:12375
      └ Containers: 4
      └ Reserved CPUs: 0 / 8
      └ Reserved Memory: 0 B / 1.025 GiB
     weave-3: 192.168.99.131:12375
      └ Containers: 4
      └ Reserved CPUs: 0 / 8
      └ Reserved Memory: 0 B / 1.025 GiB

This is great, we can run some containers now.

## Deploy

First, let's run same _"Hello, Weave!"_ container like we did before

    > docker `docker-machine config --swarm weave-1` run -d --name=pingme \
        gliderlabs/alpine nc -p 4000 -l -e echo 'Hello, Weave!'
    df8bb89d048abce4f9ed25259072ac6c177ebdae708222662325603ef4ec4a78

Next, in order to confirm that we have truly transparent multi-host setup, we should make sure that test container `pinger`
doesn't run on the same hosts as `pingme` does, for this we can set Swarm affinity constraint with `-e 'affinity:container!=pingme'`.

    > docker `docker-machine config --swarm weave-1` run -e 'affinity:container!=pingme' --name=pinger -ti \
        gliderlabs/alpine sh -l

Now let's repeat our test with `ping` and `nc` commands, just like we did in the two previous chapters.

    pinger:/# ping -c3 pingme.weave.local
    PING pingme.weave.local (10.128.128.0): 56 data bytes
    64 bytes from 10.128.128.0: seq=0 ttl=64 time=17.572 ms
    64 bytes from 10.128.128.0: seq=1 ttl=64 time=7.900 ms
    64 bytes from 10.128.128.0: seq=2 ttl=64 time=3.284 ms

    --- pingme.weave.local ping statistics ---
    3 packets transmitted, 3 packets received, 0% packet loss
    round-trip min/avg/max = 3.284/9.585/17.572 ms
    pinger:/# echo "What's up?" | nc pingme.weave.local 4000
    Hello, Weave!
    pinger:/#

Before we tear down two running container, let's convince ourselves that these are running on two different VMs.

In a new terminal window run

    > docker `docker-machine config --swarm weave-1` ps | grep alpine
    aa5ae81e5cf4      gliderlabs/alpine:latest    "/w/w sh -l"          7 minutes ago   Up 7 minutes   weave-2/pinger
    df8bb89d048a      gliderlabs/alpine:latest    "/w/w nc -p 4000 -lk  6 minutes ago   Up 6 minutes   weave-3/pingme

and you will see that there hostnames of our VMs in the last column, i.e. `weave-2/pinger` and `weave-3/pingme`.

We can exit the test container now.

    pinger:/# exit

And, as all worked well, let's get rid of both containers by running

    > docker `docker-machine config --swarm weave-1` rm -f pingme pinger
    pingme
    pinger

## Cleanup

Unless you proceed to the [next chapter][ch4] right away, you probably want to remove the VMs we have created here.

    docker-machine rm -f weave-1 weave-2 weave-3

## Summary

In this chapter we have learned how to use Weave with Docker Swarm & Machine to provision an miniature infrastructure of 3 virtual
machines running on VirtualBox with [Weave Net](/net) providing connectivity for Docker containers. We have then deployed a simple
_"Hello, Weave!"_ service and tested that setup works 100%. Most importantly, you now learned all the commands you need use in order
to create a cluster of Docker hosts and should understanding how to integrate Weave proxy and Swarm, so you proceed to the next step
with confidence. Next we will look at how to use Compose to deploy an entier stack of containers to a Swarm cluster powered
by [Weave Net](/net) and [Weave Run](/run).

[step1]: https://github.com/weaveworks/guides/blob/d6c3b28061d40774818734dee915fd829b93e6bf/weave-and-docker-platform/scripts/1-machine-create.sh
[step2]: https://github.com/weaveworks/guides/blob/d6c3b28061d40774818734dee915fd829b93e6bf/weave-and-docker-platform/scripts/2-weave-launch.sh
[step3]: https://github.com/weaveworks/guides/blob/d6c3b28061d40774818734dee915fd829b93e6bf/weave-and-docker-platform/scripts/3-replace-swarm-agents.sh
[ch1]: /guides/weave-and-docker-platform/chapter1/machine.html
[ch2]: /guides/weave-and-docker-platform/chapter2/machine-with-weave-proxy.html
[ch3]: /guides/weave-and-docker-platform/chapter3/machine-and-swarm-with-weave-proxy.html
[ch4]: /guides/weave-and-docker-platform/chapter4/compose-scalable-swarm-cluster-with-weave.html
