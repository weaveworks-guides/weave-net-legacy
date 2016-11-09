**Note:** This example uses Digital Ocean, but you can just as easily create these three instances in AWS or whatever your favorite cloud provider is.

## Set Up Droplets in Digital Ocean

Sign up or log into [Digital Ocean](https://digitalocean.com) and create three Ubuntu 16.04 instances, where you'll deploy a Kubernetes cluster, add a container network using Weave Net and finally deploy the Sock Shop onto the cluster and verify this deployment with the one you just did on your laptop in Weave Cloud.

**Note:** It is recommended that each host have at least 4 gigabytes of memory in order to run this demo smoothly.

### Create three Ubuntu Instances

Next you'll move over to Digital Ocean and create three Ubuntu 16.04 droplets. All of the machines should run Ubuntu 16.04 with 4GB or more of RAM per machine.

### Adding an Additional Instance to Weave Cloud

Sign up or log into [Weave Cloud](https://cloud.weave.works/).

Before you start installing Kubernetes, you may wish to [create an additional instance in Weave Cloud](https://cloud.weave.works/instances/create). This extra instance provides a separate "workspace" for this cluster, and in it you will be able to see the Sock Shop as it spins up on Kubernetes.

To create an additional instance, select the 'Create New Instance' command located in the menu bar.

## Set up a Kubernetes Cluster with kubeadm

This is by far the simplest way in which to install Kubernetes.  In a few commands, you will have deployed a complete Kubernetes cluster with a resilient and secure container network onto the Cloud Provider of your choice.

The installation uses a tool called `kubeadm` which is part of Kubernetes 1.4.

This process works with local VMs, physical servers and/or cloud servers. It is simple enough that you can easily integrate its use into your own automation (Terraform, Chef, Puppet, etc).

See the full [`kubeadm` reference](http://kubernetes.io/docs/admin/kubeadm) for information on all `kubeadm` command-line flags and for advice on automating `kubeadm` itself.

### Objectives

* Install a secure Kubernetes cluster on your machines
* Install Weave Net as a pod network on the cluster so that application components (pods) can talk to each other
* Install a sample microservices application (a socks shop) on the cluster
* View the result in Weave Cloud as you go along

###  Installing kubelet and kubeadm on Your Hosts

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

### Initializing the Master

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

### Installing Weave Net

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

### Joining Your Nodes

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

### (Optional) Control Your Cluster From Machines Other Than The Master

In order to get kubectl on (for example) your laptop to talk to your cluster, you need to copy the `kubeconfig` file from your master to your laptop like this:

~~~
scp root@<master ip>:/etc/kubernetes/admin.conf .
kubectl --kubeconfig ./admin.conf get nodes
~~~

### Install and Launch Weave Scope

Install and launch the Weave Scope probes onto your Kubernetes cluster. From the master:

~~~bash
curl -sSL 'https://cloud.weave.works/launch/k8s/weavescope.yaml?service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>' \
|sed s/50m/500m/ |kubectl apply -f -
~~~

You should fetch `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` from [Weave Cloud](https://cloud.weave.works/).

Return to the Weave Cloud interface, select View Instance and click on the `Hosts` button to view the cluster ready to go.

As you follow the next steps you can then watch the socks shop come up in [Weave Cloud](https://cloud.weave.works/).

Ensure that 'System Containers' are selected from the filters in the left hand corner to see all of the Kubernetes processes.

<img src="images/kubernetes-weave-cloud-2.png" style="width:100%;" />

### Installing the Sock Shop onto Kubernetes

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


### Viewing the Sock Shop in Your Browser

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

### Viewing the Result in Weave Cloud

You can also view the result in [Weave Cloud](https://cloud.weave.works/) and also watch all of the pods as they join the cluster.


### Run the Load Test on the Cluster

After the Sock Shop has completely deployed onto the cluster, run a load test from your local machine and view the results in Weave Cloud. You should see the architecture of the application "emerge" as different pieces join up.

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -r 10000 -c 20 -h <host-ip:[port number]>
~~~

Where,

* `<host-ip:[port number]>` is the IP of the master and the port number you see when you run `kubectl describe svc front-end -n sock-shop`
