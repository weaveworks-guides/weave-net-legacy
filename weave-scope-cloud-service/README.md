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

Weave Scope automatically detects and monitors every host, container and process in your infrastructure, builds a map showing their inter-communications and then presents an up-to-date view of your infrastructure in a web interface. You can visualize, monitor and control your distributed applications and troubleshoot bottlenecks, memory leaks or any other issues. It does this without requiring changes to your code or configuration, and without having to make declarations about your infrastructure that become out-of-date and stale. 

While Weave Scope works with Docker and the Weave network, neither is required. Weave Scope can be deployed to any infrastructure, and works well in all cloud and bare-metal environments.

If you haven't already signed up for the cloud service, see [scope.weave.works](http://scope.weave.works) for instructions on getting started. 

You can also run Weave Scope as a stand-alone service, where Weave Scope is run locally to gain insight into your infrastructure. See, ["Using Weave Scope Standalone to Visualize and Monitor Docker Containers"](/guides/weave-scope/weave-scope-alone.html) for more information and an example on how to use it. 

##Running Weave Scope in Cloud Service Mode

Once you've received a service-token id, use it to launch a Weave Scope probe on every machine that you want to monitor:

~~~bash
+sudo wget -O /usr/local/bin/scope \
+  https://github.com/weaveworks/scope/releases/download/latest_release/scope
+sudo chmod a+x /usr/local/bin/scope
sudo scope launch --service-token=<token>
~~~

>Note: If you are running Weave Net you can launch a Weave Scope probe onto one host and Weave Net, provided that you have weaveDNS running will discover the rest of the containers. 

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

##Grouping Containers

Weave Scope works great in topologies of any size. When you get too many containers on the screen at once, you can use the grouping features to make things easier to understand. For example, in the containers view, click the grouping button to merge all the containers that are running the same container image together.

In our stack, that means all of the db, app, and lb instances get merged together into single nodes, even when they exist across hosts. The result is a logical, rather than physical, lens on the infrastructure — something that application developers should intuitively understand. And detailed statistics are also merged.

These features are great for application developers, but those with a more operations-oriented background will feel right at home in the hosts view. 

An Overview of all Processes Communicating![An Overview of all Processes Communicating](/guides/images/weave-scope/weave-scope-applications-view.png)

Click on applications to show all the processes communicating in your network. This is the most granular view of Weave Scope.

Weave Scope collects information in a flexible data model, so it’s possible to visualize nearly any possible transformation of your network.

##Weave Scope Command Reference

To stop Weave Scope: 

~~~bash
./weave scope stop
~~~


##Getting Help

If you encounnter any problems with this application or documentation or you would like to get in touch, contact us via [Help and Support](http://weave.works/help/index.html).


