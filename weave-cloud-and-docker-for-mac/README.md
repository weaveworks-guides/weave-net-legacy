---
layout: guides
title: Visualizing Microservices with Weave Cloud on Docker for Mac
---


In this guide you will learn how Weave Cloud can help you understand and troubleshoot a microservices-based app.  The app you will deploy is an online store, called the Socks Shop that consists of several microservices written in three different languages: Node.js, Spring Boot and Go Kit, and which also uses the data services, RabbitMQ and MongoDB.

Docker and Docker Compose will be used to deploy the Socks Shop onto your local machine, and then you will launch Weave Scope probes to push metrics to Weave Cloud so that you can observe the topology of the app and explore how it works. Weave Scope probes monitor network traffic and builds a topology graph in real-time. The view in Weave Cloud is augmented with metadata from the Docker API along with several different systems metrics that allow you to troubleshoot your app.

The following topics are discussed: 

* [Installing Docker for Mac](#install-docker-for-mac)
* [Deploying the Socks Shop App](#deploy-the-demo-app)
* [Signing Up for Weave Cloud](#sign-up-to-weave-cloud)
* [Connecting the Scope Probes to Weave Cloud](#connect-scope-probe-to-weave-cloud)


<h3 id="install-docker-for-mac">Installing Docker for Mac</h3>

If you haven't installed Docker for Mac, please follow the installation instructions on <a href="https://docs.docker.com/docker-for-mac/" target="_blank"> Docker website </a>.

Once it's running you will see <img alt="Docker Icon in the Mac OS menu bar" src="docker-for-mac-menu-bar-icon.png"
style="height: 1em;" /> in your menu bar.


<h3 id="deploy-the-demo-app">Deploying the Socks Shop App</h3>

To deploy The Socks Shop: 

**1. Get the code:**

~~~bash
git clone https://github.com/weaveworks/guides
cd microservices-demo-app
~~~

**2. Deploy the Socks Shop app:**

~~~bash
docker-compose pull 
docker-compose -p shop up -d 
open http://localhost
~~~

>**Note:** If localhost does not load the Socks Shop, then use the IP `127.0.0.1` instead.  

Once the app displays in your browser, you can test the functionality. Login using `user1`/`password1`, and then put an item in the basket and proceed to the checkout.

![The Socks Shop](guides/weave-cloud-and-docker-for-mac/socks-shop.png)


[demo-app]: https://github.com/weaveworks/weaveDemo


<h3 id="sign-up-to-weave-cloud">Signing Up for Weave Cloud</h3>

To visualize microservices, first sign up for Weave Cloud:

1.	Go to <a href="https://cloud.weave.works" target="_blank"> Weave Cloud </a>
2.	Sign up using either a Github, or Google account or use an email address.
3.	Obtain the cloud service token from the User settings screen:

![Obtain service token for Weave Cloud](guides/weave-cloud-and-docker-for-mac/weave-cloud-token-screenshot.png)

<h3 id="connect-scope-probe-to-weave-cloud">Connecting the Scope Probes to Weave Cloud</h3>

Install and launch the Weave Scope probes:

~~~bash
sudo curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
~~~

**Where,** 

* `<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>` - is the token that appears on the settings page, once you’ve logged into Weave Cloud. 

**Note:** To set the Weave Cloud controls to read-only for all users, you can launch scope with the --probe.no-controls flag.  In this demo, you will be launching a terminal window and viewing messages between microservices, and so this flag is not necessary. However, you may want to keep this flag in mind when using Weave Cloud and sharing your infrastructure views with others outside of your organization.

Weave Cloud controls allow you to stop, start and pause containers. They also enable you to launch a terminal and interact directly with your containers.


<h3 id="run-the-load-test">Running the Load Test</h3>

To fully appreciate the topology of this app, you will need to run a load on the app. 

Run a load test with the following:

~~~bash
docker run -ti --rm --name=LOAD_TEST \
  --net=shop_external \
  weaveworksdemos/load-test -h edge-router -r 100 -c 2
~~~

With the load test running, you can observe the different services communicating by clicking on the Load Test container in Weave Cloud. From the metrics panel,  open Load Test's terminal to view the messages. With the load test running, the topology graph in Weave Cloud console will also form.

![Weave Load Test](guides/weave-cloud-and-docker-for-mac/load-test-messages.png)

###Tearing Down the App

To clean up the app from your system: 

~~~bash
docker-compose -p shop down
~~~

###Conclusions

In this guide, an online store using a microservices-based approach was launched into the Weave Cloud, where you could observe communication events and also interact with the topology of the microservices app. 

If you have any questions or comments, we would be happy to hear from you, visit [Weave Help & Support](https://www.weave.works/help/) for information on ways to contact us. 

**Further Reading**

 * [Introducing Weave Cloud](https://www.weave.works/docs/scope/latest/introducing/)
 * [Installing Weave Scope](https://www.weave.works/docs/scope/latest/installing/)


