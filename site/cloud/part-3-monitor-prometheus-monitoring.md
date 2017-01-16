---
title: Monitor: Prometheus Monitoring with Weave Cortex
menu_order: 3
---

{{ include "./includes/parts.md" }}

This is Part 3 of 4 of the [Weave Cloud guides series][index].

Containerized applications are by nature dynamic and in a state of constant change. One of the advantages of using containers is the fact that they will ‘self-heal’, and when a container goes down, it automatically spins back up. But when it does so, it may not appear on the same virtual machine. To further complicate matters, applications can be spread across multiple cloud provides or they can span both data centers and cloud providers (hybrid clouds). Because of these factors, traditional server-focused monitoring systems, don’t work well with containerized applications.

Weave Cortex is an extension of the open source project Prometheus and once deployed to your cluster, it listens for changes in a single Kubernetes cluster or even across a Kubernetes federation.

When the Weave Cortex agent is deployed to a Kubernetes production environment, metrics are automatically pushed to Weave Cloud, where they can be viewed and queried from within the Microservices Dashboard.

You will use the sample app, 'The Sock Shop', deploy it to three virtual machines running Docker and Kubernetes and then monitor metrics from within Weave Cloud.

This tutorial takes approximately 25 minutes to complete.

[[ open_div \`style='width:50%; padding: 10px; float:left; font-weight: 700;'\` ]]

[&laquo; Go to previous part: Part 2 – Deploy: Continuous Delivery][part2]

[[ close_div ]]

[[ open_div \`style='width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;'\` ]]

[Go to next part: Part 4 – Secure: Container Firewalls &raquo;][part4]

[[ close_div ]]

<img src="images/monitor.png" style="width:100%; border:1em solid #32324b;" />

View your app, network and container orchestrator metrics altogether in Weave Cloud with Weave Cortex. This example uses Kubernetes clusters.

## A Video Overview

<center>
  <div style="width:530px; display:inline-block; margin-top:2em;">
    <iframe src="https://player.vimeo.com/video/190563580" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
  </div>
</center>

## What You Will Use

* [Weave Cloud](https://cloud.weave.works)
* [Kubernetes](http://kubernetes.io/)
* [Weaveworks Sockshop](https://github.com/microservices-demo)
* [Weave Net](https://www.weave.works/products/weave-net/)

## Sign Up for Weave Cloud

Before you can use Cortex to monitor apps, sign up for a Weave Cloud account.

**1.**  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a>

**2.**  Sign up using either a Github, or Google account or use an email address.

**3.**  Make a note of the cloud service token from the User settings screen:

<img src="images/weave-cloud-token.png" style="width:100%;" />

**Note:** If you are continuing from one of the other guides in this series, use your Cloud token to set up Prometheus Monitoring below.

## Deploy a Kubernetes Cluster with Weave Net and the Sample App

If you have already done this as part of one of the other tutorials, skip this step.
Otherwise, click "Details" below to see the instructions.

[[ open_details ]]

{{ include "./includes/setup-kubernetes-sock-shop.md" }}

[[ close_details ]]

## Configuring Cortex for Your Production Environment

Next, enable Cortex to start pushing metrics to Weave Cloud.

**1.** Log onto the master Kubernetes node and run the following to launch the Cortex daemon onto your hosts. Keep your Cloud service token handy and paste it into the command:

~~~bash
kubectl -n kube-system apply -f 'https://cloud.weave.works/k8s/cortex.yaml?t=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>'
~~~

**Where**,

* `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` is the token you obtained when you signed up for Weave Cloud above.

Cortex runs in its own Docker container and it may take a few minutes for it to download and appear on the server. You can watch for it to appear in [Weave Cloud](https://cloud.weave.works).

**2.** Or check that Cortex is running on one of the Kubernetes nodes with:

~~~bash
kubectl get pods -n kube-system -l weave-cloud-component=cortex
~~~

Where you should see something similar to:

~~~console
NAME                                 READY     STATUS    RESTARTS   AGE
weave-cortex-agent-459196232-a83mc   1/1       Running   0          10s
weave-cortex-node-exporter-clofd     1/1       Running   0          12s
weave-cortex-node-exporter-jeyrt     1/1       Running   0          12s
weave-cortex-node-exporter-klp2h     1/1       Running   0          12s
weave-cortex-node-exporter-uqwx5     1/1       Running   0          12s
~~~

## Viewing Sock Shop Metrics in Weave Cortex

Go to [Weave Cloud](https://cloud.weave.works) and click 'Monitor' from the header. You should see the Cortex GUI where you can display metrics from the Sock Shop app.

Cortex by default displays a number of metrics at the top that have already been detected by the system.

Select `CPU usage in % by pod` from the Kubernetes section in the Detected Metrics section of Prometheus System Queries, where something similar to the screen capture shown below will be shown (note this is a stacked view of the chart):

<img src="images/prometheus-kubernetes-monitor.png"/>

## Run the Load Test

To view metrics in Weave Cortex under a load, run:

~~~bash
docker run -ti --rm --name=LOAD_TEST  weaveworksdemos/load-test -r 100 -c 2 -h <host-ip:[port number]>
~~~

<!-- TODO include a sample query here -->

## Running Queries with the Prometheus Query Language

Custom queries can be built with the Prometheus Query Language builder. For example detailed metrics can be viewed by Node, by orchestrator such as Kubernetes or you can view metrics about your Weave Net container network.

For more information on using the Prometheus Query Language, see [Prometheus Query Examples](https://prometheus.io/docs/querying/examples/)

## Monitor the Network with Weave Cortex

Weave Net supports Prometheus monitoring, so you can monitor your Weave Net network in Weave Cloud.

Go to the Cortex page in Weave Cloud to view network specific metrics, such as:

* IP address space exhaustion in %
* Number of local DNS entries per each host
* Connection termination rate per second
* Number of blocked connections per transport-layer protocol
* Frequent protocol-dport combinations of blocked connections such as IP address exhaustion

For more information on Weave Net metrics see, ["Monitoring with Prometheus"](https://www.weave.works/docs/net/latest/metrics/).

## Tear Down

[[ open_details ]]

{{ include "./includes/setup-kubernetes-sock-shop-teardown.md" }}

[[ close_details ]]

## Conclusions

You've seen how Weave Cortex can be used to monitor your application, your cluster and your network in Weave Cloud.

{{ include "./includes/slack-us.md" }}

[[ open_div \`style='width:50%; float:left; padding: 10px; font-weight: 700;'\` ]]

[&laquo; Go to previous part: Part 2 – Deploy: Continuous Delivery][part2]

[[ close_div ]]

[[ open_div \`style='width:50%; padding: 10px; float:left; text-align:right; font-weight: 700;'\` ]]

[Go to next part: Part 4 – Secure: Container Firewalls &raquo;][part4]

[[ close_div ]]
