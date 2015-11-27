---
layout: guides
shorttitle: Using Weave Scope Standalone to Visualize and Monitor Docker Containers
title: Using Weave Scope Standalone to Visualize and Monitor Docker Containers
description: Use Weave Scope to monitor and visualize docker container clusters and swarms.
tags: weave scope, docker containers, cluster, swarms
permalink: /guides/weave-scope/weave-scope-alone.html
sidebarpath: /start/weave-scope-alone
sidebarweight: 50
---


Weave Scope automatically detects and monitors every host, container and process in your infrastructure, builds a map showing their inter-communications and then presents an up-to-date view of your infrastructure in a web interface. You can visualize, monitor and control your distributed applications and troubleshoot bottlenecks, memory leaks or any other issues. It does this without requiring changes to your code or configuration, and without having to make declarations about your infrastructure that become out-of-date and stale. 

While Weave Scope works with Docker and the Weave network, neither is required. Weave Scope can be deployed to any infrastructure, and works well in all cloud and bare-metal environments.

There are two ways in which Weave Scope can be deployed: as a standalone configuration, or if you don't want to bother with the administration yourself, you can sign up for the Weave Scope cloud service.

##What is Weave Scope Cloud Service?

The Weave Scope cloud service centrally manages and shares access to your Weave Scope user interface. With the cloud service, you run Weave Scope probes locally across your infrastructure and then monitor it from the Weaveworks website where the Weave Scope app feed visualization is hosted.

Sign up at [scope.weave.works](http://scope.weave.works) to obtain a secure token key. Deploy Weave Scope probes with the secure token id to all of your hosts and monitor your containerized apps from the Weaveworks website any time you or management may need to.

##What is Weave Scope Standalone?

In standalone mode, Weave Scope probes are deployed locally and the Weave Scope app is launched in a browser to gain instant insight into your infrastructure.

This tutorial demonstrates how to use Weave Scope standalone, where you will: 

1. Deploy a 3-tiered web application stack, consisting of a pool of data services, a set of custom application servers and a load balancing layer. 
2. Launch Weave Scope to visualize and monitor containers and to return useful intelligence. 

This guide takes about 15 minutes to complete and while some UNIX skills are required, it does not require any programming skills to complete. 


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

To demonstrate Weave Scope in stand-alone mode, you will deploy an example application with Docker Compose. This example uses a single host, but keep in mind that Weave Scope works across on multiple hosts, or even across data centers and cloud providers.

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

With just a few commands, you've deployed a three-tier application stack into seven containers. 

###Launching Weave Scope

With the sample app up and running, you are ready to install and launch Weave Scope:

~~~bash
sudo wget -O /usr/local/bin/scope \
  https://github.com/weaveworks/scope/releases/download/latest_release/scope
sudo chmod a+x /usr/local/bin/scope
sudo scope launch
~~~

Point your web browser to: `http://192.168.99.100:4040/` (or to the address displayed to you in the terminal window after Weave Scope was launched).


>Note: If you are running containers on multiple hosts, you must launch Weave Scope onto each host. But if you are running Weave Net to network containers, you can launch Weave Scope onto one host and Weave Net, provided you have weaveDNS running will do the rest, see Launching Weave Scope When You are Using Weave Net, below. 


##Launching Weave Scope When Using Weave Net to Connect Connect Containers

If you are running Weave Scope on the same machine as the Weave network, the probe uses `weaveDNS` to automatically discover other apps and containers on your network. 

Weave Scope registers itself using the address `scope.weave.local`. Each probe then, sends its report to every app registered under this address. In other words, if you are running Weave Net with DNS, you do not need to take any further steps. Launch once and Weave Net takes care of the rest. 

If you don't want to use weaveDNS, you can instruct Weave Scope to cluster with other Weave Scope instances on the command line. Hostnames and IP addresses are acceptable, both with and without ports, for example:

~~~bash
scope launch scope1:4030 192.168.0.12 192.168.0.11:4030
~~~

Hostnames are regularly resolved as A records, where each answer is used as a target.

##Visualizing Your Infrastructure

Once Weave Scope is displayed in your browser, it gives you an immediate overview of your network, and shows all of your containerized apps. 

An Overview of the App:![An Overview of the App](/guides/images/weave-scope/weave-scope-application-layers.png)

Each circle on the map represents a container in your network. Circles connected by a line are containers communicating with each other. Use your mouse to explore the network. When you hover over a container or a connection Weave Scope highlights the connected containers to help you understand the topology quicker. This is especially helpful for infrastructures with many containers.

If you are looking for more information about one of the database (db) containers, click on the container with the label tns_db1_1 and view the metrics about it.

Metrics of the DB Container:![Details and Metrics of the DB Container](/guides/images/weave-scope/weave-scope-database-metrics.png)

The panel on the right shows basic information about the container, for example the image and process names, as well as any network metrics, like ingress/egress byte rates and also the number of TCP connections.

>Note: In this view, you can Pause, Restart, and Stop containers, and for this reason, access to your Weave Scope infrastructure visualization should be restricted to trusted individuals. 

##More Advanced Use Cases

Weave Scope works great in topologies of any size, but if there are too many containers on the screen at once, you can use Weave Scope’s grouping features to make things easier to understand. In the Containers view, click the Image button to merge all containers running on the same host together.

Grouped Container View:![Grouped Container View](/guides/images/weave-scope/weave-scope-group-containers.png)

In our stack, all of the db, app, and lb instances get merged together into single nodes, even when they exist across hosts. The result is a logical, rather than physical, lens on the infrastructure — something that application developers intuitively understand. Detailed statistics are also merged.

These features are great for application developers, but those with a more operations-oriented background will feel right at home in the hosts view, where you can see the physical layout of the infrastructure, as you might find in a tool like Ganglia or Squid.

Click on Applications to show all processes communicating in your network. This is the most granular view of Scope.

An Overview of all Processes Communicating![An Overview of all Processes Communicating](/guides/images/weave-scope/weave-scope-applications-view.png)

Scope collects information in a flexible data model, and therefor it is possible to visualize nearly all possible transformations on your network.

##Stopping Weave Scope and Other Weave Scope Commands


##Conclusions

This guide demonstrated how to launch Weave Scope in standalone mode, so that you can visualize, monitor and control your container network to gain valuable insight into your application's infrastructure. 

If you have any problems with this guide or would like to get in touch, contact us via [Help and Support](http://weave.works/help/index.html).

