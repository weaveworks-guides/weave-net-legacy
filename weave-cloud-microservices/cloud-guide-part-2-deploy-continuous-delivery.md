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

Continuous Delivery with Weave Flux manages change between your container registry, where your CI system pushes or builds a Docker container image, and your version control system that keeps track of your Kubernetes manifests. Flux tracks and acts on changes between these systems without you having to disassemble and reassemble your infrastructure each time a new feature is added to your app.

##A Video Overview

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe src="https://player.vimeo.com/video/190563579" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
</div></center>

## Introduction

Weave Flux enables every developer on your team to push changes to a Kubernetes cluster as simply as a `git push`, while at the same time maintains a best practices approach by version controlling all of the cluster configuration (Kubernetes manifests) as you go, and by automatically modifying the manifests to include any new versions.

Flux does this by:

 **1.**  Watching a container image registry for changes.

 **2.**  When a new image arrives, consulting its deployment policy, which for each service (container image) can either be "manual" or "automatic". This policy can be modified by running `fluxctl automate`.

 **3.**  If it's configured to automatically deploy a change, it proceeds immediately. If not, it waits for the user to run `fluxctl release`.

 **4.**  When doing a release, flux clones the latest version of the Kubernetes manifests from version control, updates the manifest for the new image, makes a commit and pushes the change back to version control. It then applies the change to your cluster.

This deployment pipeline automates an otherwise manual and error-prone two-step process of updating the Kubernetes manifest in version control and applying the changes to the cluster.

In this tutorial, you will put yourself in the position of a developer on a devops team, where you will watch a code change go from your laptop to code in version control, and on through the CI system which automatically builds a container image and pushes it to the registry, after which Flux takes over and, because the service was configured to deploy with `fluxctl automate`, it automatically modifies the Kubernetes manifest in version control and then deploys the change to your Kubernetes cluster.

In particular, you will change the colour of a button on the frontend of the user's app, a Socks Shop.

## Deploy a Kubernetes Cluster with Weave Net and the Sample App

If you have already done this as part of one of the other tutorials, you can skip this step. Otherwise, click "Details" below to see how to set up a Kubernetes cluster and deploy the Socks Shop demo app to it.

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

XXX-END-DETAILS-BLOCK


## Fork The Repositories

You will need a GitHub account for this step.

In order to modify the Socks Shop, you need to fork (at least) two repositories:

