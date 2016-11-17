<!-- Deploy: Continuous Delivery with Weave Flux -->
In Part 2 of 4 of the <a href="/guides/">Weave Cloud guides series</a> you will learn how to achieve fast iteration and continuous delivery with Weave Cloud and Weave Flux, and how automatic app deployment is possible by connecting the output of your continuous integration system into a container orchestrator.

With Weave Flux every developer on your team makes app changes and deploys it to a Kubernetes cluser in the cloud with a simple `git push`.  Because Flux maintains a best practices approach by version controlling the cluster configuration files (Kubernetes manifests) as you go along, and by automatically modifying them to include all pushed versions of the app's Docker images, code changes can be made more rapidly and are also less error-prone.

Flux does this by:

 **1.**  Watching a container image registry for changes.

 **2.**  Deploying images (microservices) based on a "manual deployment" or an "automatic deployment" policy.  When a new image arrives, the deployment policy is consulted. Policies can be modified on a service by service basis by running `fluxctl automate`. If Flux is configured to automatically deploy a change, it proceeds immediately. If not, Flux waits for you to run `fluxctl release`.

 **3.**  During a release, Flux clones the latest version of the Kubernetes manifests from version control, updates the manifest for the new image, makes a commit and then pushes the change back to version control. It then applies the change to your cluster. This deployment pipeline automates an otherwise manual and error-prone two-step process of updating the Kubernetes manifest in version control and applying the changes to the cluster.

In this tutorial, you will put yourself in the position of a developer on a devops team, where you will watch a code change go from your laptop to code in version control, and then on through the CI system which automatically builds a container image and pushes it to the registry, after which Flux takes over and, because the service was configured to deploy with `fluxctl automate`, automatically modifies the Kubernetes manifest in version control and deploys the change to your Kubernetes cluster.

In particular, you will change the colour of a button on the frontend of a microservices architectured app, the Socks Shop.


<div style="width:50%; padding: 10px; float:left; font-weight: 700;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>


<img src="images/deploy.png" style="width:100%; border:1em solid #32324b;" />
<p></p>

Continuous Delivery with Weave Flux speeds up and streamlines the software development pipeline. With Weave Flux change is managed between your container registry, where Docker images are built and pushed, and your version control system, which stores not only the code, but also the Kubernetes manifests.

##A Video Overview

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe src="https://player.vimeo.com/video/190563579" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
</div></center>

## Deploy a Kubernetes Cluster with Weave Net and the Sample App

If you have already done this as part of one of the other tutorials, you can skip this step. Otherwise, click "Details" below to see how to set up a Kubernetes cluster and deploy the Socks Shop demo app to it.

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

XXX-END-DETAILS-BLOCK


## Fork The Repositories

You will need a GitHub account for this step.

In order to modify the Socks Shop, fork the following two repositories:

