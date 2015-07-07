# Load Balancing Using Weave #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example we will demonstrate how Weave allows you to quickly and easily deploy a 
simple load blancing solution using Weave and WeaveDNS, with no modifications to your
application and minimal docker knowledge. 

We will run a very simple go based rest server which shows the IP address of each container
to demonstrate our use of round robin DNS.

![Simple Loadbalancing with Weave](https://github.com/weaveworks/guides/blob/master/weave-loadbalance/Weave_LoadBalance.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)
* [Vagrant](http://vagrantup.com)
* [Git](http://git-scm.com/downloads)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker and Ubuntu, and we make use of VirtualBox and Vagrant to allow you to run this entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

## What you will do ##

You will use Weave to

* Load balance six containers across three hosts on a Weave network

## Configuring and setting up your hosts ## 

All of the code for this example is available on [github](http://github.com/weaveworks/buides), and you first clone the getting started repository.

```bash
git clone http://github.com/weaveworks/guides
```

You will use Vagrant to setup and configure two Ubuntu hosts and install Docker. We make use of Vagrant's functionality to download the base docker images we will be using, and we then install Weave. If you would like to work through the installation steps please review our [getting started guide](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/README.md) for a more manual example.

```bash
cd guides/weave-loadbalance
vagrant up
```

Vagrant will pull down and configure an Ubuntu image, this may take a few minutes depending on the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com). If you are thinking about a cup of coffee, now may be a good point to get one.

Once the setup of the hosts is complete you can check their status with

```bash
vagrant status
```

The IP addresses we use for this demo are

```bash
172.17.8.101    weave-gs-01
172.17.8.102    weave-gs-02
```

## Introducing WeaveDNS ##

[WeaveDNS](http://docs.weave.works/weave/latest_release/weavedns.html) answers name queries in a Weave network. WeaveDNS provides a simple way for containers to find each other: just give them hostnames and tell other containers to connect to those names. 

## Introducting Weave Automatic IP Address Management ##

[Weave Automatic IP Address Management (IPAM)](http://docs.weave.works/weave/latest_release/ipam.html) automatically assigns containers IP addresses that are unique across the network. Weave IPAM allows you to easily add more containers
to your network and takes care of ensuring each container has a unique IP so you don't have too.  

## Launching Weave for our example ##

In order to start our example we first first lauch Weave and WeaveDNS on all of our hosts. Take note of the `-iprange` option we pass to Weave, which enables Weaves Automatic IP Address Management (IPAM) functionality on a specific subnet. 

```bash
vagrant ssh weave-gs-01 
weave launch -iprange 10.2.0.1/16    
```

```bash
vagrant ssh weave-gs-02 
weave launch -iprange 10.2.0.1/16 172.17.8.101    
```

```bash
vagrant ssh weave-gs-01
weave launch-dns; weave launch-proxy
```

```bash
vagrant ssh weave-gs-02
weave launch-dns; weave launch-proxy
```

Alternatively you can use the script `setup-weave.sh`.  

## What has happened ##

At this point you have launched Weave on all your hosts, and created an overlay network which also provides DNS.

Logging into any of the hosts and typing `weave status` will give you output similar to below

```bash
vagrant ssh weave-gs-01
weave status 
weave router 1.0.1
Our name is 42:02:a2:d8:14:cb(weave-gs-01)
Encryption off
Peer discovery on
Sniffing traffic on &{10 65535 ethwe a6:a1:f3:34:16:43 up|broadcast|multicast}
MACs:
42:02:a2:d8:14:cb -> 42:02:a2:d8:14:cb(weave-gs-01) (2015-06-26 11:09:13.283350945 +0000 UTC)
0e:60:68:23:d6:49 -> 0e:60:68:23:d6:49(weave-gs-02) (2015-06-26 11:09:21.796326941 +0000 UTC)
82:f7:77:38:5d:6c -> 0e:60:68:23:d6:49(weave-gs-02) (2015-06-26 11:09:21.931415654 +0000 UTC)
86:af:aa:89:7e:97 -> 42:02:a2:d8:14:cb(weave-gs-01) (2015-06-26 11:09:26.795301866 +0000 UTC)
2e:01:bf:c8:e6:49 -> 0e:60:68:23:d6:49(weave-gs-02) (2015-06-26 11:09:33.34108255 +0000 UTC)
a6:a1:f3:34:16:43 -> 42:02:a2:d8:14:cb(weave-gs-01) (2015-06-26 11:09:13.102604533 +0000 UTC)
b2:49:04:f3:e1:8c -> 42:02:a2:d8:14:cb(weave-gs-01) (2015-06-26 11:09:13.246159386 +0000 UTC)
Peers:
42:02:a2:d8:14:cb(weave-gs-01) (v2) (UID 11753500133695043494)
   -> 0e:60:68:23:d6:49(weave-gs-02) [172.17.8.102:45163]
0e:60:68:23:d6:49(weave-gs-02) (v2) (UID 10284882779670453037)
   -> 42:02:a2:d8:14:cb(weave-gs-01) [172.17.8.101:6783]
Routes:
unicast:
42:02:a2:d8:14:cb -> 00:00:00:00:00:00
0e:60:68:23:d6:49 -> 0e:60:68:23:d6:49
broadcast:
42:02:a2:d8:14:cb -> [0e:60:68:23:d6:49]
0e:60:68:23:d6:49 -> []
Direct Peers:
Reconnects:

Allocator range [10.2.0.0-10.3.0.0)
Owned Ranges:
  10.2.0.0 -> 42:02:a2:d8:14:cb (weave-gs-01) (v3)
  10.2.128.0 -> 0e:60:68:23:d6:49 (weave-gs-02) (v1)
  10.2.255.255 -> 42:02:a2:d8:14:cb (weave-gs-01) (v0)
Allocator default subnet: 10.2.0.0/16

weave DNS 1.0.1
Listen address :53
Fallback DNS config &{[10.0.2.3] [overplay] 53 1 5 2}

Local domain weave.local.
Interface &{14 65535 ethwe 86:af:aa:89:7e:97 up|broadcast|multicast}
Zone database:


weave proxy is running
```

## Launching our Containers ##

Next we launch our containers on each host. Our containers contain a very simple rest server
which will return the ip address of the containers on the Weave network.  

As we have enabled both WeaveDNS and Weaves Automatic IP Address Management we only need to provide
the name of our container and the hostname we wish to use. You will notice that we use the same
hostname on each container. WeaveDNS automatically detects this DNS requests

```bash
vagrant ssh weave-gs-01
eval $(weave proxy-env)
docker run -d -h lb.weave.local fintanr/myip-scratch 
docker run -d -h lb.weave.local fintanr/myip-scratch 
docker run -d -h lb.weave.local fintanr/myip-scratch 
```

```bash
vagrant ssh weave-gs-02
eval $(weave proxy-env)
docker run -d -h lb.weave.local fintanr/myip-scratch 
docker run -d -h lb.weave.local fintanr/myip-scratch 
docker run -d -h lb.weave.local fintanr/myip-scratch 
```

Alternatively you can use the script `launch-demo-containers.sh` to launch.

## What has happened ##

At this point you have launched six instances of our service, they have all
been allocated IP addresses and appear to other applications as a single endpoint. 

## Connecting to your application ##

Next we will launch a container curl on the same network, and from there

```bash
vagrant ssh weave-gs-01
eval $(weave proxy-env)
CONTAINER=$(docker run -d -ti -h ubuntu.weave.local fintanr/weave-gs-ubuntu-curl)
docker exec -ti $CONTAINER "/bin/bash"
``` 

In this container lets connect to our endpoint, and make a request to our myip service.

```bash
for i in `seq 1 20`; do curl lb.weave.local/myip; done
```

This will give you output such as

```bash
root@81fc16c65cbd:/# for i in `seq 1 20`; do curl lb.weave.local/myip; done
10.2.0.7
fe80::f049:33ff:fe82:63ad

10.2.0.2
fe80::8037:a3ff:fe19:dd61

10.2.0.8
fe80::240e:48ff:fe32:d4f7

10.2.0.4
fe80::acdf:29ff:fe28:f3ae
....
````

## Summary ##

You have used Weave and Docker to deploy a simple load balanced application.
