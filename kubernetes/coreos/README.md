---
layout: guides
title: Using Weave with Kubernetes on a CoreOS Cluster
description: Using a weave network with Kubernetes on CoreOS
tags: kubernetes, php, ipam, coreos cluster
permalink: /guides/kubernetes/coreos/weave-kubernetes-coreos.html

shorttitle: Weave and Kubernetes on CoreOS
sidebarpath: /start/kubernetes
sidebarweight: 60
---

## What You Will Build

Kubernetes is an open source container cluster manager built by Google. It allows you to manage multiple clusters spread across multiple machines. With Kubernetes there is the concept of the pod, which represents a collection of containers deployed as a single logical unit. For more information see the [Kubernetes Overview](http://kubernetes.io/v1.0/docs/user-guide/overview.html)

In this example, we will demonstrate how you can use a Weave network with Kubernetes on a CoreOS cluster. Although, there are other network fabric solutions such as [Flannel](https://coreos.com/flannel/docs/latest/flannel-config.html) and [Calico](http://www.projectcalico.org/), only Weave provides simple to deploy [encryption](http://docs.weave.works/weave/latest_release/features.html#security) and automatic unique IP assigment using [IPAM](http://docs.weave.works/weave/latest_release/features.html#addressing). Weave furthermore, is one of the few solutions that can monitor any uncontainerized services that you may have, such as legacy databases, on a container network. 

This is a reworked version of our old Kubernetes guide. Many new features have been added to Weave since the time of writing. Both Weave and Kubernetes have become much more mature as they've gone beyond 1.0 releases.

With the [Weave 1.1 release](https://github.com/weaveworks/weave/releases) users can utilise a Docker API proxy and IP address allocation with Kubernetes, thereby removing the need to configure the Docker daemon with statically allocated subnets for each host.

In this example we will: 

1. Provision three Virtual Machines with CoreOS, Docker. 
2. Install the CoreOS container cluster on to the VMs. 
3. Set up the Weave network onto the cluster.
3. Launch Kubernetes on top of the cluster
4. Deploy the guestbook-example PHP app across the cluster

## What You Will Use ##

* [Weave](http://weave.works)
* [CoreOS](https://coreos.com/)
* [Kubernetes](http://kubernetes.io/)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

## What You Need to Complete This Guide

Before you begin, ensure you have the following installed on your system:  

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

## Setting up the CoreOS Cluster & Deploying Kubernetes

First, clone the guides repository: 

~~~bash
git clone https://github.com/weaveworks/guides
~~~

Change to the `kubernetes/coreos` directory and run Vagrant. Vagrant in this case sets up all 3 virtual machines with the CoreOS images, and with Docker. 

For more info about what Vagrant is doing in this example, look at `coreos\Vagrantfile`:

~~~bash
cd kubernetes/coreos
vagrant up
~~~

Next, launch the Weave network onto the clusters by ssh'ing onto each of the VMs and then running `weave setup`: 

~~~bash
> vagrant ssh kube-01

kube-01 > weave setup
~~~


All three CoreOS instances should now be running in a cluster. To check the health of the cluster, and to check that everything set up correctly: 

~~~bash
kube-01 > etcdctl cluster-health

cluster is healthy
member 25d6ce33763c5524 is healthy
member 6ae27f9fa2984b1d is healthy
member ff32f4b39b9c47bd is healthy
~~~

Wait for the Kubernetes binaries to download and install onto the coreOS cluster. 

~~~bash
kube-01 > journalctl -f -u install-kubernetes 
~~~

Once the Kubernetes binaries are fully installed, you can discover all of the pods by deploying the DNS addon: 

~~~bash
kube-01 > kubectl create -f /etc/kubernetes/addons

replicationcontrollers/kube-dns-v8
services/kube-dns
~~~

And then, wait for the DNS to discover the pods: 

~~~bash
kube-01 > kubectl get pods -w --all-namespaces

NAMESPACE     NAME                READY     STATUS    RESTARTS   AGE
kube-system   kube-dns-v8-hmofb   0/4       Pending   0          17s
kube-system   kube-dns-v8-ofmjo   0/4       Pending   0          17s
kube-system   kube-dns-v8-sooal   0/4       Pending   0          17s
NAMESPACE     NAME                READY     STATUS    RESTARTS   AGE
kube-system   kube-dns-v8-sooal   0/4       Running   0          57s
kube-system   kube-dns-v8-hmofb   0/4       Running   0         57s
kube-system   kube-dns-v8-sooal   4/4       Running   0         58s
kube-system   kube-dns-v8-hmofb   4/4       Running   0         59s
kube-system   kube-dns-v8-ofmjo   0/4       Running   0         1m
kube-system   kube-dns-v8-ofmjo   3/4       Running   1         1m
kube-system   kube-dns-v8-ofmjo   4/4       Running   1         1m

~~~

Check that the nodes have registered with the master.  In this example, kube-01 at address: `172.17.8.101` is the master, leaving the other 2 VMs as the nodes, shown below: 

~~~bash
kube-01 > kubectl get nodes

NAME           LABELS                                STATUS
172.17.8.102   kubernetes.io/hostname=172.17.8.102   Ready
172.17.8.103   kubernetes.io/hostname=172.17.8.103   Ready

~~~

##Deploying the Guestbook App


Now you are ready to deploy the guestbook app on to the master node. 

The guestbook php app consists of two replication controllers: one redis database master and another redis database slave. It also deploys a front-end service, which you will be able to load into your browser: 

~~~bash
kube-01 > kubectl create -f guestbook-example
~~~

>>Make a note of the port number returned after launching the guestbook app. 

Let’s take a look at the state of our Kubernetes cluster, we should see the three pods that we have just deployed. This should match the number of replication controllers as well as the front-end service. When you run this command, the pods will go from `Pending` to `Running` as shown below: 

~~~bash
kube-01 > kubectl get pods -w

NAME                 READY     STATUS    RESTARTS   AGE
frontend-oba5w       1/1       Running   0          1h
frontend-rpjad       1/1       Running   0          1h
frontend-xhjc2       1/1       Running   0          1h
redis-master-t7b0b   1/1       Running   0          1h
redis-slave-kyi7u    1/1       Running   0          1h
redis-slave-ncdc3    1/1       Running   0          1h
~~~

Now you will be able to load the app into your browser using this IP address `172.17.8.101` and the port number that was returned when you ran `kubectl create -f guestbook-example` above.

![Guestbook front-end](/guides/kubernetes/coreos/guestbook.png)


Here are a few other useful commands for troubleshooting:

~~~bash
etcdctl cluster-health
systemctl status kube-*
kubectl get nodes
journalctl to see installation log
~~~


##Conclusions

Weave is the only networking solution for Kubernetes, which offers a simple to use encryption. Weave also enables users to access un-orchestrated or even uncontainerized services (such as legacy databases), as well as those services on running on other orchestrators or cloud configuration managers, such as Mesos. 

You can easily adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [email](mailto:help@weave.works) or [Twitter](https://twitter.com/weaveworks).

##Further Reading


* [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
* [Weave encryption](http://docs.weave.works/weave/latest_release/features.html#security)
* [Weave IPAM](http://docs.weave.works/weave/latest_release/features.html#addressing)
* [Weave - Weaving Containers into Applications](https://github.com/weaveworks/weave)
* [Documentation Home Page](http://docs.weave.works/weave/latest_release/)
