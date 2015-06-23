# Getting started with Weave and Docker on Ubuntu #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will be creating a simple application running in a container on one host. Your service provides a JSON message containing hello world and a date - we call this your hello world service. In your second container, running on a seperate host, you use curl to query the hello world service.

![Weave and Docker](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/Simple_Weave.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker and Ubuntu, and we make use of VirtualBox and Vagrant to allow you to run the entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

## Setting up our hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

```bash
git clone http://github.com/weaveworks/guides
```

You will use vagrant to setup and configure two Ubuntu hosts and install Docker. These hosts will be assigned IP addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named `weave-gs-01` and `weave-gs-02`.

```bash
cd guides/ubuntu-simple
vagrant up
```

Vagrant will pull down and configure an ubuntu image, this may take a few minutes depending on the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated during the Vagrant setup, please just hit return at this point.

Once the setup of the hosts is complete you can check their status with

```bash
vagrant status
```

The IP addresses we use for this demo are

```bash
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-02
```

## Installing Weave ##

Now you install Weave on each host.

```bash
vagrant ssh weave-gs-01
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod a+x /usr/local/bin/weave

vagrant ssh weave-gs-02
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod a+x /usr/local/bin/weave
```

We provide the commands to install Weave as part of this getting started guide, but in practice you would automate this step.

## Using Weave ##

Next you start Weave on each host in turn.

On host `weave-gs-01`

```bash
sudo weave launch
sudo weave launch-dns
```

On host `weave-gs-02`

```bash
sudo weave launch 172.17.8.101
sudo weave launch-dns
```

Your two hosts are now connected to each other, and any subsequent containers you launch with Weave will be visible to other containers Weave is aware of.

### What has happened? ###

As this is the first time you have launched Weave you

* downloaded a docker image for the Weave router container
* launched that container

On your first host, `weave-gs-01`, you have launched a Weave router container. On your second host, `weave-gs-02`, you launched another Weave router container with the IP address of your first host. This command tells the Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

At this point you have a single container running on each host, which you can see from docker. On either host run

```bash
sudo docker ps
```

and you will see something similar to

```bash
CONTAINER ID        IMAGE                       COMMAND                CREATED             STATUS              PORTS                                            NAMES
e3fba94a35fc        weaveworks/weavedns:1.0.1   "/home/weave/weavedn   57 seconds ago      Up 56 seconds       10.1.42.1:53->53/udp                             weavedns            
dd3878af6307        weaveworks/weave:1.0.1      "/home/weave/weaver    16 minutes ago      Up 16 minutes       0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave  
```
You can see your peered network by using `weave status`

```bash
sudo weave status
```

```bash
weave router 1.0.1
Our name is b2:6d:8c:74:4a:31(weave-gs-01)
Encryption off
Peer discovery on
Sniffing traffic on &{10 65535 ethwe 36:bd:bd:11:79:43 up|broadcast|multicast}
MACs:
b6:66:e6:8a:c4:3e -> aa:3c:6c:5f:fa:31(weave-gs-02) (2015-06-23 09:50:46.840569861 +0000 UTC)
4e:60:c7:bd:20:0c -> b2:6d:8c:74:4a:31(weave-gs-01) (2015-06-23 09:51:15.181934617 +0000 UTC)
2a:c2:80:3e:5c:db -> b2:6d:8c:74:4a:31(weave-gs-01) (2015-06-23 09:48:07.853429348 +0000 UTC)
aa:3c:6c:5f:fa:31 -> aa:3c:6c:5f:fa:31(weave-gs-02) (2015-06-23 09:50:46.368725659 +0000 UTC)
Peers:
b2:6d:8c:74:4a:31(weave-gs-01) (v2) (UID 10617824048609415185)
   -> aa:3c:6c:5f:fa:31(weave-gs-02) [172.17.8.102:36982]
aa:3c:6c:5f:fa:31(weave-gs-02) (v2) (UID 17525028717806349409)
   -> b2:6d:8c:74:4a:31(weave-gs-01) [172.17.8.101:6783]
Routes:
unicast:
b2:6d:8c:74:4a:31 -> 00:00:00:00:00:00
aa:3c:6c:5f:fa:31 -> aa:3c:6c:5f:fa:31
broadcast:
b2:6d:8c:74:4a:31 -> [aa:3c:6c:5f:fa:31]
aa:3c:6c:5f:fa:31 -> []
Direct Peers:
Reconnects:

Allocator range [10.128.0.0-10.192.0.0)
Owned Ranges:
  10.128.0.0 -> b2:6d:8c:74:4a:31 (weave-gs-01) (v3)
Allocator default subnet: 10.128.0.0/10

weave DNS 1.0.1
Listen address :53
Fallback DNS config &{[10.0.2.3] [overplay] 53 1 5 2}

Local domain weave.local.
Interface &{18 65535 ethwe 4e:60:c7:bd:20:0c up|broadcast|multicast}
Zone database:
```

## Our Hello World Service ##

Next you will use Weave to run a Docker image containing an Apache webserver.  Details on how this container was created using docker are available [here](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/DockerfileREADME.md).

On `weave-gs-01` run

```bash
sudo weave run --name=web1 -t -i fintanr/weave-gs-simple-hw
```

At this point you have a running Apache server in a Docker container.

### What has happened?

Weave has launched a pre-built Docker image containing an Apache
webserver, given it the name "web1", and assigned it an IP
address. The Docker image you are using has been downloaded from the
[Docker Hub](https://hub.docker.com/).

The container is registered with Weave and is accessible to other containers registered with Weave across multiple hosts.

### Creating our client container

Next you want to create a container on your second host and connect to the webserver in the container on our first host. We will use another prebuilt container, `fintanr/weave-gs-ubuntu-curl` for this example. Containers return a container ID which you will capture to use further on in this example. On `weave-gs-02` run

```bash
CONTAINER=`sudo weave run -t -i fintanr/weave-gs-ubuntu-curl`
```
The Ubuntu Docker image you are using here is the same image that we based our Apache Docker image on,
with the addition of curl.

First attach to your Docker container using the `CONTAINER` value we captured earlier

```bash
sudo docker attach $CONTAINER
```

```bash
curl http://web1
```

And you will see a JSON string similar too

```javascript
{
    "message" : "Hello World",
    "date" : "2015-02-16 15:02:57"
}
```

Now you can exit from the container. As you have finished the command that the container was running (in this case `/bin/bash`) the container also exits.

## Summary ##

You have now used Weave to quickly deploy an application across two hosts using containers.
