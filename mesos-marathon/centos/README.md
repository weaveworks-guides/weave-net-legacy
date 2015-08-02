---
layout: guides
title: "Using Weave with Apache Mesos & Marathon on CentOS"
permalink: /guides/platform/mesos-marathon/os/centos/cloud/vagrant/index.html
tags: docker, mesos, marathon, cli, vagrant, virtualbox, dns, ipam
---

##What You Will Build 

Weave provides a software network that is optimized for visualizing and communicating with apps scattered within Docker containers. Using tools and protocols that are familiar to you, Weave provides the network topology that allows you to communicate between containerized apps distributed across multiple networks or hosts more quickly and efficiently.
 
This example describes how to setup a Weave Network on a cluster manager, specifically, within the Apache Mesos & Marathon environment. For more details on the Apache Mesos and its application manager, Marathon, see the [Apache Mesos Docs](http://mesos.apache.org/documentation/latest/) and the [Marathon Docs](https://mesosphere.github.io/marathon/).

In this self-contained tutorial, you will:
 
1. Use Vagrant to install and configure the virtual machines with [CentOS](http://http://centos.org/). 
2. Install and launch [Docker](http://docker.com) and [Weave](http://weave.works) onto the virtual machines
3. Set up and configure [Apache Mesos & Marathon](https://mesosphere.github.io/marathon/)
4. Deploy a sample app.  

## Let's go!

Before you begin, please ensure you have the following installed: 

* [Git](http://git-scm.com/downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads) 

First, clone the repo and run the vagrant script:

        git clone https://github.com/weaveworks/guides
        cd mesos-marathon/centos
        vagrant up
        
The Vagrant script installed the Virtual Machines `mesos-00` and `mesos-01`. It also configured a single Apache Zookeeper instance that manages `mesos-00` as master, and `mesos-01` as slave within the Marathon framework. 

View the virtual machines: 

        vagrant status

and finally view the sample app, `Basic-3` running in Marathon through your browser at: `http://172.17.85. 100:8080`.

## Viewing the Weave Network on the Virtual Machines

View the Weave network on the virtual machines:

      
        vagrant ssh mesos-00

Become root first

        [vagrant@mesos-00 ~]$ sudo -s
        [root@mesos-00 vagrant]#

View Weave status: 

         [root@mesos-00 ~]$ weave status

or see a more detailed status of weave:

        [root@mesos-00 vagrant]# systemctl status weave weavedns weaveproxy

and then view three Docker containers and Weave: 

         [root@mesos-00 ~]$ docker ps
         
Where you should see something similar to this:
        
        CONTAINER ID        IMAGE                        COMMAND                CREATED             STATUS              PORTS                                            NAMES
        c1151278ab82        python:3                     "/w/w /bin/sh -c 'py   4 hours ago         Up 4 hours          0.0.0.0:31002->8080/tcp                          mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1   
        f7c6f74c5698        python:3                     "/w/w /bin/sh -c 'py   4 hours ago         Up 4 hours          0.0.0.0:31001->8080/tcp                          mesos-3d40b117-2339-4cf7-a6c4-9e4a865acc7f   
        224eb5f51aeb        python:3                     "/w/w /bin/sh -c 'py   4 hours ago         Up 4 hours          0.0.0.0:31000->8080/tcp                          mesos-9a60628e-b35c-4a29-b994-2c0f530a03f4   
        a529d21d2729        weaveworks/weavedns:1.0.1    "/home/weave/weavedn   43 hours ago        Up 43 hours         10.1.42.1:53->53/udp                             weavedns                                     
        23fe7f3e7ac8        weaveworks/weaveexec:1.0.1   "/home/weave/weavepr   43 hours ago        Up 43 hours                                                          weaveproxy                                   
        e4caf3cc6fdc        weaveworks/weave:1.0.1       "/home/weave/weaver    43 hours ago        Up 43 hours         0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave

For more information about Weave, type `weave --help` and Docker, type `docker --help`

### Overriding Default Configuration Variables

The default variables for this tutorial are specified in the `Vagrantfile`:

        $mesos_slaves = 1
        $memory = 1024*2
        $cpus = 2
        $network = [172, 17, 85]

Override any of these by creating a `config.rb` file with the desired variables and saving the file in the same directory.
