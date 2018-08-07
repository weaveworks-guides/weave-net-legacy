---
layout: guides
title: Networking Kubernetes Clusters on CoreOS with Weave
description: Networking Kubernetes Clusters on CoreOS with Weave
tags: kubernetes, clusters, php, ipam, coreos
permalink: /guides/platform/kubernetes/os/coreos/cloud/vagrant/index.html

shorttitle: Networking Kubernetes Clusters on CoreOS with Weave
sidebarpath: /start/kubernetes
sidebarweight: 60
---

**Note:** You are looking at our `old-guides` repository. The guides in here haven't been updated in a while.
They might or might not work for you. We are keeping them around for informational purposes.

---

Kubernetes is an open source container cluster manager built by Google. It allows you to manage multiple clusters spread across multiple machines. With Kubernetes there is the concept of the pod, which represents a collection of containers deployed as a single logical unit. For more information see the [Kubernetes Overview](http://kubernetes.io/v1.0/docs/user-guide/overview.html)

In this example, we will demonstrate how you can use a Weave network with Kubernetes on a CoreOS cluster. Although there are other network fabric solutions such as [Flannel](https://coreos.com/flannel/docs/latest/flannel-config.html) and [Calico](http://www.projectcalico.org/), only Weave provides simple to deploy [encryption](/documentation/net-1.5-features#security) and automatic unique IP assigment using [IPAM](/documentation/net-1.5-features#addressing). Weave furthermore, is one of the few solutions that can integrate with any uncontainerized services that you may have, such as legacy databases, together on a container network.

In this example we will:

1. Provision three Virtual Machines with CoreOS, and Docker.
2. Install the CoreOS container cluster on to the VMs.
3. Set up the Weave network.
3. Launch Kubernetes to schedule and manage the cluster.
4. Deploy the guestbook example app.

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

~~~bash
cd guides/kubernetes/coreos
vagrant up
~~~

Next, check that the Weave network has launched successfully onto the clusters by ssh'ing onto each of the VMs and then running `weave status`:

~~~bash
> vagrant ssh kube-01

core@kube-01 ~ $ weave status
~~~


All three CoreOS instances should now be running in a cluster. To check the health of the cluster, and to check that everything set up correctly:

~~~bash
core@kube-01 ~ $ etcdctl cluster-health

cluster is healthy
member 25d6ce33763c5524 is healthy
member 6ae27f9fa2984b1d is healthy
member ff32f4b39b9c47bd is healthy
~~~

Watch for the Kubernetes binaries to install here:

~~~bash
core@kube-01 ~ $ journalctl -f -u install-kubernetes

-- Logs begin at Mon 2015-09-07 14:46:39 UTC. --
Sep 07 14:47:49 kube-01 tar[2454]: kubernetes/server/bin/kube-apiserver.docker_tag
Sep 07 14:47:49 kube-01 tar[2454]: kubernetes/server/bin/kube-scheduler
Sep 07 14:47:49 kube-01 tar[2454]: kubernetes/server/bin/hyperkube
Sep 07 14:47:50 kube-01 tar[2454]: kubernetes/server/bin/kube-controller-manager.docker_tag
Sep 07 14:47:50 kube-01 tar[2454]: kubernetes/server/bin/kube-controller-manager
Sep 07 14:47:50 kube-01 tar[2454]: kubernetes/server/bin/kubernetes
Sep 07 14:47:50 kube-01 tar[2454]: kubernetes/server/bin/kube-scheduler.docker_tag
Sep 07 14:47:50 kube-01 tar[2454]: kubernetes/server/bin/kubectl
Sep 07 14:47:50 kube-01 tar[2454]: kubernetes/server/bin/kube-apiserver
Sep 07 14:47:51 kube-01 systemd[1]: Started Download Kubernetes Binaries.

~~~

Once the Kubernetes binaries are downloaded and installed onto the coreOS cluster, `ctl-c` out of this mode.

Check that the nodes have registered with the master.  In this example, kube-01 at address: `172.17.8.101` is the master, leaving the other 2 VMs as the nodes, shown below:

~~~bash
core@kube-01 ~ $ kubectl get nodes

NAME           LABELS                                STATUS
172.17.8.102   kubernetes.io/hostname=172.17.8.102   Ready
172.17.8.103   kubernetes.io/hostname=172.17.8.103   Ready

~~~

##Deploying the Guestbook App


Now you are ready to deploy the guestbook app on to the master node.

The guestbook php app consists of two replication controllers: one redis database master and another redis database slave. It also deploys a front-end service, which you will be able to load into your browser:

~~~bash
core@kube-01 ~ $ kubectl create -f guestbook-example
~~~

{% assign template_to_escape = '{{(index (index .items 0).spec.ports 0).nodePort}}' %}

> You can make a note of the port number returned after launching the guestbook app.
>
> You can also obtain it programatically later by calling:
> <br><br>
>
> ~~~bash
> core@kube-01 ~ $ kubectl get services \
>   --selector="name=frontend" \
>   --output="template" \
>   --template="{{template_to_escape}}"
> ~~~

Let’s take a look at the state of our Kubernetes cluster, we should see the three pods that we have just deployed. This should match the number of replication controllers as well as the front-end service. When you run this command, the pods will go from `Pending` to `Running` as shown below:

~~~bash
core@kube-01 ~ $ kubectl get pods -w

NAME                 READY     STATUS    RESTARTS   AGE
frontend-oba5w       1/1       Running   0          1h
frontend-rpjad       1/1       Running   0          1h
frontend-xhjc2       1/1       Running   0          1h
redis-master-t7b0b   1/1       Running   0          1h
redis-slave-kyi7u    1/1       Running   0          1h
redis-slave-ncdc3    1/1       Running   0          1h
~~~

Now you will be able to load the app into your browser using IP address of either of the nodes (`172.17.8.101`, `172.17.8.102`, `172.17.8.103`) and the port number that was returned when you ran `kubectl create -f guestbook-example` above.

![Guestbook front-end](/guides/images/kubernetes/coreos/guestbook.png)


Here are a few other useful commands for troubleshooting:

  - to list status of all Kubernetes master components: `systemctl status kube-*`
  - to see installation log: `journalctl`

##Conclusions

Weave is the only networking solution for Kubernetes, which offers a simple to use encryption. Weave also enables users to access un-orchestrated or even uncontainerized services (such as legacy databases), as well as those services on running on other orchestrators or cloud configuration managers, such as Mesos.

You can easily adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [email](mailto:help@weave.works) or [Twitter](https://twitter.com/weaveworks).

##Further Reading


* [Weave Features](/documentation/net-1.5-features)
* [Weave encryption](/documentation/net-1.5-features#security)
* [Weave IPAM](/documentation/net-1.5-features#addressing)
* [Weave - Weaving Containers into Applications](https://github.com/weaveworks/weave)
* [Documentation Home Page](/docs)
