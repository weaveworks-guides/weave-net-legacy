---
layout: guides
title: "Using Weave with Apache Mesos Marathon on CentOS"
permalink: /guides/platform/mesos-marathon/os/centos/cloud/vagrant/index.html
tags: docker, mesos, marathon, cli, vagrant, virtualbox, dns, ipam
---
##How Weave Works with Apache Mesos Marathon##

In this guide we will demonstrate how to get Weave working with Mesosphere Marathon on CentOS 7 using Vagrant.

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [CentOS](http://http://centos.org/)
* [Apache Mesos Marathon](https://mesosphere.github.io/marathon/)

## What you will need to install to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker and CentOS, and we make use of VirtualBox and Vagrant to allow you to run the entire getting started guide on your personal system.

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads) -- This step is optional since the Vagrant script checks and will download this if it's not already installed.


## Let's go!

1.	First, you need to clone the repository:
     `git clone https://github.com/weaveworks/guides`						
2.	Run all commands from the same sub-directory: 
    `cd mesos-marathon/centos`
3.	Next, you should start-up the Vagrant VMs by running: 
    `vagrant up`


This will bring up `mesos-00` and `mesos-01`. I chose to make `mesos-00` act as Mesos master and run a
single Zookeeper instance and Marathon framework, while `mesos-01` acts as a slave (you can setup more
slaves, please see below by setting `$mesos_slaves` in `config.rb`, there you can also set `$cpus` and
`$memory`, see `Vagrantfile` for default values).

Now you should be able access Marathon user interface by pointing your browser at `http://172.17.85.100:8080`.
You can also deploy a simple test app by running `./basic_test.sh`.