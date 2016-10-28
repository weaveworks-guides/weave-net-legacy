
---
layout: guides
title: Troubleshooting Microservices with Weave Cloud
---



kubeadm join --token bed73b.290fdade7ec04860 45.55.57.4

In this four part tutorial how to manage and deploy microservices to the cloud is described. For example, say you have been tasked with defining making your app Cloud Native. And by Cloud Native, you mean that your app must be deployed to the cloud, which anticipates the large influx of expected users, and as a result it must also be scalable.

To satisfy these criterion, you've decided on the following: 

* Docker Containers
* Microservices-based architecture
* Continuous Integration and Delivery
* Kubernetes

In addition to the above, you soon find that you'll need to monitor this system you're deploying and at the same time a microservices troubleshooting dashboard might help speed up development time and deployment.

And while you want all of things to develop and deploy your app, you want to be able to do this quickly and without having to be the one who has to maintain a set of custom shell scripts connecting all of these processes together.

The first part of this series focuses on the troubleshooting, deploying and verifying your app on your local laptop. 

To do this, you will use the Weaveworks sample app, 'The Sock Shop', deploy it to a couple of virtual machines running Docker and Kubernetes and then verify and troubleshoot any issues in Weave Cloud. 

Specifically, in this tutorial, you will: 

1. Set up Docker for Mac (if you haven't already done so)
2. Deploy the Sockshop with Docker-compose
3. Install Scope and verify your app on your laptop.
3. Configure a Kubernetes cluster and at the same time install Weave Net onto Digital Ocean.
4. Use Weave Cloud to watch the Kubernetes cluster deployment in Digital Ocean.
5. Install the Sock Shop onto Kubernetes.
5. Compare both apps, on your laptop and in the Kubernetes cluster on Digital Ocean

This tutorial will take approximately 15 minutes to complete: 

## What You Will Use

* [Weave](http://weave.works)
* [Docker for Mac](https://docs.docker.com/docker-for-mac/docker-toolbox/)
* [Weaveworks Sockshop](
* [Kubernetes](
* [Weave Net](
* [Weave Cloud](


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

If you haven't installed Docker for Mac, please follow the installation instructions on <a href="https://docs.docker.com/docker-for-mac/" target="_blank"> Docker website </a>.

Once it's running you will see <img alt="Docker Icon in the Mac OS menu bar" src="https://github.com/weaveworks/guides/blob/master/weave-cloud-and-docker-for-mac/docker-for-mac-menu-bar-icon.png"
style="height: 1em;" /> in your menu bar.


<h3 id="deploy-the-demo-app">Deploying the Socks Shop App</h3>

To deploy The Socks Shop: 

**1. Get the code:**
~~~
git clone https://github.com/microservices-demo/microservices-demo.git
~~~


**2. Get the latest version of docker-compose file:**

~~~
curl -L https://github.com/docker/compose/releases/download/1.8.0/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
~~~


**3. In the repo you just cloned, cd into:**

~~~
/microservices-demo/deploy/docker-only
~~~ 

**4. Run the Sock Shop and display it in your browser:

~~~
docker-compose up -d user-db user catalogue-db catalogue rabbitmq queue-master cart-db cart orders-db shipping payment orders front-end edge-router
~~~

**Note:** If the shop doesn't come up right away or it gives you an error like `ERROR: for edge-router  Cannot start service edge-router:` because of a port in use, try going to `http://12.0.0.1` in your browser. 


###Run Tests

Next you will put some load on the app in order to simulate users in the Sock Shop:

~~~~
docker run weaveworksdemos/load-test -d 60 -h edge-router -c 3 -r 10
Cleaning up
docker-compose stop
docker-compose rm -f
~~~


###Verify the App in Weave Cloud

Let's verify the app in Weave Cloud to see that everything deployed correctly and that all services are behaving as they should. We'll do this first on your laptop and then also view the pods as they are deploying right in verify it again after you've deployed the same app to Kubernetes in Digital Ocean. 

To verify that everything installed correctly on your laptop sign up for Weave Cloud:

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a>
2.  Sign up using either a Github, or Google account or use an email address.
3.  Obtain the cloud service token from the User settings screen:

![Obtain service token for Weave Cloud](weave-cloud-token-screenshot.png)


Return to your Docker Window and install and launch the Weave Cloud agents:

~~~bash
sudo curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
~~~

**Where,** 

* `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` - is the token that appears on the settings page, once you’ve logged into Weave Cloud. 

**Note:** To set the Weave Cloud controls to read-only for all users, you can launch scope with the --probe.no-controls flag.  In this demo, you will be launching a terminal window and viewing messages between microservices, and so this flag is not necessary. However, you may want to keep this flag in mind when using Weave Cloud and sharing your infrastructure views with others outside of your organization.

Weave Cloud controls allow you to stop, start and pause containers. They also enable you to launch a terminal and interact directly with your containers.

##Set Up Droplets in Digital Ocean

Move over to Digital Ocean and create two Ubuntu instances to set up Kubernetes, container networking with Weave Net and finally deploy the Sock shop onto. 

##Setting Up Kubernetes and Weave Net

<h3 id="sign-up-to-weave-cloud">Adding an Additional Instance in Weave Cloud</h3>

But before you start installing Kubernetes, create an additional instance running in Weave Cloud. This will assist you when you're deploying Kubernetes and also when you launch the Sock Shop on Kubernetes.  You can do this by selecting the 'Create New Instance' located in the menu bar. 

**1. Install and launch the Weave Scope probes onto each of your Ubuntu instances:

~~~bash
sudo curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
~~~

If you return to the Weave Cloud interface, you should be able to view your two hosts networked and ready to go. 

Next you'll move over to Digital Ocean and create two Ubuntu droplets and setup a Kubernetes cluster, container networking and then deploy the Sock Shop in this environment. This example uses Digital Ocean, but you can just as easily create these two instances in AWS or on whoever your favourite cloud provider is. 

This is by far the simplest way in which to install Kubernetes.  In a few commands, you will have deployed a complete Kubernetes cluster with a resilient and secure container network onto the Cloud Provider of your choice.

[XXX add kubernetes instructions here XXX

**Note:**  Ensure that you make a note of the `kubeadm` token that is generated when you initialize one of your servers as the `master`, you need it later on to join the nodes from one server to another: `kubeadm join --token <token id>


## Overview

This quickstart shows you how to easily install a secure Kubernetes cluster on machines running Ubuntu 16.04 or CentOS 7.
The installation uses a tool called `kubeadm` which is part of Kubernetes 1.4.

This process works with local VMs, physical servers and/or cloud servers.
It is simple enough that you can easily integrate its use into your own automation (Terraform, Chef, Puppet, etc).

See the full [`kubeadm` reference](/docs/admin/kubeadm) for information on all `kubeadm` command-line flags and for advice on automating `kubeadm` itself.

**The `kubeadm` tool is currently in alpha but please try it out and give us [feedback](/docs/getting-started-guides/kubeadm/#feedback)!
Be sure to read the [limitations](#limitations); in particular note that kubeadm doesn't have great support for
automatically configuring cloud providers.  Please refer to the specific cloud provider documentation or
use another provisioning system.**

kubeadm assumes you have a set of machines (virtual or real) that are up and running.  It is designed
to be part of a larger provisioning system - or just for easy manual provisioning.  kubeadm is a great
choice where you have your own infrastructure (e.g. bare metal), or where you have an existing
orchestration system (e.g. Puppet) that you have to integrate with.

If you are not constrained, other tools build on kubeadm to give you complete clusters:

* On GCE, [Google Container Engine](https://cloud.google.com/container-engine/) gives you turn-key Kubernetes
* On AWS, [kops](kops) makes installation and cluster management easy (and supports high availability)

## Prerequisites

1. One or more machines running Ubuntu 16.04, CentOS 7 or HypriotOS v1.0.1
1. 1GB or more of RAM per machine (any less will leave little room for your apps)
1. Full network connectivity between all machines in the cluster (public or private network is fine)

## Objectives

* Install a secure Kubernetes cluster on your machines
* Install a pod network on the cluster so that application components (pods) can talk to each other
* Install a sample microservices application (a socks shop) on the cluster

## Instructions

### (1/4) Installing kubelet and kubeadm on your hosts

You will install the following packages on all the machines:

* `docker`: the container runtime, which Kubernetes depends on. v1.11.2 is recommended, but v1.10.3 and v1.12.1 are known to work as well.
* `kubelet`: the most core component of Kubernetes.
  It runs on all of the machines in your cluster and does things like starting pods and containers.
* `kubectl`: the command to control the cluster once it's running.
  You will only need this on the master, but it can be useful to have on the other nodes as well.
* `kubeadm`: the command to bootstrap the cluster.

For each host in turn:

* SSH into the machine and become `root` if you are not already (for example, run `sudo su -`).
* If the machine is running Ubuntu 16.04 or HypriotOS v1.0.1, run:

      # curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
      # cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
      deb http://apt.kubernetes.io/ kubernetes-xenial main
      EOF
      # apt-get update
      # # Install docker if you don't have it already.
      # apt-get install -y docker.io
      # apt-get install -y kubelet kubeadm kubectl kubernetes-cni

   If the machine is running CentOS 7, run:

      # cat <<EOF > /etc/yum.repos.d/kubernetes.repo
      [kubernetes]
      name=Kubernetes
      baseurl=http://yum.kubernetes.io/repos/kubernetes-el7-x86_64
      enabled=1
      gpgcheck=1
      repo_gpgcheck=1
      gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg
             https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
      EOF
      # setenforce 0
      # yum install -y docker kubelet kubeadm kubectl kubernetes-cni
      # systemctl enable docker && systemctl start docker
      # systemctl enable kubelet && systemctl start kubelet

The kubelet is now restarting every few seconds, as it waits in a crashloop for `kubeadm` to tell it what to do.

Note: `setenforce 0` will no longer be necessary on CentOS once [#33555](https://github.com/kubernetes/kubernetes/pull/33555) is included in a released version of `kubeadm`.

### (2/4) Initializing your master

The master is the machine where the "control plane" components run, including `etcd` (the cluster database) and the API server (which the `kubectl` CLI communicates with).
All of these components run in pods started by `kubelet`.

Right now you can't run `kubeadm init` twice without turning down the cluster in between, see [Turndown](#turndown).

To initialize the master, pick one of the machines you previously installed `kubelet` and `kubeadm` on, and run:

     # kubeadm init

**Note:** this will autodetect the network interface to advertise the master on as the interface with the default gateway.
If you want to use a different interface, specify `--api-advertise-addresses=<ip-address>` argument to `kubeadm init`.

If you want to use [flannel](https://github.com/coreos/flannel) as the pod network; specify `--pod-network-cidr=10.244.0.0/16` if you're using the daemonset manifest below. _However, please note that this is not required for any other networks, including Weave, which is the recommended pod network._

Please refer to the [kubeadm reference doc](/docs/admin/kubeadm/) if you want to read more about the flags `kubeadm init` provides.

This will download and install the cluster database and "control plane" components.
This may take several minutes.

The output should look like:

    <master/tokens> generated token: "f0c861.753c505740ecde4c"
    <master/pki> created keys and certificates in "/etc/kubernetes/pki"
    <util/kubeconfig> created "/etc/kubernetes/kubelet.conf"
    <util/kubeconfig> created "/etc/kubernetes/admin.conf"
    <master/apiclient> created API client configuration
    <master/apiclient> created API client, waiting for the control plane to become ready
    <master/apiclient> all control plane components are healthy after 61.346626 seconds
    <master/apiclient> waiting for at least one node to register and become ready
    <master/apiclient> first node is ready after 4.506807 seconds
    <master/discovery> created essential addon: kube-discovery
    <master/addons> created essential addon: kube-proxy
    <master/addons> created essential addon: kube-dns

    Kubernetes master initialised successfully!

    You can connect any number of nodes by running:

    kubeadm join --token <token> <master-ip>

Make a record of the `kubeadm join` command that `kubeadm init` outputs.
You will need this in a moment.
The key included here is secret, keep it safe &mdash; anyone with this key can add authenticated nodes to your cluster.

The key is used for mutual authentication between the master and the joining nodes.

By default, your cluster will not schedule pods on the master for security reasons.
If you want to be able to schedule pods on the master, for example if you want a single-machine Kubernetes cluster for development, run:

    # kubectl taint nodes --all dedicated-
    node "test-01" tainted
    taint key="dedicated" and effect="" not found.
    taint key="dedicated" and effect="" not found.

This will remove the "dedicated" taint from any nodes that have it, including the master node, meaning that the scheduler will then be able to schedule pods everywhere.

### (3/4) Installing a pod network

You must install a pod network add-on so that your pods can communicate with each other. 
In the meantime, the kubenet network plugin doesn't work. Instead, CNI plugin networks are supported, those you see below.
**It is necessary to do this before you try to deploy any applications to your cluster, and before `kube-dns` will start up.**

Several projects provide Kubernetes pod networks.
You can see a complete list of available network add-ons on the [add-ons page](/docs/admin/addons/).

By way of example, you can install [Weave Net](https://github.com/weaveworks/weave-kube) by logging in to the master and running:

    # kubectl apply -f https://git.io/weave-kube
    daemonset "weave-net" created

If you prefer [Calico](https://github.com/projectcalico/calico-containers/tree/master/docs/cni/kubernetes/manifests/kubeadm) or [Canal](https://github.com/tigera/canal/tree/master/k8s-install/kubeadm), please refer to their respective installation guides. 

If you are on another architecture than amd64, you should use the flannel overlay network as described in [the multi-platform section](#kubeadm-is-multi-platform)

NOTE: You can install **only one** pod network per cluster.

Once a pod network has been installed, you can confirm that it is working by checking that the `kube-dns` pod is `Running` in the output of `kubectl get pods --all-namespaces`.

And once the `kube-dns` pod is up and running, you can continue by joining your nodes.

### (4/4) Joining your nodes

The nodes are where your workloads (containers and pods, etc) run.
If you want to add any new machines as nodes to your cluster, for each machine: SSH to that machine, become root (e.g. `sudo su -`) and run the command that was output by `kubeadm init`.
For example:

    # kubeadm join --token <token> <master-ip>
    <util/tokens> validating provided token
    <node/discovery> created cluster info discovery client, requesting info from "http://138.68.156.129:9898/cluster-info/v1/?token-id=0f8588"
    <node/discovery> cluster info object received, verifying signature using given token
    <node/discovery> cluster info signature and contents are valid, will use API endpoints [https://138.68.156.129:443]
    <node/csr> created API client to obtain unique certificate for this node, generating keys and certificate signing request
    <node/csr> received signed certificate from the API server, generating kubelet configuration
    <util/kubeconfig> created "/etc/kubernetes/kubelet.conf"

    Node join complete:
    * Certificate signing request sent to master and response
      received.
    * Kubelet informed of new secure connection details.

    Run 'kubectl get nodes' on the master to see this machine join.

A few seconds later, you should notice that running `kubectl get nodes` on the master shows a cluster with as many machines as you created.

### (Optional) Control your cluster from machines other than the master

In order to get a kubectl on your laptop for example to talk to your cluster, you need to copy the `KubeConfig` file from your master to your laptop like this:

    # scp root@<master ip>:/etc/kubernetes/admin.conf .
    # kubectl --kubeconfig ./admin.conf get nodes

### (Optional) Installing a sample application

As an example, install a sample microservices application, a socks shop, to put your cluster through its paces.
To learn more about the sample microservices app, see the [GitHub README](https://github.com/microservices-demo/microservices-demo).

    # kubectl create namespace sock-shop
    # kubectl apply -n sock-shop -f "https://github.com/microservices-demo/microservices-demo/blob/master/deploy/kubernetes/complete-demo.yaml?raw=true"

You can then find out the port that the [NodePort feature of services](/docs/user-guide/services/) allocated for the front-end service by running:

    # kubectl describe svc front-end -n sock-shop
    Name:                   front-end
    Namespace:              sock-shop
    Labels:                 name=front-end
    Selector:               name=front-end
    Type:                   NodePort
    IP:                     100.66.88.176
    Port:                   <unset> 80/TCP
    NodePort:               <unset> 31869/TCP
    Endpoints:              <none>
    Session Affinity:       None

It takes several minutes to download and start all the containers, watch the output of `kubectl get pods -n sock-shop` to see when they're all up and running.

Then go to the IP address of your cluster's master node in your browser, and specify the given port.
So for example, `http://<master_ip>:<port>`.
In the example above, this was `31869`, but it is a different port for you.

If there is a firewall, make sure it exposes this port to the internet before you try to access it.

## Tear down

* To uninstall the socks shop, run `kubectl delete namespace sock-shop` on the master.

* To undo what `kubeadm` did, simply delete the machines you created for this tutorial, or run the script below and then start over or uninstall the packages.

  <br>
  Reset local state:
  <pre><code>systemctl stop kubelet;
  docker rm -f -v $(docker ps -q);
  find /var/lib/kubelet | xargs -n 1 findmnt -n -t tmpfs -o TARGET -T | uniq | xargs -r umount -v;
  rm -r -f /etc/kubernetes /var/lib/kubelet /var/lib/etcd;
  </code></pre>
  If you wish to start over, run `systemctl start kubelet` followed by `kubeadm init` or `kubeadm join`.
  <!-- *syntax-highlighting-hack -->

## Explore other add-ons

See the [list of add-ons](/docs/admin/addons/) to explore other add-ons, including tools for logging, monitoring, network policy, visualization &amp; control of your Kubernetes cluster.

## What's next

* Learn about `kubeadm`'s advanced usage on the [advanced reference doc](/docs/admin/kubeadm/)
* Learn more about [Kubernetes concepts and kubectl in Kubernetes 101](/docs/user-guide/walkthrough/).

## Feedback

* Slack Channel: [#sig-cluster-lifecycle](https://kubernetes.slack.com/messages/sig-cluster-lifecycle/)
* Mailing List: [kubernetes-sig-cluster-lifecycle](https://groups.google.com/forum/#!forum/kubernetes-sig-cluster-lifecycle)
* [GitHub Issues](https://github.com/kubernetes/kubernetes/issues): please tag `kubeadm` issues with `@kubernetes/sig-cluster-lifecycle`

## kubeadm is multi-platform

kubeadm deb packages and binaries are built for amd64, arm and arm64, following the [multi-platform proposal](https://github.com/kubernetes/kubernetes/blob/master/docs/proposals/multi-platform.md).

deb-packages are released for ARM and ARM 64-bit, but not RPMs (yet, reach out if there's interest).

Anyway, ARM had some issues when making v1.4, see [#32517](https://github.com/kubernetes/kubernetes/pull/32517) [#33485](https://github.com/kubernetes/kubernetes/pull/33485), [#33117](https://github.com/kubernetes/kubernetes/pull/33117) and [#33376](https://github.com/kubernetes/kubernetes/pull/33376). 

However, thanks to the PRs above, `kube-apiserver` works on ARM from the `v1.4.1` release, so make sure you're at least using `v1.4.1` when running on ARM 32-bit

The multiarch flannel daemonset can be installed this way. Make sure you replace `ARCH=amd64` with `ARCH=arm` or `ARCH=arm64` if necessary.

    # ARCH=amd64 curl -sSL https://raw.githubusercontent.com/luxas/flannel/update-daemonset/Documentation/kube-flannel.yml | sed "s/amd64/${ARCH}/g" | kubectl create -f -

And obviously replace `ARCH=amd64` with `ARCH=arm` or `ARCH=arm64` depending on the platform you're running on.

## Limitations

Please note: `kubeadm` is a work in progress and these limitations will be addressed in due course.

1. The cluster created here doesn't have cloud-provider integrations by default, so for example it doesn't work automatically with (for example) [Load Balancers](/docs/user-guide/load-balancer/) (LBs) or [Persistent Volumes](/docs/user-guide/persistent-volumes/walkthrough/) (PVs).
   To set up kubeadm with CloudProvider integrations (it's experimental, but try), refer to the [kubeadm reference](/docs/admin/kubeadm/) document.

   Workaround: use the [NodePort feature of services](/docs/user-guide/services/#type-nodeport) for exposing applications to the internet.
1. The cluster created here has a single master, with a single `etcd` database running on it.
   This means that if the master fails, your cluster loses its configuration data and will need to be recreated from scratch.
   Adding HA support (multiple `etcd` servers, multiple API servers, etc) to `kubeadm` is still a work-in-progress.

   Workaround: regularly [back up etcd](https://coreos.com/etcd/docs/latest/admin_guide.html).
   The `etcd` data directory configured by `kubeadm` is at `/var/lib/etcd` on the master.
1. `kubectl logs` is broken with `kubeadm` clusters due to [#22770](https://github.com/kubernetes/kubernetes/issues/22770).

   Workaround: use `docker logs` on the nodes where the containers are running as a workaround.

1. If you are using VirtualBox (directly or via Vagrant), you will need to ensure that `hostname -i` returns a routable IP address (i.e. one on the second network interface, not the first one).
   By default, it doesn't do this and kubelet ends-up using first non-loopback network interface, which is usually NATed.
   Workaround: Modify `/etc/hosts`, take a look at this [`Vagrantfile`][ubuntu-vagrantfile] for how you this can be achieved.

[ubuntu-vagrantfile]: https://github.com/errordeveloper/k8s-playground/blob/22dd39dfc06111235620e6c4404a96ae146f26fd/Vagrantfile#L11),





##Deploy the Sock Shop to Kubernetes

Now that everything is setup you're ready to deploy the Sock Shop onto your two instances in Digital Ocean: 



<h3 id="run-the-load-test">Running the Load Test</h3>

To fully appreciate the topology of this app, you will need to run a load on the app. 

Run a load test with the following:

~~~bash
docker run -ti --rm --name=LOAD_TEST \
  --net=shop_external \
  weaveworksdemos/load-test -h edge-router -r 100 -c 2
~~~

With the load test running, you can observe the different services communicating by clicking on the Load Test container in Weave Cloud. From the metrics panel,  open Load Test's terminal to view the messages. With the load test running, the topology graph in Weave Cloud console will also form.

![Weave Load Test](load-test-messages.png)





