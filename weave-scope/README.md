---
layout: guides
title: Monitoring Docker Containers with Weave Scope
description: How to use Weave Scope to monitor and visualize docker container clusters and swarms.
tags: weave scope, docker container visibillity, cluster, swarms
permalink: /guides/weave-scope/weave-scope-alone-monitor-containers.html
sidebarpath: /start/weave-scope-alone
sidebarweight: 50
---


Weave Scope automatically detects and monitors every host, Docker container and process in your infrastructure, builds a map showing their inter-communications and then presents an up-to-date view of your infrastructure in a web interface. You can visualize, monitor and control your distributed applications and troubleshoot bottlenecks, memory leaks or any other issues. It does this without requiring changes to your code or configuration, and without having to make declarations about your infrastructure that become out-of-date and stale. 

Weave Scope can be deployed to any infrastructure, and works well in all cloud and bare-metal environments.

##How Weave Scope is Deployed?

Weave Scope consists of three parts: the probe, the app and the user interface. There are two ways in which Weave Scope can be deployed: as a standalone configuration, or if you don't want to bother with the administration yourself, you can sign up for the Weave Scope cloud service.

###Weave Scope Cloud Service

The Weave Scope cloud service manages and shares access to your Weave Scope user interface. With the cloud service, Weave Scope probes are run locally on your machines, whereas the app and the user interface are hosted on the Weave Scope cloud service. Infrastructure is monitored in a browser from the [scope.weave.works](http://scope.weave.works) website.

Sign up at [scope.weave.works](http://scope.weave.works) to obtain a secure service token. 

###Weave Scope Standalone

In standalone mode, all Weave Scope components are run locally: the probes and the app are deployed to your machines, and then the user interface is displayed in your browser to view the infrastructure setup.

##About This Guide

This guide demonstrates how to launch and use Weave Scope in standalone mode. You will: 

1. Deploy a 3-tiered web application stack, consisting of a pool of data services, a set of custom application servers and a load balancing layer. 
2. Launch Weave Scope to visualize and monitor containers and return useful intelligence. 

This tutorial takes about 15 minutes to complete and while some UNIX skills are required, it does not require any programming skills to complete. 


##What You Will Use

* [Weave](http://weave.works)
* [Weave Scope](http://weave.works/scope/index.html)
* [Docker](http://docker.com)
* [Docker Compose](https://www.docker.com/docker-compose)

##Before You Begin

If you are using OS X or Windows, you can install [Docker Toolbox](https://www.docker.com/toolbox), which provides all of the tools you need to complete this guide.

For other operating systems, please install and configure the following separately before proceeding:

  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at least the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

##Setting up the VM

First, install Linux onto a VM using virtual toolbox by typing: 

~~~bash
docker-machine create -d virtualbox weave-scope-demo
~~~

SSH onto the newly created VM and then proceed to the next section: 

~~~bash
docker-machine ssh weave-scope-demo
~~~

###Deploying the Sample Application

To demonstrate Weave Scope in stand-alone mode, you will deploy an example application using Docker Compose. This example uses a single host, but keep in mind that Weave Scope works across on multiple hosts, or even across data centers and cloud providers.

Install Docker and Docker Compose onto the VM by running:

~~~bash
$ wget -qO- https://get.docker.com/ | sh
$ sudo curl -L https://github.com/docker/compose/releases/download/1.5.1/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
$ sudo chmod +x /usr/local/bin/docker-compose
~~~

And next, use Docker Compose to launch all of the components of the sample application:

~~~bash
$ wget -O docker-compose.yml http://git.io/scope-compose
$ docker-compose up -d
~~~

Check that all seven application containers are running by typing `docker ps`:

~~~bash
CONTAINER ID  IMAGE            PORTS                 NAMES
fe41c10a63ca  tns_lb1:latest   0.0.0.0:8001->80/tcp  tns_lb1_1
c94005d87115  tns_lb2:latest   0.0.0.0:8002->80/tcp  tns_lb2_1
8c15a1325094  tns_app1:latest  8080/tcp              tns_app1_1
645386356a2e  tns_app2:latest  8080/tcp              tns_app2_1
e34ccea042fd  tns_db3:latest   9000/tcp              tns_db3_1
c0d53d1327b4  tns_db2:latest   9000/tcp              tns_db2_1
0a920e17818a  tns_db1:latest   9000/tcp              tns_db1_1
~~~

Verify that the containers are reachable by curling one of the tns_lb instances. 

By default, the containers listen on ports 8001 and 8002:

~~~bash
$ curl localhost:8001  # on a Mac, try: curl `boot2docker ip`:8001
lb-6d5b2352f76d4a807423ce847b80f060 via http://app1:8080
app-60fbe0a31aee9526385d8e5b44d46afb via http://db2:9000
db-e68d33ceeddbb77f4e36a447513367e8 OK
~~~

###Launching Weave Scope

With the sample app up and running, you are ready to install and launch Weave Scope:

~~~bash
sudo wget -O /usr/local/bin/scope \
  https://github.com/weaveworks/scope/releases/download/latest_release/scope
sudo chmod a+x /usr/local/bin/scope
sudo scope launch
~~~

Point your web browser to: `http://192.168.99.100:4040/` (or to the address displayed to you in the terminal window after Weave Scope was launched).

##Launching Weave Scope When Using Weave Net to Connect Containers

If you are running Weave Scope on the same machine as a Weave network, Weave Scope uses `weaveDNS` to discover other instances of Weave Scope. 

Weave Scope registers itself using the address `scope.weave.local`. Each probe then, sends its report to every app registered under this address. In other words, if you are running Weave Net with DNS, you do not need to take any further steps. 

If you don't want to use weaveDNS, you can instruct Weave Scope to cluster with other Weave Scope instances on the command line. Hostnames and IP addresses are acceptable, both with and without ports, for example:

~~~bash
scope launch scope1:4030 192.168.0.12 192.168.0.11:4030
~~~

Hostnames are regularly resolved as A records, where each answer is used as a target.

`scope launch` prints out the URLs to which you can point your browser and display the user interface.

##Visualizing Infrastructure

Once Weave Scope is launched in your browser, an immediate overview of the infrastructure is displayed, including any running containers. The Weave Scope view is presented in an order with clients generally placed above servers. Read a Weave Scope view by going from top to bottom.

**An Overview of Application Layers:**![An Overview of the App](/images/weave-scope/weave-scope-application-layers.png)

A line between two nodes within the view represents a connection between containers. To help you understand the connections in your view, hover over a container or a connection to highlight all connected containers. This is especially useful for infrastructures that use a lot of containers.

##Viewing Metrics

Metrics about a node are displayed by clicking on a node in the Weave Scope view.  For example, to examine the metrics about one of the database (db) containers in this example, click on the node with the label tns_db1_1.

**Metrics of the DB Container**:![Details and Metrics of the DB Container](/images/weave-scope/weave-scope-database-metrics.png)

The panel on the right shows information about the database, such as the image and process names, sparklines displaying memory consumption and peformance, as well as network metrics like the number of TCP connections.

>Note: In this view, you can Pause, Restart, and Stop containers, and for this reason, access to the Weave Scope user interface should be restricted to trusted individuals. 

##Grouping By Containers or Hosts

Weave Scope works great for infrastructures of any size, but if there are too many containers on the screen at once for you to manage, use Weave Scope’s grouping features to make the view easier to understand. In the Containers view, click the Image button to merge all containers running on the same host together.

**Grouped Container View:**![Grouped Container View](/images/weave-scope/weave-scope-group-containers.png)

All db, app, and lb instances are merged together into single nodes, even when they exist across hosts. This is a logical, rather than a physical lens on the infrastructure — something that application developers intuitively understand. Detailed statistics are also merged.

The logical view is useful for application developers, but for those with a more operations-oriented background,  a `Hosts` view is also provided that displays a standard physical layout of the infrastructure.

Click on `Applications` to show all processes communicating in your network. This is the most granular view of Weave Scope. Weave Scope collects information in a flexible data model, which makes it possible to visualize nearly all possible transformations of your infrastructure setup.

**An Overview of all Processes Communicating:**![An Overview of all Processes Communicating](/images/weave-scope/weave-scope-applications-view.png)


##Stopping Weave Scope

To stop Weave Scope: 

~~~bash
sudo scope stop
~~~


##Conclusions

This guide demonstrated how to launch Weave Scope in standalone mode, so that you can visualize, monitor and control your container network to gain valuable insight into your application's infrastructure. 

If you have any problems with this guide or would like to get in touch, contact us via [Help and Support](http://weave.works/help/index.html).

