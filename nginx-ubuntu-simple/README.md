---
layout: guides
title: Using Nginx as a reverse proxy/load balancer with Weave and Docker
description: How to use Nginx as a reverse proxy/load balancer with Weave and Docker
tags: ubuntu, nginx, dns, weaveworks
permalink: /guides/weave-docker-nginx-ubuntu-simple.html

shorttitle: Using Nginx as a Reverse Proxy/load Balancer
sidebarpath: /start/load/nginx
sidebarweight: 20

---


In this example we will demonstrate how Weave allows you to quickly and easily deploy Nginx as
a load balancer for a simple php application running in containers on multiple nodes, with no
modifications to the application and minimal docker knowledge.

![Weave, Nginx, Apache and Docker 3 Nodes](/guides/images/3_Node_Nginx_Example.png)

## What You Will Use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Nginx](http://Nginx.org)
* [Ubuntu](http://ubuntu.com)

## Before You Begin ##

This getting started guide is self contained. You will use Weave, Docker, Nginx and Ubuntu, and we make use of VirtualBox and Vagrant to allow you to run this entire getting started guide on your personal system.

* 15 minutes plus time for vagrant images to download.
* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

## Setting up The Hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

    git clone http://github.com/weaveworks/guides

You will use Vagrant to setup and configure three Ubuntu hosts and install Docker. We make use of Vagrant's functionality to download the base docker images we will be using, and we then install Weave. If you would like to work through the installation steps please review our [getting started guide](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/README.md) for a more manual example.

    cd guides/nginx-ubuntu-simple
    vagrant up

Vagrant will pull down and configure an Ubuntu image, this may take a few minutes depending on the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com). If you happen to want a cup of coffee this is probably a good point to go get one.

Once the setup of the hosts is complete you can check their status with

    vagrant status

The IP addresses we use for this demo are

    172.17.8.101 	weave-gs-01
    172.17.8.102 	weave-gs-02
    172.17.8.103 	weave-gs-03

Our Vagrantfile also configures `weave-gs-01` to pass traffic from port 80 to localhost port 8080.

## Introducing Weavedns ##

