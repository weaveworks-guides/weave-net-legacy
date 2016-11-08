<!-- Monitor: Prometheus Monitoring with Weave Cortex -->



This is Part 3 of 4 of the <a href="/guides/">Weave Cloud guides series</a>.

In this guide you will configure monitoring with Weave Cloud and Weave Cortex, a Prometheus-powered monitoring service.



<div style="width:50%; padding: 10px; float:left; font-weight: 700;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">&laquo; Go to previous part: Part 2 – Deploy: Continuous Delivery</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-4-secure-container-firewalls/">Go to next part: Part 4 – Secure: Container Firewalls &raquo;</a>
</div>
<div style="clear:both;"></div>

<img src="images/monitor.png" style="width:100%; border:1em solid #32324b;" />

<p></p>
View your app, network & container orchestrator metrics in the Weave Cloud monitoring dashboard, all in one place. This example uses Kubernetes.

<h2 id="a-video-overview">A Video Overview</h2>

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe src="https://player.vimeo.com/video/190563580" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
</div></center>


<h2 id="contents">Contents</h2>

* [A Video Overview](#a-video-overview)
* [Contents](#contents)
* [Introduction](#introduction)
* [What You Will Use](#what-you-will-use)
* [Sign Up for Weave Cloud](#sign-up-for-weave-cloud)
* [Deploy a Kubernetes cluster with Weave Net and then deploy a sample application (the socks shop) to it](#deploy-a-kubernetes-cluster-with-weave-net-and-then-deploy-a-sample-application-the-socks-shop-to-it)
* [Set Up Droplets in Digital Ocean](#set-up-droplets-in-digital-ocean)
    * [Create three Ubuntu Instances](#set-up-droplets-in-digital-ocean-create-three-ubuntu-instances)
    * [Adding an Additional Instance to Weave Cloud](#set-up-droplets-in-digital-ocean-adding-an-additional-instance-to-weave-cloud)
* [Set up a Kubernetes Cluster with kubeadm](#set-up-a-kubernetes-cluster-with-kubeadm)
    * [Objectives](#set-up-a-kubernetes-cluster-with-kubeadm-objectives)
    * [Installing kubelet and kubeadm on Your Hosts](#set-up-a-kubernetes-cluster-with-kubeadm-installing-kubelet-and-kubeadm-on-your-hosts)
    * [Initializing the Master](#set-up-a-kubernetes-cluster-with-kubeadm-initializing-the-master)
    * [Installing Weave Net](#set-up-a-kubernetes-cluster-with-kubeadm-installing-weave-net)
    * [Joining Your Nodes](#set-up-a-kubernetes-cluster-with-kubeadm-joining-your-nodes)
    * [(Optional) Control Your Cluster From Machines Other Than The Master](#set-up-a-kubernetes-cluster-with-kubeadm-optional-control-your-cluster-from-machines-other-than-the-master)
    * [Install and Launch Weave Scope](#set-up-a-kubernetes-cluster-with-kubeadm-install-and-launch-weave-scope)
    * [Installing the Sock Shop onto Kubernetes](#set-up-a-kubernetes-cluster-with-kubeadm-installing-the-sock-shop-onto-kubernetes)
    * [Viewing the Sock Shop in Your Browser](#set-up-a-kubernetes-cluster-with-kubeadm-viewing-the-sock-shop-in-your-browser)
    * [Viewing the Result in Weave Cloud](#set-up-a-kubernetes-cluster-with-kubeadm-viewing-the-result-in-weave-cloud)
    * [Run the Load Test on the Cluster](#set-up-a-kubernetes-cluster-with-kubeadm-run-the-load-test-on-the-cluster)
* [Configuring Cortex for Your Production Environment](#configuring-cortex-for-your-production-environment)
* [Viewing Sock Shop Metrics in Weave Cortex](#viewing-sock-shop-metrics-in-weave-cortex)
* [Run the Load Test](#run-the-load-test)
* [Running Queries with the Prometheus Query Language](#running-queries-with-the-prometheus-query-language)
* [Monitor the network with Weave Cortex, part of Weave Cloud](#monitor-the-network-with-weave-cortex-part-of-weave-cloud)
* [Tear Down](#tear-down)
* [Recreating the Cluster: Starting Over](#recreating-the-cluster-starting-over)
* [Conclusions](#conclusions)


<!-- TODO have "sign up for weave cloud" instructions here -->

<h2 id="introduction">Introduction</h2>

Microservices environments by nature are dynamic and are in a state of constant change especially if they are running inside containers. They may be spread across multiple clouds or span both a data center and a cloud,  which can make monitoring a challenge.  And since these systems tend to be in a state of constant change with containers going down and spinning back up again, traditional monitoring systems which are typically server-focused, don't work well with dynamic systems.

Weave Cortex is built upon the open source project, Prometheus and it sits in your Kubernetes cluster and listens for changes throughout the entire pod regardless of where they may physically lie within a single Kubernetes cluster or even across a Kubernetes federation. Once Weave Cortex is deployed to your Kubernetes production environment, metrics are automatically pushed to Weave Cloud, where they can be viewed and queried from within the Microservices Dashboard.

You will use the sample app, 'The Sock Shop', deploy it to a couple of virtual machines running Docker and Kubernetes and then monitor metrics from within Weave Cloud.

In this tutorial, you will:

1. Sign up for Weave Cloud and obtain a Weave Cloud token.
2. Configure a Kubernetes cluster and at the same time install Weave Net onto two Ubuntu hosts.
4. Use Weave Cloud to observe the Kubernetes cluster deployment.
5. Install the Sock Shop onto the Kubernetes cluster.
5. Configure and launch the Cortex agent to start pushing metrics to Weave Cloud
6. Run a load test on the Sock Shop and view the metrics in Weave Cortex from inside Weave Cloud.

This tutorial takes approximately 15 minutes to complete.

<h2 id="what-you-will-use">What You Will Use</h2>

* [Weave Cloud](https://cloud.weave.works)
* [Kubernetes](http://kubernetes.io/)
* [Weaveworks Sockshop](https://github.com/microservices-demo)
* [Weave Net](https://www.weave.works/products/weave-net/)

<h2 id="sign-up-for-weave-cloud">Sign Up for Weave Cloud</h2>

Before you can use Cortex to monitor apps, sign up for a Weave Cloud account.

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a> <!-- lkj_ -->
2.  Sign up using either a Github, or Google account or use an email address.
3.  Make a note of the cloud service token from the User settings screen:

<img src="images/weave-cloud-token.png" style="width:100%;" />

**Note:** If you are continuing on from one of the other guides in this series you can use your Cloud token to set up Prometheus Monitoring below.


<h2 id="deploy-a-kubernetes-cluster-with-weave-net-and-then-deploy-a-sample-application-the-socks-shop-to-it">Deploy a Kubernetes cluster with Weave Net and then deploy a sample application (the socks shop) to it</h2>

If you have already done this as part of one of the other tutorials, skip this step.
Otherwise, click "Details" below to see the instructions.

XXX-START-DETAILS-BLOCK

**Note:** This example uses Digital Ocean, but you can just as easily create these three instances in AWS or whatever your favorite cloud provider is.

<h2 id="set-up-droplets-in-digital-ocean">Set Up Droplets in Digital Ocean</h2>

Sign up or log into [Digital Ocean](https://digitalocean.com) and create three Ubuntu 16.04 instances, where you'll deploy a Kubernetes cluster, add a container network using Weave Net and finally deploy the Sock Shop onto the cluster and verify this deployment with the one you just did on your laptop in Weave Cloud.

**Note:** It is recommended that each host have at least 4 gigabytes of memory in order to run this demo smoothly.

<h3 id="set-up-droplets-in-digital-ocean-create-three-ubuntu-instances">Create three Ubuntu Instances</h3>

Next you'll move over to Digital Ocean and create three Ubuntu 16.04 droplets. All of the machines should run Ubuntu 16.04 with 4GB or more of RAM per machine.

<h3 id="set-up-droplets-in-digital-ocean-adding-an-additional-instance-to-weave-cloud">Adding an Additional Instance to Weave Cloud</h3>

Sign up or log into [Weave Cloud](https://cloud.weave.works/).

Before you start installing Kubernetes, you may wish to [create an additional instance in Weave Cloud](https://cloud.weave.works/instances/create). This extra instance provides a separate "workspace" for this cluster, and in it you will be able to see the Sock Shop as it spins up on Kubernetes.

To create an additional instance, select the 'Create New Instance' command located in the menu bar.

<h2 id="set-up-a-kubernetes-cluster-with-kubeadm">Set up a Kubernetes Cluster with kubeadm</h2>

This is by far the simplest way in which to install Kubernetes.  In a few commands, you will have deployed a complete Kubernetes cluster with a resilient and secure container network onto the Cloud Provider of your choice.

The installation uses a tool called `kubeadm` which is part of Kubernetes 1.4.

This process works with local VMs, physical servers and/or cloud servers. It is simple enough that you can easily integrate its use into your own automation (Terraform, Chef, Puppet, etc).

See the full [`kubeadm` reference](http://kubernetes.io/docs/admin/kubeadm) for information on all `kubeadm` command-line flags and for advice on automating `kubeadm` itself.

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-objectives">Objectives</h3>

* Install a secure Kubernetes cluster on your machines
* Install Weave Net as a pod network on the cluster so that application components (pods) can talk to each other
* Install a sample microservices application (a socks shop) on the cluster
* View the result in Weave Cloud as you go along

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-installing-kubelet-and-kubeadm-on-your-hosts">Installing kubelet and kubeadm on Your Hosts</h3>

You will install the required packages on all the machines.

For each machine:

* SSH into the machine and become `root` if you are not already (for example, run `sudo su -`):

~~~
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
~~~

Install docker if you don't have it already. You can also use the [official Docker packages](https://docs.docker.com/engine/installation/) instead of `docker.io` here.
~~~
apt-get install -y docker.io
~~~

Install the Kubernetes packages:
~~~
apt-get install -y kubelet kubeadm kubectl kubernetes-cni
~~~

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-initializing-the-master">Initializing the Master</h3>

**Note:** Before making one of your machines a master, you must have installed `kubelet` and `kubeadm` onto each machine beforehand.

The master is the machine where the "control plane" components run, including `etcd` (the cluster database) and the API server (which the `kubectl` CLI communicates with).

All of these components run in pods started by `kubelet`.

Right now you can't run `kubeadm init` twice without turning down the cluster in between, see [Tear Down](#tear-down).

To initialize the master, pick one of the machines you previously installed `kubelet` and `kubeadm` on, and run:

~~~
kubeadm init
~~~

This will take a few minutes, so be patient.

**Note:** This will autodetect the network interface to advertise the master on as the interface with the default gateway.

If you want to use a different interface, specify `--api-advertise-addresses=<ip-address>` argument to `kubeadm init`.

Please refer to the [kubeadm reference doc](http://kubernetes.io/docs/admin/kubeadm/) if you want to read more about the flags `kubeadm init` provides.

This command downloads and installs the cluster database and the "control plane" components and it may take several minutes.

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

Make a record of the `kubeadm join` command that `kubeadm init` outputs. You will need this in a moment.

The key included here is secret, keep it safe &mdash; anyone with this key can add authenticated nodes to your cluster.

The key is used for mutual authentication between the master and the joining nodes.

By default, your cluster will not schedule pods on the master for security reasons. If you want to be able to schedule pods on the master, for example if you want a single-machine Kubernetes cluster for development, run:

~~~
kubectl taint nodes --all dedicated-
~~~

The output will be:
~~~
node "test-01" tainted
taint key="dedicated" and effect="" not found.
taint key="dedicated" and effect="" not found.
~~~

This will remove the "dedicated" taint from any nodes that have it, including the master node, meaning that the scheduler will then be able to schedule pods everywhere.

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-installing-weave-net">Installing Weave Net</h3>

You must install a pod network so that your pods can communicate with each other. This guide shows you how to install Weave Net.

**You must add Weave Net before deploying any applications to your cluster and before `kube-dns` starts up.**

Install [Weave Net](https://github.com/weaveworks/weave-kube) by logging in to the master and running:

~~~
kubectl apply -f https://git.io/weave-kube
~~~
The output will be:
~~~
daemonset "weave-net" created
~~~

**Note:** Install **only one** pod network per cluster.

Once a pod network is installed, confirm that it is working by checking that the `kube-dns` pod is `Running` in the output of `kubectl get pods --all-namespaces`.

And once the `kube-dns` pod is up and running, you can continue on to joining your nodes.

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-joining-your-nodes">Joining Your Nodes</h3>

The nodes are where your workloads (containers and pods, etc) run. If you want to add any new machines as nodes to your cluster, for each machine: SSH to that machine, become root (e.g. `sudo su -`) and run the command that was output by `kubeadm init`.

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

Run `kubectl get nodes` on the master to see this machine join.
~~~

A few seconds later, you should notice that running `kubectl get nodes` on the master shows a cluster with as many machines as you created.

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-optional-control-your-cluster-from-machines-other-than-the-master">(Optional) Control Your Cluster From Machines Other Than The Master</h3>

In order to get kubectl on (for example) your laptop to talk to your cluster, you need to copy the `kubeconfig` file from your master to your laptop like this:

~~~
scp root@<master ip>:/etc/kubernetes/admin.conf .
kubectl --kubeconfig ./admin.conf get nodes
~~~

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-install-and-launch-weave-scope">Install and Launch Weave Scope</h3>

Install and launch the Weave Scope probes onto your Kubernetes cluster. From the master:

~~~bash
curl -sSL 'https://cloud.weave.works/launch/k8s/weavescope.yaml?service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>' |sed s/50m/500m/ |kubectl apply -f -
~~~

You should fetch `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` from [Weave Cloud](https://cloud.weave.works/).

Return to the Weave Cloud interface, select View Instance and click on the `Hosts` button to view the cluster ready to go.

As you follow the next steps you can then watch the socks shop come up in [Weave Cloud](https://cloud.weave.works/).

Ensure that 'System Containers' are selected from the filters in the left hand corner to see all of the Kubernetes processes.

<img src="images/kubernetes-weave-cloud-2.png" style="width:100%;" />

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-installing-the-sock-shop-onto-kubernetes">Installing the Sock Shop onto Kubernetes</h3>

To put your cluster through its paces, install the sample microservices application, Socks Shop. To learn more about the sample microservices app, refer to the [microservices-demo README](https://github.com/microservices-demo/microservices-demo).

On the master, run:

~~~
kubectl create namespace sock-shop
git clone https://github.com/microservices-demo/microservices-demo
cd microservices-demo
kubectl apply -n sock-shop -f deploy/kubernetes/manifests
~~~

Switch to the `sock-shop` namespace at the bottom left of your browser window in Weave Cloud when in any of the Kubernetes-specific views (pods, replica sets, deployments & services).

<img src="images/sock-shop-kubernetes.png" style="width:100%;" />


<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-viewing-the-sock-shop-in-your-browser">Viewing the Sock Shop in Your Browser</h3>

You can then find the port that the cluster allocated for the front-end service by running:

~~~
kubectl describe svc front-end -n sock-shop
~~~

The output should look like:

~~~
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

Then go to the IP address of any of your cluster's machines in your browser, and specify the given port. So for example, `http://<master_ip>:<port>`. You can find the IP address of the machines in the DigitalOcean dashboard.

In the example above, this was `31869`, but it is a different port for you.

If there is a firewall, make sure it exposes this port to the internet before you try to access it.

<img src="images/socks-shop.png" style="width:100%;" />

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-viewing-the-result-in-weave-cloud">Viewing the Result in Weave Cloud</h3>

You can also view the result in [Weave Cloud](https://cloud.weave.works/) and also watch all of the pods as they join the cluster.


<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-run-the-load-test-on-the-cluster">Run the Load Test on the Cluster</h3>

After the Sock Shop has completely deployed onto the cluster, run a load test from your local machine and view the results in Weave Cloud. You should see the architecture of the application "emerge" as different pieces join up.

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -r 10000 -c 20 -h <host-ip:[port number]>
~~~

Where,

* `<host-ip:[port number]>` is the IP of the master and the port number you see when you run `kubectl describe svc front-end -n sock-shop`


XXX-END-DETAILS-BLOCK


<h2 id="configuring-cortex-for-your-production-environment">Configuring Cortex for Your Production Environment</h2>

Next, enable Cortex to start pushing metrics to Weave Cloud.

**1.** Log onto the master Kubernetes node and run the following to get the `cortex.yml` file and then update the file with your Weave Cloud token:

<!-- TODO replace this with the proper yaml generator -->

~~~
kubectl -n kube-system apply -f 'https://cloud.weave.works/k8s/cortex.yaml?t=<your-weave-cloud-token>'
~~~

**Where**,

* [`your-weave-cloud-token`] is the token you obtained when you signed up for Weave Cloud above.


Cortex runs in its own Docker container and it may take a few minutes for it to download and appear on the server. You can watch for it to appear in the Troubleshooting Dashboard.

**2.** Or check that Cortex is running on one of the Kubernetes nodes with:

~~~
kubectl get pods -n kube-system -l weave-cloud-component=cortex
~~~

Where you should see something similar to:

~~~
NAME                                 READY     STATUS    RESTARTS   AGE
weave-cortex-agent-459196232-a83mc   1/1       Running   0          10s
weave-cortex-node-exporter-clofd     1/1       Running   0          12s
weave-cortex-node-exporter-jeyrt     1/1       Running   0          12s
weave-cortex-node-exporter-klp2h     1/1       Running   0          12s
weave-cortex-node-exporter-uqwx5     1/1       Running   0          12s
~~~

<h2 id="viewing-sock-shop-metrics-in-weave-cortex">Viewing Sock Shop Metrics in Weave Cortex</h2>

Go to the Weave Cloud Dashboard and click the chart icon from the header bar. You should see the Cortex GUI where you can display metrics from the Sock Shop app.

<img src="images/weave-cloud-snippet.png" style="width:50%;" />

Cortex by default displays a number of metrics at the top that have already been detected by the system.

Select `process` then `open` and `fds` from the Detected Metrics section of Prometheus System Queries, and then click `execute`, where something similar to the screen capture shown below will be shown (note this is a stacked view of the chart):

<img src="images/cortex-detected-metrics.png" style="width:100%;" />


<h2 id="run-the-load-test">Run the Load Test</h2>

To view metrics in Weave Cortex under a load, run:

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -r 100 -c 2 -h <host-ip:[port number]>
~~~

<!-- TODO include a sample query here -->


<h2 id="running-queries-with-the-prometheus-query-language">Running Queries with the Prometheus Query Language</h2>

Custom queries can be built with the Prometheus Query Language builder. For example detailed metrics can be viewed by Node, by orchestrator such as Kubernetes or you can view metrics about your Weave Net container network.

For more information on using the Prometheus Query Language, see [Prometheus Query Examples](https://prometheus.io/docs/querying/examples/)

<h2 id="monitor-the-network-with-weave-cortex-part-of-weave-cloud">Monitor the network with Weave Cortex, part of Weave Cloud</h2>

Weave Net supports Prometheus monitoring, so you can monitor your Weave Net network in Weave Cloud.

Go to the Cortex page in Weave Cloud to view network specific metrics, such as:

* IP address space exhaustion in %
* Number of local DNS entries per each host
* Connection termination rate per second
* Number of blocked connections per transport-layer protocol
* Frequent protocol-dport combinations of blocked connections such as IP address exhaustion

For more information on Weave Net metrics see, <a href="https://www.weave.works/docs/net/latest/metrics/"> "Monitoring with Prometheus" </a>


<h2 id="tear-down">Tear Down</h2>

XXX-START-DETAILS-BLOCK

Unless you are continuing onto another guide, or going to use the cluster for your own app, you may want to tear down the Sock Shop and also the Kubernetes cluster you created.

If you made a mistep during the install instructions, it is recommended that you delete the entire cluster and begin again.

* To uninstall the socks shop, run `kubectl delete namespace sock-shop` on the master.

* To uninstall Kubernetes on the machines, simply delete the machines you created for this tutorial, or run the script below and then start over or uninstall the packages.

To reset local state run the following script:

~~~
systemctl stop kubelet;
docker rm -f -v $(docker ps -q);
find /var/lib/kubelet | xargs -n 1 findmnt -n -t tmpfs -o TARGET -T | uniq | xargs -r umount -v;
rm -r -f /etc/kubernetes /var/lib/kubelet /var/lib/etcd;
~~~

<h2 id="recreating-the-cluster-starting-over">Recreating the Cluster: Starting Over</h2>

If you wish to start over, run `systemctl start kubelet` followed by `kubeadm init` on the master and `kubeadm join` on any of the nodes.


XXX-END-DETAILS-BLOCK

<h2 id="conclusions">Conclusions</h2>

You've seen how Weave Cortex can be used to monitor your application, your cluster and your network in Weave Cloud.
<p></p>
If you have any questions or comments you can reach out to us on our <a href="https://slack.weave.works/"> Slack channel </a> or through one of these other channels at <a href="https://www.weave.works/help/"> Help </a>.


<div style="width:50%; float:left; padding: 10px; font-weight: 700;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">&laquo; Go to previous part: Part 2 – Deploy: Continuous Delivery</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-4-secure-container-firewalls/">Go to next part: Part 4 – Secure: Container Firewalls &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>
