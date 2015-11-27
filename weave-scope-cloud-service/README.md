---
layout: guides
shorttitle: Using Weave Scope Cloud Service to Visualize and Monitor Docker Containers
title: Using Weave Scope Cloud Service to Visualize and Monitor Docker Containers
description: Use Weave Scope to monitor and visualize docker containers.
tags: weave scope, docker containers, cluster, swarms
permalink: /guides/weave-scope/weave-scope-cloud-service.html
sidebarpath: /start/weave-scope-cloud
sidebarweight: 51
---

Weave Scope automatically detects and monitors every host, container and process in your infrastructure, and builds a map of their inter-communications. An up-to-date view of your infrastructure in a web interface is provided for you to visualize, monitor and control your complex application topology and to identify bottlenecks and any other issues. Weave Scope does this without requiring a single change to your code or configuration, and without you having to make declarations about your infrastructure that will become out-of-date and stale.

With Weave Scope cloud service there is no need for you to run Weave Scope locally. Simply signup to the Weave Scope cloud service, obtain a secure token id, and then visualize your infrastructure from the Weaveworks website. 

If you haven't already signed up for the cloud service, see [scope.weave.works](http://scope.weave.works) for instructions on getting started. 

While Weave Scope works with docker and the Weave network, neither is required. Weave Scope monitors any infrastructure, and it works well in all cloud and bare-metal environments.

You can also run Weave Scope as a stand-alone service, where Weave Scope is run locally to gain insight into your infrastructure. See, ["Using Weave Scope Standalone to Visualize and Monitor Docker Containers"](/guides/weave-scope/weave-scope-alone.html) for more information and an example on how to use it. 

##Running Weave Scope in Cloud Service Mode


To get an account for the Weave Scope service, sign up at [scope.weave.works](http://scope.weave.works). You will be sent a service token id. 

To launch a probe and send reports to the Weave Scope app service, run the following command on each machine that you want to monitor:

~~~bash
sudo scope launch --service-token=<token>
~~~

>Note: If you are running containers on multiple hosts, you must launch a Weave Scope probe onto each host. But if you are running Weave Net you can launch a Weave Scope probe onto one host and Weave Net, provided you have weaveDNS running will discover the rest. 

##Launching Weave Scope When Using Weave Net to Connect Connect Container

If you are running Weave Scope on the same machine as the Weave network, the probe uses `weaveDNS` to automatically discover other apps and containers on your network. 

Weave Scope registers itself using the address `scope.weave.local`. Each probe then, sends its report to every app registered under this address. In other words, if you are running Weave Net with DNS, you do not need to take any further steps. Launch once and Weave Net takes care of the rest. 

If you don't want to use weaveDNS, you can instruct Weave Scope to cluster with other Weave Scope instances on the command line. Hostnames and IP addresses are acceptable, both with and without ports, for example:

~~~bash
scope launch scope1:4030 192.168.0.12 192.168.0.11:4030
~~~

Hostnames are regularly resolved as A records, where each answer is used as a target.


##Visualizing Your Infrastructure

Now that Scope is up and running, it’s time to see your infrastructure. The Scope user interface is loaded in your browser and gives you an immediate overview of your network.

![An Overview of the App](/guides/images/weave-scope/.png)

Each circle of this map represents a container in your network. The circles that are connected by a line are containers communicating with each other. Use your mouse to explore the network. When you hover over a container or a connection Scope highlights the connected containers and helps you understand the topology quicker. This is especially helpful for infrastructures with lots of containers.

If you are looking for more information about one of the database (db) containers, click on a container with the label tns_db1_1 to view metrics about it.

Metrics of the DB Container:![Details and Metrics of the DB Container](/guides/images/weave-scope/weave-scope-database-metrics.png)

The panel on the right shows basic information about the container, like the image and process name, as well as network metrics, like ingress/egress byte rates and number of TCP connections.

##More Advanced Use Cases

Scope works great in topologies of any size. When you get too many containers on the screen at once, you can use Scope’s grouping features to make things easier to understand. For example, in the containers view, you can click the grouping button to merge all the containers that are running the same container image together.

Grouped Container View:![Grouped Container View](/guides/images/weave-scope/weave-scope-group-containers.png)

In our stack, that means all of the db, app, and lb instances get merged together into single nodes, even when they exist across hosts. The result is a logical, rather than physical, lens on the infrastructure — something that application developers should intuitively understand. And detailed statistics are merged, too.
These features are great for application developers, but those with a more operations-oriented background will feel right at home in the hosts view. Here, we see the physical layout of the infrastructure, as you might find in a tool like Ganglia or Squid.

An Overview of all Processes Communicating![An Overview of all Processes Communicating](/guides/images/weave-scope/weave-scope-applications-view.png)

A click on applications changes the map again, showing all processes communicating in your network. This is the most granular view of Scope.

The Applications view

Scope collects information in a flexible data model, so it’s possible to visualize nearly any possible transformation of your network.

##Weave Scope Command Reference

To stop Weave Scope: 

~~~bash
./weave scope stop
~~~



##Getting Help

If you encounnter any problems with this application or documentation or you would like to get in touch, contact us via [Help and Support](http://weave.works/help/index.html).


