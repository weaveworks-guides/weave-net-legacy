---
layout: guides
title: "Part 2: Using Weave with Docker Machine and Swarm"
permalink: /guides/weave-and-docker-platform/using-weave-with-machine-and-swarm.html
description: Using weave net and weave run with docker machine and docker swarm
tags: weave, docker, docker machine, docker swarm, weaveworks, getting started guide

shorttitle: "Part 2 of 3: Using Weave with Docker Machine & Swarm"
sidebarpath: /start/dist/mach
sidebarweight: 20
---

In [Part 1][ch1], you learned how to use Weave Net with [Docker Machine](https://docs.docker.com/machine/). 

In this Part 2 of the guide you will learn how to configure a basic [Docker Swarm Cluster](https://docs.docker.com/swarm/), and how to deploy a Weave network onto it to make its contents discoverable.

In [Part 3 "Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave"](/part-3-creating-and-scaling-multi-host-docker-deployment-with-swarm-and-compose-using-weave/), you take what you learned in Parts 1 and 2 and use [Docker Compose](https://docs.docker.com/compose/) and Weave Net to launch a two-tier application spread across three VMs. 

[Docker Swarm](http://docs.docker.com/swarm/) is a native clustering environment for its Docker engines. It turns a pool of Docker engines into a single, virtual host. [Docker Machine](https://docs.docker.com/machine/) allows you to easily create the Docker hosts (VMs) on your computer, on cloud providers or inside your own data center. With a few commands, it creates servers, installs Docker on them, and then it configures the Docker client to talk to them.

Weave Net's standard container network enables simple DNS-based container discovery, so that you can manage your distributed containerized applications without the need to deploy any additional services or software. It also boosts the Swarm cluster scalability, and provides true portability whether deployed to a public cloud or to an in-house data center. Weave furthermore, eliminates the need for an [ambassador pattern linking](https://docs.docker.com/engine/admin/ambassador_pattern_linking/), or any other approach that might involve some combination of distributed configuration store and a proxy.

This example requires no programming, but it does require basic UNIX skills.

This tutorial will take approximately 15-25 minutes to complete.

##What You Will Use

  - [Weave](http://weave.works)
  - [Docker, Swarm & Machine](http://docker.com)

##What You Need to Complete Part 2

If you are using OS X or Windows, then install [Docker Toolbox](https://www.docker.com/toolbox), which provides all of the tools you need to complete this guide.

For all other operating systems, install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at least the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

If you completed [Part 1][ch1],then all of these dependencies should already be installed.

##Cloning the Guides Repo and Installing Weave Net

If you didn't complete [Part 1][ch1], then clone the guides directory: 

~~~bash
git clone https://github.com/weaveworks/guides
~~~

and cd to the `weave-and-docker-platform` directory. 

##Installing Weave Net

Download the latest version of `weave`. If you do not have ownership of the `/usr/local/bin` directory, you may need to preface the commands with `sudo`:

~~~bash
curl -L git.io/weave -o /usr/local/bin/weave
chmod a+x /usr/local/bin/weave
~~~


###How This Guide is Organized

This guide describes how to provision a cluster on the command line manually. If you prefer to jump ahead and see Weave Net in action, then refer to [Automating Cluster Provisioning ](#automate-cluster), where several helpful shell scripts are provided that automates this entire process.

But if you prefer to work through setting up a swarm and to use Weave Net, then see the following topics: 

  * [Workflow for Setting up a Swarm](#work-order)
  * [Generate the Discovery Swarm Token](#swarm-token)
  * [Create the VMs and Set Up the Swarm](#create-vms)
  * [Connecting the Cluster with Weave Net: Initializing Peers](#connect-cluster)
  * [Setting up Swarm Agents to Use the Weave Docker API Proxy](#swarm-agents-proxy)
  * [Deploying Containers and Testing the Weave Network](#deploy-agents-proxy)
  * [Automating Cluster Provisioning](#automate-cluster)


##<a name="work-order"></a>Workflow for Setting up a Swarm

Among the three VMs to be provisioned, choose one that will act as the Swarm master. In this example, we refer to `weave-1` as the head or the bootstrap node. Keep in mind that Weave Net has no specific knowledge of a Swarm master and its agents, and you can deploy your network in whatever topology you choose. But for the purposes of this example, `weave-1` acts as the bootstrap node which provides the initial configuration information for any newly joining nodes.

The workflow is as follows:

  1. Generate a Discovery Swarm token. 
  2. create `weave-1` as a Swarm master
  3. create `weave-2` as a Swarm agent
  4. create `weave-3` as a Swarm agent

The swarm discovery token is a unique cluster ID. Normally this token is created after the hosts have been provisioned, and you are about to define the Swarm, but since this is a sandbox scenario that uses Virtualbox, the token is generated beforehand, so that it can be used as a command line option during the VM creation. 

For more information see the [Docker Swarm Documentation](https://docs.docker.com/swarm/install-w-machine/). 


##<a name="swarm-token"></a>Generate the Swarm Discovery Token

There are a two ways to generate the token, one is after the VMs have been created, which requires a Swarm image to be downloaded which is then used to generate the token, and the other, generates it from a discovery service website, and returns it via curl. This example uses the latter, (which incidently is not recommended for production).

Generate a token with:

~~~bash
curl -s -XPOST https://discovery.hub.docker.com/v1/clusters
~~~

Copy the discovery token somewhere, you will need it when you are creating the virtual machines and the swarm.

See [Create a Swarm Discovery Token](https://docs.docker.com/swarm/install-w-machine/#create-a-swarm-discovery-token)

##<a name="create-vms"></a>Create the VMs and Set Up the Swarm

Using the Swarm Discovery Token you just generated, you will create the machines and also set up the structure for Docker Swarm. 

To create the bootstrap node,  `weave-1`: 

~~~bash
docker-machine create --driver virtualbox weave-1  --swarm-discovery=token://<generated-discovery-token> --swarm-master
~~~

Then create the other 2 VMs: 

~~~bash
docker-machine create --driver virtualbox --swarm --swarm-discovery=token://<generated-discovery-token> weave-2
~~~

~~~bash
docker-machine create --driver virtualbox --swarm --swarm-discovery=token://<generated-discovery-token> weave-3
~~~

Where, 

 * --swarm-discovery=token://<generated-discovery-token> is the token you [generated](#swarm-token) for this swarm
 * --swarm-master is the head node or the boostrapping node (and only applies to the bootstrap node, weave-1)


##<a name="connect-cluster"></a>Connecting the Cluster with Weave Net: Initializing Peers

Next launch Weave Net onto the virtual machines you just created and connect the nodes together in a Swarm. 

Since the IP addresses of all the peers are not known ahead of time, so you will need to pass `--ipalloc-init consensus=<count>` to `weave launch`. The `--ipalloc-init consensus=<count>` option establishes a quorum of peers based on the number of peers entered. 

>**Note:** You could also pass all of the IPs or DNS names to `weave launch` and avoid having to set the <code>--ipalloc-init consensus=<count></code> explicitly. 

Other ways to initialize peers use the options `seed` or `observer`. With the `seed` option, you provide a list of peer names that share the same address space. Whereas the `observer` option can be used on one or more peers in a cluster, and enables them to be changed or added to a fixed cluster without having to worry about re-adjusting your total peer counts.

For more information, see ["Initializing Peers on a Network"](https://www.weave.works/docs/net/latest/ipam/#initialization)

>**Important!** Docker Machine is being used on VirtualBox where IP addresses are not known in advance. Therefore this example is not using weaveDNS for peer discovery. You should however be able to use weaveDNS to discover peers with any one of the cloud drivers, such as Microsoft Azure or Google Compute Engine.

The `consensus` option, used in this example, allows Weave Net to determine the seed automatically via a consensus algorithm. For Weave Net to reliably form a reliable single consensus, you must tell each peer how many peers there are in total. In this example there are 3 peers.

On each host, you will:

  1. Launch Weave Net by passing the `--ipalloc-init consensus=3` option.
  2. Connect each host to the bootstrap node,  `weave-1`.

To launch Weave Net on `weave-1` run the following:

~~~bash
eval "$(docker-machine env weave-1)"
weave launch --ipalloc-init consensus=3
~~~

Next, launch Weave Net on `weave-2` and connect it to the bootstrap node:

~~~bash
eval "$(docker-machine env weave-2)"
weave launch --ipalloc-init consensus=3
weave connect "$(docker-machine ip weave-1)"
~~~

Follow the same steps for `weave-3` as you did for `weave-2`, 
and also connect it to the `weave-1` bootstrap node. 

Check to see that Weave Net is all set up as expected and that all nodes are peered:

~~~bash
weave status
~~~

Where you should see `Connections: 2 (2 established)` and `Peers: 3 (with 6 established connections)` in the Connections and Peers sections of `weave status`. 

To see that everything is setup properly run `docker-machine ls`:

    NAME      ACTIVE   DRIVER       STATE     URL                         SWARM
    weave-1            virtualbox   Running   tcp://192.168.99.129:2376   weave-1 (master)
    weave-2            virtualbox   Running   tcp://192.168.99.130:2376   weave-1
    weave-3   *        virtualbox   Running   tcp://192.168.99.131:2376   weave-1


And finally, check that all nodes are in a Swarm by running `docker `docker-machine config --swarm weave-1` info`:

     Containers: 26
     Images: 17
     Server Version: swarm/1.2.3
     Role: primary
     Strategy: spread
     Filters: health, port, containerslots, dependency, affinity, constraint
     Nodes: 3
     weave-1: 192.168.99.100:12375
      └ ID: 7IUX:7TQQ:SVMV:FVPK:TS4A:7ZGF:2UNK:CHRH:HHVP:I4JF:5PI5:RUNF
      └ Status: Healthy
      └ Containers: 9
      └ Reserved CPUs: 0 / 1
      └ Reserved Memory: 0 B / 1.021 GiB
     weave-2: 192.168.99.101:12375
      └ ID: SIF4:K2P2:GKTV:632D:GVBX:IZ76:4Q2I:SS6Z:LGRM:O2OY:JUG4:6JLT
      └ Status: Healthy
      └ Containers: 9
      └ Reserved CPUs: 0 / 1
      └ Reserved Memory: 0 B / 1.021 GiB
     weave-3: 192.168.99.103:12375
      └ ID: JFUK:42JN:P3GL:MOOO:OITX:PI4C:NPGP:5RSC:SCII:TYXC:KJK2:BZDD
      └ Status: Healthy
      └ Containers: 8
      └ Reserved CPUs: 0 / 1
      └ Reserved Memory: 0 B / 1.021 GiB

##<a name="swarm-agents-proxy"></a>Setting up Swarm Agents to Use the Weave Docker API Proxy

This next step is a necessary work-around to a reported Docker Machine issue, which we will refrain from covering in detail. Refer to  [issue #1334 in Docker Machine](https://github.com/docker/machine/issues/1334) for more information.  In short, the swarm agents are restarted with a new discovery token and then registered to TCP port 12375 for the `Docker API Proxy`. The following script [`scripts/3-replace-swarm-agents.sh`][step3] describes this process in more detail.

##<a name="deploy-agents-proxy"></a>Deploying Containers and Testing the Weave Network

Before deploying containers to the Weave Net, ensure that the environment for the Weave Docker API Proxy is setup by 
running: 

~~~bash
eval "$(weave env)"
~~~

The Docker API Proxy allows you to use standard Docker commands to attach containers to the Weave network and assign IP addresses to them. An alternative way to attach containers to the Weave network is by using the Docker Plugin [(for Docker >= 1.9)]((/docs/net/latest/plugin/). Here you are using the Weave Docker API Proxy to attach containers (which is the preferred method). 

###Testing the Weave Network

Deploy the _"Hello, Weave!"_ container:

    > docker `docker-machine config --swarm weave-1` run -d --name=pingme \
        gliderlabs/alpine nc -p 4000 -ll -e echo 'Hello, Weave!'
    df8bb89d048abce4f9ed25259072ac6c177ebdae708222662325603ef4ec4a78

Confirm that there is a transparent multi-host setup, and then check that the test container `pinger`
is not running on the same host as `pingme`. 

This can be checked by setting the Swarm affinity constraint with `-e 'affinity:container!=pingme'`.

    > docker `docker-machine config --swarm weave-1` run -e 'affinity:container!=pingme' --name=pinger -ti \
        gliderlabs/alpine sh -l

Now repeat the test using the `ping` and `nc` commands:.

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

Before tearing down these two running containers, confirm that the containers are in fact running on two different VMs.

In a new terminal window run:

    > docker `docker-machine config --swarm weave-1` ps | grep alpine
    aa5ae81e5cf4      gliderlabs/alpine:latest    "/w/w sh -l"          7 minutes ago   Up 7 minutes   weave-2/pinger
    df8bb89d048a      gliderlabs/alpine:latest    "/w/w nc -p 4000 -lk  6 minutes ago   Up 6 minutes   weave-3/pingme

and as you can see, the hostnames of our VMs appear in the last column, i.e. `weave-2/pinger` and `weave-3/pingme`.

Now exit the test container:

    pinger:/# exit

Since everything worked as expected, you can get rid of both containers by running:

    > docker `docker-machine config --swarm weave-1` rm -f pingme pinger
    pingme
    pinger

##<a name="automate-cluster"></a>Automating Cluster Provisioning

Change to the scripts directory:

    cd ./guides/weave-and-docker-platform/scripts

Now that you understand how this is provisioned, the whole process can be automated by running these 3 scripts:

    ./1-machine-create.sh
    ./2-weave-launch.sh
    ./3-replace-swarm-agents.sh


## Cleanup

Unless you proceed to [Part 3 Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave][ch3] right away, you may want to remove the VMs that were created:

    docker-machine rm -f weave-1 weave-2 weave-3

## Summary

You have learned how to use Weave Net with Docker Machine and Swarm to provision a miniature infrastructure of three virtual machines running on VirtualBox and [Weave Net](/net) providing connectivity for Docker containers. A simple _"Hello, Weave!"_ service was deployed and tested. Most importantly, you should now know all the commands to create a cluster of Docker hosts and also understand how to integrate Weave Net and Docker Swarm to proceed to the next step with confidence. Next you will learn how to use Compose to deploy an entire stack of containers to a Swarm cluster all powered by [Weave Net](/net).

Proceed to In [Part 3 "Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave"](/part-3-creating-and-scaling-multi-host-docker-deployment-with-swarm-and-compose-using-weave/). 

Send us your thoughts or issues via [Help and Support](http://weave.works/help/index.html).

##Further Reading

  *  [How Weave Works](/docs/net/latest/how-it-works/)
  *  [Allocating IP Addresses](/docs/net/latest/ipam/)
  *  [Integrating Docker via the Network Plugin](/docs/net/latest/plugin/)
  *  [Operations Guide](https://www.weave.works/docs/net/latest/operational-guide/concepts/)

[step1]: https://github.com/weaveworks/guides/blob/30afe999265ad18494f3a88064f70cac1edc9607/weave-and-docker-platform/scripts/1-machine-create.sh
[step2]: https://github.com/weaveworks/guides/blob/30afe999265ad18494f3a88064f70cac1edc9607/weave-and-docker-platform/scripts/2-weave-launch.sh
[step3]: https://github.com/weaveworks/guides/blob/30afe999265ad18494f3a88064f70cac1edc9607/weave-and-docker-platform/scripts/3-replace-swarm-agents.sh

[ch1]: /part-1-launching-weave-net-with-docker-machine/
[ch2]: /part-2-using-weave-with-docker-machine-and-swarm/
[ch3]: /part-3-creating-and-scaling-multi-host-docker-deployment-with-swarm-and-compose-using-weave/
