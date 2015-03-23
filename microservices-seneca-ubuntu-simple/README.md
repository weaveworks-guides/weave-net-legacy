# Microservices with Weave, Docker and node.js on Ubuntu #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will create a containerized set of microservices in a commonly used 
toolkit for building microservices in [node.js](http://nodejs.org), [Seneca](http://senecajs.org/). 
The example you will use here is derived from the Seneca microservices example available on 
[github](https://github.com/rjrodger/seneca-examples/tree/master/micro-services).

![Weave, Microservices and Docker](https://github.com/fintanr/weave-gs/blob/master/microservices-seneca-ubuntu-simple/Microservices_Seneca_Weave.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Seneca](http://senecajs.org)
* [node.js](http://nodejs.org)
* [Ubuntu](http://ubuntu.com)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker, node.js and Ubuntu, and we make use of VirtualBox and Vagrant to allow you to run the entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

## A Note on Microservices ##

Microservices have emerged as a development pattern in recent times, with companies such as Netfilx, Hubspot
and OpenTable adopting the approach. But what are Microservices?

A formal definition is hard to come by, but the definitions we have found to be most useful are

* Microservices are an approach to developing a single application as a suite of small, connected, services ([Martin Fowler](https://twitter.com/martinfowler))
* Microservices are loosely coupled service orientated architecture with bounded contexts ([Adrian Cockcroft](https://twitter.com/adrianco))
* Microservices are small automonous services that work well together ([Sam Newman](https://twitter.com/samnewman))

The common thread you see in all of these definitions is that of small simple services that do one thing very well, and
can be easily combined together. People frequently cite [The Unix Philosophy](http://en.wikipedia.org/wiki/Unix_philosophy)
of small, composable tools when describing Microservices.     

A discussion on why you should use Microservices is beyond the scope of this guide, but you can read a lot more in
articles and presentations by [Martin Fowler and James Lewis](http://martinfowler.com/articles/microservices.html), [Adrian Cockcroft](http://www.slideshare.net/adriancockcroft/dockercon-state-of-the-art-in-microservices) and in the book [Building Microservices](http://shop.oreilly.com/product/0636920033158.do) by Sam Newman.
  
## Setting up our hosts ##

All of the code for this example is available on [github](http://github.com/fintanr/weave-gs/microservices-seneca-ubuntu-simple), and you first clone the getting started repository.

```bash
git clone http://github.com/fintanr/weave-gs
```

You will use Vagrant to setup and configure an Ubuntu host and install Docker. We make use of Vagrant's functionality to download the base docker images we will be using, and we then install Weave. If you would like to work through the installation steps please review our [hello world getting started guide](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/README.md) for a more manual example.

```bash
cd weave-gs/microservices-seneca-ubuntu-simple
vagrant up
```

Vagrant will pull down and configure an ubuntu image, this may take a few minutes depending on  the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

Once the setup of the hosts is complete you can check their status with

```bash
vagrant status
```

The IP addresses we use for this demo are

```bash
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-01
```

Our Vagrantfile also configures weave-gs-01 to pass traffic from port 80 to localhost port 8080.

## Introducing WeaveDNS ##

[WeaveDNS](https://github.com/zettio/weave/tree/master/weavedns#readme) answers name queries in a Weave network. WeaveDNS provides a simple way for containers to find each other: just give them hostnames and tell other containers to connect to those names. Unlike Docker 'links', this requires no code changes and works across hosts.

In this example we have modified the seneca example code to refer to hostnames. You will be giving each container a hostname and use WeaveDNS to to find the correct container for a request.

## Launching our demo application ##

We have provided a script to launch our containers, and the steps to do it manually are included below.

```bash
./launch-senca-demo.sh
```

If you would prefer to launch things manually, follow the steps below

Firstly launch Weave and WeaveDNS on each host

```bash
vagrant ssh weave-gs-01
sudo weave launch
sudo weave launch-dns 10.2.1.1/24
```

```bash
vagrant ssh weave-gs-02
sudo weave launch 172.17.8.101
sudo weave launch-dns 10.2.1.2/24
```

Next we start our node.js application 
 
```bash
vagrant ssh weave-gs-02
sudo weave run --with-dns 10.3.1.2/24 -h user.weave.local fintanr/seneca_user
```

```bash
vagrant ssh weave-gs-01
sudo weave run --with-dns 10.3.1.1/24 -h offer.weave.local fintanr/seneca_offer
sudo weave run --with-dns 10.3.1.3/24 -p 80:80 -h web.weave.local fintanr/seneca_webapp
```

### What has happened? ###

As this is the first time you have launched Weave you

* downloaded a docker image for the Weave router container
* launched that container

On your first host, `weave-gs-01`, you have launched a Weave router container. On your second host, `weave-gs-02`, you launched another Weave router container with the IP address of your first host. This command tells the Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

You then launched the node.js application 

At this point you have a single container running on each host, which you can see from docker. On either host run

```bash
sudo docker ps
```

and you will see something similar to (on this case from weave-gs-01)

```bash
vagrant@weave-gs-01:~$ sudo docker ps
CONTAINER ID        IMAGE                          COMMAND                CREATED             STATUS              PORTS                                            NAMES
cef5f355e59b        fintanr/seneca_webapp:latest   "nodejs /opt/app/ser   2 minutes ago       Up 2 minutes        0.0.0.0:80->80/tcp                               sad_rosalind        
c1bade861820        fintanr/seneca_offer:latest    "nodejs /opt/app/ser   3 minutes ago       Up 3 minutes                                                         silly_goldstine     
6d3afd54681f        zettio/weavedns:0.9.0          "/home/weave/weavedn   3 minutes ago       Up 3 minutes        10.1.42.1:53->53/udp                             weavedns            
8864d666cf1e        zettio/weave:0.9.0             "/home/weave/weaver    3 minutes ago       Up 3 minutes        0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave   
```

You can see your peered network by using `weave status`

```bash
sudo weave status
```
```bash
vagrant@weave-gs-01:~$ sudo weave status
weave router 0.9.0
Encryption off
Our name is 7a:58:a4:8a:4c:f4
Sniffing traffic on &{26 65535 ethwe da:39:e5:93:41:f5 up|broadcast|multicast}
MACs:
da:39:e5:93:41:f5 -> 7a:58:a4:8a:4c:f4 (2015-03-23 17:45:23.101447546 +0000 UTC)
52:60:89:f0:60:1a -> 7a:58:a4:8a:4c:f4 (2015-03-23 17:45:23.315699612 +0000 UTC)
4a:35:8d:99:09:be -> 7a:58:a4:8a:4c:f4 (2015-03-23 17:45:30.53047339 +0000 UTC)
ce:e7:0e:d5:8f:06 -> 7a:69:dd:f8:b0:22 (2015-03-23 17:45:44.169875835 +0000 UTC)
d6:c0:27:ed:39:96 -> 7a:69:dd:f8:b0:22 (2015-03-23 17:45:49.97411692 +0000 UTC)
fe:58:7f:46:77:a5 -> 7a:58:a4:8a:4c:f4 (2015-03-23 17:45:57.577251193 +0000 UTC)
9e:90:49:2b:ae:1f -> 7a:69:dd:f8:b0:22 (2015-03-23 17:46:09.155057407 +0000 UTC)
f2:0e:09:74:88:fa -> 7a:58:a4:8a:4c:f4 (2015-03-23 17:46:15.974840611 +0000 UTC)
Peers:
Peer 7a:58:a4:8a:4c:f4 (v2) (UID 718236049010220522)
   -> 7a:69:dd:f8:b0:22 [172.17.8.102:58836]
Peer 7a:69:dd:f8:b0:22 (v2) (UID 9669953362032727155)
   -> 7a:58:a4:8a:4c:f4 [172.17.8.101:6783]
Routes:
unicast:
7a:58:a4:8a:4c:f4 -> 00:00:00:00:00:00
7a:69:dd:f8:b0:22 -> 7a:69:dd:f8:b0:22
broadcast:
7a:69:dd:f8:b0:22 -> []
7a:58:a4:8a:4c:f4 -> [7a:69:dd:f8:b0:22]
Reconnects:
```

## Our Microservices Example With Seneca ##

The example you are using has three microservices all running in containers. To test that the 
various services are up and running point your browser to [http://localhost:8080](http://localhost:8080). 
You will be greated with a login screen. Login with the username and password u1/U1.

The example itself is a very simple demonstration of how to use the Seneca framework, discussion of which 
is out of scope for this guide. For more details see the [http://senecajs.org/](Seneca website). 

Seneca is written in node.js, and the Dockerfiles used for building the containers in this guide are also 
included in our [github repo](). 

## Summary ##

You have now used Weave to quickly deploy a simple node.js microservices application using Docker containers.

## Credits ##

The seneca example code is adapted from Richard Rodger's of [Nearform](http://nearform.com) [Seneca Microservices example](https://github.com/rjrodger/seneca-examples).
