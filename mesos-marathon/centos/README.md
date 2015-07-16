---
layout: guides
title: "Using Weave with Mesos Marathon on CentOS"
permalink: /guides/platform/mesos-marathon/os/centos/cloud/vagrant/index.html
tags: docker, mesos, marathon, cli, vagrant, virtualbox, dns, ipam
---

In this guide I will demonstrate how to get Weave working with Mesos Marathon on CentOS 7 using Vagrant.

## Let's go!

First, you need to clone the repository

```
git clone https://github.com/weaveworks/guides
```

You will need to run all the commands from the same sub-directory, so please
```
cd mesos-marathon/centos
```

Next, you should fire-up Vagrant VMs by running
```
vagrant up
```

This will bring up `mesos-00` and `mesos-01`. I chose to make `mesos-00` act as Mesos master and run a
single Zookeeper instance and Marathon framework, while `mesos-01` acts as a slave (you can setup more
slaves, please see below by setting `$mesos_slaves` in `config.rb`, there you can also set `$cpus` and
`$memory`, see `Vagrantfile` for default values).

Now you should be able access Marathon user interface by pointing your browser at `http://172.17.85.100:8080`.
You can also deploy a simple test app by running `./basic_test.sh`.
