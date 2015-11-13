---
layout: guides
shorttitle: Weave and Docker on Ubuntu-all-in-one
title: Getting Started with Weave and Docker on Ubuntu-all-in-one
description: Using Nginx as a reverse proxy/load balancer with Weave Net and Docker on Amazon Web Services
tags: ubuntu, aws, ngnix, microservices, dns
permalink: /guides/weave-docker-ubuntu-all-in-one.html
sidebarpath: /start/wd/ubuntunall
sidebarweight: 50

---


## What You Will Build ##

**Weave** allows you to focus on developing your application, rather than your infrastructure.

In this example, you will: 

1. Create a simple application running in a container on one host. 
2. Run a service which Your provides a JSON message containing the date and the message `hello world`. 
3. Query the `hello world` service from a second container using `curl`.

This guide requires no programming skills and takes about 10 minutes to complete.

![Weave and Docker](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/Simple_Weave.png)

## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)

## Before Starting This Guide

Ensure you have the following installed before starting this guide:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

You are also provided with a script to setup the demo, if you would like to work through a manual example please
see our more detailed [getting started guide](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/README.md).

## Setting Up The Hosts

The code for this example is available on github. To begin, clone the getting started repository:

~~~bash
git clone https://github.com/weaveworks/guides
~~~

Vagrant sets up and configures the two Ubuntu hosts, and then it installs Docker and **Weave**. The two hosts named `weave-gs-01` and `weave-gs-02` are assigned IP addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork).

~~~bash
cd guides/ubuntu-all-in-one
vagrant up
~~~

Vagrant pulls down and configures an Ubuntu image. This may take a few minutes depending on the speed of your network connection. For more information about Vagrant and how it works, refer to the [Vagrant documentation](http://vagrantup.com).

>Note: You may be prompted for a password when `/etc/hosts` is being updated during the Vagrant setup, press return at this point.

Once the hosts are setup, you can check their status using:

~~~bash
vagrant status
~~~

The IP addresses used in this demo are

~~~bash
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-02
~~~

## Launching Weave and The Demo Containers

Run the script `launch-simple-demo.sh`

This script:

* launches **Weave** onto each of the hosts 
* launches a container with a simple hello world webserver in `weave-gs-02` (CONTAINER1) using the IP address `10.3.1.1`
* launches a container containing `curl` which you will use to connect to CONTAINER1 on `weave-gs-01` with an IP address of `10.3.1.2`

On `weave-gs-01`, a **Weave** router container was installed. On `weave-gs-02` another **Weave** router container was launched  by passing the IP address of your first host. This tells **Weave** on `weave-gs-02` to create a peer with the **Weave** on `weave-gs-01`.


## Connecting Containers

Log onto `weave-gs-01`, where the curl container is running, by typing:

~~~bash
vagrant ssh weave-gs-01
~~~

Connect to the container:

~~~bash
CONTAINER=$(sudo docker ps | grep weave-gs-ubuntu-curl | awk '{print $1}')
sudo docker attach $CONTAINER
curl 10.3.1.1
~~~

This returns the following from the 'Hello World' service running on weave-gs-02:

~~~javascript
{
    "message" : "Hello World",
    "date" : "2015-03-13 15:03:52"
}
~~~

## Conclusions

You have now used Weave to quickly deploy an application across two hosts using containers.

## Further Reading

 * [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
 * [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
