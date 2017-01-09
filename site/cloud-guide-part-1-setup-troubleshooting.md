---
title: Setup: Troubleshooting Dashboard with Weave Cloud and Weave Scope
menu_order: 1
---

When your app is Cloud Native you are free to focus on your code instead of maintaining cloud tools. This allows you to make rapid, incremental feature updates without having to disassemble and reassemble your infrastructure each time your code is changed.

While the ability to rapidly deploy changes to your app is important, being able to choose your own source control system, deployment tools and container registry without having to maintain a set of brittle custom scripts is also critical.

To streamline the app development pipeline so that you can develop code faster, you've decided on the following:

* A microservices approach to software design
* Docker Containers
* Continuous integration and delivery
* Kubernetes container orchestration

But using these technologies comes with tradeoffs. Most significantly is the configuration effort needed to get all of these technologies working together.  Weave Cloud simplifies this process and gets your app into the cloud without lock in. Weave allows you to choose the tools you need to create high quality code faster.

In Part 1 of this series, you'll use Weave Cloud to validate and troubleshoot your app: from your development laptop into production. And in parts 3 to 4, you'll move on to how to [automate code deployment][part2] and to [monitor app with Prometheus][part3] and then you'll [secure the microservices using Kubernetes network policy][part4] all from one convenient troubleshooting dashboard.

[part2]: cloud-guide-part-2-deploy-continuous-delivery.md
[part3]: cloud-guide-part-3-monitor-prometheus-monitoring.md
[part4]: cloud-guide-part-4-secure-container-firewalls.md

In this tutorial you will use the Weaveworks sample app, [The Sock Shop](https://github.com/microservices-demo), deploy it to three Ubuntu hosts, running Docker and Kubernetes and networked with Weave Net. Then you'll validate and troubleshoot any issues with it in Weave Cloud.

This tutorial will take approximately 15 minutes to complete.

<div style="width:50%; padding: 10px; float:right; text-align:right; font-weight:700;">
  <a href="cloud-guide-part-2-deploy-continuous-delivery.md">Go to next part: Part 2 – Deploy: Continuous Delivery &raquo;</a>
</div>

<img src="images/setup.png" style="width:100%; border:1em solid #32324b;" />

## A Video Overview

<center>
  <div style="width:530px; display:inline-block; margin-top:2em;">
    <iframe src="https://player.vimeo.com/video/190563578" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
  </div>
</center>

## What You Will Use

 * [Weave Cloud](https://cloud.weave.works)
 * [Docker for Mac](https://docs.docker.com/docker-for-mac/docker-toolbox/)
 * [Weaveworks Microservices Demo (Sock Shop)](https://github.com/microservices-demo)
 * [Kubernetes](http://kubernetes.io/)
 * [Weave Net](https://www.weave.works/products/weave-net/)

<!-- TODO deduplicate this wrt the docker for mac guide... -->

## Before You Begin

Ensure the following installed are installed before you begin:

 * [Git](http://git-scm.com/downloads)
 * [Docker](https://docs.docker.com/engine/installation/) and [Docker Compose](https://docs.docker.com/compose/install/)
   * Note that this guide also works with [Docker for Mac](https://docs.docker.com/docker-for-mac/)

## If you're on a Mac

If you haven't installed Docker for Mac before, follow the installation instructions on <a href="https://docs.docker.com/docker-for-mac/" target="_blank">Docker website </a>. <!-- lkj_ -->

Once it's running you will see <img src="images/docker-for-mac-menu-bar-icon.png" style="height: 1em; display:inline-block;" /> in your menu bar.

## Sign Up for Weave Cloud

Signup for Weave Cloud and use it to verify what you deployed to your laptop to ensure that everything deployed correctly and that all services are behaving as they should. You will verify the app first on your laptop. Then you'll use Weave Cloud to view the Kubernetes pods as they get deployed, and again to verify the Sock Shop after it gets deployed to Kubernetes in Digital Ocean.

To sign up for Weave Cloud:

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a> <!-- lkj_ -->
2.  Sign up using either a Github, or Google account or use an email address.
3.  Obtain the cloud service token from the User settings screen:

<img src="images/weave-cloud-token.png" style="width:100%;" />

### Launch the Weave Cloud Probes

Launch the Weave Cloud probes using the token you obtained when you signed up for the service:

<!-- TODO maybe this should use the k8s scope yaml in the launcher -->

~~~bash
curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
~~~

**Where,**

* `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` - is the token that appears on the settings page, once you’ve logged into Weave Cloud.

**Note:** To set the Weave Cloud controls to read-only for all users, you can launch scope with the `--probe.no-controls` flag.  In this demo, you will be launching a terminal window and viewing messages between microservices, and so this flag is not necessary. However, you may want to keep this flag in mind when using Weave Cloud and sharing your infrastructure views with others outside of your organization.

Weave Cloud controls allow you to stop, start and pause containers. They also enable you to launch a terminal and interact directly with your containers.

## Deploying the Socks Shop

To deploy The Socks Shop:

**1. Get the code:**

~~~bash
git clone https://github.com/microservices-demo/microservices-demo.git
~~~

**2. Change into the following directory:**

~~~bash
cd microservices-demo/deploy/docker-compose
~~~

**3. Run the Sock Shop and display it in your browser:**

~~~bash
docker-compose up -d
~~~

**Note:** If the shop doesn't come up right away or it gives you an error like `ERROR: for edge-router  Cannot start service edge-router:` because of a port in use, try going to `http://127.0.0.1` in your browser.

<img src="images/socks-shop.png" style="width:100%;" />

### Run a Load Test on the Sock Shop

To fully appreciate the topology of this app in Weave Scope (the graph of your containers visible in Weave Cloud), you will need to run a load on the app.

Run a load test with the following:

~~~bash
docker run -ti --rm --name=LOAD_TEST \
  --net=dockercompose_default \
  weaveworksdemos/load-test -h edge-router -r 100 -c 2
~~~

With the load test running, observe the different services communicating by clicking on the Load Test container in Weave Cloud. From the metrics panel, open the load test's terminal to view the messages. With the load test running, the topology in Weave Cloud will also begin to form where you can see the microservices communicating with one another in the app.

<img src="images/load-test-messages.png" style="width:100%;" />

# Deploying the app to "production" on Kubernetes

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

## Tear Down

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop-teardown.md"}

## Conclusions

In this tutorial you learned how to verify an app deployed to your laptop with the same tools (Weave Scope) used when your app is deployed to a Kubernetes cluster.

{"gitdown": "include", "file": "./includes/slack-us.md"}

<div style="width:50%; padding: 10px; float:right; text-align:right; font-weight: 700;">
  <a href="/site/cloud-guide-part-2-deploy-continuous-delivery.md">Go to next part: Part 2 – Deploy: Continuous Delivery &raquo;</a>
</div>
