<!-- Setup: Troubleshooting Dashboard with Weave Cloud and Weave Scope -->

In Part 1 of this series, you'll use Weave Cloud to validate and troubleshoot your app on a development laptop and then compare it with a production environment.

In parts 2, you'll learn how to set up Flux to achieve <a href="https://www.weave.works/guides/cloud-guide-part-2-deploy-continuous-delivery/"> continuous delivery </a> and in part 3 <a href="https://www.weave.works/guides/cloud-guide-part-3-monitor-prometheus-monitoring/"> how to monitor applications with Prometheus and Weave Cortex is discussed.</a>

In Part 4 you will <a href="https://www.weave.works/guides/cloud-guide-part-4-secure-container-firewalls/"> secure your app using Kubernetes Network Policy and then enforce it with Weave Net.</a>

All four of these tutorials use the Weaveworks microservices app, [The Sock Shop](https://github.com/microservices-demo).

###About Part 1

You will use the Weaveworks sample app, [The Sock Shop](https://github.com/microservices-demo), deploy it to three Ubuntu hosts, running Docker and Kubernetes and networked with Weave Net. Then you'll validate and troubleshoot any issues with it in Weave Cloud.

This tutorial takes approximately 25 minutes to complete.

<div style="width:50%; padding: 10px; float:right; text-align:right; font-weight:700;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">Go to next part: Part 2 – Deploy: Continuous Delivery &raquo;</a>
</div>
<div style="clear:both;"></div>

<img src="images/setup.png" style="width:100%; border:1em solid #32324b;" />
<p></p>

##A Video Overview

<center><div style="width:530px; display:inline-block; margin-top:2em;">
<iframe src="https://player.vimeo.com/video/190563578" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>
</center>

## What You Will Use

 * [Weave Cloud](https://cloud.weave.works)
 * [Docker for Mac](https://docs.docker.com/docker-for-mac/docker-toolbox/)
 * [Weaveworks Microservices Demo (Sock Shop)](https://github.com/microservices-demo)
 * [Kubernetes](http://kubernetes.io/)
 * [Weave Net](https://www.weave.works/products/weave-net/)

<!-- TODO deduplicate this wrt the docker for mac guide... -->

## Before You Begin

Before you begin, ensure the following installed:

 * [Git](http://git-scm.com/downloads)
 * [Docker](https://docs.docker.com/engine/installation/) and [Docker Compose](https://docs.docker.com/compose/install/)
   * This guide also works with [Docker for Mac](https://docs.docker.com/docker-for-mac/)

## If You're on a Mac

If you haven't installed Docker for Mac before, follow the installation instructions on <a href="https://docs.docker.com/docker-for-mac/" target="_blank">Docker website </a>. <!-- lkj_ -->

Once it's running you will see <img src="images/docker-for-mac-menu-bar-icon.png" style="height: 2em; display:inline-block;" /> in your menu bar.

## Sign Up for Weave Cloud

To begin, sign up for Weave Cloud and deploy the Scope probes on your laptop.  

After verifying that the app works as it should on your laptop, you'll then install the Weave Cloud probes to production, set up a Kubernetes cluster and deploy the app it, and then compare production with the app on your laptop.  

To sign up for Weave Cloud:

1.  Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a> <!-- lkj_ -->
2.  Sign up using either a Github, or Google account or use an email address.
3.  Obtain the cloud token from the User settings screen:

<img src="images/weave-cloud-token-1.png" style="width:100%;" />

### Launch the Scope Probes on Your Laptop

Launch the Scope probes using the token you obtained when you signed up for the service:

<!-- TODO maybe this should use the k8s scope yaml in the launcher -->

~~~bash
curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<cloud-token>
~~~

**Where,**

* `<cloud-token>` - is the token that appears on the settings page, once you’ve logged into Weave Cloud.


## Deploying the Socks Shop

To deploy The Socks Shop to your local machine:

**1. Get the code:**

~~~bash
git clone https://github.com/microservices-demo/microservices-demo.git
~~~


**2. Change to the docker-compose directory:**

~~~bash
cd microservices-demo/deploy/docker-compose
~~~

**3. Run the Sock Shop and display it in your browser:**

~~~bash
docker-compose up -d
~~~

**Note:** If the shop doesn't come up right away or it gives you an error like `ERROR: for edge-router  Cannot start service edge-router:` because of a port in use, try going to `http://127.0.0.1` in your browser.

<img src="images/socks-shop.png" style="width:100%;" />

### Run a Load Test Against the Sock Shop

To fully appreciate the topology of this app in Weave Scope, you will need to first run a load on the app. This load test simulates users buying socks at the shop.

Run a load test with the following:

~~~bash
docker run -ti --rm --name=LOAD_TEST \
  weaveworksdemos/load-test -h edge-router -r 100 -c 2
~~~

With the load test running, the topology in Weave Cloud also forms where you can see the microservices communicating as socks are being selected and purchased.

With the load test running, search for the user-db container, and click on it to open the metrics panel. From the metrics panel that appears, select the terminal icon and view the messages from users logging onto the site.

<img src="images/load-test-messages-1-1.png" style="width:100%;" />

# Deploying to "Production" on Kubernetes

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop.md"}

## Tear Down on Ubuntu

{"gitdown": "include", "file": "./includes/setup-kubernetes-sock-shop-teardown.md"}

## Tear Down on Your laptop

To remove the Sock Shop from your laptop, run:

~~~bash
docker-compose -f deploy/docker-compose/docker-compose.yml down
~~~

## Conclusions

In this tutorial you learned how to verify an app deployed to your laptop with the same tools (Weave Scope) used when your app is deployed to a Kubernetes cluster.
<p></p>
{"gitdown": "include", "file": "./includes/slack-us.md"}

<div style="width:50%; padding: 10px; float:right; text-align:right; font-weight: 700;">
<a href="/guides/cloud-guide-part-2-deploy-continuous-delivery/">Go to next part: Part 2 – Deploy: Continuous Delivery &raquo;</a>
</div>
<div style="clear:both;"></div>

<p></p>
