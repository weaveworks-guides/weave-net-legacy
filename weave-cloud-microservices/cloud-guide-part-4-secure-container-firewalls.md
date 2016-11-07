<!-- Secure: Container Firewalls -->

<img src="images/secure.png" style="width:100%; border:1em solid #32324b;" />

This is Part 4 of 4 of the <a href="/guides/">Weave Cloud guides series</a>.
In this guide we'll see how to secure your app by defining Kubernetes Network Policy and having it enforced by Weave Net.

<div style="width:50%; float:left;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">&laquo; Go to previous part: Part 3 – Monitor: Prometheus Monitoring</a>
</div>
<div style="clear:both;"></div>

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe width="530" height="298" src="https://www.youtube.com/embed/3qRRP3fQBTs?modestbranding=1&autohide=0&showinfo=0&controls=1&rel=0" frameborder="0" allowfullscreen></iframe>
</div></center>


## Contents

{"gitdown": "contents"}


### Sign up for a Weave Cloud account

Go to [Weave Cloud](https://cloud.weave.works/) and register for an account.
You'll use the Weave Cloud token later to send metrics to Cortex.


## Deploy a Kubernetes cluster with Weave Net and then deploy a sample application (the socks shop) to it

If you have already done this as part of one of the other tutorials, you can skip this step.
Otherwise, click "Details" below to see the instructions.

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

XXX-END-DETAILS-BLOCK



### Deploy socks shop

On the master:

```
# kubectl create namespace sock-shop
# git clone https://github.com/microservices-demo/microservices-demo
# kubectl apply -n sock-shop -f microservices-demo/manifests
```

It takes several minutes to download and start all the containers, watch the output of `kubectl get pods -n sock-shop` to see when they're all up and running.


## Secure the application by applying Network Policy, which gets enforced by Weave Net

Now we'll use Kubernetes policy to secure the application.

Let's start by finding out that the application is not yet secured.
Supposed that a hacker is able to infiltrate ...

Before - container A can talk to container B.
Don't want it to be able to – apply policy.
Oh look, now it can't (all through Scope).


## Tear Down

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop-teardown.md"}

XXX-END-DETAILS-BLOCK

## Conclusions

TODO: What are they??

<div style="width:50%; float:left;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">&laquo; Go to previous part: Part 3 – Monitor: Prometheus Monitoring</a>
</div>
<div style="clear:both;"></div>

<p></p>

{"gitdown": "include", "file": "./includes/slack-us.md"}