* [https://github.com/microservices-demo/front-end](https://github.com/microservices-demo/front-end) - the front-end of the application. We will update the color of one of the buttons in this example.
*  [https://github.com/microservices-demo/microservices-demo](https://github.com/microservices-demo/microservices-demo) - the repo that stores the Kubernetes manifests for the application. Flux will update this repository.

Go to each GitHub repository and click "Fork" in the top right hand corner, and fork the repository to your own GitHub account.

## Shut Down The Socks Shop Running on the Kubernetes Cluster

If you followed the instructions above, there will already be a socks shop running on your Kubernetes cluster. First remove that, so that you can deploy a copy from your own fork:

~~~
kubectl delete namespace sock-shop
~~~


## Get a Container Registry Account

You can use any container registry, such as Docker Hub or Google Container Registry. In this example, we'll use Quay.io.

Sign up for a [Quay.io](https://quay.io) account, and record the username that it gives you. When you log in, you'll be able to see it under "Users and Organizations" on the right hand side of the Repositories page.

Make an empty Quay.io repository called `front-end`, where you'll configure Travis to push to.

## Get a Continuous Integration Account

If you already have your own CI system, you can use that instead. All that Flux needs is that something creates a container image and pushes it to the registry whenever you push to GitHub.

The example used here is [Travis CI](https://travis-ci.org/). Sign up for an account if you haven't got one already, and then hook it up to your GitHub account. Click the `+` button next to "My Repositories" and toggle on the button for `<YOUR_GITHUB_USERNAME>/front-end` so that Travis automatically runs builds for the repo.

## Edit the travis.yml File

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


## Configure a Robot Account in Quay.io

Log into Quay.io, and create a robot account (`ci_push_pull`) and then give it Admin permissions to that repo.

Next, set up TravisCI. In http://travis-ci.org/, sign in, find the front-end repo and switch it on.

Supply environment entries for `DOCKER_USER` and `DOCKER_PASS` by copying them from the robot account in quay.io.

These variables can be found by clicking on the robot account's settings and then credentials. Then selecting 'Docker Login'.

`DOCKER_USER=<"user-name+robot-account">`
`DOCKER_PASS=<"Quay.io-key">`

Where,

* `<"user-name+ci_push_pull">` is your name with the + sign and the name of the robot account.
* `<"Quay.io-key">` is the key found in the Docker Login dialog.


## Launching and Configuring Flux

There are two parts of Flux that must be configured and installed: the Flux Daemon and the Flux Service.  The Flux daemon is deployed to the cluster and it listens for changes being pushed through git and updates the cluster accordingly. `fluxctl` is the command line utility and it allows you to send requests and commands to the daemon. The flux daemon is deployed first to the cluster and afterwards, `fluxctl` is downloaded and set up.

**1.** Log onto the master Kubernetes node, and create the following .yaml file using your favourite editor:

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
        image: quay.io/weaveworks/fluxd:master-6cc08e4
        imagePullPolicy: IfNotPresent
        args:
        - --token=INSERTTOKENHERE
~~~
Insert your Weave Cloud token at `INSERTTOKENHERE` and then save the file as `fluxd-dep.yaml`

**2.** Deploy the Flux daemon to your Kubernetes cluster:

~~~
kubectl apply -f ./fluxd-dep.yaml
~~~


**3.** Generate a PGP key for your repo, which will be used by Flux to communicate between your repo and your cluster:

```
ssh-keygen -f id-rsa-flux
```


**4.** Install the `fluxctl` binary onto the master node:

```
curl -o /usr/local/bin/fluxctl -sSL https://github.com/weaveworks/flux/releases/download/master-6cc08e4/fluxctl-linux-amd64
chmod +x /usr/local/bin/fluxctl
```

**5.** Create a file on the master node called `flux.conf` using your favourite text editor:

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

* Replace `<YOUR_GITHUB_USERNAME>` with your GitHub username.
* Copy the private key you created earlier into the private key section of the file. To view the key, run `cat id-rsa-flux`. **Ensure that the indentation is correct.**
* In the Registry section, copy the authorization details from Quay robot account (`ci_push_pull`) you created earlier. You can find those details by selecting `view credentials` from the robot account you created in Quay.io.

**6.** Configure access to the Flux daemon:

```
export FLUX_URL=<weave-cloud-token>
```

**7.** Load this config into Flux using:

```
fluxctl set-config --file=flux.conf
```
**8.** And then, check that all went well by running:

~~~
fluxctl list-services
~~~

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

## Configure The Deploy Key on GitHub

Configure the deploy keys for the front-end repository in Github. This allows Flux to read and write to the repo with the Kubernetes manifests in it.

Go to the `<YOUR_GITHUB_USERNAME>/microservices-demo` repo on github, click `Settings` from the Setting tab on the top of the repo. Then select `Deploy Keys` from the left-hand menu. Click `Add a key`, and then paste your public key that was generated from above (Run `cat id-rsa-flux.pub`).  Be sure to check the `Allow write access` box.

## Modify the Front-end Manifest to Point to Your Container Image

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

Where,

* `$YOUR_QUAY_USERNAME` is your Quay.io username.

It is important that you specify a tag for the image. Flux will not recognize the image if you don't. In this example, specify `:latest` however, keep in mind that Flux replaces that tag with a specific version every time it does a release.

Commit and push this change to your GitHub fork:

```
git commit -m "Update front-end to refer to my fork." front-end-dep.yaml
git push
```

Commit and push the change. Now you should see [Travis-CI](https://travis-ci.org/) build the image and push it to [Quay.io](https://quay.io).

##Deploy the Sock Shop to Kubernetes

Now let's deploy the socks shop to Kubernetes. This is the last time you will have to run `kubectl` in this demo: after this, everything can be controlled and automated via Flux.

```
cd ~/microservices-demo/deploy/kubernetes
kubectl apply -f manifests
```

Now wait for the socks shop to deploy, and find the NodePort in the usual way:

~~~
kubectl describe svc front-end -n sock-shop
~~~


## Let's Make a Change!

Let's suppose we want to change the color of one of the buttons on the socks shop. On your workstation, or wherever you have `front-end` checked out:

```
cd front-end
sed -i s/3386e1/red/ ./public/css/style.blue.css
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
sed -i s/red/blue/ ./public/css/style.blue.css
```

Of course, you can make any change you like. Now push the change:

```
git commit -am "Change button to blue."
git push
```

Now watch Travis, Quay and `fluxctl history` to see the deploy happening automatically.


## Slack Integration

Set up Slack integration by specifying a Slack webhook in the `hookURL` configuration variable, and choose the name of your bot in `username`. Edit `flux.conf` accordingly and then run:

~~~
fluxctl set-config --file=flux.conf
~~~

Flux will then let you know in Slack, in the channels you configure in the webhook, whenever it's doing a release.

<!-- TODO is the above accurate? @squaremo -->


## Tear Down

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop-teardown.md"}

XXX-END-DETAILS-BLOCK


# Conclusion

You've seen how to automate continuous delivery while maintaining best practices, and storing Kubernetes manifests in version control, with Weave Flux.

Developers now only have to be able to push to `git` to deploy changes to your Kubernetes clusters.

See the [Flux README](https://github.com/weaveworks/flux) and `fluxctl --help` for more details on other commands.


# Coming Soon

Weave Cloud will soon include a UI to view and configure your Flux deploys, and you'll be able to configure Flux with a service token.
<p></p>
{"gitdown": "include", "file": "./includes/slack-us.md"}

<div style="width:50%; padding: 10px; float:left;font-weight: 700;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>
