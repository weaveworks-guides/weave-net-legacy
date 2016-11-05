---
layout: guides
title: Network Monitoring, Security and Policy
---

<h1 id="secure-container-firewalls-network-monitoring">Secure: Container Firewalls &amp; Network Monitoring</h1>

<img src="secure.png" style="width:100%; border:1em solid #32324b;" />

This is Part 4 of 4 of the <a href="/guides/">Weave Cloud guides series</a>.
In this guide we'll see how to secure your app by defining Kubernetes Network Policy and having it enforced by Weave Net. Also, how to monitor your Weave Net network in Weave Cloud with Weave Cortex.

<div style="width:50%; float:left;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">&laquo; Go to previous part: Part 3 – Monitor: Prometheus Monitoring</a>
</div>
<div style="clear:both;"></div>

<center><div style="width:300px; display:inline-block; border:1px solid red; margin-top:2em;">
VIDEO GOES HERE
</div></center>


<h2 id="secure-container-firewalls-network-monitoring-contents">Contents</h2>

* [Secure: Container Firewalls & Network Monitoring](#secure-container-firewalls-network-monitoring)
    * [Contents](#secure-container-firewalls-network-monitoring-contents)
    * [Introduction](#secure-container-firewalls-network-monitoring-introduction)
    * [Deploy Kubernetes](#secure-container-firewalls-network-monitoring-deploy-kubernetes)
    * [Monitor the network with Weave Cortex](#secure-container-firewalls-network-monitoring-monitor-the-network-with-weave-cortex)
        * [Sign up for a Weave Cloud account](#secure-container-firewalls-network-monitoring-monitor-the-network-with-weave-cortex-sign-up-for-a-weave-cloud-account)
        * [Deploy socks shop](#secure-container-firewalls-network-monitoring-monitor-the-network-with-weave-cortex-deploy-socks-shop)
    * [Secure the application with Weave Net](#secure-container-firewalls-network-monitoring-secure-the-application-with-weave-net)



<h2 id="secure-container-firewalls-network-monitoring-introduction">Introduction</h2>

In this guide, we're going to:

* [Deploy a Kubernetes cluster with Weave Net and then deploy a sample application (the socks shop) to it](#deploy)
* [Monitor the network in Weave Cortex, part of Weave Cloud](#monitor-network-cortex)
* [Secure the application by applying Network Policy, which gets enforced by Weave Net](#secure-application)

If you have already set up a Kubernetes cluster with Weave Net with one of the other guides, you can skip straight to one of these sections by clicking on the links above.

<a name="deploy"></a>
<h2 id="secure-container-firewalls-network-monitoring-deploy-kubernetes">Deploy Kubernetes</h2>

```
TODO: include the deploying Kubernetes section from trouble-shooting-dashboard.md (factor that out into an include).
XXX: instructions need to _not_ apply network policy yet.
```


<a name="monitor-network-cortex"></a>
<h2 id="secure-container-firewalls-network-monitoring-monitor-the-network-with-weave-cortex">Monitor the network with Weave Cortex</h2>

Cortex is a hosted, scalable Prometheus Monitoring system built-in to Weave Cloud.
Weave Net supports Prometheus monitoring.

Here we'll use Cortex and Net together to monitor the health of the Weave Network.
As examples, we'll be able to see:

* how many IP addresses are allocated to containers as a percentage of available IP addresses on the Weave Network
* how many connections get made in total between all components as we apply a load test (so we can calculate the impact of a microservices architecture on the network)
* how many connections get blocked when we apply some network policy
* (TODO - maybe later) how many connection issues occur when a partial network partition between nodes in the cluster is experienced (and how Weave Net carries on working)

<h3 id="secure-container-firewalls-network-monitoring-monitor-the-network-with-weave-cortex-sign-up-for-a-weave-cloud-account">Sign up for a Weave Cloud account</h3>

Go to [Weave Cloud](https://cloud.weave.works/) and register for an account.
You'll use the Weave Cloud token later to send metrics to Cortex.

<h3 id="secure-container-firewalls-network-monitoring-monitor-the-network-with-weave-cortex-deploy-socks-shop">Deploy socks shop</h3>

On the master:

```
# kubectl create namespace sock-shop
# git clone https://github.com/microservices-demo/microservices-demo
# kubectl apply -n sock-shop -f microservices-demo/manifests
```

It takes several minutes to download and start all the containers, watch the output of `kubectl get pods -n sock-shop` to see when they're all up and running.


<a name="secure-application"></a>
<h2 id="secure-container-firewalls-network-monitoring-secure-the-application-with-weave-net">Secure the application with Weave Net</h2>

Now we'll use Kubernetes policy to secure the application.

Let's start by finding out that the application is not yet secured.
Supposed that a hacker is able to infiltrate ...

Before - container A can talk to container B.
Don't want it to be able to – apply policy.
Oh look, now it can't (all through Scope).


<div style="width:50%; float:left;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">&laquo; Go to previous part: Part 3 – Monitor: Prometheus Monitoring</a>
</div>
<div style="clear:both;"></div>

<p></p>

If you have any questions or comments you can reach out to us on our [Slack channel](https://slack.weave.works/) or through one of these other channels on [Help](https://www.weave.works/help/).