[WeaveDNS](https://github.com/weaveworks/weave/tree/master/weavedns#readme) answers name queries on a Weave container network. Weavedns provides a simple way for containers to find each other: just give them hostnames and tell other containers to connect to those names. Unlike Docker 'links', this requires no code changes and works across hosts.

In this example you will give each container a hostname and use WeaveDNS to allow Nginx to find the correct container for a request.

## Introducing Automatic IP Address Management ##

[Automatic IP Address Management(IPAM)](http://docs.weave.works/weave/latest_release/ipam.html) automatically assigns containers an IP address that is unique across the network, and releases that address when a container exit.

In this example you will use IPAM to automatically allocate IP addresses to the containers used across our network. IPAM and WeaveDNS work
seemlessly together, and you will

## Introduction Weave Proxy ##

You will use the [Weave Docker API proxy](http://docs.weave.works/weave/latest_release/features.html#docker) functionality, which gives seamless integration with Docker.

## Nginx and a simple PHP application running in Apache ##

Nginx is a popular free, open-source, high-performance HTTP server and reverse proxy. It is frequently used as a load balancer. In this
example we will use Nginx to load balance requests to a set of containers running Apache.

While our example application is very simple, as a php application running on apache2 it resembles many real world applications
in use. We have created an Nginx configuration which will round-robin across the websevers our php application is running on.
The details of the Nginx configuration are out of scope for this article, but you can review it at [on github](https://github.com/weaveworks/guides/blob/master/nginx-ubuntu-simple/example/nginx.conf)

We have created two docker containers specifically for this guide, if you would like further details on how these were created refer to
the Dockerfile section at the end of this guide.

## Starting The Example ##

To start the example run the script `launch-nginx-demo.sh`. This will

* launch Weave and WeaveDNS on each host.
* launch six containers across our three hosts running an apache2 instance with our simple php site
* launch Nginx as a load balancer in front of the six containers

    ./launch-nginx-demo.sh

If you would like to execute these steps manually the commands to launch Weave, WeaveDNS and Weave Proxy

    vagrant ssh weave-gs-01 -c "sudo weave launch -initpeercount 3"
    vagrant ssh weave-gs-02 -c "sudo weave launch -initpeercount 3 172.17.8.101"
    vagrant ssh weave-gs-03 -c "sudo weave launch -initpeercount 3 172.17.8.101"

    vagrant ssh weave-gs-01 -c "sudo weave launch-dns; sudo weave launch-proxy"
    vagrant ssh weave-gs-02 -c "sudo weave launch-dns; sudo weave launch-proxy"
    vagrant ssh weave-gs-03 -c "sudo weave launch-dns; sudo weave launch-proxy"

You will note that we first launched weave on each host, and then WeaveDNS. This is to allow the IPAM functionality to find at least a majority of peers, and ensure that unique IP addresses will be allocated on each host.

We also launched Weave Proxy

The commands to launch our application containers are

    vagrant ssh weave-gs-01
    eval $(weave proxy-env)
    docker run -d -h ws1.weave.local fintanr/weave-gs-nginx-apache
    docker run -d -h ws2.weave.local fintanr/weave-gs-nginx-apache

    vagrant ssh weave-gs-02
    eval $(weave proxy-env)
    docker run -d -h ws3.weave.local fintanr/weave-gs-nginx-apache
    docker run -d -h ws4.weave.local fintanr/weave-gs-nginx-apache

    vagrant ssh weave-gs-03
    eval $(weave proxy-env)
    docker run -d -h ws5.weave.local fintanr/weave-gs-nginx-apache
    docker run -d -h ws6.weave.local fintanr/weave-gs-nginx-apache

Note the `-h` option, when WeaveDNS has been launched `-h x.weave.local` allows the host to be resolvable.

Finally we launch our Nginx container

    vagrant ssh weave-gs-01
    eval $(weave proxy-env)
    docker run -ti -h nginx.weave.local -d -p 80:80 fintanr/weave-gs-nginx-simple

### What has happened? ###

At this point you have launched Weave and WeaveDNS on all of your hosts, and connected six containers running our simple php
application and Nginx together using Weave.

## Testing our example ##

To demonstrate our example we have provided a small curl script which will make http requests to the our Nginx container. We make
six requests so you can see Nginx moving through each of the webservers in turn.

    ./access-hosts.sh

You will see output similar to

    Connecting to Nginx in Weave demo
    {
        "message" : "Hello Weave - nginx example",
        "hostname" : ws1.weave.local",
        "date" : "2015-06-23 16:01:55"
    }
    {
        "message" : "Hello Weave - nginx example",
        "hostname" : ws2.weave.local",
        "date" : "2015-06-23 16:01:55"
    }
    {
        "message" : "Hello Weave - nginx example",
        "hostname" : ws3.weave.local",
        "date" : "2015-06-23 16:02:11"
    }
    {
        "message" : "Hello Weave - nginx example",
        "hostname" : ws4.weave.local",
        "date" : "2015-06-23 16:02:11"
    }
    {
        "message" : "Hello Weave - nginx example",
        "hostname" : ws5.weave.local",
        "date" : "2015-06-23 16:01:55"
    }
    {
        "message" : "Hello Weave - nginx example",
        "hostname" : ws6.weave.local",
        "date" : "2015-06-23 16:01:55"
    }

## Summary ##

You have now used Weave to deploy a containerised PHP application using Nginx across multiple hosts.

## The Dockerfiles ##

We have included the two Dockerfiles we used for creating our containers, and copy these, and the
associated files we are using, onto each of the Vagrant hosts we created for you to play around with.
A full discussion of Dockerfiles is out of scope for this guide, for more information refer to the
offical guide on [docker.com](https://docs.docker.com/reference/builder/).

Our containers have been built from the offical [Nginx](https://registry.hub.docker.com/_/nginx/) and [Ubuntu](https://registry.hub.docker.com/_/ubuntu/) images, and pushed to the Docker Hub

If you want to experiment with these images just log into one of the Vagrant hosts and go the appropriate
directory

### NGinx ###

    vagrant ssh weave-gs-01
    cd nginx-example
    sudo docker build .

When you run docker build you will see out similar to

    Sending build context to Docker daemon 34.82 kB
    Sending build context to Docker daemon
    Step 0 : FROM nginx
     ---> 4b5657a3d162
    Step 1 : RUN rm /etc/nginx/conf.d/default.conf
     ---> Using cache
     ---> 27365a3d665f
    Step 2 : RUN rm /etc/nginx/conf.d/example_ssl.conf
     ---> Using cache
     ---> 4a98cc012cfd
    Step 3 : COPY nginx.conf /etc/nginx/conf.d/default.conf
     ---> Using cache
     ---> 5583ba8e1c8a
    Successfully built 5583ba8e1c8a

To run this container take the id from the ~Successfully built~ output and use Weave or Docker to launch the container.

    sudo weave run 10.3.1.64/24 5583ba8e1c8a

or to just launch the container

    sudo docker run 5583ba8e1c8a

### Apache and PHP Application ###

    vagrant ssh weave-gs-01
    cd apache-php-example
    sudo docker build .
