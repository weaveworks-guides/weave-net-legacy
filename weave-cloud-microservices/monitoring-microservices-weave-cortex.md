---
layout: guides
title: Monitoring Microservices with Weave Cortex
---

Microservices environments by nature are dynamic and are in a state of constant change especially if they are running inside containers. They may also be spread across multiple clouds or they may be spanning both a data center and a cloud which can make monitoring a challenge.  And since these systems tend to be in a state of constant change with containers going down and spinning back up again, traditional monitoring systems which tend to be server-focused, don't work well at all. 

Weave Cortex is built upon the open source project, Prometheus and it sits in your Kubernetes cluster and listens change throughout the entire pod irregardless of where they may physically lie within a single Kubernetes cluster or even across a Kubernetes federation. Once Weave Cortex is deployed to your Kubernetes production environment, metrics are automatically pushed to Weave Cloud where they can be viewed and queried from within the Microservices Dashboard. 

You will use the sample app, 'The Sock Shop', deploy it to a couple of virtual machines running Docker and Kubernetes and then monitor issues in Weave Cloud. 

Specifically, in this tutorial, you will: 

1. Set up Docker for Mac (if you haven't already done so)
2. Deploy the Sockshop with Docker-compose
3. Install Scope and verify your app on your laptop.
3. Configure a Kubernetes cluster and at the same time install Weave Net onto two Ubuntu hosts.
4. Use Weave Cloud to observe the Kubernetes cluster deployment.
5. Install the Sock Shop onto the Kubernetes cluster.
5. Configure and launch the Cortex agent to start pushing metrics to Weave Cloud
6. Run a load test on the Sock Shop and view the metrics in Weave Cortex from the Weave Cloud troubleshooting dashboard. 

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

##Launch the Weave Cloud Probes 

Launch the Weave Cloud probes using the token you obtained when you signed up for Weave Cloud:

~~~bash
curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
~~~

**Where,** 

* `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` - is the token that appears on the settings page, once you’ve logged into Weave Cloud. 

**Note:** To set the Weave Cloud controls to read-only for all users, you can launch scope with the --probe.no-controls flag.  In this demo, you will be launching a terminal window and viewing messages between microservices, and so this flag is not necessary. However, you may want to keep this flag in mind when using Weave Cloud and sharing your infrastructure views with others outside of your organization.

Weave Cloud controls allow you to stop, start and pause containers. They also enable you to launch a terminal and interact directly with your containers.

##Install Kubernetes and the Sock Shop

[install instructions from trouble-shooting-dashboard]

##Configuring Cortex in Your Production Environment

Next enable Cortex to start pushing metrics to Weave Cloud. 

**1** Log onto the master Kubernetes node and run the following to get the cortex.yml file and also update the file with your Weave Cloud token: 


curl -sL https://gist.githubusercontent.com/errordeveloper/b2f92741b9fd45fd58e2bcd2870a8b5f/raw/c02cab79d9dde52c1f855c19399bfb222dd55235/cortex.yaml | sed 's/INSERT_TOKEN_HERE/[your-weave-cloud-token]/' | kubectl create -n kube-system -f -


Where, 

* [your-weave-cloud-token] is the token you obtained when you signed up for Weave Cloud above.


Cortex runs in its own Docker container and it may take a few minutes for it to download and appear on the server. You can watch for it to appear in the Troubleshooting Dashboard: 

**2.** Check that Cortex is running on one of the Kubernetes nodes by running: 

~~~
kubectl get deployments -n kube-system
~~~

Where you should see something similar to: 

~~~
NAME                 DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
kube-discovery       1         1         1            1           18h
kube-dns             1         1         1            1           18h
weave-cortex-agent   1         1         1            1           4h
~~~


##Run the Load Test

After the Sock Shop has completely deployed onto the cluster, run the same load test as you did on your laptop and then view the results in Weave Cloud. 

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -h edge-router -r 100 -c 2 <host-ip:[port number]>
~~~


##Viewing Sock Shop Metrics in Weave Cortex

Go back to the Dashboard and click the [graph icon] from the header bar. You should see the Cortex GUI where you will be able to display metrics from the Sock Shop app. 

Run the following query: 





##Running Queries with the Prometheus Query Language


