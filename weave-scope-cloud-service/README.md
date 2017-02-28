---
layout: guides
title: Visualizing Dockerized Microservices With Weave Cloud
description: How to use Weave Cloud service to monitor and visualize docker containers.
tags: weave scope, docker containers visibility, cluster, swarms
permalink: /guides/weave-scope/weave-scope-cloud-service-monitor-containers.html
sidebarpath: /start/weave-scope-cloud
sidebarweight: 51
---

Weave Scope automatically detects and monitors every host, container and process in your infrastructure, builds a map showing their inter-communications and then presents an up-to-date view in a web interface. You can visualize, monitor and control your distributed applications and troubleshoot bottlenecks, memory leaks or any other issues. It does this without requiring changes to your code or configuration, and without having to make declarations about your infrastructure that become out-of-date and stale. 

Weave Scope can be deployed to any infrastructure, and works well in all cloud and bare-metal environments.

[Weave Cloud](http://cloud.weave.works) centrally manages and shares access to your Weave Scope user interface. With the cloud service, you run Weave Scope probes locally across your machines and then monitor the infrastructure from the Weaveworks website where the Weave Scope app feed is hosted. 

You can also launch Weave Scope in stand-alone mode, and run Weave Scope locally in your own environment. See, ["Monitoring Docker Containers with Weave Scope"](/monitor-docker-containers/) for more information and an example on how to use it.

###About This Guide

This guide demonstrates how to launch Weave Scope and use it in Weave Cloud. You will:

1. Deploy a 3-tiered web application stack, consisting of a pool of data services, a set of custom application servers and a load balancing layer.
2. Launch Weave Scope to visualize and monitor containers and return useful intelligence.


This tutorial takes about 15 minutes to complete and while some UNIX skills are required, and doesn't require any programming skills to complete.


##Signing Up With Weave Cloud Service

To register with Weave Cloud, go to [cloud.weave.works](http://cloud.weave.works), and enter your email address. A confirmation email will be sent with further instructions. 

Login to Weave Cloud and click the settings icon in the top right hand corner to obtain the cloud service token:

![Weave Cloud](/guides/images/aws-ecs/weave-cloud-main-page.png)


##Launch the Weave Scope Probes

Use the Weave Cloud token to launch a Weave Scope probe onto every host that you want to monitor:

~~~bash
sudo wget -O /usr/local/bin/scope \
  https://github.com/weaveworks/scope/releases/download/latest_release/scope
sudo chmod a+x /usr/local/bin/scope
sudo scope launch --service-token=<weave-cloud-token>
~~~

Where, 

* <weave-cloud-token> is the token found in the Weave Cloud settings page when you login.


###Deploying the Sample Application

You will deploy a sample application using Docker Compose to your laptop. This example uses a single host, but keep in mind that Weave Scope works across on multiple hosts, or even across data centers and cloud providers.

##Install Docker and Docker Compose onto the VM by running:

~~~bash
wget -qO- https://get.docker.com/ | sh
sudo curl -L https://github.com/docker/compose/releases/download/1.5.1/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
~~~

And next, use Docker Compose to launch all of the components of the sample application:

~~~bash
wget -O docker-compose.yml http://git.io/scope-compose
docker-compose up -d
~~~

Check that all seven application containers are running by typing docker ps:


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
curl localhost:8001  # on a Mac, try: curl `boot2docker ip`:8001
lb-6d5b2352f76d4a807423ce847b80f060 via http://app1:8080
app-60fbe0a31aee9526385d8e5b44d46afb via http://db2:9000
db-e68d33ceeddbb77f4e36a447513367e8 OK
~~~

##Viewing Your App in Weave Cloud

With Weave Scope probes deployed and the app launched, go to [https://cloud.weave.works](https://cloud.weave.works) to see an immediate overview of your containerized app displayed in your browser. 

Weave Scope presents all nodes in a particular order, and presents all clients above servers. As a general rule, you can read a Weave Scope view by going from top to bottom.

**An Overview of the App:**![Weave Scope App Overview](/guides/images/weave-scope/weave-scope-application-layers.png)

A line between two nodes within the view represents a connection between containers. To help you understand the connections in your view, hover over a container or a connection to highlight all connected containers. This is especially useful for infrastructures that use a lot of containers.

##Viewing Metrics

Metrics about a node are displayed by clicking on a node in the Weave Scope view. Basic metrics for the node will depend on the type, but generally will contain: the image and process names, sparklines showing memory consumption and performance, as well as any network metrics, like the number of TCP connections.

>**Note:** In this view, you can Pause, Restart, and Stop containers, and for this reason, access to Weave Scope should be restricted to trusted individuals. 

##Grouping By Containers or Hosts

Weave Scope works great in topologies of any size, but if there are too many nodes in the view at once, you can use the grouping features to make the view simpler to understand. For example, in the containers view, click the `By Image` button to merge all the containers that are running the same container image together.

**Grouped Container View:**![Weave Scope Grouped Container View](/guides/images/weave-scope/weave-scope-group-containers.png)

In our stack all instances get merged together into single nodes, even when they exist across hosts. The result is a logical, rather than physical, lens on the infrastructure — something that application developers intuitively understand. 

Grouping all instances and applications are great for application developers, but for those who have a more operations-oriented background, there is also the option to group `By HOST`. 

Click on `Applications` to show all the processes communicating in your network. This is the most granular view of Weave Scope.

Weave Scope collects information in a very flexible data model, so that you can visualize all possible transformations within your network.

**An Overview of all Processes:**![Weave Scope View Processes Communicating](/guides/images/weave-scope/weave-scope-applications-view.png)

##Stopping Weave Scope

To stop Weave Scope: 

~~~bash
sudo scope stop
~~~

##Getting Help

If you encounter any problems with this application or documentation or you would like to get in touch, contact us via [Help and Support](https://weave.works/help/).


