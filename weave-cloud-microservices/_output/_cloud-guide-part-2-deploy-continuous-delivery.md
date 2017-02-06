<!-- Deploy: Continuous Delivery with Weave Flux -->
In Part 2 of 4 of the <a href="/guides/">Weave Cloud guides series</a> you will learn how to achieve fast iteration and continuous delivery with Weave Cloud and Weave Flux, and how automatic app deployment is possible by connecting the output of your continuous integration system into a container orchestrator.

As a developer on a DevOps team, you will make a code change to the company microservices app, the Sock Shop, push the change to version control, and then automatically deploy the new image to a Kubernetes Cluster. This example uses [Travis CI](https://travis-ci.org/) for Continuous Integration and [Quay](https://quay.io) for the Docker container registry, but Weave Flux is flexible, and it works with all of your favourite tools, such as [Jenkins](https://jenkins.io), [Docker Trusted Registry](https://docs.docker.com/datacenter/dtr/2.1/guides/) and [Gitlab](https://about.gitlab.com/).

<h3 id="how-weave-flux-works">How Weave Flux Works</h3>

With Weave Flux every developer on your team can make code changes to the app and then deploy updated app to a Kubernetes cluster.  Flux maintains a best practices approach by version controlling the Kubernetes manifests, and by modifying them to include all pushed Docker image versions. This allows DevOps teams to make rapid and less error-prone code changes.

Flux does this by:

 **1.**  Watching a container image registry for changes.

 **2.**  Deploying images (microservices) based on a "manual deployment" or an "automatic deployment" policy.  Policies can be modified on a service by service basis by running `fluxctl automate`. If Flux is configured to automatically deploy a change, it proceeds immediately. If not, Flux waits for you to run `fluxctl release`.

 **3.**  During a release, Flux updates the Kubernetes manifests in version control with the latest images and applies the change to the cluster. The Flux deployment pipeline automates an otherwise manual and error-prone two-step process by updating the Kubernetes manifest in version control and by applying the changes to the cluster.

<div style="width:50%; padding: 10px; float:left; font-weight: 700;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>


<img src="images/deploy.png" style="width:100%; border:1em solid #32324b;" />
<p></p>

Continuous Delivery with Weave Flux streamlines the software development pipeline. With Weave Flux change is managed between your container registry, where Docker images are built and pushed, and your version control system, which stores not only the code, but also the Kubernetes manifests.

<h2 id="a-video-overview">A Video Overview</h2>

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe src="https://player.vimeo.com/video/190563579" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
</div></center>

<h2 id="sign-up-for-weave-cloud">Sign Up for Weave Cloud</h2>

To sign up for Weave Cloud:

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a> <!-- lkj_ -->
2.  Sign up using either a Github, or Google account or use an email address.
3.  Obtain the cloud service token from the user settings screen:

<img src="images/weave-cloud-token-1.png" style="width:100%;" />

<h2 id="deploy-the-sock-shop-to-kubernetes-with-weave-net">Deploy the Sock Shop to Kubernetes with Weave Net</h2>

If you have already done this as part of one of the other tutorials, you can skip this step. Otherwise, expand the "Details" below to see how to set up a Kubernetes cluster, deploy Weave Scope probes and the Socks Shop demo app to it.

XXX-START-DETAILS-BLOCK

**Note:** This example uses Digital Ocean, but you can just as easily create these three instances in AWS or whatever your favorite cloud provider is.

<h2 id="set-up-droplets-in-digital-ocean">Set Up Droplets in Digital Ocean</h2>

Sign up or log into [Digital Ocean](https://digitalocean.com) and create three Ubuntu 16.04 instances, where you'll deploy a Kubernetes cluster, add a container network using Weave Net and finally install the Sock Shop onto the cluster.

**Note:** It is recommended that each host have at least 4 gigabytes of memory in order to run this demo smoothly.

<h3 id="set-up-droplets-in-digital-ocean-create-three-ubuntu-instances">Create three Ubuntu Instances</h3>

Next, move over to Digital Ocean and create three Ubuntu 16.04 droplets. All of the machines should run Ubuntu 16.04 with 4GB or more of RAM per machine.

<h3 id="set-up-droplets-in-digital-ocean-adding-an-additional-instance-to-weave-cloud">Adding an Additional Instance to Weave Cloud</h3>

Sign up or log into [Weave Cloud](https://cloud.weave.works/).

Before you start installing Kubernetes, you may wish to [create an additional instance in Weave Cloud](https://cloud.weave.works/instances/create). This extra instance provides a separate "workspace" for this cluster, and in it you will be able to see the Sock Shop as it spins up on Kubernetes.

To create an additional instance, select the 'Create New Instance' command located in the menu bar.

<h2 id="set-up-a-kubernetes-cluster-with-kubeadm">Set up a Kubernetes Cluster with kubeadm</h2>

This is by far the simplest way in which to install Kubernetes.  With only a few commands, you will have deployed a complete Kubernetes cluster with a resilient and secure container network onto the Cloud Provider of your choice.

The installation uses a tool called `kubeadm` which is part of Kubernetes 1.4.

`kubeadm` works with local VMs, physical servers and/or cloud servers. It is simple enough that you can easily integrate it with your own automation (Terraform, Chef, Puppet, etc).

See the full [`kubeadm` reference](http://kubernetes.io/docs/admin/kubeadm) for information on all `kubeadm` command-line flags and for advice on automating `kubeadm` itself.

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-objectives">Objectives</h3>

* Install a secure Kubernetes cluster on your machines
* Install Weave Net as a pod network on the cluster so that application components (pods) can talk to each other
* Install a demo microservices application (a Socks Shop) onto the cluster
* View the result in Weave Cloud as you build the cluster

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-installing-kubelet-and-kubeadm-on-your-hosts">Installing kubelet and kubeadm on Your Hosts</h3>

Install the required packages on all the machines.

For each machine:

* SSH into the machine and become `root` if you are not already (for example, run `sudo su -`):

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

Install the Kubernetes packages:
~~~
apt-get install -y kubelet kubeadm kubectl kubernetes-cni
~~~

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-initializing-the-master">Initializing the Master</h3>

**Note:** Before making one of your machines a master, `kubelet` and `kubeadm` must be installed onto each of the machines beforehand.

The master is the machine where the "control plane" components run, including `etcd` (the cluster database) and the API server (which the `kubectl` CLI communicates with).

All of these components run in pods started by `kubelet`.

Right now you can't run `kubeadm init` twice without turning down the cluster in between, see [Tear Down](#tear-down) for more information.

To initialize the master, pick one of the machines you previously installed `kubelet` and `kubeadm` on, and run:

~~~
kubeadm init
~~~

Initialization of the master may take a few minutes, so be patient.

**Note:** This will autodetect the network interface to advertise the master on as the interface with the default gateway.

If you want to use a different interface, specify `--api-advertise-addresses=<ip-address>` argument to `kubeadm init`.

Please refer to the [kubeadm reference doc](http://kubernetes.io/docs/admin/kubeadm/) if you want to read more about the flags `kubeadm init` provides.

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

By default, the cluster does not schedule pods on the master for security reasons. If you want to be able to schedule pods on the master, for example if you want a single-machine Kubernetes cluster for development, run:

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

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-installing-weave-net">Installing Weave Net</h3>

In this section, you will install a Weave Net pod network so that your pods can communicate with each other.

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

The nodes are where your workloads (containers and pods, etc) run. If you want to add additional machines as nodes to your cluster, then SSH onto each new machine, become root (e.g. `sudo su -`) and run the command that was output by `kubeadm init`.

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

In order to get kubectl on (for example) your laptop to talk to your cluster, copy the `kubeconfig` file from your master to your laptop:

~~~
scp root@<master ip>:/etc/kubernetes/admin.conf .
kubectl --kubeconfig ./admin.conf get nodes
~~~

<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-install-and-launch-weave-scope">Install and Launch Weave Scope</h3>

Install and launch the Weave Scope probes onto your Kubernetes cluster. From the master:

~~~
curl -sSL 'https://cloud.weave.works/launch/k8s/weavescope.yaml?service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>'|kubectl apply -f -
~~~

The `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` is found in the settings dialog on [Weave Cloud](https://cloud.weave.works/).

Return to the Weave Cloud interface, select View Instance and click on the `Hosts`.

As you follow the next steps you can then watch the socks shop come up in [Weave Cloud](https://cloud.weave.works/).

Ensure that 'System Containers' are selected from the filters in the left hand corner to see all of the Kubernetes processes.

<img src="images/kubernetes-weave-cloud-3-1.png" style="width:100%;" />

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

<img src="images/sock-shop-kubernetes-1-1.png" style="width:100%;" />


<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-viewing-the-sock-shop-in-your-browser">Viewing the Sock Shop in Your Browser</h3>

To find the port that the cluster allocated for the front-end service run:

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

Or view the containers appearing on the screen as they get created in [Weave Cloud](https://cloud.weave.works/).

Launch the Sock Shop in your browser by going to the IP address of any of your node machines in your browser, and by specifying the NodePort. So for example, `http://<master_ip>:<pNodePort>`. You can find the IP address of the machines in the DigitalOcean dashboard.

In the example above, the NodePort was `31869`.

If there is a firewall, make sure it exposes this port to the internet before you try to access it.

<img src="images/socks-shop.png" style="width:100%;" />


<h3 id="set-up-a-kubernetes-cluster-with-kubeadm-run-the-load-test-on-the-cluster">Run the Load Test on the Cluster</h3>

After the Sock Shop has completely deployed onto the cluster, run a load test and view the results in Weave Cloud. You should see the architecture of the application emerge as different microservices begin communicating with one another.

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -r 10000 -c 20 -h <host-ip:[port number]>
~~~

Where,

* `<host-ip:[port number]>` is the IP of the master and the port number you see when you run `kubectl describe svc front-end -n sock-shop`


XXX-END-DETAILS-BLOCK


<h2 id="fork-the-repositories">Fork The Repositories</h2>

You will need a [GitHub](https://www.github.com) account for this step.

Before you can modify the Socks Shop, fork the following two repositories:

* [https://github.com/microservices-demo/front-end](https://github.com/microservices-demo/front-end) - the front-end of the Sock Shop application. You will update the color of one of the buttons in this example.
*  [https://github.com/microservices-demo/microservices-demo](https://github.com/microservices-demo/microservices-demo). This repo stores the Kubernetes manifests for the application. Flux automatically updates this repository.

To fork the GitHub repositories click **Fork** from the top right hand corner. The repositories will appear in your own GitHub account.

<h2 id="shut-down-the-socks-shop-running-on-the-kubernetes-cluster">Shut Down The Socks Shop Running on the Kubernetes Cluster</h2>

If you followed the instructions above, the Socks Shop demo will already be running in Kubernetes, and you will need to delete the `sock-shop namespace` so you can deploy a copy from your own fork.

On the master node run:

~~~
kubectl delete namespace sock-shop
~~~

<h2 id="get-a-container-registry-account">Get a Container Registry Account</h2>

Sign up for a [Quay.io](https://quay.io) account, and record the username that it gives you. When you log in, you'll be able to see it under "Users and Organizations" on the right hand side of the Repositories page.

Create a new public repository called `front-end`. This is the Docker repository that will be used by Travis on which to push newly images.

<h2 id="get-a-continuous-integration-account">Get a Continuous Integration Account</h2>

If you already have your own CI system, you can use that instead. All that Flux needs is something that creates a container image and pushes it to the registry whenever you push a change to GitHub.

The example used here is [Travis CI](https://travis-ci.org/). Sign up for an account if you haven't got one already, and then hook it up to your GitHub account. Click the `+` button next to **My Repositories** and toggle the button for `<YOUR_GITHUB_USERNAME>/front-end` so that Travis automatically runs builds for the repo.

<h2 id="edit-the-travis-yml-file">Edit the travis.yml File</h2>

Replace the `.travis.yml` file in your fork of the `front-end` repo so that it contains only the following and replace `<YOUR_QUAY_USERNAME>` with your Quay.io username:

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

Commit and push this change to your fork of the `front-end` repo.

```
git commit -m "Update .travis.yml to refer to my quay.io account." .travis.yml
git push
```

<h2 id="configure-a-robot-account-in-quay-io-and-link-it-to-travis-ci">Configure a Robot Account in Quay.io and Link it to Travis CI</h2>

**1.** Log into Quay.io, and create a **Robot Account** called `ci_push_pull` by selecting the + from the header.

<img src="images/add-robot-account.png" />

**2.** Ensure that the robot account has Admin permissions.

**3.** Configure the environment entries for `DOCKER_USER` and `DOCKER_PASS` using the credentials from the robot account in quay.io. Click the `ci_push_pull` repo and then **Credentials** and **Settings**. Select **Robot Token** from the top of this dialog. Copy the robot token from this dialog.

**4.** Go back to [TravisCI](http://travis-ci.org/), find the `front-end` repo and turn on the build switch next to it.  

**5.** Add your Quay.io user name and robot account token to the `front-end` repo in Travis by selecting **More Options** and then **Settings** from the drop down menu on the upper right.  

<img src="images/travis-ci-build-settings.png" />

Add the following credentials from Quay.io:

`DOCKER_USER=<"user-name+robot-account">`
`DOCKER_PASS=<"robot-key">`

**Where**,

* `<"user-name+ci_push_pull">` is your user-name including the `+` sign and the name of the robot account.
* `<"robot-key">` is the key found and copied from the **Robot Token** dialog box.


<h2 id="launching-and-configuring-flux">Launching and Configuring Flux</h2>

Flux consists of two parts: the `fluxd` daemon and the `fluxctl` service.  The `fluxd` daemon is deployed to the cluster and listens for changes being pushed through git; it then updates the cluster and any images accordingly. `fluxctl` is the command line utility that allows you to send requests and commands to the daemon. First deploy the `fluxd` daemon to the cluster and then download the `fluxctl` service and configure it for your environment.

To install and set up Flux in Kubernetes:

**1.**  Log onto the master Kubernetes node, and create the following `.yaml` file using your favourite editor:

~~~
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: fluxd
spec:
  replicas: 1
  template:
    metadata:
      labels:
        name: fluxd
    spec:
      containers:
      - name: fluxd
        image: quay.io/weaveworks/fluxd:master-0d109dd
        imagePullPolicy: IfNotPresent
        args:
        - --token=INSERTTOKENHERE
~~~

Paste your Weave Cloud token into the arg section: `INSERTTOKENHERE` and then save the file as `fluxd-dep.yaml`

**2.**  Deploy the `fluxd` daemon to the Kubernetes cluster by running:

~~~
kubectl apply -f ./fluxd-dep.yaml
~~~

**Note:** If you have Weave Cloud running, check the UI to see that the `fluxd` is running as a container. To simplify this, search for 'flux':

<img src="images/fluxd-weave-cloud.png" />


**3.**  Generate public and private SSH keys for your repo. These keys are used by `fluxd` to manage changes between Github and Kubernetes:

```
ssh-keygen -f id-rsa-flux
```


**4.**  Install the `fluxctl` binary onto the master node:

```
curl -o /usr/local/bin/fluxctl -sSL https://github.com/weaveworks/flux/releases/download/master-0d109dd/fluxctl_linux_amd64
chmod +x /usr/local/bin/fluxctl
```

**5.**  Create a file on the master node called `flux.conf` with your preferred text editor:

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

Copy the following into the `flux.conf`:

* Replace `<YOUR_GITHUB_USERNAME>` with your GitHub username (required).

* Copy the private key you created earlier into the private key section of the file. To view the key, run `cat id-rsa-flux` (required). **Ensure that the indentation is correct.**

* In the **Registry** section, copy the authorization details from the Quay Robot Account (`ci_push_pull`) you created earlier. You can find those details by selecting **Settings** and then clicking on the `ci_push_pull` Robot Account.  Select the **Docker Configuration** tab from the **Robot Credentials** dialog in Quay. This step is optional and only required if you are using a private repository, See [Configuring Access for a Private Registry](#private-repo) for more information.

**6.** Configure access to the `fluxd` daemon using:

```
export FLUX_SERVICE_TOKEN=<weave-cloud-token>
```
**Note:** If you've logged out of your shell, you must re-run `export FLUX_SERVICE_TOKEN=<weave-cloud-token>` to re-establish your environment.

**7.** Load the config file into the Flux service:

```
fluxctl set-config --file=flux.conf
```

**8.** Check that all went well by running:

~~~
fluxctl list-services
~~~

<h3 id="launching-and-configuring-flux-a-name-private-repo-a-configuring-access-for-a-private-registry"><a name="private-repo"></a>Configuring Access for a Private Registry</h3>

To configure `fluxd` to use a private registry, use the following stanza in the `.conf` file:

```
registry:
  auths:
    "<address-of-registry>":
      auth: "<base64-encoded-user:password>"
```

An example of `<address-of-registry>` is `https://index.docker.io/v1/`.  You can copy `<base64-encoded-user:password>` from your `~/.docker/config.json`.



<h2 id="configuring-the-ssh-deploy-keys-on-github">Configuring The SSH Deploy Keys on GitHub</h2>

Configure the deploy keys for the `microservices-demo` repository that you forked in Github. This allows Flux to read and write to the repo with the Kubernetes manifests in it. It is important to note that the SSH keys you created must be set on the repository that contains the Kubernetes manifests.  These manifests are used by the Flux service to manage changes between the cluster and the app.

To set your public key up for the `microservices-demo` repo:

**1.** Go to the `<YOUR_GITHUB_USERNAME>/microservices-demo` repo on github, and click **Settings** from the top of the repo.

**2.** Click on **Deploy Keys** from the left-hand menu.

**3.** Click **Add a Key**, and then paste in your public key generated from above (Run `cat id-rsa-flux.pub` to see it).  

**Enable the `Allow Read/Write access` box so that Flux has full access to the repo.**


<h2 id="modify-the-manifest-file-so-it-points-to-your-container-image">Modify the Manifest file so it Points to Your Container Image</h2>

Begin by logging in to the Kubernetes master node. The rest of the demo will be run from the master Kubernetes node, but you could also run it from your laptop if you wish. Use `ssh -A` to enable the SSH agent so that you can use your GitHub SSH key from your workstation.

```
git clone https://github.com/<YOUR_GITHUB_USERNAME>/microservices-demo
cd microservices-demo/deploy/kubernetes
```

Modify the front-end manifest so that it refers to the container image that you'll be using. Using an editor of your choice, open `manifests/front-end-dep.yaml`, and update the `image` line.

Change it from:

```
        image: weaveworksdemos/front-end
```
To:

```
        image: quay.io/$YOUR_QUAY_USERNAME/front-end:deploy-tag
```

Where,

* `$YOUR_QUAY_USERNAME` is your Quay.io username.

You must specify a tag for the image. Flux will not recognize the image if there is no tag. Since Flux replaces tags with a specific version every time it does a release, it is best not to use `:latest` as a tag in this file.

Commit and push the change to your GitHub fork:

```
git commit -m "Update front-end to refer to my fork." manifests/front-end-dep.yaml
git push
```

Then go to [Travis-CI](https://travis-ci.org/) and watch as the image is built, unit-tested and then pushed to the Docker Registry,  [Quay.io](https://quay.io).

<h2 id="deploy-the-sock-shop-to-kubernetes">Deploy the Sock Shop to Kubernetes</h2>

Deploy the Socks Shop to Kubernetes. This is the last time you will run `kubectl` in this demo. After this, everything can be controlled and automated via Flux service, `fluxctl`.

```
cd ~/microservices-demo/deploy/kubernetes
kubectl apply -f manifests
```

Wait for the Socks Shop to deploy. When finished, find the NodePort by running:

~~~
kubectl describe svc front-end -n sock-shop
~~~

Display the Sock Shop in the browser using `<master-node-IP>:<NodePort>`.

Note that the active states of the Catalogue and the Cart buttons are blue. In the next section you will change those to red.

<h2 id="make-a-change-to-the-socks-shop-and-deploy-it">Make a Change to the Socks Shop and Deploy it</h2>

Suppose you want to change the colour of one of the buttons on the socks shop. On your workstation, or wherever you have `front-end` checked out (**Note:** You may need to clone it to your workstation, if you haven't already done this):

```
cd front-end
sed -i s/#4993e4/red/ ./public/css/style.blue.css
```
You can also open up the file `./public/css/style.blue.css` in a text editor and search and replace `#4993e4` with `red`.

Now push the change to Github:

```
git commit -am "Change buttons to red."
git push
```

<h3 id="make-a-change-to-the-socks-shop-and-deploy-it-deploying-the-change-to-kubernetes-with-flux">Deploying the Change to Kubernetes with Flux</h3>

Return to Travis and watch the change as it's being built in a Docker image and then pushed to Quay.

Once the new image is ready in Quay.io, query `fluxd` using the service, `fluxctl` to see which images are available for deployment:

```
fluxctl list-images --service=sock-shop/front-end
```

Where you will see something as follows:

~~~
fluxctl list-images --service=sock-shop/front-end
SERVICE              CONTAINER  IMAGE                                         CREATED
sock-shop/front-end  front-end  quay.io/abuehrle/front-end                    
                                |   b071dff52e76c302afbdbd8735fb1901cab3629d  16 Nov 16 18:35 UTC
                                |   latest                                    16 Nov 16 18:35 UTC
                                |   snapshot                                  16 Nov 16 18:35 UTC
                                |   815ddf17c351d0ab8f01048610db72e22dc2880f  16 Nov 16 16:45 UTC
                                '-> 1ce46a8aacee796e635426941e063f20bd1c860a  16 Nov 16 05:44 UTC
                                    52ac6c212a06812df79b5996471b94d4d8e2e88d  16 Nov 16 05:35 UTC
                                    ac7b1e47070d99dff4c8d6acf0967b3ce8174f87  16 Nov 16 03:53 UTC
                                    26f53f055f117042dce87281ad88eb7305631afa  16 Nov 16 03:19 UTC
                                    1a2a73b945de147a9b32fb38fcdc0d8e0daaed15  16 Nov 16 02:57 UTC
                                    df061eb1bececacbeee01455669ba14d7674047e  15 Nov 16 23:18 UTC
~~~

Now deploy the new image with:

```
fluxctl release --service=sock-shop/front-end --update-all-images
```

Once the release is deployed, reload the Socks Shop in your browser and notice that the buttons in the catalogue and on the cart have all changed to red!

So that's useful for manually gated changes, but it's even better to do continuous delivery.

<h3 id="make-a-change-to-the-socks-shop-and-deploy-it-enabling-continuous-delivery">Enabling Continuous Delivery</h3>

Turn continuous delivery on by running:

```
k8s-01$ fluxctl automate --service=sock-shop/front-end
```

Then change the front-end again, maybe green this time?

```
cd front-end
sed -i s/red/green/ ./public/css/style.blue.css
```

Of course, you can make any change you like. Now push the change:

```
git commit -am "Change button to blue."
git push
```

And watch Travis, and Quay.

Run `fluxctl history` on the master node to see the deployment happening automatically.

~~~
TIME                 TYPE  MESSAGE
16 Nov 16 18:43 UTC  v0    front-end: Regrade due to "Release latest images to sock-shop/front-end": done
16 Nov 16 18:43 UTC  v0    front-end: Starting regrade "Release latest images to sock-shop/front-end"
16 Nov 16 16:40 UTC  v0    front-end: Automation enabled.
16 Nov 16 16:33 UTC  v0    front-end: Regrade due to "Release latest images to sock-shop/front-end": done
16 Nov 16 16:33 UTC  v0    front-end: Starting regrade "Release latest images to sock-shop/front-end"
16 Nov 16 05:50 UTC  v0    front-end: Automation enabled.
~~~

<h3 id="make-a-change-to-the-socks-shop-and-deploy-it-viewing-and-managing-releases-in-weave-cloud">Viewing and Managing Releases in Weave Cloud</h3>

Once you have everything all configured, you can also deploy new changes and view releases right from within Weave Cloud.

<img src="images/flux-history-weave-cloud.png" />

To release a new image, click on the service, and choose the image to release:

<img src="images/flux-release-weave-cloud.png"/>


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

* To uninstall a daemon set run `kubectl delete ds <agent-name>`. 

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

You've seen how to automate continuous delivery while maintaining best practices by storing Kubernetes manifests in version control with Weave Flux.

Developers on your team can now push to `git` to deploy code changes to your Kubernetes clusters.

See the [Flux README](https://github.com/weaveworks/flux) and `fluxctl --help` for more details on other commands.

<p></p>
If you have any questions or comments you can reach out to us on our <a href="https://weave-community.slack.com"> Slack channel </a> or through one of these other channels at <a href="https://www.weave.works/help/"> Help </a>.


<div style="width:50%; padding: 10px; float:left;font-weight: 700;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>
