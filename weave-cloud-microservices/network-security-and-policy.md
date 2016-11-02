---
layout: guides
title: Network Monitoring, Security and Policy
---

In this guide, we're going to:

* [Deploy a Kubernetes cluster with Weave Net and then deploy a sample application (the socks shop) to it](#deploy)
* [Monitor the network in Weave Cortex, part of Weave Cloud](#monitor-network-cortex)
* [Secure the application by applying Network Policy, which gets enforced by Weave Net](#secure-application)

If you have already set up a Kubernetes cluster with Weave Net with one of the other guides, you can skip straight to one of these sections by clicking on the links above.

<a name="deploy"></a>
## Deploy Kubernetes

```
TODO: include the deploying Kubernetes section from trouble-shooting-dashboard.md (factor that out into an include).
XXX: instructions need to _not_ apply network policy yet.
```


<a name="monitor-network-cortex"></a>
## Monitor the network with Weave Cortex

Cortex is a hosted, scalable Prometheus Monitoring system built-in to Weave Cloud.
Weave Net supports Prometheus monitoring.

Here we'll use Cortex and Net together to monitor the health of the Weave Network.
As examples, we'll be able to see:

* how many IP addresses are allocated to containers as a percentage of available IP addresses on the Weave Network
* how many connections get made in total between all components as we apply a load test (so we can calculate the impact of a microservices architecture on the network)
* how many connections get blocked when we apply some network policy
* (TODO - maybe later) how many connection issues occur when a partial network partition between nodes in the cluster is experienced (and how Weave Net carries on working)

### Sign up for a Weave Cloud account

Go to [Weave Cloud](https://cloud.weave.works/) and register for an account.
You'll use the Weave Cloud token later to send metrics to Cortex.

### Deploy socks shop

On the master:

```
# kubectl create namespace sock-shop
# git clone https://github.com/microservices-demo/microservices-demo
# kubectl apply -n sock-shop -f microservices-demo/manifests
```

It takes several minutes to download and start all the containers, watch the output of `kubectl get pods -n sock-shop` to see when they're all up and running.


<a name="secure-application"></a>
## Secure the application with Weave Net

Now we'll use Kubernetes policy to secure the application.

Let's start by finding out that the application is not yet secured.
Supposed that a hacker is able to infiltrate ...

