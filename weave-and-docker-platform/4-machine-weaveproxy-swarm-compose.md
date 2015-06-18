---
layout: guides
title: "4. Creating and scaling multi-host Docker deployment with Swarm and Compose using Weave"
permalink: /guides/weave-and-docker-platform/chapter4/compose-scalable-swarm-cluster-with-weave.html
tags: docker, machine, swarm, compose, cli, virtualbox, dns, ipam, proxy, python, flask, redis
---

> ### ***Creating distributed applications with Weave and the Docker platform***
>
> - Chapter 1: [Using Weave with Docker Machine][ch1]
> - Chapter 2: [Using Weave with Docker Machine via proxy][ch2]
> - Chapter 3: [Using Weave with Docker Machine and Swarm][ch3]

Weave allows you to focus on developing your application, rather than your infrastructure, and it works great with tools
like [Docker Machine](https://docs.docker.com/machine/) and [Swarm](https://docs.docker.com/swarm/). Here you will learn
how to get started with Weave, and Swarm as well as Compose. After following through this chapter you should be very familiar
with all the tooling, which is indeed quite simple. Having equipped yourself with the tooling, you can turbocharge the
application you are developing and achieve greater results without having to spend long time in infrastructure planning.

## What you will build

[Docker Machine](https://docs.docker.com/machine/) makes it really easy to create Docker hosts (VMs) on your computer, on
cloud providers and inside your own data center. It creates servers, installs Docker on them, then configures the Docker
client to talk to them.

[Docker Swarm](http://docs.docker.com/swarm/) is native clustering for Docker. It turns a pool of Docker hosts into a single,
virtual host. You can instruct Machine to provision a Swarm cluster for you, and we have looked at how to integrate it
with Weave in [the previous chapters][ch3].

[Docker Compose](https://docs.docker.com/compose/) is a tool for defining and running complex applications with Docker.
With Compose, you define a multi-container application in a single file, then spin your application up in a single command
which does everything that needs to be done to get it running.

In this chapter we will use a cluster of 3 Swarm-enabled VirtualBox VMs that we have setup in [the previous chapter][ch3],
and look at using Compose to create a simple 2-tier application stack with Python Flask front-end app and Redis as the
database. We will then scale the front-end app to take advantage of all 3 VMs we have.

It would not be possible to build the same so easily without [Weave Net](/net) and [Weave Run](/run), which boost Swarm cluster
scalability and enable simple DNS-based container discovery. More specifically, Weave provide true portability to a Swarm
cluster. The exact same setup can be reproduced and scaled as easily in any environment, whether it's in the public cloud or
an in-house datacenter. Additionally, Weave eliminates the need for [ambassador pattern][ambassador], or any other approach
that might involve some combination of distributed configuration store and a proxy.

[ambassador]: https://docs.docker.com/articles/ambassador_pattern_linking/

## What you will use

  - [Weave](http://weave.works)
  - [Docker, Compose, Swarm & Machine](http://docker.com)
  - [Python][], [Flask][] & [Redis][]

[Python]: https://www.python.org/
[Flask]: http://flask.pocoo.org/
[Redis]: http://redis.io/

In case you are familiar with Compose already, you should recognise the Flask app used here. If you haven't used Compose yet,
do make sure to take a brief look at [the overview](https://docs.docker.com/compose/#overview), which describes the app
and `docker-compose.yml` file structure as well as `Dockerfile` used.

## What you will need to complete this chapter

  - 15-25 minutes
  - [`docker-compose`](http://docs.docker.com/compose/install/) binary (_`>= 1.2.0`_)
  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

_If you have followed through [the previous chapter][ch3], you should already have **most** of these dependencies installed,
the only new tool introduced here is **`docker-compose`**._

If you are using OS X, then you can install these tools with Homebrew like this:

    brew install docker docker-machine docker-compose

For other operating systems, please refer to links above.

If you haven't yet installed VirtualBox, be sure to follow [installation instructions for your OS](https://www.virtualbox.org/wiki/Downloads).

## Let's go!

### Setup

If you haven't followed through [the previous chapter][ch3], you can run the following commands to get a set of 3 VMs with Weave
network setup. You also should run these if you chose to destroy all the VMs once you finished reading that chapter.

First, you need to clone the repository

    git clone https://github.com/weaveworks/guides weaveworks-guides
    cd ./weaveworks-guides/weave-and-docker-platform/scripts

Now, run these 3 scripts

    ./1-machine-create.sh
    ./2-weave-launch.sh
    ./3-replace-swarm-agents.sh

### Create

First, we need build the app and make images available on each of the Docker hosts, there is a script which does this for
you. You should simply change to the `app` direcorty and run it like this

    cd ../app
    ./build.sh

Now we need to setup the environment variable to make Compose talk to Swarm endpoint.

    eval $(docker-machine env --swarm weave-1)

And finally, we can deploy the stack by running

    docker-compose up -d

Running `docker-compose ps` should show two containers are deployed.

    > docker-compose ps
    Name                  Command               State               Ports
    -------------------------------------------------------------------------------------
    app_redis_1   /w/w /entrypoint.sh redis- ...   Up      6379/tcp
    app_web_1     /w/w python app.py               Up      192.168.99.131:32768->5000/tcp

We can test this with `curl` using IP/port listed above.

    > curl 192.168.99.131:32768
    Hello World! I have been seen 1 times.
    > curl 192.168.99.131:32768
    Hello World! I have been seen 2 times.
    > curl 192.168.99.131:32768
    Hello World! I have been seen 3 times.

### Scale

As we have 3 VMs to our disposal, the web service instances should run on all of them.

    > docker-compose scale web=3
    Creating app_web_2...
    Creating app_web_3...
    Starting app_web_2...
    Starting app_web_3...

With `docker-compose ps` we can see all 3 VMs are now running the web service now.

    > docker-compose ps
    Name                  Command               State               Ports
    -------------------------------------------------------------------------------------
    app_redis_1   /w/w /entrypoint.sh redis- ...   Up      6379/tcp
    app_web_1     /w/w python app.py               Up      192.168.99.131:32768->5000/tcp
    app_web_2     /w/w python app.py               Up      192.168.99.129:32768->5000/tcp
    app_web_3     /w/w python app.py               Up      192.168.99.130:32768->5000/tcp

We can test each of the instances just as well.

    > curl 192.168.99.129:32768
    Hello World! I have been seen 4 times.
    > curl 192.168.99.130:32768
    Hello World! I have been seen 5 times.

That's great, we have deployed and scaled-up our simple app using Weave, Swarm and Compose!

## Next steps

Next, you can deploy a cluster in public cloud, which should be pretty simple and you should be able to just set the
`DOCKER_MACHINE_DRIVER` and a few provider-specific environment variables prior to running `./1-machine-create.sh`,
but make sure to [cleanup VirtualBox VMs first](#cleanup).

For example, for Microsoft Azure it should be enought set the following

    export DOCKER_MACHINE_DRIVER="azure"
    export AZURE_SUBSCRIPTION_CERT="/path/to/mycert.pem"
    export AZURE_SUBSCRIPTION_ID="MySubscriptionID"

Or for Google Compute Engine

    export DOCKER_MACHINE_DRIVER="google"
    export GOOGLE_PROJECT="my-awesome-project-1"
    export GOOGLE_AUTH_TOKEN="MyAuthToken"

You would need to find out what the right values are, of course. Do note that this guide is open-source, and if you'd
like to expand this guide to cover some clould providers in detail, feel free to submit a pull-request to our [guides
repository](https://github.com/weaveworks/guides).

## Cleanup

If you feel like you are done for now, you can tear-down the VMs you have deployed just now

    docker-machine rm -f weave-1 weave-2 weave-3

## Summary

In this final chapter of _"Creating distributed applications with Weave and the Docker platform"_ guide we have looked
at utilising all 3 great components of the Docker platform (Machine, Swarm & Compose). You should now be able to understand
all what's required to set up a scalable cluster of Docker hosts with Weave tools and deploy your application to it with
ease. You may chose to do the automation somehow differently, hence I've split this guide into 4 chapters, showing all
the details you need in order to understand how it works and where all these different pieces fit together.

[ch1]: /guides/weave-and-docker-platform/chapter1/machine.html
[ch2]: /guides/weave-and-docker-platform/chapter2/machine-with-weave-proxy.html
[ch3]: /guides/weave-and-docker-platform/chapter3/machine-and-swarm-with-weave-proxy.html
[ch4]: /guides/weave-and-docker-platform/chapter4/compose-scalable-swarm-cluster-with-weave.html
