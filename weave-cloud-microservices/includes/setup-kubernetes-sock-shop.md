This example uses Digital Ocean, but you can just as easily create three instances in [AWS](https://aws.amazon.com/), [Google Cloud Platform](https://cloud.google.com/) or [Microsoft Azure](https://azure.microsoft.com/en-us/services/cloud-services/)or any other cloud provider.

## Create Three Droplets in Digital Ocean

Sign up or log into [Digital Ocean](https://digitalocean.com) and create three Ubuntu instances with the following specifications:

* Ubunutu 16.04
* 4GB or more of RAM per instance


### Edit a Weave Cloud Instance Name

Sign up or log into [Weave Cloud](https://cloud.weave.works/).

Before you start installing Kubernetes, you may wish to [rename the default instance in Weave Cloud](https://cloud.weave.works).

A Weave Cloud instance provides a separate "workspace" where you  you will be able to see the Sock Shop as it spins up on Kubernetes.

## Set up a Kubernetes Cluster with kubeadm

Kubeadm is the simplest way to install Kubernetes.  With only a few commands, you can deploy a complete Kubernetes cluster with a resilient and secure container network onto the Cloud Provider of your choice in a few minutes.

`kubeadm` is a command line tool that are a part of [Kubernetes](https://kubernetes.io/docs/getting-started-guides/kubeadm/).

See the full [`kubeadm` reference](http://kubernetes.io/docs/admin/kubeadm) for information on all `kubeadm` command-line flags and for advice on automating `kubeadm` itself.

### Objectives

* Install a secure Kubernetes cluster
* Install Weave Net as a pod network so that application components (pods) can communicate with one another
* Install the Sock Shop, a demo microservices application
* View the result in Weave Cloud

###  Installing kubelet and kubeadm on Your Hosts

To begin SSH into the machine and become `root` if you are not already (for example, run `sudo su -`) and then install the required binaries onto all three instances:

~~~
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
~~~

Install Docker if you don't have it already. You can also use the [official Docker packages](https://docs.docker.com/engine/installation/) instead of `docker.io` here.
~~~
apt-get install -y docker.io
~~~

Finally, install the Kubernetes packages:

~~~
apt-get install -y kubelet kubeadm kubectl kubernetes-cni
~~~

### Initializing the Master

**Note:** Before making one of your machines a master, `kubelet` and `kubeadm` must have been installed onto each of the nodes.

The master is the machine where the "control plane" components run, including `etcd` (the cluster database) and the API server (which the `kubectl` CLI communicates with).

All of these components run in pods started by `kubelet`.

Keep in mind that you can't run `kubeadm init` twice without tearing down the cluster, see [Tear Down](#tear-down) for more information.

To initialize the master, pick one of the machines on which you previously installed `kubelet` and `kubeadm` and run:

~~~
kubeadm init
~~~

Initialization of the master may take a few minutes.

This autodetects the network interface and then advertises the master on it with the default gateway.

If you want to use a different network interface, you can specify one using `--api-advertise-addresses=<ip-address>` flag when you run `kubeadm init`.

Refer to the [kubeadm reference doc](http://kubernetes.io/docs/admin/kubeadm/) if you want to read more about the flags `kubeadm init` provides.

If the initialization is successful, the output should look as follows:

~~~
[preflight] Running pre-flight checks
[init] Using Kubernetes version: v1.5.3
[tokens] Generated token: "ad23e7.17c4c857d6a2eef9"
[certificates] Generated Certificate Authority key and certificate.
[certificates] Generated API Server key and certificate
[certificates] Generated Service Account signing keys
[certificates] Created keys and certificates in "/etc/kubernetes/pki"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/kubelet.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/admin.conf"
[apiclient] Created API client, waiting for the control plane to become ready
[apiclient] All control plane components are healthy after 38.977112 seconds
[apiclient] Waiting for at least one node to register and become ready
[apiclient] First node is ready after 2.505625 seconds
[apiclient] Creating a test deployment
[apiclient] Test deployment succeeded
[token-discovery] Created the kube-discovery deployment, waiting for it to become ready
[token-discovery] kube-discovery is ready after 12.504988 seconds
[addons] Created essential addon: kube-proxy
[addons] Created essential addon: kube-dns

Your Kubernetes master has initialized successfully!

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
    http://kubernetes.io/docs/admin/addons/

You can now join any number of machines by running the following on each node:

kubeadm join --token=<token> <master-ip>
~~~

Make a record of the `kubeadm join` command that `kubeadm init` outputs. You will need this once it's time to join the nodes. This token is used for mutual authentication between the master and any joining nodes.

This token is a secret, and so it's important to keep it safe &mdash; anyone with this key can add authenticated nodes to your cluster.

###(Optional) Scheduling Pods on the Master

By default, the cluster does not schedule pods on the master for security reasons. If you want to be able to schedule pods on the master, for example if you want a single-machine Kubernetes cluster for development, then run:

~~~
kubectl taint nodes --all dedicated-
~~~

The output will be:
~~~
node "test-01" tainted
taint key="dedicated" and effect="" not found.
taint key="dedicated" and effect="" not found.
~~~

This removes the "dedicated" taint from any nodes that have it, including the master node, meaning that the scheduler will then be able to schedule pods everywhere.

### Installing Weave Net

In this section, you will install a Weave Net pod network so that your pods can communicate with each other.

You must add Weave Net before deploying any applications to your cluster and before `kube-dns` starts up.

**Note:** Install **only one** pod network per cluster.

Install [Weave Net](https://github.com/weaveworks/weave-kube) by logging onto the master and running:

~~~
kubectl apply -f https://git.io/weave-kube
~~~

The output will be:

~~~
daemonset "weave-net" created
~~~

Once a pod network is installed, confirm that it is working by checking that the `kube-dns` pod is `running`:  

~~~
kubectl get pods --all-namespaces
~~~

Once the `kube-dns` pod is up and running, you can join all of the nodes to form the cluster.

### Joining Your Nodes

The nodes are where the workloads (containers and pods, etc) run.

Add each of the nodes to your cluster by running the following:

~~~
kubeadm join --token <token> <master-ip>
~~~

The above command including the token and the master-ip is output by `kubeadm init` that you ran earlier.

The output should look like:

~~~
preflight] Running pre-flight checks
[tokens] Validating provided token
[discovery] Created cluster info discovery client, requesting info from "http://138.197.150.135:9898/cluster-info/v1/?token-id=ad23e7"
[discovery] Cluster info object received, verifying signature using given token
[discovery] Cluster info signature and contents are valid, will use API endpoints [https://138.197.150.135:6443]
[bootstrap] Trying to connect to endpoint https://138.197.150.135:6443
[bootstrap] Detected server version: v1.5.3
[bootstrap] Successfully established connection with endpoint "https://138.197.150.135:6443"
[csr] Created API client to obtain unique certificate for this node, generating keys and certificate signing request
[csr] Received signed certificate from the API server:
Issuer: CN=kubernetes | Subject: CN=system:node:node-02 | CA: false
Not before: 2017-02-20 20:33:00 +0000 UTC Not After: 2018-02-20 20:33:00 +0000 UTC
[csr] Generating kubelet configuration
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/kubelet.conf"

Node join complete:
* Certificate signing request sent to master and response
  received.
* Kubelet informed of new secure connection details.

Run 'kubectl get nodes' on the master to see this machine join.

~~~

Run `kubectl get nodes` on the master to display a cluster with the number of machines as you created.

### (Optional) Control Your Cluster From Machines Other Than The Master

In order to get kubectl on (for example) your laptop to talk to your cluster, copy the `kubeconfig` file from your master to your laptop:

~~~
scp root@<master ip>:/etc/kubernetes/admin.conf .
kubectl --kubeconfig ./admin.conf get nodes
~~~

### Install and Launch the Weave Cloud Probes

Install and launch the Weave Cloud probes onto your Kubernetes cluster. This command installs all of the Cloud tokens onto your cluster: Flux for Continuous Delivery, Scope for Troubleshooting and Cortex for Prometheus Monitoring.

From the master:

~~~
kubectl apply -f \
  https://cloud.weave.works/k8s.yaml?t=<cloud-token>
~~~

The `<cloud-token>` is found in the settings dialog on [Weave Cloud](https://cloud.weave.works/).

Return to Weave Cloud, and click **Explore** to display Scope and then **Pods** to show the Kubernetes cluster. Ensure that the **All Namespaces** filter is enabled from the left-hand corner.

In these next steps, you can watch as the Sock Shop containers start appearing in Scope in [Weave Cloud](https://cloud.weave.works/).


<img src="images/kubernetes-weave-cloud-3-1.png" style="width:100%;" />

### Installing the Sock Shop onto Kubernetes

To put your cluster through its paces, install the sample microservices application, Socks Shop. You can learn more about the sample microservices app by referring to the [microservices-demo README](https://github.com/microservices-demo/microservices-demo).

To install the sockshop, run the following:

~~~
kubectl create namespace sock-shop
git clone https://github.com/microservices-demo/microservices-demo
cd microservices-demo
kubectl apply -n sock-shop -f deploy/kubernetes/manifests
~~~

Click on the **Pod** view and then enable the **sock-shop** namespace filter from the bottom left-hand corner in the Weave Cloud user interface.

It takes several minutes to download and start all of the containers, watch the output of `kubectl get pods -n sock-shop` to see that all of the containers are running.

Or view the containers appearing on the screen as they get created in [Weave Cloud](https://cloud.weave.works/).

<img src="images/sock-shop-kubernetes-1-1.png" style="width:100%;" />


### Viewing the Sock Shop in Your Browser

Find the port that the cluster allocated for the front-end service by running:

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

Launch the Sock Shop in your browser by going to the IP address of any of your node machines in your browser, and by specifying the NodePort. So for example, `http://<master_ip>:<pNodePort>`. You can find the IP address of the machines in the DigitalOcean dashboard.

In the example above, the NodePort was `31869`.

If there is a firewall, make sure it exposes this port to the internet before you try to access it.

<img src="images/socks-shop.png" style="width:100%;" />


### Run the Load Test on the Cluster

After the Sock Shop has completely deployed, run a load test and then view the results in Weave Cloud.

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -r 10000 -c 20 -h <host-ip:[port number]>
~~~

Where,

* `<host-ip:[port number]>` is the IP of the master and the port number you see when you run `kubectl describe svc front-end -n sock-shop`.

Click on **Pods** and then search for and click on **user-db** to reveal its details panel. From here, click the terminal icon to see users logging in and added the database.
