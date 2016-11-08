<!-- Secure: Container Firewalls -->



This is Part 4 of 4 of the <a href="/guides/">Weave Cloud guides series</a>.
In this guide we'll see how to secure your app by defining Kubernetes Network Policy and having it enforced by Weave Net.

<div style="width:50%; padding: 10px float:left;font-weight: 700;";">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">&laquo; Go to previous part: Part 3 – Monitor: Prometheus Monitoring</a>
</div>
<div style="clear:both;"></div>

<img src="images/secure.png" style="width:100%; border:1em solid #32324b;" />

<center><div style="width:530px; padding: 10px; display:inline-block; margin-top:2em;">
<iframe width="530" height="298" src="https://www.youtube.com/embed/3qRRP3fQBTs?modestbranding=1&autohide=0&showinfo=0&controls=1&rel=0" frameborder="0" allowfullscreen></iframe>
</div></center>



## Contents

{"gitdown": "contents"}


### Sign up for a Weave Cloud account

Go to [Weave Cloud](https://cloud.weave.works/) and register for an account.
You'll use the Weave Cloud token later to send metrics to Cortex.

<img src="images/weave-cloud-token.png" style="width:100%;" />


## Deploy a Kubernetes cluster with Weave Net and then deploy a sample application (the socks shop) to it

If you have already done this as part of one of the other tutorials, you can skip this step.
Otherwise, click "Details" below to see the instructions.

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

XXX-END-DETAILS-BLOCK


## Secure the application by applying Network Policy, which gets enforced by Weave Net

In the above guide, you should have deployed the socks shop.  However, the different components are not isolated.

Let's start by testing that. Load up [Weave Cloud](https://cloud.weave.works/) and make sure you're in the containers view, then observe that the catalogue service can talk to the shipping service.

Select "catalogue" and click the `>_` icon. This will load up a shell. Then type the following:

~~~
wget http://shipping
~~~

You should get:

~~~
wget: server returned error: HTTP/1.1 404
~~~

This is not good! The catalogue service can speak to the shipping service. For a hacker who managed to infiltrate the catalogue service, they could now get direct access to the shipping service and attack that too.

So, let's apply some network policy. SSH into the master, or where ever you run run `kubectl`:

~~~
cd microservices-demo
kubectl apply -f deploy/kubernetes/manifests-policy/
~~~

Now run the wget inside the terminal in Weave Cloud again:
~~~
wget http://shipping
~~~

And you'll see the connection just times out. Those packets are being dropped. The app is now more secure!

You can [take a look at the network policy itself](https://github.com/microservices-demo/microservices-demo/tree/master/deploy/kubernetes/manifests-policy) and learn about [Kubernetes network policy](http://kubernetes.io/docs/user-guide/networkpolicies/) to learn how to write your own policy for your app.

## Tear Down

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop-teardown.md"}

XXX-END-DETAILS-BLOCK

## Conclusions

You've seen that Kubernetes network policy allows you to define flexible and dynamic security policies, and Weave Net allows you to enforce them.
<p></p>

{"gitdown": "include", "file": "./includes/slack-us.md"}

<div style="width:50%; padding: 10px; float:left;font-weight: 700;">
<a href="/guides/cloud-guide-part-3-monitor-prometheus-monitoring/">&laquo; Go to previous part: Part 3 – Monitor: Prometheus Monitoring</a>
</div>
<div style="clear:both;"></div>

<p></p>
