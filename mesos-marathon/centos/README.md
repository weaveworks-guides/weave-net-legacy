---
layout: guides
title: "Using Weave with Apache Mesos & Marathon on CentOS"
permalink: /guides/platform/mesos-marathon/os/centos/cloud/vagrant/index.html
tags: docker, mesos, marathon, cli, vagrant, virtualbox, dns, ipam
---

##What You Will Build 

Weave provides a software network that is optimized for visualizing and communicating with apps scattered within Docker containers. Using tools and protocols that are familiar to you, Weave provides the network topology that allows you to communicate between containerized apps distributed across multiple networks or hosts more quickly and efficiently.
 
This example describes how to setup a Weave Network on a cluster manager, specifically, within the Apache Mesos & Marathon environment. For more details on the Apache Mesos and its application manager, Marathon, see the [Apache Mesos Docs](http://mesos.apache.org/documentation/latest/) and the [Marathon Docs](https://mesosphere.github.io/marathon/).

## What You Will Use

* [Docker](http://docker.com)
* [Weave](http://weave.works)
* [CentOS](http://http://centos.org/)
* [Apache Mesos & Marathon](https://mesosphere.github.io/marathon/)

## Before You Start

This self-contained tutorial uses Vagrant to install and configure the virtual machines with CentOS, then it installs and launches both Docker and Weave onto the virtual machines and finally, it sets up and configures Apache Mesos & Marathon, and then it deploys a sample app.  

Before you start have the following installed: 

* [Git](http://git-scm.com/downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads) 


## Let's go!

1.  Clone the repository:

        git clone https://github.com/weaveworks/guides
     						
2.  Change to the following sub-directory: 

        cd mesos-marathon/centos
    
3.	Run the Vagrant script: 

        vagrant up
        
4. The Vagrant script installed the Virtual Machines `mesos-00` and `mesos-01`. A single Apache Zookeeper instance manages `mesos-00` as master, and `mesos-01` as slave within the Marathon framework. 

5.  From the same directory as the Vagrant script was run, view the installed virtual machines by typing: 

        vagrant status

5.  Access Marathon through your browser at: `http://172.17.85.100:8080`  where the sample app, Basic-3 is running.
	
## Viewing the Weave Network on the Virtual Machines

To view the containers and the Weave network on the virtual machines:

1. Open a terminal, and ssh onto one of the virtual machines:
      
        vagrant ssh mesos-00
      
2. View Weave status: 

        vagrant@mesos-00 ~]$ sudo weave status
       
   The following should appear: 
       
		Usage of loopback devices is strongly discouraged for production use. Either use `--storage-opt  					dm.thinpooldev`or use `--storage-opt dm.no_warn_on_loop_devices=true` to suppress this warning.
		
		weave router 1.0.1
		Our name is 36:d7:f7:78:e6:1e(mesos-00)
		Encryption off
		Peer discovery on
		Sniffing traffic on &{10 65535 ethwe fe:79:4f:d2:57:40 up|broadcast|multicast}
		MACs:
		02:12:a9:c1:92:59 -> a6:ae:84:c4:b2:d5(mesos-01) (2015-07-23 17:54:27.018561473 +0000 UTC)
		de:5a:6f:ed:fa:88 -> 36:d7:f7:78:e6:1e(mesos-00) (2015-07-23 17:49:47.406999529 +0000 UTC)
		Peers:
		36:d7:f7:78:e6:1e(mesos-00) (v2) (UID 6675026302552278536)-> a6:ae:84:c4:b2:d5(mesos-01) 
		[172.17.85.101:34482]
		a6:ae:84:c4:b2:d5(mesos-01) (v2) (UID 3843462217018011557)-> 36:d7:f7:78:e6:1e(mesos-00)
		[172.17.85.100:6783]
		
		Routes:
		unicast:
		36:d7:f7:78:e6:1e -> 00:00:00:00:00:00
		a6:ae:84:c4:b2:d5 -> a6:ae:84:c4:b2:d5
		broadcast:
		36:d7:f7:78:e6:1e -> [a6:ae:84:c4:b2:d5]
		a6:ae:84:c4:b2:d5 -> []
		Direct Peers: 172.17.85.101
		Reconnects:

		Allocator range [10.128.0.0-10.192.0.0)
		Owned Ranges: 10.128.0.0 -> 36:d7:f7:78:e6:1e (mesos-00) (v1) 10.160.0.0 -> a6:ae:84:c4:b2:d5 (mesos-01) (v4)
		Allocator default subnet: 10.128.0.0/10

		weave DNS 1.0.1
		Listen address :53
		Fallback DNS config &{[10.0.2.3] [] 53 1 5 2}

		Local domain weave.local.
		Interface &{40 65535 ethwe 8e:81:47:43:82:39 up|broadcast|multicast}
		Zone database:
						
		weave proxy is running
       
      
3.  View the Docker containers with Weave running: 
      
        [vagrant@mesos-00 ~]$ sudo docker ps
  
 

![Weave Network running with Docker](docker-ps.png)
       
     		
For more information about Weave, type `sudo weave --help` and docker, type `sudo docker --help`		   

### Overriding the Default Configuration Variables

The folllowing are the default variables set up in the `Vagrantfile`:

		$mesos_slaves = 1
		$memory = 1024*2
		$cpus = 2
		$network = [172, 17, 85]

You can override any of these settings by creating a `config.rb` file with your specified variable attributes.  		  	








