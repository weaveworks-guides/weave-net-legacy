---
layout: guides
title: Troubleshooting Microservices with Weave Cloud
---

<h1 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope">Setup: Troubleshooting Dashboard with Weave Cloud and Weave Scope</h1>

<img src="setup.png" style="width:100%; border:1em solid #32324b;" />

This is Part 1 of 4 of the <a href="/guides/">Weave Cloud guides series</a>. In this part, we'll see how to set up, verify and troubleshoot your app with Weave Cloud and Weave Scope.
* We'll start on your local laptop using Docker Compose in development.
* Then we'll see how to set up Kubernetes for production, including Weave Net, and then deploy your application to it.

<div style="width:50%; float:right; text-align:right;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">Go to next part: Part 2 – Deploy: Continuous Delivery &raquo;</a>
</div>
<div style="clear:both;"></div>

<center><div style="width:300px; display:inline-block; border:1px solid red; margin-top:2em;">
VIDEO GOES HERE
</div></center>

<h2 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-contents">Contents</h2>

* [Setup: Troubleshooting Dashboard with Weave Cloud and Weave Scope](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope)
    * [Contents](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-contents)
    * [Set up](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-set-up)
    * [What You Will Use](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-what-you-will-use)
    * [Before You Begin](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-before-you-begin)
    * [If you're on a Mac](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-if-you-re-on-a-mac)
    * [Sign Up for Weave Cloud](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-sign-up-for-weave-cloud)
        * [Launch the Weave Cloud Probes](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-sign-up-for-weave-cloud-launch-the-weave-cloud-probes)
    * [Deploying the Socks Shop](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-deploying-the-socks-shop)
        * [Run a Load Test on the Sock Shop](#setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-deploying-the-socks-shop-run-a-load-test-on-the-sock-shop)
* [Deploying the app to "production" on Kubernetes](#deploying-the-app-to-production-on-kubernetes)
    * [Set Up Droplets in Digital Ocean](#deploying-the-app-to-production-on-kubernetes-set-up-droplets-in-digital-ocean)
        * [Create two Ubuntu Instances](#deploying-the-app-to-production-on-kubernetes-set-up-droplets-in-digital-ocean-create-two-ubuntu-instances)
        * [Adding an Additional Instance to Weave Cloud](#deploying-the-app-to-production-on-kubernetes-set-up-droplets-in-digital-ocean-adding-an-additional-instance-to-weave-cloud)
    * [Set up a Kubernetes Cluster](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster)
        * [Objectives](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-objectives)
        * [Installing kubelet and kubeadm on Your Hosts](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-installing-kubelet-and-kubeadm-on-your-hosts)
        * [Install and Launch Weave Scope](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-install-and-launch-weave-scope)
        * [Initializing the Master](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-initializing-the-master)
        * [Installing Weave Net](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-installing-weave-net)
        * [Joining Your Nodes](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-joining-your-nodes)
        * [(Optional) Control Your Cluster From Machines Other Than The Master](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-optional-control-your-cluster-from-machines-other-than-the-master)
        * [Installing the Sock Shop onto Kubernetes](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-installing-the-sock-shop-onto-kubernetes)
        * [Viewing the Sock Shop in Your Browser](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-viewing-the-sock-shop-in-your-browser)
        * [Viewing the Result in Weave Cloud](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-viewing-the-result-in-weave-cloud)
        * [Run the Load Test on the Cluster](#deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-run-the-load-test-on-the-cluster)
    * [Tear Down](#deploying-the-app-to-production-on-kubernetes-tear-down)
    * [Recreating the Cluster: Starting Over](#deploying-the-app-to-production-on-kubernetes-recreating-the-cluster-starting-over)
    * [Conclusions](#deploying-the-app-to-production-on-kubernetes-conclusions)


<h2 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-set-up">Set up</h2>

In this four-part tutorial how to deploy, deliver, and monitor a secure microservices Cloud Native app is described.

To streamline your app development pipeline and make your app Cloud Native to develop code faster, the following will be incorporated:

* A microservices-based architecture
* Docker Containers
* Continuous Integration and Delivery
* Kubernetes container orchestration

A Cloud Native app gives you the freedom to focus on your code instead of maintaining cloud tools, where rapid, incremental updates can be made without having to disassemble and reassemble your infrastructure each time a new feature is added.  And while the ability to rapidly deploy changes to your app is important, the freedom to choose your own source control system, deployment tools and container registry without having to maintain a set of custom scripts is also critical.

With Weave Cloud you can view and monitor your microservices all in one place in a convenient troubleshooting dashboard, and together with automated continuous delivery built with your favorite tools, Weave Cloud allows you to create higher quality code more rapidly.

Part 1 discusses the Troubleshooting Dashboard and how to verify your app using the Weave Cloud dashboard on your local laptop with an app deployed to a production setup like Kubernetes running on Digital Ocean.

[Part 2] describes how to setup Fast Iteration and Continuous Delivery with Weave Cloud.

[Part 3] discusses how to configure Cloud Native Monitoring with Weave Cortex as well as viewing and querying your app's metrics from the Weave Cloud dashboard.

[Part 4] Network Security and Policy with Weave Cloud shows you to how simply, yet powerfully secure your app or portions of your app.

You will use the Weaveworks sample app, [The Sock Shop](https://github.com/microservices-demo), deploy it to a couple of virtual machines running Docker and Kubernetes and then verify and troubleshoot any issues in Weave Cloud.

Specifically, in this tutorial, you will:

1. Set up Docker or Docker for Mac on your local machine (if you haven't already done so).
2. Deploy the sock shop with Docker Compose.
3. Install Scope and verify your app on your laptop.
3. Configure a Kubernetes cluster and at the same time install Weave Net onto Digital Ocean.
4. Use Weave Cloud to watch the Kubernetes cluster deployment in Digital Ocean.
5. Install the Sock Shop onto Kubernetes.
5. Compare both apps, on your laptop and in the Kubernetes cluster on Digital Ocean.

This tutorial will take approximately 15 minutes to complete.

<h2 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-what-you-will-use">What You Will Use</h2>

* [Weave Cloud](https://cloud.weave.works)
* [Docker for Mac](https://docs.docker.com/docker-for-mac/docker-toolbox/)
* [Weaveworks Sockshop](https://github.com/microservices-demo)
* [Kubernetes](http://kubernetes.io/)
* [Weave Net](https://www.weave.works/products/weave-net/)

<!-- TODO deduplicate this wrt the docker for mac guide... -->

<h2 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-before-you-begin">Before You Begin</h2>

Ensure that you have the following installed:

* [Git](http://git-scm.com/downloads)
* [Docker](https://docs.docker.com/engine/installation/) and [Docker Compose](https://docs.docker.com/compose/install/)
  * Note that this guide also works with [Docker for Mac](https://docs.docker.com/docker-for-mac/)

<h2 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-if-you-re-on-a-mac">If you&#39;re on a Mac</h2>

If you haven't installed Docker for Mac before, follow the installation instructions on <a href="https://docs.docker.com/docker-for-mac/" target="_blank">Docker website </a>. <!-- lkj_ -->

Once it's running you will see <img alt="Docker Icon in the Mac OS menu bar" src="/wp-content/uploads/docker-for-mac-menu-bar-icon.png" style="height: 1em; display:inline-block;" /> in your menu bar.

<h2 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-sign-up-for-weave-cloud">Sign Up for Weave Cloud</h2>

Next, use Weave Cloud to verify what was just deployed to your laptop and check that everything deployed correctly and that all services are behaving as they should. You will verify the app first on your laptop. Then you'll use Weave Cloud to view the Kubernetes pods as they get deployed, and again to verify the Sock Shop after it gets deployed to Kubernetes in Digital Ocean.

To check that everything installed correctly on your laptop, first sign up for Weave Cloud:

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a> <!-- lkj_ -->
2.  Sign up using either a Github, or Google account or use an email address.
3.  Obtain the cloud service token from the User settings screen:

![Obtain service token for Weave Cloud](weave-cloud-token-screenshot.png)

<h3 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-sign-up-for-weave-cloud-launch-the-weave-cloud-probes">Launch the Weave Cloud Probes</h3>

Launch the Weave Cloud probes using the token you obtained when you signed up for Weave Cloud:

~~~bash
curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
~~~

**Where,**

* `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` - is the token that appears on the settings page, once you’ve logged into Weave Cloud.

**Note:** To set the Weave Cloud controls to read-only for all users, you can launch scope with the `--probe.no-controls` flag.  In this demo, you will be launching a terminal window and viewing messages between microservices, and so this flag is not necessary. However, you may want to keep this flag in mind when using Weave Cloud and sharing your infrastructure views with others outside of your organization.

Weave Cloud controls allow you to stop, start and pause containers. They also enable you to launch a terminal and interact directly with your containers.

<h2 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-deploying-the-socks-shop">Deploying the Socks Shop</h2>

To deploy The Socks Shop:

**1. Get the code:**
~~~
git clone https://github.com/microservices-demo/microservices-demo.git
~~~


**2. Change into the right directory in the repo you just cloned:**

<!-- XXX this doesn't work any more :/ -->

~~~
cd microservices-demo/deploy/docker-only
~~~


**3. Run the Sock Shop and display it in your browser:**

~~~
docker-compose up -d
~~~

**Note:** If the shop doesn't come up right away or it gives you an error like `ERROR: for edge-router  Cannot start service edge-router:` because of a port in use, try going to `http://127.0.0.1` in your browser.

<h3 id="setup-troubleshooting-dashboard-with-weave-cloud-and-weave-scope-deploying-the-socks-shop-run-a-load-test-on-the-sock-shop">Run a Load Test on the Sock Shop</h3>

To fully appreciate the topology of this app in Weave Scope (the graph of your containers visible in Weave Cloud), you will need to run a load on the app.

Run a load test with the following:

~~~bash
docker run -ti --rm --name=LOAD_TEST \
  --net=shop_external \
  weaveworksdemos/load-test -h edge-router -r 100 -c 2
~~~

With the load test running, you can observe the different services communicating by clicking on the Load Test container in Weave Cloud. From the metrics panel, open the load test's terminal to view the messages. With the load test running, the topology graph in Weave Cloud console will also form.

![Weave Load Test](load-test-messages.png)

<h1 id="deploying-the-app-to-production-on-kubernetes">Deploying the app to &quot;production&quot; on Kubernetes</h1>

**Note:** This example uses Digital Ocean, but you can just as easily create these two instances in AWS or whatever your favorite cloud provider is.

<h2 id="deploying-the-app-to-production-on-kubernetes-set-up-droplets-in-digital-ocean">Set Up Droplets in Digital Ocean</h2>

Sign up for [Digital Ocean](https://digitalocean.com) and create three Ubuntu instances, where you'll deploy a Kubernetes cluster, add a container network using Weave Net and finally deploy the Sock Shop onto the cluster and verify this deployment with the one you just did on your laptop in Weave Cloud.

**Note:** It is recommended that each host have at least 4 gigabytes of memory in order to run this demo smoothly.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-droplets-in-digital-ocean-create-two-ubuntu-instances">Create two Ubuntu Instances</h3>

Next you'll move over to Digital Ocean and create two Ubuntu droplets.
Both machines should run Ubuntu 16.04 with 4GB or more of RAM per machine.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-droplets-in-digital-ocean-adding-an-additional-instance-to-weave-cloud">Adding an Additional Instance to Weave Cloud</h3>

Before you start installing Kubernetes, create an additional instance in Weave Cloud. This extra instance assists you when you're deploying Kubernetes and will also allow you to see the Sock Shop as it spins up on Kubernetes.  

Select the 'Create New Instance' command located in the menu bar.


<h2 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster">Set up a Kubernetes Cluster</h2>

This is by far the simplest way in which to install Kubernetes.  In a few commands, you will have deployed a complete Kubernetes cluster with a resilient and secure container network onto the Cloud Provider of your choice.

The installation uses a tool called `kubeadm` which is part of Kubernetes 1.4.

This process works with local VMs, physical servers and/or cloud servers.
It is simple enough that you can easily integrate its use into your own automation (Terraform, Chef, Puppet, etc).

See the full [`kubeadm` reference](http://kubernetes.io/docs/admin/kubeadm) for information on all `kubeadm` command-line flags and for advice on automating `kubeadm` itself.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-objectives">Objectives</h3>

* Install a secure Kubernetes cluster on your machines
* Install a pod network on the cluster so that application components (pods) can talk to each other
* Install a sample microservices application (a socks shop) on the cluster
* View the result in Weave Cloud as you go along

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-installing-kubelet-and-kubeadm-on-your-hosts">Installing kubelet and kubeadm on Your Hosts</h3>

You will install the following packages on all the machines:

* `docker`: the container runtime, which Kubernetes depends on. v1.11.2 is recommended, but v1.10.3 and v1.12.1 are known to work as well.
* `kubelet`: the most core component of Kubernetes.
  It runs on all of the machines in your cluster and does things like starting pods and containers.
* `kubectl`: the command to control the cluster once it's running.
  You will only need this on the master, but it can be useful to have on the other nodes as well.
* `kubeadm`: the command to bootstrap the cluster.

For each host:

* SSH into the machine and become `root` if you are not already (for example, run `sudo su -`):

~~~
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
~~~

Install docker if you don't have it already. You can also use the [official Docker packages](https://docs.docker.com/engine/installation/).
~~~
apt-get install -y docker.io
apt-get install -y kubelet kubeadm kubectl kubernetes-cni
~~~

**Note:** You may have to re-run `apt-get update` and then run `apt-get install -y kubelet kubeadm kubectl kubernetes-cni` second time to ensure that the packages are properly downloaded.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-install-and-launch-weave-scope">Install and Launch Weave Scope</h3>

Install and launch the Weave Scope probes onto each of your Ubuntu instances:

~~~bash
sudo curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
~~~

If you return to the Weave Cloud interface, you can click on the `Hosts` button and view your two Ubuntu hosts networked ready to go.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-initializing-the-master">Initializing the Master</h3>

The master is the machine where the "control plane" components run, including `etcd` (the cluster database) and the API server (which the `kubectl` CLI communicates with).

All of these components run in pods started by `kubelet`.

Right now you can't run `kubeadm init` twice without turning down the cluster in between, see [Tear Down](#tear-down).

To initialize the master, pick one of the machines you previously installed `kubelet` and `kubeadm` on, and run:

     # kubeadm init

**Note:** this will autodetect the network interface to advertise the master on as the interface with the default gateway.

If you want to use a different interface, specify `--api-advertise-addresses=<ip-address>` argument to `kubeadm init`.

Please refer to the [kubeadm reference doc](http://kubernetes.io/docs/admin/kubeadm/) if you want to read more about the flags `kubeadm init` provides.

This command downloads and installs the cluster database and the "control plane" components.
This may take several minutes.

The output should look like:

~~~
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
~~~

Make a record of the `kubeadm join` command that `kubeadm init` outputs.
You will need this in a moment.

The key included here is secret, keep it safe &mdash; anyone with this key can add authenticated nodes to your cluster.

The key is used for mutual authentication between the master and the joining nodes.

By default, your cluster will not schedule pods on the master for security reasons.
If you want to be able to schedule pods on the master, for example if you want a single-machine Kubernetes cluster for development, run:

~~~
    # kubectl taint nodes --all dedicated-
    node "test-01" tainted
    taint key="dedicated" and effect="" not found.
    taint key="dedicated" and effect="" not found.
~~~

This will remove the "dedicated" taint from any nodes that have it, including the master node, meaning that the scheduler will then be able to schedule pods everywhere.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-installing-weave-net">Installing Weave Net</h3>

You must install a pod network so that your pods can communicate with each other. This guide shows you how to install Weave Net.

**You must add Weave Net before deploying any applications to your cluster and before `kube-dns` starts up.**

Install [Weave Net](https://github.com/weaveworks/weave-kube) by logging in to the master and running:

~~~
kubectl apply -f https://git.io/weave-kube
daemonset "weave-net" created
~~~

**Note:** Install **only one** pod network per cluster.

Once a pod network is installed, confirm that it is working by checking that the `kube-dns` pod is `Running` in the output of `kubectl get pods --all-namespaces`.

And once the `kube-dns` pod is up and running, you can continue on to joining your nodes.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-joining-your-nodes">Joining Your Nodes</h3>

The nodes are where your workloads (containers and pods, etc) run.
If you want to add any new machines as nodes to your cluster, for each machine: SSH to that machine, become root (e.g. `sudo su -`) and run the command that was output by `kubeadm init`.
For example:

~~~
kubeadm join --token <token> <master-ip>
~~~

The output should look like:
~~~
<util/tokens> validating provided token
<node/discovery> created cluster info discovery client, requesting info from "http://X.X.X.X:9898/cluster-info/v1/?token-id=0f8588"
<node/discovery> cluster info object received, verifying signature using given token
<node/discovery> cluster info signature and contents are valid, will use API endpoints [https://X.X.X.X:443]
<node/csr> created API client to obtain unique certificate for this node, generating keys and certificate signing request
<node/csr> received signed certificate from the API server, generating kubelet configuration
<util/kubeconfig> created "/etc/kubernetes/kubelet.conf"
Node join complete:
* Certificate signing request sent to master and response
  received.
* Kubelet informed of new secure connection details.
~~~

Run 'kubectl get nodes' on the master to see this machine join.

A few seconds later, you should notice that running `kubectl get nodes` on the master shows a cluster with as many machines as you created.

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-optional-control-your-cluster-from-machines-other-than-the-master">(Optional) Control Your Cluster From Machines Other Than The Master</h3>

In order to get kubectl on (for example) your laptop to talk to your cluster, you need to copy the `kubeconfig` file from your master to your laptop like this:

~~~
scp root@<master ip>:/etc/kubernetes/admin.conf .
kubectl --kubeconfig ./admin.conf get nodes
~~~

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-installing-the-sock-shop-onto-kubernetes">Installing the Sock Shop onto Kubernetes</h3>

As an example, install a sample microservices application, a socks shop, to put your cluster through its paces.
To learn more about the sample microservices app, see the [microservices-demo README](https://github.com/microservices-demo/microservices-demo).

~~~
kubectl create namespace sock-shop
kubectl apply -n sock-shop -f "https://github.com/microservices-demo/microservices-demo/blob/master/deploy/kubernetes/complete-demo.yaml?raw=true"
~~~

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-viewing-the-sock-shop-in-your-browser">Viewing the Sock Shop in Your Browser</h3>

You can then find the port that the [NodePort feature of services](/docs/user-guide/services/) allocated for the front-end service by running:

~~~
kubectl describe svc front-end -n sock-shop
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
~~~

It takes several minutes to download and start all of the containers, watch the output of `kubectl get pods -n sock-shop` to see when they're all up and running.

Or you can view the containers appearing on the screen as they get created in Weave Cloud.

Then go to the IP address of your cluster's master node in your browser, and specify the given port.
So for example, `http://<master_ip>:<port>`.

In the example above, this was `31869`, but it is a different port for you.

If there is a firewall, make sure it exposes this port to the internet before you try to access it.

[sockshop screenshot]

<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-viewing-the-result-in-weave-cloud">Viewing the Result in Weave Cloud</h3>

You can also view the result in Weave Cloud and also watch all of the pods as they join the cluster.

[weave cloud screenshot]


<h3 id="deploying-the-app-to-production-on-kubernetes-set-up-a-kubernetes-cluster-run-the-load-test-on-the-cluster">Run the Load Test on the Cluster</h3>

After the Sock Shop has completely deployed onto the cluster, run the same load test as you did on your laptop and then view the results in Weave Cloud.

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -h edge-router -r 100 -c 2 <host-ip:[port number]>
~~~

Where,

* `<host-ip:[port number]>` is the IP of the master and the port number you see when you run `kubectl describe svc front-end -n sock-shop`


<h2 id="deploying-the-app-to-production-on-kubernetes-tear-down">Tear Down</h2>

Unless you are continuing onto part 2, then you may want to tear down the Sock Shop and also the Kubernetes cluster you just created.

If you made a mistep during the install instructions, it is recommended that you delete the entire cluster and begin again.

* To uninstall the socks shop, run `kubectl delete namespace sock-shop` on the master.

* To undo what `kubeadm` did, simply delete the machines you created for this tutorial, or run the script below and then start over or uninstall the packages.

To reset local state run the following script:

~~~
systemctl stop kubelet;
docker rm -f -v $(docker ps -q);
find /var/lib/kubelet | xargs -n 1 findmnt -n -t tmpfs -o TARGET -T | uniq | xargs -r umount -v;
rm -r -f /etc/kubernetes /var/lib/kubelet /var/lib/etcd;
~~~

<h2 id="deploying-the-app-to-production-on-kubernetes-recreating-the-cluster-starting-over">Recreating the Cluster: Starting Over</h2>

If you wish to start over, run `systemctl start kubelet` followed by `kubeadm init`on the master and `kubeadm join` on any of the nodes.


<h2 id="deploying-the-app-to-production-on-kubernetes-conclusions">Conclusions</h2>

In this tutorial you learned how to verify your app deployed to your laptop with the same tools (Weave Scope) that you can use when your app is deployed to a Kubernetes cluster. The next next part of this series discusses how to configure "Continuous Delivery with Weave Cloud".

<div style="width:50%; float:right; text-align:right;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">Go to next part: Part 2 – Deploy: Continuous Delivery &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>

If you have any questions or comments you can reach out to us on our [Slack channel](https://slack.weave.works/) or through one of these other channels on [Help](https://www.weave.works/help/).

