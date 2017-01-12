<!-- Deploy: Continuous Delivery with Weave Flux -->
In Part 2 of 4 of the <a href="/guides/">Weave Cloud guides series</a> you will learn how to achieve fast iteration and continuous delivery with Weave Cloud and Weave Flux, and how automatic app deployment is possible by connecting the output of your continuous integration system into a container orchestrator.

As a developer on a DevOps team, you will make a code change to the company microservices-based app, the Sock Shop, push the change to version control, and then automatically deploy the new image to a Kubernetes Cluster. This example uses [Travis CI](https://travis-ci.org/) for Continuous Integration and [Quay](https://quay.io) for the container registry, but Weave Flux is flexible and it works with all of your favourite tools, such as Jenkins, Docker Registry and Gitlab.

###How Weave Flux Works

With Weave Flux every developer on your team can make app changes and deploy it to a Kubernetes cluster.  Flux maintains a best practices approach by version controlling the Kubernetes manifests, and by modifying them to include all pushed Docker image versions. This allows DevOps teams to make rapid and less error-prone code changes.

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

##A Video Overview

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe src="https://player.vimeo.com/video/190563579" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
</div></center>

## Sign Up for Weave Cloud

To begin, sign up for Weave Cloud and deploy the Scope probes on your laptop.  

After verifying that the app works as it should on your laptop, you'll launch a new set of Scope probes in to your production environment, launch the app and Kubernetes and compare that deployment with the one on your laptop.  

To sign up for Weave Cloud:

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a> <!-- lkj_ -->
2.  Sign up using either a Github, or Google account or use an email address.
3.  Obtain the cloud service token from the User settings screen:

<img src="images/weave-cloud-token-1.png" style="width:100%;" />

## Deploy the Sock Shop to Kubernetes with Weave Net

If you have already done this as part of one of the other tutorials, you can skip this step. Otherwise, click "Details" below to see how to set up a Kubernetes cluster and deploy the Socks Shop demo app to it.

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

XXX-END-DETAILS-BLOCK


## Fork The Repositories

You will need a GitHub account for this step.

Before you can modify the Socks Shop, fork the following two repositories:

* [https://github.com/microservices-demo/front-end](https://github.com/microservices-demo/front-end) - the front-end of the Sock Shop application. You will update the color of one of the buttons in this example.
*  [https://github.com/microservices-demo/microservices-demo](https://github.com/microservices-demo/microservices-demo). This repo stores the Kubernetes manifests for the application. Flux automatically updates this repository.

To fork the GitHub repositoris and click "Fork" in the top right hand corner, and the repositories will appear in your own GitHub account.

## Shut Down The Socks Shop Running on the Kubernetes Cluster

If you followed the instructions above, the Socks Shop demo will already be running in Kubernetes. First delete the `sock-shop namespace` so you can deploy a copy from your own fork.

On the master node run:

~~~
kubectl delete namespace sock-shop
~~~

## Get a Container Registry Account

Sign up for a [Quay.io](https://quay.io) account, and record the username that it gives you. When you log in, you'll be able to see it under "Users and Organizations" on the right hand side of the Repositories page.

Create a new public repository called `front-end`. This Docker repository will be used by Travis on which to push newly images.

## Get a Continuous Integration Account

If you already have your own CI system, you can use that instead. All that Flux needs is something that creates a container image and pushes it to the registry whenever you push a change to GitHub.

The example used here is [Travis CI](https://travis-ci.org/). Sign up for an account if you haven't got one already, and then hook it up to your GitHub account. Click the `+` button next to "My Repositories" and toggle the button for `<YOUR_GITHUB_USERNAME>/front-end` so that Travis automatically runs builds for the repo.

## Edit the travis.yml File

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

## Configure a Robot Account in Quay.io and Link it to Travis CI

**1.** Log into Quay.io, and create a robot account called `ci_push_pull` by selecting the + from the header.

<img src="images/add-robot-account.png" />

**2.** Ensure that the robot account has Admin permissions.

**3.** Configure the environment entries for `DOCKER_USER` and `DOCKER_PASS` by copying them from the robot account in quay.io. Click the `ci_push_pull` repo and then `credentials` and `settings` and select `Robot Token` from the top of this dialog. Copy the robot token from this dialog.

**4.** Go back to [TravisCI](http://travis-ci.org/), find the `front-end` repo and turn on the build switch next to it.  

**5.** Add the Quay.io robot account environment variables to the `front-end` repo in Travis by selecting `More Options` and then `Settings` from the drop down menu on the upper right.  

<img src="images/travis-ci-build-settings.png" />

Add the following variables from the credentials dialog on the robot account you created in Quay:

`DOCKER_USER=<"user-name+robot-account">`
`DOCKER_PASS=<"robot-key">`

**Where**,

* `<"user-name+ci_push_pull">` is your name with the + sign and the name of the robot account.
* `<"robot-key">` is the key found in the Robot Token dialog.


## Launching and Configuring Flux

Flux consists of two parts: the `fluxd` daemon and the `fluxctl` service.  The `fluxd` daemon is deployed to the cluster and listens for changes being pushed through git; it then updates the cluster and any images accordingly. `fluxctl` is the command line utility that enables you to send requests and commands to the daemon. First deploy the `fluxd` daemon to the cluster and then download the `fluxctl` service and configure it for your environment.

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
* In the Registry section, copy the authorization details from the Quay robot account (`ci_push_pull`) you created earlier. You can find those details by selecting `Settings` and then clicking on the `ci_push_pull` Robot Account.  Select the `Docker Configuration` tab from the `Robot Credentials` dialog in Quay. This step is optional and only required if you are using a private repository, See [Configuring Access for a Private Registry](#private-repo) for more information.

**6.** Configure access to the `fluxd` daemon using:

```
export FLUX_SERVICE_TOKEN=<weave-cloud-token>
```

**7.** Load the config file into the Flux service:

```
fluxctl set-config --file=flux.conf
```

**Note:** If you've logged out of your shell, you must re-run both `export FLUX_SERVICE_TOKEN=<weave-cloud-token>`and `fluxctl set-config --file=flux.conf` commands to re-establish your environment.

**8.** Check that all went well by running:

~~~
fluxctl list-services
~~~

###<a name="private-repo"></a>Configuring Access for a Private Registry

If you want to configure `fluxd` to use a private registry, use the following stanza in the `.conf` file:

```
registry:
  auths:
    "<address-of-registry>":
      auth: "<base64-encoded-user:password>"
```

An example of `<address-of-registry>` is `https://index.docker.io/v1/`.  You can copy `<base64-encoded-user:password>` from your `~/.docker/config.json`.



## Configuring The SSH Deploy Keys on GitHub

Configure the deploy keys for the `front-end` repository that you forked in Github. This allows Flux to read and write to the repo with the Kubernetes manifests in it. It is important to note that the SSH keys you created must be set on the repository that contains the Kubernetes manifests.  These manifests are used by the Flux service to manage changes between the cluster and the app.

To set your public key up for the `front-end` repo:

**1.** Go to the `<YOUR_GITHUB_USERNAME>/front-end` repo on github, and click `Settings` from the top of the repo.

**2.** Select `Deploy Keys` from the left-hand menu.

**3.** Click `Add a key`, and then paste in your public key generated from above (Run `cat id-rsa-flux.pub` to see it).  

**Enable the `Allow Read/Write access` box so that Flux has full access to the repo.**


## Modify the Manifest file so it Points to Your Container Image

Begin by logging in to the Kubernetes master node. The rest of the demo will be run from the master Kubernetes node, however you could also run it from your laptop if you wish. Use `ssh -A` to enable the SSH agent so that you can use your GitHub SSH key from your workstation.

```
git clone https://github.com/<YOUR_GITHUB_USERNAME>/microservices-demo
cd microservices-demo/deploy/kubernetes
```

Modify the front-end manifest so that it refers to the container image that you'll be using. Using your favorite editor, open up `manifests/front-end-dep.yaml`, and update the `image` line.

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

You must specify a tag for the image. Flux will not recognize the image if there is no tag. Since Flux replaces tags with a specific version every time it does a release and so it is best not to use `:latest` as a tag.

Commit and push this change to your GitHub fork:

```
git commit -m "Update front-end to refer to my fork." manifests/front-end-dep.yaml
git push
```

Then go to [Travis-CI](https://travis-ci.org/) and watch as the image is built, unit-tested and then pushed it to the Docker Registry,  [Quay.io](https://quay.io).

##Deploy the Sock Shop to Kubernetes

Deploy the Socks Shop to Kubernetes. This is the last time you will have to run `kubectl` in this demo: after this, everything can be controlled and automated via Flux service, `fluxctl`.

```
cd ~/microservices-demo/deploy/kubernetes
kubectl apply -f manifests
```

Now wait for the Socks Shop to deploy, and find the NodePort by running:

~~~
kubectl describe svc front-end -n sock-shop
~~~

Display the Sock Shop in the browser using `<master-node-IP>:<NodePort>`.

In the header, the catalogue active state of the button is blue and so is the cart button. We will change these to red.

## Make a Change to the Socks Shop and Deploy it

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

###Deploying the Change to Kubernetes with Flux

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

And then deploy it:

```
fluxctl release --service=sock-shop/front-end --update-all-images
```

Once the release is deployed, reload the Socks Shop in your browser to see that the buttons in the catalogue and on the cart have all changed to red!

So that's useful for manually gated changes, but it's even better to do continuous delivery. Turn that on by running:

```
k8s-01$ fluxctl automate --service=sock-shop/front-end
```

Then change the front-end again, maybe back to green this time?

```
cd front-end
sed -i s/red/green/ ./public/css/style.blue.css
```

Of course, you can make any change you like. Now push the change:

```
git commit -am "Change button to blue."
git push
```

And watch Travis, and Quay. Run `fluxctl history` on the master node to see the deployment happening automatically.

~~~
TIME                 TYPE  MESSAGE
16 Nov 16 18:43 UTC  v0    front-end: Regrade due to "Release latest images to sock-shop/front-end": done
16 Nov 16 18:43 UTC  v0    front-end: Starting regrade "Release latest images to sock-shop/front-end"
16 Nov 16 16:40 UTC  v0    front-end: Automation enabled.
16 Nov 16 16:33 UTC  v0    front-end: Regrade due to "Release latest images to sock-shop/front-end": done
16 Nov 16 16:33 UTC  v0    front-end: Starting regrade "Release latest images to sock-shop/front-end"
16 Nov 16 05:50 UTC  v0    front-end: Automation enabled.
~~~
###Viewing and Manging Releases in Weave Cloud

Once you have everything all configured, you can also deploy new changes and view releases right from within Weave Cloud.

<img src="images/flux-history-weave-cloud.png" />

To release a new image, click on the service, and choose the image to release:

<img src="images/flux-release-weave-cloud.png"/>


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
