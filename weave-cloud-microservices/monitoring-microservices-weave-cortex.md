---
layout: guides
title: Monitoring Microservices with Weave Cortex
---

Microservices environments by nature are dynamic and they are constantly changing especially if they are running inside containers. They may also be spread across multiple clouds or they may be spanning both a data center and a cloud which can make monitoring a challenge.  And since these systems tend to be in a state of constant change with containers going down and spinning back up again, traditional monitoring systems which tend to be server-focused, don't work well at all. 

Weave Cortex is built upon the open source project, Prometheus and it sits in your Kubernetes cluster and listens change throughout the entire pod irregardless of where they may physically lie within a single Kubernetes cluster or even across a Kubernetes federation. Once Weave Cortex is deployed to your Kubernetes production environment, metrics are automatically pushed to Weave Cloud where they can be viewed and queried from within the Microservices Dashboard. 

You will use the sample app, 'The Sock Shop', deploy it to a couple of virtual machines running Docker and Kubernetes and then monitor issues in Weave Cloud. 

Specifically, in this tutorial, you will: 

1. Set up Docker for Mac (if you haven't already done so)
2. Deploy the Sockshop with Docker-compose
3. Install Scope and verify your app on your laptop.
3. Configure a Kubernetes cluster and at the same time install Weave Net onto Digital Ocean.
4. Use Weave Cloud to watch the Kubernetes cluster deployment in Digital Ocean.
5. Install the Sock Shop onto the Kubernetes cluster.
5. Configure Cortex to start pushing metrics to Weave Cloud
6. Run a number of queries on the Sock Shop and view their data in the Weave Cloud dashboard. 

This tutorial will take approximately 15 minutes to complete.

## What You Will Use

* [Weave Cloud](https://cloud.weave.works)
* [Docker for Mac](https://docs.docker.com/docker-for-mac/docker-toolbox/)
* [Weaveworks Sockshop](https://github.com/microservices-demo)
* [Kubernetes](http://kubernetes.io/)
* [Weave Net](https://www.weave.works/products/weave-net/)

##Before You Begin

Ensure that you have the following installed: 

* Docker Toolbox(https://docs.docker.com/docker-for-mac/docker-toolbox/
* [Git](http://git-scm.com/downloads)

For other operating systems, install and configure the following separately before proceeding:

* docker-machine binary (>= 0.2.0)
* docker binary, at least the client (>= v1.6.x)
* VirtualBox (>= 4.3.x)
* curl (any version)

<h3 id="install-docker-for-mac">Installing Docker for Mac</h3>

If you haven't installed Docker for Mac, follow the installation instructions from the <a href="https://docs.docker.com/docker-for-mac/" target="_blank"> Docker website </a>.

Once it's running you will see <img alt="Docker Icon in the Mac OS menu bar" src="https://github.com/weaveworks/guides/blob/master/weave-cloud-and-docker-for-mac/docker-for-mac-menu-bar-icon.png"
style="height: 1em;" /> in your menu bar.

##Sign Up for Weave Cloud

Before you can use Cortex, you will need to sign up for a Weave Cloud account.

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a>
2.  Sign up using either a Github, or Google account or use an email address.
3.  Make a note of the cloud service token from the User settings screen:

![Obtain service token for Weave Cloud](weave-cloud-token-screenshot.png)


##Set up Two Ubuntu Hosts

[install instructions from trouble-shooting-dashboard]

##Install Kubernetes and the Sock Shop

[install instructions from trouble-shooting-dashboard]

##Configuring Cortex in Your Production Environment

Next enable Cortex to start pushing metrics to Weave Cloud. 

**1** Log onto the master Kubernetes node and change to the directory noted below. This directory contains a number of .yaml files that makes deploying Cortex simple : 

~~~
cd ~/microservices-demo/deploy/kubernetes/manifests-cortex
~~~

**2.** Update the file cortex-config.yaml file found here: `deploy/kubernetes/manifests/cortex-config.yaml` and overwrite the variable, `$INSERT_WEAVE_CLOUD_TOKEN` with the Weave Cloud token you obtained when you signed up above.


**3.** Apply the changes to the configuration using:

~~~
$ kubectl apply -f . -n sock-shop
~~~

Cortex runs in its own Docker container and it may take a few minutes for it to download and appear on the server. You can watch for it to appear in the Troubleshooting Dashboard: 

**4.** Check that Cortex is running by using: 

~~~
docker ps grep | cortex
~~~


##Viewing Sock Shop Metrics in Weave Cortex

Go back to the Dashboard and click the [graph icon] from the header bar. You should see the Cortex GUI where you will be able to display metrics from the Sock Shop app. 

Run the following query: 





##Running Queries with the Prometheus Query Language


