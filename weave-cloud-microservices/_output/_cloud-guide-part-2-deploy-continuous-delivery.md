<!-- Deploy: Continuous Delivery with Weave Flux -->

This is Part 2 of 4 of the <a href="/guides/">Weave Cloud guides series</a>. In this guide, you'll see how to achieve fast iteration and Continuous Delivery with Weave Cloud and Weave Flux, which connects the output of your CI system into your container orchestrator. This example uses Kubernetes.

<div style="width:50%; padding: 10px; float:left; font-weight: 700;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>


<img src="images/deploy.png" style="width:100%; border:1em solid #32324b;" />
<p></p>

Continuous Delivery with Weave Flux manages change between your container registry, where typically your CI system pushes or builds a Docker container image, and your version control system that keeps track of your Kubernetes manifests.  Flux tracks and acts on the changes between these systems without you having to disassemble and reassemble your infrastructure each time a new feature is added to your app. 

<h2 id="a-video-overview">A Video Overview</h2>

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe width="530" height="298" src="https://www.youtube.com/embed/CKHXYtU1n8Y?modestbranding=1&autohide=0&showinfo=0&controls=1&rel=0" frameborder="0" allowfullscreen></iframe>
</div></center>


<h2 id="contents">Contents</h2>

* [A Video Overview](#a-video-overview)
* [Contents](#contents)
* [Introduction](#introduction)
* [Deploy a Kubernetes Cluster with Weave Net and Then Deploy the Application to it](#deploy-a-kubernetes-cluster-with-weave-net-and-then-deploy-the-application-to-it)
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
* [Fork The Repositories](#fork-the-repositories)
* [Shut Down The Socks Shop Running on the Kubernetes Cluster](#shut-down-the-socks-shop-running-on-the-kubernetes-cluster)
* [Get a Container Registry Account](#get-a-container-registry-account)
* [Get a Continuous Integration Account](#get-a-continuous-integration-account)
* [Configure .travis.yml File](#configure-travis-yml-file)
* [Configure Robot Account in Quay.io](#configure-robot-account-in-quay-io)
* [Getting Flux Running](#getting-flux-running)
* [Configure The Deploy Key on GitHub](#configure-the-deploy-key-on-github)
* [Modify the Front-end Manifest to Point to Your Container Image](#modify-the-front-end-manifest-to-point-to-your-container-image)
* [Let's Make a Change!](#let-s-make-a-change)
* [Slack Integration](#slack-integration)
* [Tear Down](#tear-down)
* [Recreating the Cluster: Starting Over](#recreating-the-cluster-starting-over)
* [Conclusion](#conclusion)
* [Coming Soon](#coming-soon)


<h2 id="introduction">Introduction</h2>

Weave Flux enables every developer on your team to push changes to a Kubernetes cluster as simply as a `git push`, while maintaining best practices in version controlling all of the cluster configuration (Kubernetes manifests) as you go by automatically modifying the manifests to include new versions.

And it does this by:

 **1.**  Watching a container image registry for changes.

 **2.**  When a new image arrives, consulting its deployment policy, which for each service (container image) can either be "manual" or "automatic". This policy can be modified by running `fluxctl automate`.

 **3.**  If it's configured to automatically deploy a change, it proceeds immediately. If not, it waits for the user to run `fluxctl release`.

 **4.**  When doing a release, flux clones the latest version of the Kubernetes manifests from version control, updates the manifest for the new image, makes a commit and pushes the change back to version control. It then applies the change to your cluster.

This automates an otherwise manual and error-prone two-step process of updating the Kubernetes manifest in version control and applying the changes to the cluster.

In this tutorial, you will put yourself in the position of a developer on a devops team, and watch a code change go from code on a laptop to code in version control, through the CI system which builds a container image and pushes it to the registry, after which Flux takes over and, because the service was configured to automatically deploy with `fluxctl automate`, automatically modifies the Kubernetes manifest in version control and then deploys the change to the user's cluster.

In particular, you will change the colour of a button on the frontend of the user's app, a socks shop.

<h2 id="deploy-a-kubernetes-cluster-with-weave-net-and-then-deploy-the-application-to-it">Deploy a Kubernetes Cluster with Weave Net and Then Deploy the Application to it</h2>

If you have already done this as part of one of the other tutorials, you can skip this step. Otherwise, click "Details" below to see the instructions for setting up a Kubernetes cluster and deploying the socks shop to it.

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


<h2 id="fork-the-repositories">Fork The Repositories</h2>

You will need a GitHub account for this step.

In order to modify the socks shop, you need to fork (at least) two repositories:

* [https://github.com/microservices-demo/front-end](https://github.com/microservices-demo/front-end) - the front-end of the application. We will update the color of one of the buttons in this example.
*  [https://github.com/microservices-demo/microservices-demo](https://github.com/microservices-demo/microservices-demo) - the repo that stores the Kubernetes manifests for the application. Flux will update this repository.

Go to each GitHub repository and click "Fork" in the top right hand corner, and fork the repository to your own GitHub account.

<h2 id="shut-down-the-socks-shop-running-on-the-kubernetes-cluster">Shut Down The Socks Shop Running on the Kubernetes Cluster</h2>

If you followed the instructions above, there will already be a socks shop running on your Kubernetes cluster. First remove that, so that you can deploy a copy from your own fork:

~~~
kubectl delete namespace sock-shop
~~~


<h2 id="get-a-container-registry-account">Get a Container Registry Account</h2>

You can use any container registry, such as Docker Hub or Google Container Registry. In this example, we'll use Quay.io.

Sign up for a [Quay.io](https://quay.io) account, and record the username that it gives you. When you log in, you'll be able to see it under "Users and Organizations" on the right hand side of the Repositories page.

Make an empty Quay.io repository called `front-end`, where you'll configure Travis to push to.

<h2 id="get-a-continuous-integration-account">Get a Continuous Integration Account</h2>

If you already have your own CI system, you can use that instead. All that Flux needs is that something creates a container image and pushes it to the registry whenever you push to GitHub.

The example used here is [Travis CI](https://travis-ci.org/). Sign up for an account if you haven't got one already, and then hook it up to your GitHub account. Click the `+` button next to "My Repositories" and toggle on the button for `<YOUR_GITHUB_USERNAME>/front-end` so that Travis automatically runs builds for the repo.

<h2 id="configure-travis-yml-file">Configure .travis.yml File</h2>

Replace the `.travis.yml` file in your fork of the `front-end` repo so that it contains exactly the following, with `<YOUR_QUAY_USERNAME>` replaced with your Quay.io username:

```
language: node_js

sudo: required

node_js:
  - "0.10.32"

services:
  - docker

before_install:
  - sudo apt-get install -y make
  - make test-image deps

env:
  - GROUP=quay.io/<YOUR_QUAY_USERNAME> COMMIT=$TRAVIS_COMMIT TAG=$TRAVIS_TAG REPO=front-end;

script:
  - make test

after_success:
  - set -e
  - if [ -z "$DOCKER_PASS" ]; then echo "Build triggered by external PR. Skipping docker push" && exit 0; fi
  - docker login quay.io -u $DOCKER_USER -p $DOCKER_PASS;
  - ./scripts/build.sh
  - ./test/container.sh
  - ./scripts/push.sh
```

Commit and push this change to your fork of the `front-end` repo. You can do this on your workstation using your favourite text editor.

```
git commit -m "Update .travis.yml to refer to my quay.io account." .travis.yml
git push
```


<h2 id="configure-robot-account-in-quay-io">Configure Robot Account in Quay.io</h2>

Log into Quay.io, and create a robot account (`ci_push_pull`) and then give it Admin permissions to that repo.

Connect up to TravisCI. In http://travis-ci.org/, sign in, find the repo and switch it on. Supply environment entries for `DOCKER_USER` and `DOCKER_PASS` by copying them from the robot account in quay.io.


<h2 id="getting-flux-running">Getting Flux Running</h2>

Log into the master Kubernetes node.

Deploy Flux to your Kubernetes cluster:
~~~
kubectl apply -f 'https://cloud.weave.works/k8s/flux.yaml'
~~~

Next, generate a deploy key for your repo, and configure Flux with it:

```
ssh-keygen -f id-rsa-flux
```

Install the `fluxctl` binary on the master:

```
curl -o /usr/local/bin/fluxctl -sSL https://github.com/weaveworks/flux/releases/download/master-6cc08e4/fluxctl-linux-amd64
chmod +x /usr/local/bin/fluxctl
```

Now open a file called `flux.conf` in your favourite text editor, on the server, and paste the following config into it, replacing `<YOUR_GITHUB_USERNAME>` with your GitHub username:

```
git:
  URL: git@github.com:<YOUR_GITHUB_USERNAME>/microservices-demo
  path: deploy/kubernetes/manifests
  branch: master
  key: |
         -----BEGIN RSA PRIVATE KEY-----
         ZNsnTooXXGagxg5a3vqsGPgoHH1KvqE5my+v7uYhRxbHi5uaTNEWnD46ci06PyBz
         zSS6I+zgkdsQk7Pj2DNNzBS6n08gl8OJX073JgKPqlfqDSxmZ37XWdGMlkeIuS21
         nwli0jsXVMKO7LYl+b5a0N5ia9cqUDEut1eeKN+hwDbZeYdT/oGBsNFgBRTvgQhK
         ... contents of id-rsa-flux file from above ...
         -----END RSA PRIVATE KEY-----
slack:
  hookURL: ""
  username: ""
registry:
  auths: {}
```

Copy the private key you created earlier. To view it, run `cat id-rsa-flux`. Be careful to get the indentation right.

Configure access to Flux via the Kubernetes API:
```
export FLUX_URL=http://localhost:8080/api/v1/proxy/namespaces/default/services/flux
```

Load this config into Flux with:

```
fluxctl set-config --file=flux.conf
```

There is no need to specify auth for your registry since Flux will poll a public registry.

XXX-START-DETAILS-BLOCK

However if you want to configure it to use a private registry, use the following stanza:

```
registry:
  auths:
    "<address-of-registry>":
      auth: "<base64-encoded-user:password>"
```

An example of `<address-of-registry>` is `https://index.docker.io/v1/`.  You can copy `<base64-encoded-user:password>` from your `~/.docker/config.json`.

XXX-END-DETAILS-BLOCK

<h2 id="configure-the-deploy-key-on-github">Configure The Deploy Key on GitHub</h2>

This allows Flux to read and write to the repo with the Kubernetes manifests in it.

Go to the `<YOUR_GITHUB_USERNAME>/microservices-demo` repo on github, click settings, deploy keys (on the left at present). Add a key, paste in the public key from above, check the `Allow write access` box. (Run `cat id-rsa-flux.pub` to get this out.)


<h2 id="modify-the-front-end-manifest-to-point-to-your-container-image">Modify the Front-end Manifest to Point to Your Container Image</h2>

Start by logging in to the Kubernetes master node. You will run the rest of the demo from there for convenience, but you could also run it from your laptop. Use `ssh -A` to enable the SSH agent so that you can use your GitHub SSH key from your workstation.

```
git clone git@github.com:<YOUR_GITHUB_USERNAME>/microservices-demo
cd microservices-demo/deploy/kubernetes
```

Modify the front-end manifest so that it refers to the container image that you'll be using. Using your favorite editor, open up `deploy/kubernetes/manifests/front-end-dep.yaml`, and update the `image` line.

Change it from:

```
        image: weaveworksdemos/front-end
```
To:

```
        image: quay.io/$YOUR_QUAY_USERNAME/front-end:latest
```

where `$YOUR_QUAY_USERNAME` is your Quay.io username.

It's important that you specify a tag here, because Flux won't work unless you do. For now, specify `:latest` but Flux will replace that with a specific version every time it does a release.

Commit and push this change to your GitHub fork:

```
git commit -m "Update front-end to refer to my fork." front-end-dep.yaml
git push
```

Commit that and push. Now you should see [Travis-CI](https://travis-ci.org/) build the image and push it to [Quay.io](https://quay.io).

Now let's deploy the socks shop to Kubernetes. This is the last time you will have to run `kubectl` in this demo: after this, everything can be controlled and automated via Flux.

```
cd ~/microservices-demo/deploy/kubernetes
kubectl apply -f manifests
```

Now wait for the socks shop to deploy, and find the NodePort in the usual way:
~~~
kubectl describe svc front-end -n sock-shop
~~~


<h2 id="let-s-make-a-change">Let&#39;s Make a Change!</h2>

Let's suppose we want to change the color of one of the buttons on the socks shop. On your workstation, or wherever you have `front-end` checked out:

```
cd front-end
sed -i "" s/3386e1/red/ ./public/css/style.blue.css
```

Of course, you can make any change you like. Now push the change:

```
git commit -am "Change button to red."
git push
```

Go to Travis and watch the change get turned into a Docker image.

Once a new image is in Quay.io, you can use Flux to see what's available:

```
fluxctl list-images --service=default/front-end
```

And then deploy it:

```
fluxctl release --service=default/front-end --update-all-images
```

Once that's finished, reload the socks shop and you'll see the buttons have changed to red!

So that's useful for manually gated changes, but it's even better to do continuous delivery. You can turn that on easily by running:

```
k8s-01$ fluxctl automate --service=default/front-end
```

Then change the front-end again, maybe blue this time?

```
cd front-end
sed -i "" s/red/blue/ ./public/css/style.blue.css
```

Of course, you can make any change you like. Now push the change:

```
git commit -am "Change button to blue."
git push
```

Now watch Travis, Quay and `fluxctl history` to see the deploy happening automatically.


<h2 id="slack-integration">Slack Integration</h2>

Set up Slack integration by specifying a Slack webhook in the `hookURL` configuration variable, and choose the name of your bot in `username`. Edit `flux.conf` accordingly and then run:

~~~
fluxctl set-config --file=flux.conf
~~~

Flux will then let you know in Slack, in the channels you configure in the webhook, whenever it's doing a release.

<!-- TODO is the above accurate? @squaremo -->


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


<h1 id="conclusion">Conclusion</h1>

You've seen how to automate continuous delivery while maintaining best practices, and storing Kubernetes manifests in version control, with Weave Flux.

Developers now only have to be able to push to `git` to deploy changes to your Kubernetes clusters.

See the [Flux README](https://github.com/weaveworks/flux) and `fluxctl --help` for more details on other commands.


<h1 id="coming-soon">Coming Soon</h1>

Weave Cloud will soon include a UI to view and configure your Flux deploys, and you'll be able to configure Flux with a service token.
<p></p>
If you have any questions or comments you can reach out to us on our <a href="https://slack.weave.works/"> Slack channel </a> or through one of these other channels at <a href="https://www.weave.works/help/"> Help </a>.


<div style="width:50%; padding: 10px; float:left;font-weight: 700;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>
