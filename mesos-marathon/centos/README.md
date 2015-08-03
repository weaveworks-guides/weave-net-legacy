---
layout: guides
title: "Using Weave with Apache Mesos & Marathon on CentOS"
permalink: /guides/platform/mesos-marathon/os/centos/cloud/vagrant/index.html
tags: docker, mesos, marathon, cli, vagrant, virtualbox, dns, ipam
---

##What You Will Build

Weave provides a software network that is optimized for visualizing and communicating with apps scattered within Docker containers. Using tools and protocols that are familiar to you, Weave provides the network topology that allows you to communicate between containerized apps distributed across multiple networks or hosts more quickly and efficiently.

This example describes how to setup a Weave Network on a cluster manager, specifically, within the Apache Mesos & Marathon environment. For more details on the Apache Mesos and its application manager, Marathon, see the [Apache Mesos Docs](http://mesos.apache.org/documentation/latest/) and the [Marathon Docs](https://mesosphere.github.io/marathon/).

In particular, you should learn about load-balancing in [Weave Run](/run) and usage of the [Docker API proxy](http://docs.weave.works/weave/latest_release/proxy.html) with Mesos.

In this self-contained tutorial, you will:

1. Use Vagrant to install and configure the virtual machines with [CentOS](http://centos.org/).
2. Install and launch [Docker](http://docker.com) and [Weave](http://weave.works) onto the virtual machines
3. Set up and configure [Apache Mesos & Marathon](https://mesosphere.github.io/marathon/)
4. Deploy and test a simple web app.

## Let's go!

Before you begin, please ensure you have the following installed:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

First, clone the repo and run the vagrant script:

    git clone https://github.com/weaveworks/guides
    cd mesos-marathon/centos
    vagrant up

The Vagrant script installed the Virtual Machines `mesos-00` and `mesos-01`. It also configured a single Apache Zookeeper instance that manages `mesos-00` as master, and `mesos-01` as slave within the Marathon framework.

Once `vagrant up` has exited, access the Marathon admin UI through your browser at: `http://172.17.85.100:8080`.

## Viewing the Weave Network on the Virtual Machines

View the Weave network on the virtual machines:


    vagrant ssh mesos-00

Become root first

    [vagrant@mesos-00 ~]$ sudo -s
    [root@mesos-00 vagrant]#

View Weave status:

    [root@mesos-00 vagrant]# weave status

or see a more detailed status of weave:

    [root@mesos-00 vagrant]# systemctl status weave weavedns weaveproxy

and then view three Docker containers and Weave:

    [root@mesos-00 vagrant]# docker ps

Where you should see something similar to this:

    CONTAINER ID    IMAGE                        COMMAND                CREATED         STATUS         PORTS                                            NAMES
    b9c179b2303d    weaveworks/weaveexec:1.0.1   "/home/weave/weavepr   4 minutes ago   Up 3 minutes                                                    weaveproxy
    71a7716f50cc    weaveworks/weavedns:1.0.1    "/home/weave/weavedn   4 minutes ago   Up 3 minutes   10.1.42.1:53->53/udp                             weavedns
    3ca6d9c9dd0d    weaveworks/weave:1.0.1       "/home/weave/weaver    4 minutes ago   Up 3 minutes   0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave

There is not much else to do on `mesos-00` and you can exit

    [root@mesos-00 vagrant]# exit

Back in your local shell, run

    ./deploy_on_marathon.sh outyet.json

This deploys a simple "Hello, World" type of a web app, as show in [Marathon tutorial](http://open.mesosphere.com/intro-course/ex17.html). There are 4 instances of this app being deployed and this guide will demonstrate how easy it is to use DNS-based load-balancing in Weave Run, as well as how the use of Weave Net eliminate the need for port remapping and just a default container port will be used.

Accessing Marathon UI at `http://172.17.85.100:8080` should show the app going from deployment to running status, it should take just a few minutes.

Login to `mesos-01` now, become root and setup environment variables for using the Docker API proxy

     vagrant ssh mesos-01
     [vagrant@mesos-01 ~]$ sudo -s
     [root@mesos-01 vagrant]# eval $(weave proxy-env)

Listing conainer processes should confirm that there 4 instances of the app

    [root@mesos-01 vagrant]# docker ps | grep outyet
    666a8c7f344e     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   5 minutes ago   Up 5 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.bceb4f07-0ff9-4555-b9f0-99dadc9392fa
    8e708c45d0a9     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   6 minutes ago   Up 6 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.a9db0ff5-f666-40be-bc99-b8ee7dac170d
    819a8c3a4f78     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   6 minutes ago   Up 6 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.05f07ff3-0115-4d4b-b6e7-ce1c9532370e
    d9046f7e63cc     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   6 minutes ago   Up 6 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.374e679d-edee-47ed-a3e2-69abf017a3f3

Next, test the functionality of the app by creating an interactive container on Weave

    [root@mesos-01 vagrant]# docker run -ti centos:7
    [root@7844aae5d94d /]# curl outyet:8080

You should see output like this:

    <!DOCTYPE html><html><body><center>
            <h2>Is Go 1.4 out yet?</h2>
            <h1>

                    <a href="https://go.googlesource.com/go/&#43;/go1.4">YES!</a>

            </h1>
    </center></body></html>

If you run `curl -v outyet:8080` a few times, you should be able to confirm that Weave Run does the load-ballancing as IP address for `outyet` is not always the same.

### How does this work?

[Weave Net](/net) takes care of connecting containers on an isolated overlay network and [Weave Run](/run) provides the DNS and IP address allocation.

Mesos Marathon frameworks provides a management API (used by `deploy_on_marathon.sh` script) and UI. Mesos schedules tasks created through Marathon and runs those on the cluster, there is a `mesos-slave` service on each of the nodes except from `mesos-00`. Docker and the Weave containers run on all the nodes, it doesn't have to run on `mesos-00`, but it can be convenient for management purposes. The following diagram illustrates this.

![Architecture Overview](/guides/images/mesos-marathon/centos/diagram-1.png)

To make Marathon deploy tasks as Docker containers and use Weave there is [a configuration file](https://github.com/weaveworks/guides/blob/ab8fb8efd9e5da943cfbd98361d78008e1c46f71/mesos-marathon/centos/mesos-slave-containerizers.conf) [being installed](https://github.com/weaveworks/guides/blob/ab8fb8efd9e5da943cfbd98361d78008e1c46f71/mesos-marathon/centos/setup_and_launch_mesos_slave.sh#L7) by Vagrant provisioning logic described below. The next diagram breaks-down Weave components and illustrates how these interact with Docker and Mesos componenets.

![Weave Details](/guides/images/mesos-marathon/centos/diagram-2.png)

### How is this setup?

The is a set of small shell scripts that run on Vagrant during provisioning phase (`vagrant up`), if you look at [Vagrantfile](https://github.com/weaveworks/guides/blob/ab8fb8efd9e5da943cfbd98361d78008e1c46f71/mesos-marathon/centos/Vagrantfile#L59-L82), you will see the logic of how, where and when those are executed. The scripts install and configure Weave as well as RPM packages from the Mesosphere repository.

### Overriding Default Configuration Variables

The default variables for this tutorial are specified in the `Vagrantfile`:

        $mesos_slaves = 1
        $memory = 1024*2
        $cpus = 2
        $network = [172, 17, 85]

Override any of these by creating a `config.rb` file with the desired variables and saving the file in the same directory.

For example, you can grow the cluster by running

    echo '$mesos_slaves = 3' > config.rb
    vagrant up mesos-02 mesos-03
