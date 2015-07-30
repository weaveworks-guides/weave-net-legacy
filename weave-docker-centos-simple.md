---
layout: guides
title: Getting started with Weave and Docker on CentOS
description: Getting started with Weave and Docker on CentOS
keywords: weave, docker, containers, networking, software defined networking, dockerfile, centos, apache, php
markdown: kramdown
highlighter: pygments
---


## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will be creating a simple application running in a container on one host. Your service provides a JSON message containing hello world and a date - we call this your hello world service. In your second container, running on a seperate host, you use curl to query the hello world service.

![Weave and Docker](Simple_Weave.png)


## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [CentOS](http://http://centos.org/)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker and CentOS, and we make use of VirtualBox and Vagrant to allow you to run the entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

## Setting up our hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

{% highlight bash %}
git clone http://github.com/weaveworks/guides
{% endhighlight %}

You will use vagrant to setup and configure two CentOS hosts and install Docker. These hosts will be assigned IP addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named `weave-gs-01` and `weave-gs-02`.

{% highlight bash %}
cd guides/centos-simple
vagrant up
{% endhighlight %}

Vagrant will pull down and configure an ubuntu image, this may take a few minutes depending on  the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated during the Vagrant setup, please just hit return at this point.

Once the setup of the hosts is complete you can check their status with

{% highlight bash %}
vagrant status
{% endhighlight %}

The IP addresses we use for this demo are

{% highlight bash %}
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-02
{% endhighlight %}

## Installing Weave ##

Now you install Weave on each host.

{% highlight bash %}
vagrant ssh weave-gs-01
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod a+x /usr/local/bin/weave

vagrant ssh weave-gs-02
sudo curl -L git.io/weave -o /usr/local/bin/weave
sudo chmod a+x /usr/local/bin/weave
{% endhighlight %}

We provide the commands to install Weave as part of this getting started guide, but in practice you would automate
this step.

## Using Weave ##

Next you start Weave on each host in turn.

On host `weave-gs-01`

{% highlight bash %}
sudo weave launch
{% endhighlight %}

On host `weave-gs-02`

{% highlight bash %}
sudo weave launch 172.17.8.101
{% endhighlight %}

Your two hosts are now connected to each other, and any subsequent containers you launch with Weave will be visible to other containers Weave is aware of.

### What has happened? ###

As this is the first time you have launched Weave you

* downloaded a docker image for the Weave router container
* launched that container

On your first host, `weave-gs-01`, you have launched a Weave router container. On your second host, `weave-gs-02`, you launched another Weave router container with the IP address of your first host. This command tells the Weave on `weave-gs-02` to peer with the Weave on `weave-gs-01`.

At this point you have a single container running on each host, which you can see from docker. On either host run

{% highlight bash %}
sudo docker ps
{% endhighlight %}

and you will see something similar to

{% highlight bash %}
CONTAINER ID        IMAGE                COMMAND                CREATED             STATUS              PORTS                                            NAMES
f975990040f1        zettio/weave:0.9.0   "/home/weave/weaver    7 minutes ago       Up 7 minutes        0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave
{% endhighlight %}
You can see your peered network by using `weave status`

{% highlight bash %}
sudo weave status
{% endhighlight %}
{% highlight bash %}
weave router 0.9.0
Encryption off
Our name is 7a:42:86:2f:2c:c4
Sniffing traffic on &{10 65535 ethwe 66:cb:17:94:af:39 up|broadcast|multicast}
MACs:
Peers:
Peer 7a:42:86:2f:2c:c4 (v2) (UID 13774419172407657760)
   -> 7a:2e:1e:f1:e0:1a [172.17.8.101:6783]
Peer 7a:2e:1e:f1:e0:1a (v2) (UID 10517587287546927665)
   -> 7a:42:86:2f:2c:c4 [172.17.8.102:41754]
Routes:
unicast:
7a:42:86:2f:2c:c4 -> 00:00:00:00:00:00
7a:2e:1e:f1:e0:1a -> 7a:2e:1e:f1:e0:1a
broadcast:
7a:42:86:2f:2c:c4 -> [7a:2e:1e:f1:e0:1a]
7a:2e:1e:f1:e0:1a -> []
Reconnects:
{% endhighlight %}

## Our Hello World Service ##

Next you will use Weave to run a Docker image containing an Apache webserver.  Details on how this container was created using docker are available [here](https://github.com/weaveworks/guides/blob/master/centos-simple/DockerfileREADME.md).

On `weave-gs-01` run

{% highlight bash %}
sudo weave run 10.0.1.1/24 -t -i fintanr/weave-gs-centos-hw
{% endhighlight %}

At this point you have a running Apache server in a Docker container.

### What has happened?

Weave has launched a pre-built Docker container containing an Apache webserver, and assigned it an address of `10.0.1.1`. The Docker image you are using has been downloaded from the [Docker Hub](https://hub.docker.com/).

The container is registered with Weave and is accessible to other containers registered with Weave across multiple hosts.

### Creating our client container

You now want to create a container on your second host and connect to the webserver in the container on our first host. Containers return a container ID which you will capture to use further on in this example. On `weave-gs-02` run

{% highlight bash %}
CONTAINER=`sudo weave run 10.0.1.2/24 -t -i fintanr/weave-gs-centos-bash`
{% endhighlight %}

Now you attach to your docker container using the `CONTAINER` value we captured earlier, and run a curl command to connect to your hello world service.

{% highlight bash %}
sudo docker attach $CONTAINER
{% endhighlight %}

{% highlight bash %}
curl http://10.0.1.1
{% endhighlight %}

And you will see a JSON string similar too

{% highlight javascript %}
{
    "message" : "Hello World",
    "date" : "2015-02-16 15:02:57"
}
{% endhighlight %}

Now you can exit from the container. As you have finished the command that the container was running (in this case `/bin/bash`) the container also exits.

## Summary ##

You have now used Weave to quickly deploy an application across two hosts using containers.


