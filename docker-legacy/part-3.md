---
title: "Part 3: Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave"
---

**Note:** You are looking at our `old-guides` repository. The guides in here haven't been updated in a while.
They might or might not work for you. We are keeping them around for informational purposes.

---

In this Part 3 of the guide you will be introduced to using Weave Net with Docker Swarm and Docker Compose. 

[Docker Machine](https://docs.docker.com/machine/) makes it really easy to create Docker hosts (VMs) on your computer, on cloud providers and inside your own data center. It creates servers, installs Docker on them, and configures the Docker client to talk to them.

[Docker Swarm](http://docs.docker.com/swarm/) is Docker's native clustering environment. It turns a pool of Docker hosts into a single, virtual host. You can instruct Docker Machine to provision a Swarm cluster for you, and then integrate the Swarm using Weave Net. Both of these concepts were explored in [Part 1][ch1] and [Part 2][ch2].

With [Docker Compose](https://docs.docker.com/compose/) you can define and run complex applications with Docker.
Compose is an extra layer that allows you to combine a multi-container application into a single file and then launch your application with a single command.

In Part 3 of this tutorial you will: 

  1. Work with a cluster of 3 Swarm-enabled VirtualBox VMs which were setup in [Part 2 of this tutorial][ch2]
  2. Use Compose to create a simple 2-tier application stack using Python Flask for the front-end and Redis as its
database. 
  3. Scale the front-end app to take advantage of all 3 Virtual Machines.
  
This tutorial does not require any programming skills, but it does require some UNIX skills.
The tutorial should take 15-25 minutes to complete.

## What You Will Use

  - [Weave](http://weave.works)
  - [Docker, Compose, Swarm & Machine](http://docker.com)
  - [Python](https://www.python.org/)
  - [Flask](http://flask.pocoo.org/)
  - [Redis](http://redis.io/)

If you are already familiar with Compose, then you will recognize the Flask app used here. If you haven't yet used Compose, then have a look at [the overview in Docker Compose Documentation](https://docs.docker.com/compose/#overview) which describes the app and the `docker-compose.yml` file structure, as well as the `Dockerfile` used.

## Before You Begin

If you are using OS X, then install [Docker Toolbox](https://www.docker.com/toolbox), which provides the tools you need.

For all other operating systems, install and configure the following separately before proceeding:

  - [`docker-compose`](http://docs.docker.com/compose/install/) binary (_`>= 1.7.2`_)
  - [`docker-machine`](http://docs.docker.com/machine/#installation) binary (_`>= 0.7.0`_)
  - [`docker`](https://docs.docker.com/installation/#installation) binary, at lest the client (_`>= v1.6.x`_)
  - [VirtualBox](https://www.virtualbox.org/wiki/Downloads) (_`>= 4.3.x`_)
  - `curl` (_any version_)

If you have followed through [Part 2 of this tutorial][ch2], then **most** of these dependencies will already be installed.

The only new tool introduced here is **`Docker Compose`**.

>**Note:** [Docker Compose](http://docs.docker.com/machine/#installation) is not supported on Windows.


## Provisioning the VMs

### 1. Automating the Set up

If you didn't continue from [Part 2][ch2], run the following commands to create the 3 VMs with a Weave network. If you chose to destroy all the VMs in Part 2, then you'll need to run through these commands again.

First, clone the repository

    git clone https://github.com/weaveworks/guides
    cd ./guides/weave-and-docker-platform/scripts

Run these 3 scripts

    ./1-machine-create.sh
    ./2-weave-launch.sh
    ./3-replace-swarm-agents.sh

### 2. Create the App

Build the app and then make the images available to each of the Docker hosts.  To save some time, there is a script which does this for you. 

Change to the `app` directory and run it like this:

    cd ../app
    ./build.sh

Next set up the environment variable to enable Compose to communicate with the Swarm endpoint:

    eval "$(docker-machine env --swarm weave-1)"

And finally, deploy the stack by running:

    docker-compose up -d

Run `docker-compose ps` to show the two deployed containers:

    > docker-compose ps
    Name                  Command               State               Ports
    -------------------------------------------------------------------------------------
    app_redis_1   /w/w /entrypoint.sh redis- ...   Up      6379/tcp
    app_web_1     /w/w python app.py               Up      192.168.99.131:80->5000/tcp

Test the containers with `curl` using the IP listed above after you ran `docker-compose ps`:

    > curl 192.168.99.131
    Hello World! I have been seen 1 times.
    > curl 192.168.99.131
    Hello World! I have been seen 2 times.
    > curl 192.168.99.131
    Hello World! I have been seen 3 times.

### 3. Scale the App Across Host

Since there are 3 VMs at your disposal, you can force the web service instances to use all of them by running  `docker-compose scale web=3`:

    > docker-compose scale web=3
    Creating app_web_2...
    Creating app_web_3...
    Starting app_web_2...
    Starting app_web_3...

Next check that all 3 VMs are running the web service using `docker-compose ps`.

    > docker-compose ps
    Name                  Command               State               Ports
    -------------------------------------------------------------------------------------
    app_redis_1   /w/w /entrypoint.sh redis- ...   Up      6379/tcp
    app_web_1     /w/w python app.py               Up      192.168.99.131:80->5000/tcp
    app_web_2     /w/w python app.py               Up      192.168.99.129:80->5000/tcp
    app_web_3     /w/w python app.py               Up      192.168.99.130:80->5000/tcp


Test each of these instances with `curl` using IP/port listed above:

    > curl 192.168.99.129
    Hello World! I have been seen 4 times.
    > curl 192.168.99.130
    Hello World! I have been seen 5 times.

You have just deployed and scaled a simple app using Weave Net, Swarm and Compose!

## 4. Deploying Clusters to Public Clouds

Deploy a cluster to the public cloud by setting the
`DOCKER_MACHINE_DRIVER` variable and also by specifying the required provider-specific environment variables before running the `./1-machine-create.sh` shell script.  But before you do so, make sure that you [remove the VirtualBox VMs first](#cleanup).

For example, if you are using Microsoft Azure, then set the following variables:

    export DOCKER_MACHINE_DRIVER="azure"
    export AZURE_SUBSCRIPTION_CERT="/path/to/mycert.pem"
    export AZURE_SUBSCRIPTION_ID="MySubscriptionID"

Or for Google Compute Engine use these:

    export DOCKER_MACHINE_DRIVER="google"
    export GOOGLE_PROJECT="my-awesome-project-1"
    export GOOGLE_AUTH_TOKEN="MyAuthToken"


>**Note:** that this guide is open-source, and if you would
like to expand this guide to cover other clould providers in detail, please feel free to submit a pull-request to our [guides
repository](https://github.com/weaveworks/guides).

## Cleanup

You can tear-down the VMs you have deployed:

    docker-machine rm -f weave-1 weave-2 weave-3

## Summary

In this final Part 3 of _"Creating and Scaling Multi-host Docker Deployment with Swarm and Compose using Weave_ tutorial you have looked
at how Weave Net works with all three components of the Docker platform (Machine, Swarm & Compose). You should now be able to understand all that is required in setting up a scalable cluster of Docker hosts using Weave Net. 

You may automate your deployment somewhat differently, and for this reason, this tutorial is split into three parts with each part describing the necessary concepts so that you can understand how Weave Net helps you deploy and manage your applications. 

Please send us your thoughts or issues via [Help and Support](/help/).

## Further Reading

  *  [Introducing Weave Net](/docs/net/latest/introducing-weave/)
  *  [Weave Net Features](docs/net/latest/features/)
  *  [Allocating IP Addresses ](/docs/net/latest/ipam/)


[ch1]: ./part-1.md
[ch2]: ./part-2.md
[ch3]: ./part-3.md
