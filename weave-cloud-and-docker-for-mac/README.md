<h3 id="introduction-weave-cloud-and-the-demo-app">Introduction: Weave Cloud and the Demo App</h3>

In this guide you will learn how Weave Cloud can help you to understand a microservices app. You will deploy
an app consisting of several microservices written in different languages (Node.js, Java and Go) as well as
data services (RabbitMQ and MongoDB). You will use Docker for Docker Compose to deploy this app on
your local machine, and then use the Weave Scope Probe to push metrics to Weave Cloud to observe the
topology of the app and explore how it works. Weave Scope Probe monitors the network traffic and builds the
topology graph in real-time, augmented with metadata from Docker API along with various system metrics.

<h3 id="install-docker-for-mac">Install Docker for Mac</h3>

If you haven't installed Docker for Mac, please follow the installation instructions on [Docker website][install-d4m].

Once it's runing you should see <img alt="Docker Icon in the Mac OS menu bar" src="docker-for-mac-menu-bar-icon.png"
style="height: 1em;" /> in your menu bar.

[install-d4m]: https://docs.docker.com/docker-for-mac/

<h3 id="deploy-the-demo-app">Deploy the Demo App</h3>

In this guide you will deploy a miscroservices app that [we have built](demo-app). The app is a full-blown
online store, which sells socks.

Get the code:
```
git clone https://github.com/weaveworks/guides
cd microservices-demo-app
```
Deploy the shop app:
```
docker-compose pull
docker-compose -p shop up -d
open http://localhost
```

Once the app has been loaded in your browser, you can test the functionality. The user interface should be
self-explanatory. Login using `user1`/`password1`, put an item in the basket and proceed to checkout.

[demo-app]: https://github.com/weaveworks/weaveDemo


<h3 id="sign-up-to-weave-cloud">Sign Up to Weave Cloud</h3>

You will use Weave Cloud to see what the application does. If you haven't yet sign up, here is what you need to do.

1. Go to ***[cloud.weave.works](https://cloud.weave.works)***
2. Sign up with either Github, Google or email
3. Obtain service token as shown below

![Obtain service token for Weave Cloud](weave-cloud-token-screenshot.png)

<h3 id="connect-scope-probe-to-weave-cloud">Connect Scope Probe to Weave Cloud</h3>

Install and launch Weave Scope Probe:
```
sudo curl --silent --location https://git.io/scope --output /usr/local/bin/scope
sudo chmod +x /usr/local/bin/scope
scope launch --service-token=<YOUR_WEAVE_CLOUD_SERVICE_TOKEN>
```

<h3 id="run-the-load-test">Run the Load Test</h3>

Unless there is load on the app, you cannot see full topology in Weave Cloud. To observe the topology,
you will need to run a load test:
```
docker run -ti --rm --name=LOAD_TEST \
  --net=shop_external \
  weaveworksdemos/load-test -h edge-router -r 100 -c 2
```

While the load test is running, you should see how different services communicate, and the topology
graph in Weave Cloud console will form.

