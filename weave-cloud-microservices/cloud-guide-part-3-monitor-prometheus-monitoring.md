<!-- Monitor: Prometheus Monitoring with Weave Cortex -->



This is Part 3 of 4 of the <a href="/guides/">Weave Cloud guides series</a>.
In this guide you will see how to configure monitoring with Weave Cloud and Weave Cortex, a Prometheus-powered monitoring service.

In this way, you can view your app, network & container orchestrator metrics in the Weave Cloud monitoring dashboard. This example uses Kubernetes.</p>

<div style="width:50%; padding: 10px; float:left; font-weight: 700;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">&laquo; Go to previous part: Part 2 – Deploy: Continuous Delivery</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-4-secure-container-firewalls/">Go to next part: Part 4 – Secure: Container Firewalls &raquo;</a>
</div>
<div style="clear:both;"></div>

<img src="images/monitor.png" style="width:100%; border:1em solid #32324b;" />


<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe width="530" height="298" src="https://www.youtube.com/embed/Fqwj3ibe5So?modestbranding=1&autohide=0&showinfo=0&controls=1&rel=0" frameborder="0" allowfullscreen></iframe>
</div></center>


## Contents

{"gitdown": "contents"}

<!-- TODO have "sign up for weave cloud" instructions here -->

## Introduction

Microservices environments by nature are dynamic and are in a state of constant change especially if they are running inside containers. They may also be spread across multiple clouds or they may be spanning both a data center and a cloud which can make monitoring a challenge.  And since these systems tend to be in a state of constant change with containers going down and spinning back up again, traditional monitoring systems which are typically server-focused, don't work well with dynamic systems.

Weave Cortex is built upon the open source project, Prometheus and it sits in your Kubernetes cluster and listens for changes throughout the entire pod regardless of where they may physically lie within a single Kubernetes cluster or even across a Kubernetes federation. Once Weave Cortex is deployed to your Kubernetes production environment, metrics are automatically pushed to Weave Cloud where they can be viewed and queried from within the Microservices Dashboard.

You will use the sample app, 'The Sock Shop', deploy it to a couple of virtual machines running Docker and Kubernetes and then monitor issues in Weave Cloud.

Specifically, in this tutorial, you will:

1. Sign up for Weave Cloud and obtain a Weave Cloud token.
2. Configure a Kubernetes cluster and at the same time install Weave Net onto two Ubuntu hosts.
4. Use Weave Cloud to observe the Kubernetes cluster deployment.
5. Install the Sock Shop onto the Kubernetes cluster.
5. Configure and launch the Cortex agent to start pushing metrics to Weave Cloud
6. Run a load test on the Sock Shop and view the metrics in Weave Cortex from inside Weave Cloud.

This tutorial will take approximately 15 minutes to complete.

## What You Will Use

* [Weave Cloud](https://cloud.weave.works)
* [Kubernetes](http://kubernetes.io/)
* [Weaveworks Sockshop](https://github.com/microservices-demo)
* [Weave Net](https://www.weave.works/products/weave-net/)

## Sign Up for Weave Cloud

Before you can use Cortex to monitor apps, you will need to sign up for a Weave Cloud account.

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a> <!-- lkj_ -->
2.  Sign up using either a Github, or Google account or use an email address.
3.  Make a note of the cloud service token from the User settings screen:

<img src="images/weave-cloud-token.png" style="width:100%;" />

**Note:** If you are continuing on from one of the other guides in this series you can use your Cloud token to set up Prometheus Monitoring below.


## Deploy a Kubernetes cluster with Weave Net and then deploy a sample application (the socks shop) to it

If you have already done this as part of one of the other tutorials, you can skip this step.
Otherwise, click "Details" below to see the instructions.

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

XXX-END-DETAILS-BLOCK


## Configuring Cortex for Your Production Environment

Next you are going to enable Cortex to start pushing metrics to Weave Cloud.

**1.** Log onto the master Kubernetes node and run the following to get the cortex.yml file and also update the file with your Weave Cloud token:

<!-- TODO replace this with the proper yaml generator -->

~~~
curl -sL https://gist.githubusercontent.com/errordeveloper/b2f92741b9fd45fd58e2bcd2870a8b5f/raw/c02cab79d9dde52c1f855c19399bfb222dd55235/cortex.yaml | sed 's/INSERT_TOKEN_HERE/[your-weave-cloud-token]/' | kubectl create -n kube-system -f -
~~~

**Where**,

* [`your-weave-cloud-token`] is the token you obtained when you signed up for Weave Cloud above.


Cortex runs in its own Docker container and it may take a few minutes for it to download and appear on the server. You can watch for it to appear in the Troubleshooting Dashboard:

**2.** Check that Cortex is running on one of the Kubernetes nodes by running:

~~~
kubectl get deployments -n kube-system
~~~

Where you should see something similar to:

~~~
NAME                 DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
kube-discovery       1         1         1            1           18h
kube-dns             1         1         1            1           18h
weave-cortex-agent   1         1         1            1           4h
~~~

## Viewing Sock Shop Metrics in Weave Cortex

Go back to the Weave Cloud Dashboard and click the chart icon from the header bar. You should see the Cortex GUI where you can display metrics from the Sock Shop app.

<img src="images/weave-cloud-snippet.png" style="width:50%;" />

Cortex by default displays a number of metrics at the top that have already been detected by the system. Select `process` then `open` and `fds` and from the Detected Metrics section of Prometheus System Queries, and click `execute` where you should see something similar to the screen capture shown below (note this is a stacked view of the chart):

<img src="images/cortex-detected-metrics.png" style="width:100%;" />


## Run the Load Test

You may wish to run a load test to see the metrics in Weave Cortex change as load is applied to the application.

~~~
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -r 100 -c 2 -h <host-ip:[port number]>
~~~

<!-- TODO include a sample query here -->


## Running Queries with the Prometheus Query Language

You can also build your own queries using the Prometheus Query Language builder. For example you can view metrics by Nodes, Kubernetes or Weave Net.

For more information on using the Prometheus Query Language, see [Prometheus Query Examples](https://prometheus.io/docs/querying/examples/)

## Monitor the network with Weave Cortex, part of Weave Cloud

Weave Net supports Prometheus monitoring, so you can monitor your Weave Net network in Weave Cloud.

Simply go to the Cortex page in Weave Cloud and you'll see network specific metrics, such as IP address exhaustion.


## Tear Down

XXX-START-DETAILS-BLOCK

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop-teardown.md"}

XXX-END-DETAILS-BLOCK

## Conclusions

You've seen how Weave Cortex can be used to monitor your application, your cluster and your network in Weave Cloud.
<p></p>
{"gitdown": "include", "file": "./includes/slack-us.md"}

<div style="width:50%; float:left; padding: 10px; font-weight: 700;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">&laquo; Go to previous part: Part 2 – Deploy: Continuous Delivery</a>
</div>
<div style="width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-4-secure-container-firewalls/">Go to next part: Part 4 – Secure: Container Firewalls &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>
