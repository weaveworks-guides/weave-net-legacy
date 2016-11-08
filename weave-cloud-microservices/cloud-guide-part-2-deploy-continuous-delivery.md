<!-- Deploy: Continuous Delivery with Weave Flux -->

This is Part 2 of 4 of the <a href="/guides/">Weave Cloud guides series</a>. In this guide, you'll see how to achieve fast iteration and Continuous Delivery with Weave Cloud and Weave Flux, which connects the output of your CI system into your container orchestrator. This example uses Kubernetes.

<div style="width:50%; padding: 10px; float:left;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>


<img src="images/deploy.png" style="width:100%; border:1em solid #32324b;" />




<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe width="530" height="298" src="https://www.youtube.com/embed/CKHXYtU1n8Y?modestbranding=1&autohide=0&showinfo=0&controls=1&rel=0" frameborder="0" allowfullscreen></iframe>
</div></center>


## Contents

{"gitdown": "contents"}

## Introduction

Weave Flux enables every developer on your team to push changes to a Kubernetes cluster as simply as a `git push`, while maintaining best practices in version controlling all of the cluster configuration (Kubernetes manifests) as you go by automatically modifying the manifests to include new versions.

Continuous Delivery with Weave Flux interacts with the following three things:

 **1.**  Your container registry, where typically your CI system (or something/someone else) pushes or builds container images.

 **2.**  Your version control system, where you store your Kubernetes manifests.

 **3.**  Your Kubernetes deployment, where you run a Flux agent (`fluxd`), in order to do the deployments (releases).

And it does this by:

 **1.**  Watching a container image registry for changes.

 **2.**  When a new image arrives, consulting its deployment policy, which for each service (container image) can either be "manual" or "automatic". This policy can be modified by running `fluxctl automate`.

 **3.**  If it's configured to automatically deploy a change, it proceeds immediately. If not, it waits for the user to run `fluxctl release`.

 **4.**  When doing a release, fluxy clones the latest version of the Kubernetes manifests from version control, updates the manifest for the new image, makes a commit and pushes the change back to version control. It then applies the change to your cluster.

This automates an otherwise manual and error-prone two-step process of updating the Kubernetes manifest in version control and applying the changes to the cluster.

In this tutorial, you will put yourself in the position of a developer on a devops team, and watch a code change go from code on a laptop to code in version control, through the CI system which builds a container image and pushes it to the registry, after which Flux takes over and, because the service was configured to automatically deploy with `fluxctl automate`, automatically modifies the Kubernetes manifest in version control and then deploys the change to the user's cluster.

In particular, you will change the colour of a button on the frontend of the user's app, a socks shop.

## Deploy a Kubernetes Cluster with Weave Net and Then Deploy the Application to it

If you have already done this as part of one of the other tutorials, you can skip this step. Otherwise, click "Details" below to see the instructions for setting up a Kubernetes cluster and deploying the socks shop to it.

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

XXX-END-DETAILS-BLOCK


## Fork The Repositories

You will need a GitHub account for this step.

In order to modify the socks shop, you need to fork (at least) two repositories:

* [https://github.com/microservices-demo/front-end](https://github.com/microservices-demo/front-end) - the front-end of the application. We will update the color of one of the buttons in this example.
*  [https://github.com/microservices-demo/microservices-demo](https://github.com/microservices-demo/microservices-demo) - the repo that stores the Kubernetes manifests for the application. Flux will update this repository.

Go to each GitHub repository and click "Fork" in the top right hand corner, and fork the repository to your own GitHub account.

## Shut Down The Socks Shop Running on the Kubernetes Cluster

If you followed the instructions above, there will already be a socks shop running on your Kubernetes cluster. First remove that, so that you can deploy a copy from your own fork:

~~~
kubectl delete --all pods -n sock-shop
~~~


## Get a Container Registry Account

You can use any container registry, such as Docker Hub or Google Container Registry. In this example, we'll use Quay.io.

Sign up for a [Quay.io](https://quay.io) account, and record the username that it gives you. When you log in, you'll be able to see it under "Users and Organizations" on the right hand side of the Repositories page.

Make an empty Quay.io repository called `front-end`, where you'll configure Travis to push to.

## Get a Continuous Integration Account

If you already have your own CI system, you can use that instead. All that Flux needs is that something creates a container image and pushes it to the registry whenever you push to GitHub.

The example used here is [Travis CI](https://travis-ci.org/). Sign up for an account if you haven't got one already, and then hook it up to your GitHub account. Click the `+` button next to "My Repositories" and toggle on the button for `<YOUR_GITHUB_USERNAME>/front-end` so that Travis automatically runs builds for the repo.

## Configure .travis.yml File

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


## Configure Robot Account in Quay.io

Log into Quay.io, and create a robot account (`ci_push_pull`) and then give it Admin permissions to that repo.

Connect up to TravisCI. In http://travis-ci.org/, sign in, find the repo and switch it on. Supply environment entries for `DOCKER_USER` and `DOCKER_PASS` by copying them from the robot account in quay.io.


## Getting Flux Running

Log into the master Kubernetes node.

Deploy Flux to your Kubernetes cluster:
~~~
kubectl apply -f https://gist.githubusercontent.com/errordeveloper/0e92c0223ac40a9df68df8e402ca873c/raw/2eaf7a567d75a41faf7a6712aded3d6fa6ad13ff/flux.yaml
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
export FLUX_URL=http://localhost:8080/api/v1/proxy/namespaces/default/services/fluxy
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

## Configure The Deploy Dey on GitHub

This allows Flux to read and write to the repo with the Kubernetes manifests in it.

Go to the `<YOUR_GITHUB_USERNAME>/microservices-demo` repo on github, click settings, deploy keys (on the left at present). Add a key, paste in the public key from above, check the `Allow write access` box. (Run `cat id-rsa-flux.pub` to get this out.)


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


## Let's Make a Change!

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

<div style="width:50%; padding: 10px; float:left;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>
