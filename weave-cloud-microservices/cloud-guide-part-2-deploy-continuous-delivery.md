---
layout: guides
title: Continuous Delivery with Weave Flux
---

# Deploy: Continuous Delivery with Weave Flux

<img src="deploy.png" style="width:100%; border:1em solid #32324b;" />

This is Part 2 of 4 of the <a href="/guides/">Weave Cloud guides series</a>.

<div style="width:50%; float:left;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; float:left; text-align:right;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>

<center><div style="width:300px; display:inline-block; border:1px solid red; margin-top:2em;">
VIDEO GOES HERE
</div></center>


## Contents

{"gitdown": "contents"}

## Set up

Create three droplets on D.O. with the Ubuntus. Do steps 1 through 4
from https://lukemarsden.github.io/docs/getting-started-guides/kubeadm/ to get a Kubernetes cluster.


Go to github and fork the microservices-demo repo to
https://github.com/squaremo/microservices-demo.  Clone it locally.


## Get sockshop running


On lead node (ssh -A root@...), since there's no convenient way to run
kubectl otherwise:


```
k8s-01$ export YOURUSERNAME=XXX # replace this with your github username
k8s-01$ git clone git@github.com:$YOURUSERNAME/microservices-demo
k8s-01$ cd microservices-demo/deploy/kubernetes
k8s-01$ kubectl apply -f manifests/
```


(fix problem with mysql in catalogue-db)


Find NodePort and put with host IP to get address; put in browser.


```
k8s-01$ kubectl describe service front-end
```


## Set up frontend image build


There are lots of ways of doing this! Here's one example. It can be done ahead of
time, to some extent.


Fork the front-end repo to `$YOURUSERNAME/front-end`. Clone it locally.


```
local$ git clone git@github.com:$YOURUSERNAME/front-end
```


Sign up for quay.io. Make an empty repository called
$YOURUSERNAME/front-end. Create a robot account (`ci_push_pull`) and give
it write permissions to that repo.


Connect up to TravisCI. In http://travis-ci.org/, sign in, find the
repo and switch it on. Supply environment entries for DOCKER_USER and
DOCKER_PASS by copying them from the robot in quay.io.


Locally, change the environment entry `GROUP` in `microservices-front-end/.travis.yml` to
`quay.io/$YOURUSERNAME`, change `docker login ...` to `docker login quay.io
...`, and remove the bastion gubbins. Commit that and push. Now you
can go back and see it all happen in travis-ci.


## Getting fluxy running


This is largely taken from
https://github.com/weaveworks/fluxy/blob/master/deploy/README.md. Some of it can be done ahead of time.


Generate a deploy key for our repo, on the master node, and create a secret in Kubernetes for it:


```
k8s-01$ ssh-keygen -f id-fluxy
...
k8s-01$ kubectl create secret generic fluxy-repo-key --from-file=id-rsa=id-fluxy
...
k8s-01$ cat id-fluxy.pub
...
```


Go to the $YOURUSERNAME/microservices-demo repo on github, click settings, deploy
keys (on the left at present). Add a key, paste the public key from
above in, check `Allow write access` box.


Add fluxy config into the microservices-demo repository (for now I am copying across my
local configuration and modifying. The idea is soon you'll be able to
download it from cloud.weave.works, and provide keys some other way).


```
local$ cp $FLUXY_REPO/deploy/fluxy-*.yaml deploy/kubernetes/manifests/
```


Changed fluxy-deployment.yaml: imagePullPolicy to "IfNotPresent" and
image to "weaveworks/fluxy:master"; args:


```
 - --repo-url=git@github.com:$YOURUSERNAME/microservices-demo
 - --repo-path=deploy/kubernetes/manifests
```


Also change weaveworks/fluxy to weaveworks/fluxy:master.


You may want to prepare some of this ahead of time, or not even show
it.


I commit these to the repo locally, pushed them to
$YOURUSERNAME/microservices-demo, and pulled from the master host then
applied them.


```
k8s-01$ git pull
k8s-01$ kubectl apply -f manifests/fluxy-deployment.yaml -f manifests/fluxy-service.yaml
```


For now we use the kubernetes proxy to reach fluxy. I copied a fluxctl
binary to the master host, since it's not publicly available.


```
$ export FLUX_URL=http://localhost:8080/api/v1/proxy/namespaces/default/services/fluxy
$ fluxctl list-services
...
```


[[to remove a network policy on default: kubectl annotate namespace default net.beta.kubernetes.io/network-policy-]


## Demo proper


Oh no, we have to update the front-end to have a different button!
First, let's switch to using our fork of the front-end image.


Edit the config in microservices-demo locally and change the image for
front-end-dep.yaml to use quay.io/squaremo/front-end, appending the
tag (check quay.io for the tags if it's not on screen somewhere).


You have to apply this using kubectl, but it would be nice if fluxy
could do it for you.


```
k8s-01$ git pull
k8s-01$ kubectl apply -f deploy/kubernetes/manifests/front-end-dep.yaml
k8s-01$ kubectl get pods
```


Now we're ready to do something with fluxctl. Let's make another
front-end image. Edit microservices-front-end/public/index.html,
commit and push. Watch it bubble through travis to quay.io.


```
k8s-01$ fluxctl list-images --service=default/front-end
... # shows quay.io/squaremo/front-end as the image repo
k8s-01$ fluxctl release --service=default/front-end --update-all-images
...
```


If that worked, we can automate it:


```
k8s-01$ fluxctl automate --service=default/front-end
```


and change the front-end image again.

# Conclusion

What did we learn?

<div style="width:50%; float:left;">
<a href="/guides/cloud-guide-part-1-setup-troubleshooting/">&laquo; Go to previous part: Part 1 – Setup: Troubleshooting Dashboard</a>
</div>
<div style="width:50%; float:left; text-align:right;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">Go to next part: Part 3 – Monitor: Prometheus Monitoring &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>

{"gitdown": "include", "file": "./includes/slack-us.md"}
