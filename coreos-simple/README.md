# Getting started with Weave and Docker on CoreOS #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will be creating a simple application running in a container on one host. Your service provides a JSON message containing hello world and a date - we call this your hello world service. In your second container, running on a seperate host, you use curl to query the hello world service.

![Weave and Docker](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/Simple_Weave.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [CoreOS](http://coreos.com)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker and CoreOS, and we make use of VirtualBox and Vagrant to allow you to run the entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)


## A Note on CoreOS ##

CoreOS is one of a new breed of Linux distributions, primarily aimed at running container solutions such as 
[Docker](http://docker.com) and [Rocket](https://github.com/coreos/rocket). Emerging distributions in this space include
[Snappy](https://developer.ubuntu.com/en/snappy/) from [Canonical](http://canonical.com), [Project Atomic](http://www.projectatomic.io/) from [Redhat](http://redhat.com) and others.

CoreOS is not a general purpose operating system, and may feel somewhat alien if you are more accustomed to 
one of the more established distributions. If you feel more comfortable with a general purpose operating system 
you may prefer to follow our getting started guides on [Ubuntu](https://github.com/fintanr/weave-gs/blob/master/ubuntu-simple/README.md) or [CentOS](https://github.com/fintanr/weave-gs/blob/master/centos-simple/README.md).

## Setting up your hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

```bash
git clone http://github.com/fintanr/weave-gs
```

You will use vagrant to setup and configure two CoreOS hosts and install Weave. These hosts will be assigned IP addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named `weave-gs-01` and `weave-gs-02`.

```bash
cd weave-gs/coreos-simple
vagrant up
```

Vagrant will pull down and configure a CoreOS image, this may take a few minutes depending on  the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

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

## Installing Weave on CoreOS ##

When you run `vagrant up` the installation of weave is taken care of for you, but it is useful to understand
how this accomplished. CoreOS makes uses of of a "cloud-config" file to do various OS level configurations. You can 
read more about in the [CoreOS Using Cloud Config](https://coreos.com/docs/cluster-management/setup/cloudinit-cloud-config/)
document. 

To install Weave we use a feature of the CoreOS cloud config files called "units" to create a systemd unit which
installs weave. You can review the cloud-config file we used [here](https://github.com/fintanr/weave-gs/blob/master/coreos-simple/user-data). Systemd is outside the scope of this document, for more information please review [Getting Started With
systemd](https://coreos.com/docs/launching-containers/launching/getting-started-with-systemd/).     
 
## Using Weave ##

Next you start Weave on each host in turn.

On host `weave-gs-01`

```bash
sudo weave launch
```

On host `weave-gs-02`

```bash
sudo weave launch 172.17.8.101
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
CONTAINER ID        IMAGE                COMMAND                CREATED             STATUS              PORTS                                            NAMES
52bbb9eee7aa        zettio/weave:0.9.0   "/home/weave/weaver    29 seconds ago      Up 28 seconds       0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave  
```
You can see your peered network by using `weave status`

```bash
sudo weave status
```
```bash
weave router 0.9.0
Encryption off
Our name is 7a:6c:f3:f3:ae:ff
Sniffing traffic on &{10 65535 ethwe e2:50:86:f5:27:91 up|broadcast|multicast}
MACs:
aa:04:03:5a:c0:0a -> 7a:6c:f3:f3:ae:ff (2015-02-27 17:23:29.336971738 +0000 UTC)
e2:50:86:f5:27:91 -> 7a:6c:f3:f3:ae:ff (2015-02-27 17:23:27.951086308 +0000 UTC)
7a:6c:f3:f3:ae:ff -> 7a:6c:f3:f3:ae:ff (2015-02-27 17:23:28.397837633 +0000 UTC)
Peers:
Peer 7a:6c:f3:f3:ae:ff (v2) (UID 15834305660056266284)
   -> 7a:87:55:81:55:c9 [172.17.8.101:6783]
Peer 7a:87:55:81:55:c9 (v2) (UID 7370780921418713878)
   -> 7a:6c:f3:f3:ae:ff [172.17.8.102:42087]
Routes:
unicast:
7a:87:55:81:55:c9 -> 7a:87:55:81:55:c9
7a:6c:f3:f3:ae:ff -> 00:00:00:00:00:00
broadcast:
7a:6c:f3:f3:ae:ff -> [7a:87:55:81:55:c9]
7a:87:55:81:55:c9 -> []
Reconnects:
```

## Our Hello World Service ##

Next you will use Weave to run a Docker image containing an Apache webserver. The container you will use
in this example was built for our [Getting started with Weave and Docker on Ubuntu guide](), and is derived 
from an Ubuntu container. If you would like  

On `weave-gs-01` run

```bash
sudo weave run 10.0.1.1/24 -t -i fintanr/weave-gs-simple-hw
```

At this point you have a running Apache server in a Docker container based on Ubuntu.

### What has happened?

Weave has launched a pre-built Docker container containing an Apache webserver, and assigned it an address of `10.0.1.1`. The Docker image you are using has been downloaded from the [Docker Hub](https://hub.docker.com/).

The container is registered with Weave and is accessible to other containers registered with Weave across multiple hosts.

### Creating our client container

You now want to create a container on your second host and connect to the webserver in the container on our first host. 
We will use a container we created for our [Getting startedi with Weave and Docker on CentOS guide](). Containers return a container ID which you will capture to use further on in this example. On `weave-gs-02` run

```bash
CONTAINER=`sudo weave run 10.0.1.2/24 -t -i fintanr/weave-gs-centos-bash`
```

Now you attach to your docker container using the `CONTAINER` value we captured earlier, and run a curl command to connect to your hello world service.

```bash
sudo docker attach $CONTAINER
```

```bash
curl http://10.0.1.1
```

And you will see a JSON string similar too

```javascript
{
    "message" : "Hello World",
    "date" : "2015-02-27 17:30:51"
}
```

Now you can exit from the container. As you have finished the command that the container was running (in this case `/bin/bash`) the container also exits.

## Summary ##

You have now used Weave to quickly deploy an application across two hosts using containers on CoreOS.

## Credits ##

This example is derived in part from the [basic weave example](https://github.com/errordeveloper/weave-demos/tree/master/basic-weave-example) by [Ilya Dmitrichenko](http://github.com/errordeveloper).