* [https://github.com/microservices-demo/front-end](https://github.com/microservices-demo/front-end) - the front-end of the application. We will update the color of one of the buttons in this example.
*  [https://github.com/microservices-demo/microservices-demo](https://github.com/microservices-demo/microservices-demo) - the repo that stores the Kubernetes manifests for the application. Flux will update this repository.

Go to each GitHub repository and click "Fork" in the top right hand corner, and fork the repository to your own GitHub account.

## Shut Down The Socks Shop Running on the Kubernetes Cluster

If you followed the instructions above, the Socks Shop demo will already be running on your Kubernetes cluster. You will need to remove that so you can deploy a copy from your own fork:

~~~
kubectl delete namespace sock-shop
~~~


## Get a Container Registry Account

You can use any container registry, such as Docker Hub or Google Container Registry. In this example, we'll use Quay.io.

Sign up for a [Quay.io](https://quay.io) account, and record the username that it gives you. When you log in, you'll be able to see it under "Users and Organizations" on the right hand side of the Repositories page.

Make an empty Quay.io repository called `front-end`, where you'll configure Travis to push to.

## Get a Continuous Integration Account

If you already have your own CI system, you can use that instead. All that Flux needs is something that creates a container image and pushes it to the registry whenever you push a change to GitHub.

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

Configure the environment entries for `DOCKER_USER` and `DOCKER_PASS` by copying them from the robot account in quay.io:

The "quay.io" variables are found in the robot account's settings after clicking on credentials. Select 'Robot Token' from the top of this dialog.

Enter the variables into Travis, by selecting "More Options" and then "Settings" from the drop down menu on the right.

Add the the variables:

`DOCKER_USER=<"user-name+robot-account">`
`DOCKER_PASS=<"robot-key">`

Where,

* `<"user-name+ci_push_pull">` is your name with the + sign and the name of the robot account.
* `<"robot-key">` is the key found in the Robot Token dialog.


## Launching and Configuring Flux

Flux consists of two parts: the `fluxd` daemon and the `fluxctl` service.  The `fluxd` daemon is deployed to the cluster and it listens for changes being pushed through git and updates the cluster and any images accordingly. `fluxctl` is the command line utility that enables you to send requests and commands to the daemon. The `fluxd` daemon is deployed first to the cluster and then, `fluxctl` is downloaded and configured for your environment.

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
        image: quay.io/weaveworks/fluxd:master-6cc08e4
        imagePullPolicy: IfNotPresent
        args:
        - --token=INSERTTOKENHERE
~~~

Paste your Weave Cloud token into the arg section: `INSERTTOKENHERE` and then save the file as `fluxd-dep.yaml`

**2.**  Deploy the `fluxd` daemon to the Kubernetes cluster:

~~~
kubectl apply -f ./fluxd-dep.yaml
~~~

**Note:** If you have Weave Cloud running, you check the UI to see that the `fluxd` is up and running as it should.

**3.**  Generate public and private SSH keys for your repo. These keys are used by `fluxd` to manage changes between Github and your cluster:

```
ssh-keygen -f id-rsa-flux
```


**4.**  Install the `fluxctl` binary onto the master node:

```
curl -o /usr/local/bin/fluxctl -sSL https://github.com/weaveworks/flux/releases/download/master-6cc08e4/fluxctl-linux-amd64
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
* In the Registry section, copy the authorization details from the Quay robot account (`ci_push_pull`) you created earlier. You can find those details by selecting `View Credentials` and then selecting `Docker Login` from the robot account you created in Quay.io (optional and is only required if you are using a private repository, See [Configuring Access for a Private Registry](#private-repo) for more information.)

**6.** Configure access to the `fluxd` daemon using:

```
export FLUX_URL=<weave-cloud-token>
```

**7.** Load the config file into the Flux service:

```
fluxctl set-config --file=flux.conf
```

**Note:** If you've logged out of your shell, you must re-run both `export FLUX_URL=<weave-cloud-token>`and `fluxctl set-config --file=flux.conf` commands to re-establish your environment.

**8.** Check that all went well by running:

~~~
fluxctl list-services
~~~

XXX-START-DETAILS-BLOCK

###<a name="private-repo"></a>Configuring Access for a Private Registry

If you want to configure `fluxd` to use a private registry, use the following stanza in the `.conf` file:

```
registry:
  auths:
    "<address-of-registry>":
      auth: "<base64-encoded-user:password>"
```

An example of `<address-of-registry>` is `https://index.docker.io/v1/`.  You can copy `<base64-encoded-user:password>` from your `~/.docker/config.json`.

XXX-END-DETAILS-BLOCK

## Configure The Deploy Key on GitHub

Configure the deploy keys for the `microservices-demo` repository that you forked in Github. This allows Flux to read and write to the repo with the Kubernetes manifests in it. It is important to note that the SSH keys you created must be set on the repository that contains the Kubernetes manifests.  These manifests are used by the Flux service to manage changes between the cluster and the app.

Go to the `<YOUR_GITHUB_USERNAME>/microservices-demo` repo on github, click `Settings` from the Setting tab on the top of the repo. Select `Deploy Keys` from the left-hand menu. Click `Add a key`, and then paste in your public key generated from above (Run `cat id-rsa-flux.pub`).  Be sure to enable the `Allow Read/Write access` box so that Flux has full access to the repo.


## Modify the Front-end Manifest to Point to Your Container Image

Begin by logging in to the Kubernetes master node. The rest of the demo will be run from the master Kubernetes node, however you could also run it from your laptop if you wish. Use `ssh -A` to enable the SSH agent so that you can use your GitHub SSH key from your workstation.

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

You must specify a tag for the image. Flux will not recognize the image if there is no tag. In this example, specify `:latest` however, keep in mind that Flux replaces that tag with a specific version every time it does a release.

Commit and push this change to your GitHub fork:

```
git commit -m "Update front-end to refer to my fork." front-end-dep.yaml
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

Display the Sock Shop in the browser using `<master-node-IP>:<NodePort>`

## Make a Change to the Socks Shop and Deploy it

Suppose you want to change the colour of one of the buttons on the socks shop. On your workstation, or wherever you have `front-end` checked out:

```
cd front-end
sed -i s/3386e1/red/ ./public/css/style.blue.css
```
You can also open up the file `./public/css/style.blue.css` in a text editor and go to line 1274 and change `#3386e1` to `red`.

Now push the change to Github:

```
git commit -am "Change button to red."
git push
```

And return to Travis to watch the change get turned into a Docker image and pushed to Quay.


Once a new image is in Quay.io, you can query `fluxd` with the service, `fluxctl` to see what images are available for deployment:

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

Once the release is deployed, reload the Socks Shop to see that the buttons in the header have changed to red!

So that's useful for manually gated changes, but it's even better to do continuous delivery. You can turn that on easily by running:

```
k8s-01$ fluxctl automate --service=sock-shop/front-end
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

Now watch Travis, Quay and run `fluxctl history` on the master node to see the deployment happening automatically.

~~~
TIME                 TYPE  MESSAGE
16 Nov 16 18:43 UTC  v0    front-end: Regrade due to "Release latest images to sock-shop/front-end": done
16 Nov 16 18:43 UTC  v0    front-end: Starting regrade "Release latest images to sock-shop/front-end"
16 Nov 16 16:40 UTC  v0    front-end: Automation enabled.
16 Nov 16 16:33 UTC  v0    front-end: Regrade due to "Release latest images to sock-shop/front-end": done
16 Nov 16 16:33 UTC  v0    front-end: Starting regrade "Release latest images to sock-shop/front-end"
16 Nov 16 05:50 UTC  v0    front-end: Automation enabled.
~~~


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
