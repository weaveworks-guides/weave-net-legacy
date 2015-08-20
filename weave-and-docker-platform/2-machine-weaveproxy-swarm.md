---
layout: guides
title: "Creating Distributed Apps with Weave and Docker"
permalink: /guides/weave-and-docker-platform/machine-and-swarm-with-weave-proxy.html
tags: docker, machine, swarm, cli, virtualbox, dns, ipam, proxy, hello-weave-app
---

{% include product-vars %}

### ***Using Weave with Docker Machine and Swarm***

> - Part 1: [Launching Weave Net with Docker Machine][ch1]
> - **Part 2: Using Weave with Docker Machine and Swarm**
> - Part 3: [Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave][ch3]

## What You Will Build

In this example, we show how Weave works seamlessly with tools like [Docker Machine](https://docs.docker.com/machine/) and [Docker Swarm](https://docs.docker.com/swarm/).

[Docker Swarm](http://docs.docker.com/swarm/) is a native clustering environment for its Docker engines. It turns a pool of Docker engine into a single, virtual host. [Docker Machine](https://docs.docker.com/machine/) allows you to easily create the Docker hosts (VMs) on your computer, on cloud providers or inside your own data center. With a few commands, it creates servers, installs Docker on them, and then it configures the Docker client to talk to them.

Weave’s standard container network enables simple DNS-based container discovery, so that you can easily manage your distributed containerized application without the need to deploy any additional services or software. It also boosts the Swarm cluster scalability, and provides true portability whether deployed to a public cloud or to in an in-house datacenter. Weave furthermore, eliminates the need for an [ambassador pattern][ambassador], or any other approach that might involve some combination of distributed configuration store and a proxy.


[ambassador]: https://docs.docker.com/articles/ambassador_pattern_linking/


Part 2 of this guide describes how to configure a basic Docker Swarm cluster, and how to deploy Weave Net to it, to make its contents easily discoverable. In [Part 3][ch3] we discuss a more advanced setup that uses Docker Compose.

Specifically in this tutorial, you will:

  1. Set up a simple Docker Swarm cluster using 3 virtual hosts.
  2. Deploy the Weave Network and discover hosts through DNS.
  3. Deploy a sample app to test that hosts are communicating within the Docker Swarm

This example requires no programming, but does require basic UNIX skills.
This tutorial will take approximately 15-25 minutes to complete.

## What you will use

  - [Weave](http://weave.works)
  - [Docker, Swarm & Machine](http://docker.com)

## What you will Need to Complete Part 2

If you are using OS X or Windows, you can install [Docker Toolbox](https://www.docker.com/toolbox), which provides all the tools you will need.

For all other operating systems, install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

_If you completed [Part one of this tutorial][ch1], you should have all of these dependencies installed._

## Let's go!

Note that the first two sections of this guide describes how to provision the cluster on the command line manually. If you prefer to jump ahead and see Weave in action right away, then refer to [Putting It All Together](#Putting) below, where several helpful shell scripts are provided, which automate the whole process.

First, select the number of VMs to provision. This example limits the number of VMs to 3 to demonstrate Weave in a cluster environment, while at the same time can still run comfortably on most laptops. In a production setting however, you can have any number of hosts in a  Docker Swarm and connect them using Weave.

We will refer to these VM names throughout this tutorial:

  - `weave-1`
  - `weave-2`
  - `weave-3`

### Setting up the Swarm

Among the 3 VMs to be provisioned, chose one that will act as the Swarm master. In this example, we refer to `weave-1` as the head or the bootstrap node. Keep in mind that Weave has no specific knowledge of a Swarm master and its agents, and you can deploy your network in whatever topology you choose.

But for the pursposes of this tutorial, `weave-1` will act as the bootstrap node where it will provide the initial configuration information to newly joining nodes, in this case, `weave-2` and `weave-3`.

The workflow, then is as follows:

  1. create `weave-1` as a Swarm master
  2. create `weave-2` as a Swarm agent
  3. create `weave-3` as a Swarm agent
  4. Generate a Discovery Swarm token, which is the unique cluster id, as described in the [Docker Swarm Documentation](https://docs.docker.com/swarm/install-w-machine/)


  >>*Note:* In Weave there is no notion of master/slave or any other roles of the nodes. Here we simply
  >>picked `weave-1` as a sort of bootstrap node, but we could also pass all IPs or DNS names to `weave launch`
  >>and thereby also avoid having to set <code>-initpeercount</code> explicitly. However, with Docker Machine on VirtualBox
  >>we do not know the IP addresses and don't have DNS. You should be able to use DNS with one of the cloud drivers, such as
  >>Microsoft Azure or Google Compute Engine.


  >>To obtain the discovery swarm token, and to automatically create the VMs, a sample implementation script is provided: [`scripts/1-machine-create.sh`][step1].

### Launching Weave

Next launch Weave onto each of the virtual machines.

The IP addresses of all the peers are not known ahead of time, so you will need to pass `--init-peer-count 3` to `weave launch`.
`--init-peer-count` is set to 3, as we are specifying a cluster of 3 VMs.

In this setup, `weave-1` is the bootstrap node, and so its target should be 0. Only `weave-2` and `weave-3` need to have  `--init-peer-count` set to 3 at launch.

On each host, except for `weave-1` you will need to:

  1. launch Weave router with `--init-peer-count 3`
  3. launch proxy with a copy of TLS flags from Docker daemon
  4. Connect the host to `weave-1`

On `weave-1` run:

~~~bash
weave launch
~~~

Specify the TLS settings if asked:

~~~bash
tlsargs=$(docker-machine ssh weave-12 \
  "cat /proc/\$(pgrep /usr/local/bin/docker)/cmdline | tr '\0' '\n' | grep ^--tls | tr '\n' ' '")
~~~

launch the proxy using the TLS settings you grepped above:

~~~bash
weave launch-proxy $tlsargs
~~~

and finally, set the weave environment variable for `weave-1`

~~~bash
eval "$(weave env)"
~~~

Set the weave env for `weave-1`

~~~bash
eval "$(weave env)"
~~~

Launch weave on `weave-2` with `--init-peer-count set to 3`:

~~~bash
weave launch-router --init-peer-count 3
~~~

Specify the TLS settings if asked:

~~~bash
tlsargs=$(docker-machine ssh weave-12 \
  "cat /proc/\$(pgrep /usr/local/bin/docker)/cmdline | tr '\0' '\n' | grep ^--tls | tr '\n' ' '")
~~~

then, launch the proxy using the TLS settings you grepped above:

~~~bash
weave launch-proxy $tlsargs
~~~

and finally, set the weave environment variable for `weave-2`

~~~bash
eval "$(weave env)"
~~~

Next on `weave-2` connect the cluster to our bootstrap node, `weave-1`:

~~~bash
weave connect $(docker-machine ip weave-1)
~~~

check to see that all went well:

~~~bash
weave status
~~~

Follow the same steps for `weave-3` as you did for `weave-2` above.


  >>A useful script which launches weave and sets up the hosts and connects the cluster can be found here: [`scripts/2-weave-launch.sh`][step2].


### Setting up Swarm Agents Against {{ weaveproxy }}

This next step is a necessary work-around to a reported Docker Machine issue, which we will refrain from covering in detail. For more information, refer to [issue #1334 in Docker Machine](https://github.com/docker/machine/issues/1334).  In short, swarm agents are restarted with a new discovery token and then registered to TCP port 12375 for {{ weaveproxy }}. Have a look at the following script [`scripts/3-replace-swarm-agents.sh`][step3] for more information.

### Putting it All Together

First clone the `weaveworks/guides` repository:

    git clone https://github.com/weaveworks/guides weaveworks-guides
    cd ./weaveworks-guides/weave-and-docker-platform/scripts

Now that we understand how this is provisioned, you can automate the whole process by running these 3 scripts:

    ./1-machine-create.sh
    ./2-weave-launch.sh
    ./3-replace-swarm-agents.sh

Once done, check that everything is running properly:

    > docker-machine ls
    NAME      ACTIVE   DRIVER       STATE     URL                         SWARM
    weave-1            virtualbox   Running   tcp://192.168.99.129:2376   weave-1 (master)
    weave-2            virtualbox   Running   tcp://192.168.99.130:2376   weave-1
    weave-3   *        virtualbox   Running   tcp://192.168.99.131:2376   weave-1

As you can see the 3 virtual machines are running. Check that they are in a Swarm:

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

Now that everything is setup correctly, we can run a few containers.

## Deploy

First, deploy the _"Hello, Weave!"_ container like we did in the previous example:

    > docker `docker-machine config --swarm weave-1` run -d --name=pingme \
        gliderlabs/alpine nc -p 4000 -l -e echo 'Hello, Weave!'
    df8bb89d048abce4f9ed25259072ac6c177ebdae708222662325603ef4ec4a78

Confirm that there is a transparent multi-host setup, and then check that the test container `pinger`
doesn't run on the same hosts as `pingme` does. This can be checked by setting the Swarm affinity constraint with `-e 'affinity:container!=pingme'`.

    > docker `docker-machine config --swarm weave-1` run -e 'affinity:container!=pingme' --name=pinger -ti \
        gliderlabs/alpine sh -l

Now repeat the test using the `ping` and `nc` commands, like we did in the two previous chapters.

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

Before we tear down these two running containers, confirm that the containers are in fact running on two different VMs.

In a new terminal window run

    > docker `docker-machine config --swarm weave-1` ps | grep alpine
    aa5ae81e5cf4      gliderlabs/alpine:latest    "/w/w sh -l"          7 minutes ago   Up 7 minutes   weave-2/pinger
    df8bb89d048a      gliderlabs/alpine:latest    "/w/w nc -p 4000 -lk  6 minutes ago   Up 6 minutes   weave-3/pingme

and as you can see, the hostnames of our VMs appear in the last column, i.e. `weave-2/pinger` and `weave-3/pingme`.

Now exit the test container:

    pinger:/# exit

As everything worked as expected, let's get rid of both containers by running:

    > docker `docker-machine config --swarm weave-1` rm -f pingme pinger
    pingme
    pinger

## Cleanup

Unless you proceed to [Part 3 Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave][ch3] right away, you may want to remove the VMs that were created:

    docker-machine rm -f weave-1 weave-2 weave-3

## Summary

In this Part 3, we learned how to use Weave with Docker Swarm & Machine to provision an miniature infrastructure of 3 virtual
machines running on VirtualBox with [Weave Net](/net) providing connectivity for Docker containers. We then deployed a simple
_"Hello, Weave!"_ service and tested that setup. Most importantly, you now know all the commands to create a cluster of Docker hosts and should understand how to integrate Weave and Docker Swarm to proceed to the next step with confidence. Next we will look at how to use Compose to deploy an entire stack of containers to a Swarm cluster all powered by [Weave Net](/net) and [Weave Run](/run).

You can easily adapt these examples and use them as a templates in your own implementation. We would be very happy to hear any of your thoughts or issues via [email](help@weave.works) or [Twitter](https://twitter.com/weaveworks).

##Further Reading

  *  [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
  *  [Automatic IP Address Management](https://github.com/weaveworks/weave/blob/master/site/ipam.md)

[step1]: https://github.com/weaveworks/guides/blob/d6c3b28061d40774818734dee915fd829b93e6bf/weave-and-docker-platform/scripts/1-machine-create.sh
[step2]: https://github.com/weaveworks/guides/blob/d6c3b28061d40774818734dee915fd829b93e6bf/weave-and-docker-platform/scripts/2-weave-launch.sh
[step3]: https://github.com/weaveworks/guides/blob/d6c3b28061d40774818734dee915fd829b93e6bf/weave-and-docker-platform/scripts/3-replace-swarm-agents.sh

[ch1]: /guides/weave-and-docker-platform/machine.html
[ch2]: /guides/weave-and-docker-platform/machine-and-swarm-with-weave-proxy.html
[ch3]: /guides/weave-and-docker-platform/compose-scalable-swarm-cluster-with-weave.html
