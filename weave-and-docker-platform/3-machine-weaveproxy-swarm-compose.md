---
layout: guides
title: "Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave"
permalink: /guides/weave-and-docker-platform/compose-scalable-swarm-cluster-with-weave.html
description: creating a multihost docker deployment using weave net and weave run with docker compose and docker swarms
tags: weave net, docker, machine, swarm, compose, cli, virtualbox, dns, ipam, weaveproxy, python, flask, redis

shorttitle: Using Weave & Docker Machine & Swarm
sidebarpath: /start/wd/dist/weaveswarm
sidebarweight: 25
---

{% include product-vars %}

> - Part 1: [Launching Weave Net with Docker Machine][ch1]
> - Part 2: [Using Weave with Docker Machine and Swarm][ch2]
> - **Part 3: Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave**


## What You Will Build

In this example, we show how Weave works seamlessly with tools like [Docker Machine](https://docs.docker.com/machine/) and [Docker Swarm](https://docs.docker.com/swarm/).

In this Part 3 introduces Weave, Swarm and Compose. Upon completion, you will be familiar with all of the tooling necessary to get Weave working for you so that you can spend your time fine tuning your application rather than on infrastructure planning.

[Docker Machine](https://docs.docker.com/machine/) makes it really easy to create Docker hosts (VMs) on your computer, on cloud providers and inside your own data center. It creates servers, installs Docker on them, then it configures the Docker client to talk to them.

[Docker Swarm](http://docs.docker.com/swarm/) is Docker's native clustering environment. It turns a pool of Docker hosts into a single, virtual host. You can instruct Docker Machine to provision a Swarm cluster for you, and then integrate the Swarm with Weave. Both of these concepts were explored in [Part 1][ch1] and [Part 2][ch2].

With [Docker Compose](https://docs.docker.com/compose/) you can define and run complex applications with Docker.
Compose is an extra layer which allows you to combine a multi-container application into a single file and then launch your application with a single command.

Weave's standard container network enables simple DNS-based container discovery, so that you can easily manage your distributed containerized apps without the need to deploy any additional services or software. It also boosts the Swarm cluster scalability, and provides true portability whether deployed to a public cloud or to an in-house datacenter. Weave furthermore, eliminates the need for an [ambassador pattern][ambassador], or any other approach that might involve some combination of distributed configuration store and a proxy.


[ambassador]: https://docs.docker.com/articles/ambassador_pattern_linking/

Specifically in this tutorial you will: 

  1. Work with a cluster of 3 Swarm-enabled VirtualBox VMs which were setup in [Part 2 of this tutorial][ch2]
  2. Use Compose to create a simple 2-tier application stack using Python Flask for the front-end and Redis as its
database. 
  3. Scale the front-end app to take advantage of all 3 Virtual Machines.
  
This tutorial does not require any programming skills, but does require some UNIX skills.
The tutorial should take 15-25 minutes to complete. 

## What You Will Use

  - [Weave](http://weave.works)
  - [Docker, Compose, Swarm & Machine](http://docker.com)
  - [Python][], [Flask][] & [Redis][]

[Python]: https://www.python.org/
[Flask]: http://flask.pocoo.org/
[Redis]: http://redis.io/

If you are already familiar with Compose, then you will recognise the Flask app used here. If you haven't yet used Compose, then have a look at [the overview in Docker Compose Documentation](https://docs.docker.com/compose/#overview) describes the app and the `docker-compose.yml` file structure, as well as `Dockerfile` used.

## What You Will Need to Complete Part 3

If you are using OS X you can install [Docker Toolbox](https://www.docker.com/toolbox), which provides the tools you need.

For all other operating systems, install and configure the following separately before proceeding:

  - [`docker-compose`](http://docs.docker.com/compose/install/) binary (_`>= 1.2.0`_)
  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.2.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

If you have followed through [Part 3 of this tutorial][ch3], then you will have **most** of these dependencies installed,
the only new tool introduced here is **`Docker Compose`**.

  >>Note: [Docker Compose](http://docs.docker.com/machine/#installation) is not supported on Windows.


## Let's go!

### Setup

If you didn't continue from [Part 2][ch2], you can run the following commands to create the 3 VMs with a Weave network set up. You also should run these if you chose to destroy all the VMs in Part 2.

First, clone the repository

    git clone https://github.com/weaveworks/guides weaveworks/guides
    cd ./weaveworks-guides/weave-and-docker-platform/scripts

Run the following 3 scripts

    ./1-machine-create.sh
    ./2-weave-launch.sh
    ./3-replace-swarm-agents.sh

### Create

First, we must build the app and make the images available on each of the Docker hosts.  To save some time, there is a script which does this for you. 

Change to the `app` directory and run it like this:

    cd ../app
    ./build.sh

Next set up the environment variable to enable Compose to communicate with the Swarm endpoint:

    eval $(docker-machine env --swarm weave-1)

And finally, deploy the stack by running:

    docker-compose up -d

Run `docker-compose ps` to show the two deployed containers:

    > docker-compose ps
    Name                  Command               State               Ports
    -------------------------------------------------------------------------------------
    app_redis_1   /w/w /entrypoint.sh redis- ...   Up      6379/tcp
    app_web_1     /w/w python app.py               Up      192.168.99.131:32768->5000/tcp

Test the containers with `curl` using IP/port listed above:

    > curl 192.168.99.131:32768
    Hello World! I have been seen 1 times.
    > curl 192.168.99.131:32768
    Hello World! I have been seen 2 times.
    > curl 192.168.99.131:32768
    Hello World! I have been seen 3 times.

### Scale

Since we have 3 VMs at our disposal, we can force the web service instances to use all of them.

    > docker-compose scale web=3
    Creating app_web_2...
    Creating app_web_3...
    Starting app_web_2...
    Starting app_web_3...

Next run `docker-compose ps` to see that all 3 VMs are now running the web service.

    > docker-compose ps
    Name                  Command               State               Ports
    -------------------------------------------------------------------------------------
    app_redis_1   /w/w /entrypoint.sh redis- ...   Up      6379/tcp
    app_web_1     /w/w python app.py               Up      192.168.99.131:32768->5000/tcp
    app_web_2     /w/w python app.py               Up      192.168.99.129:32768->5000/tcp
    app_web_3     /w/w python app.py               Up      192.168.99.130:32768->5000/tcp


Test each of these instances with `curl` using IP/port listed above:

    > curl 192.168.99.129:32768
    Hello World! I have been seen 4 times.
    > curl 192.168.99.130:32768
    Hello World! I have been seen 5 times.

We have just deployed and scaled-up our simple app using Weave, Swarm and Compose!

## Next Steps

You can deploy a cluster to public cloud by setting the
`DOCKER_MACHINE_DRIVER` and also by specifying a few provider-specific environment variables prior to running `./1-machine-create.sh`. 
But before you do so, make sure to [remove the VirtualBox VMs first](#cleanup).

For example, with Microsoft Azure set the following:

    export DOCKER_MACHINE_DRIVER="azure"
    export AZURE_SUBSCRIPTION_CERT="/path/to/mycert.pem"
    export AZURE_SUBSCRIPTION_ID="MySubscriptionID"

Or Google Compute Engine:

    export DOCKER_MACHINE_DRIVER="google"
    export GOOGLE_PROJECT="my-awesome-project-1"
    export GOOGLE_AUTH_TOKEN="MyAuthToken"


  >>Note that this guide is open-source, and if you would
like to expand this guide to cover other clould providers in detail, please feel free to submit a pull-request to our [guides
repository](https://github.com/weaveworks/guides).

## Cleanup

You can tear-down the VMs you have deployed:

    docker-machine rm -f weave-1 weave-2 weave-3

## Summary

In this final Part 3 of _"Creating distributed applications with Weave and the Docker platform"_ guide we have looked
at utilising all 3 great components of the Docker platform (Machine, Swarm & Compose). You should now be able to understand
all that's required in setting up a scalable cluster of Docker hosts using Weave tools and then deploying your application to it with
ease. You may choose to automate somewhat differently, hence we've split this guide into three parts, each part describing the concepts that you need to know in order to understand how Weave can help you to deploy your applications. 

You can easily adapt these examples and use them as a templates in your own implementation. We would be very happy to hear any of your thoughts or issues via [email](help@weave.works) or [Twitter](https://twitter.com/weaveworks).

##Further Reading

  *  [Weave -- weaving containers into applications](https://github.com/weaveworks/weave#readme)
  *  [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
  *  [Automatic IP Address Management](https://github.com/weaveworks/weave/blob/master/site/ipam.md)


[ch1]: /guides/weave-and-docker-platform/weavenetwork.html
[ch2]: /guides/weave-and-docker-platform/using-weave-with-machine-and-swarm.html
[ch3]: /guides/weave-and-docker-platform/compose-scalable-swarm-cluster-with-weave.html