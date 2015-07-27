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
       
      
3. To view a detailed status of weave:

         [vagrant@mesos-00 ~]$ sudo systemctl status weave weavedns weaveproxy
 
   You will see the following: 
       
	       weave.service - Weave Net
		   Loaded: loaded (/etc/systemd/system/weave.service; disabled)
		   Active: active (running) since Wed 2015-07-22 21:52:14 UTC; 1 day 20h ago
		     Docs: http://docs.weave.works/
		 Main PID: 13398 (docker)
		   CGroup: /system.slice/weave.service
		           └─13398 /usr/bin/docker attach weave
	
		Jul 24 12:26:47 mesos-01 docker[13398]: weave 2015/07/24 12:26:47.271091 Expired MAC a6:d2:7a:e0:9b:f0 at a6:ae:84:c4:b2:d5(mesos-01)
		Jul 24 12:26:47 mesos-01 docker[13398]: weave 2015/07/24 12:26:47.271098 Expired MAC ba:c7:80:ad:c0:22 at a6:ae:84:c4:b2:d5(mesos-01)
		Jul 24 12:54:30 mesos-01 docker[13398]: weave 2015/07/24 12:54:30.010695 Discovered local MAC fe:de:3e:c1:8c:42
		Jul 24 12:54:35 mesos-01 docker[13398]: weave 2015/07/24 12:54:35.127230 Discovered local MAC fa:ed:1c:13:5c:3e
		Jul 24 12:54:41 mesos-01 docker[13398]: weave 2015/07/24 12:54:41.085019 Discovered local MAC e2:48:72:46:42:da
		Jul 24 13:04:47 mesos-01 docker[13398]: weave 2015/07/24 13:04:47.316155 Expired MAC fa:ed:1c:13:5c:3e at a6:ae:84:c4:b2:d5(mesos-01)
		Jul 24 13:04:47 mesos-01 docker[13398]: weave 2015/07/24 13:04:47.316444 Expired MAC e2:48:72:46:42:da at a6:ae:84:c4:b2:d5(mesos-01)
		Jul 24 13:04:47 mesos-01 docker[13398]: weave 2015/07/24 13:04:47.316458 Expired MAC fe:de:3e:c1:8c:42 at a6:ae:84:c4:b2:d5(mesos-01)
		Jul 24 15:12:34 mesos-01 docker[13398]: weave 2015/07/24 15:12:34.219589 Expired MAC 02:12:a9:c1:92:59 at a6:ae:84:c4:b2:d5(mesos-01)
		Jul 24 15:16:06 mesos-01 docker[13398]: weave 2015/07/24 15:16:06.887280 Discovered local MAC 02:12:a9:c1:92:59
		
			weavedns.service - Weave Run - DNS
			   Loaded: loaded (/etc/systemd/system/weavedns.service; disabled)
			   Active: active (running) since Wed 2015-07-22 21:52:37 UTC; 1 day 20h ago
			     Docs: http://docs.weave.works/
			 Main PID: 14008 (docker)
			   CGroup: /system.slice/weavedns.service
			           └─14008 /usr/bin/docker attach weavedns
		
		Jul 24 12:16:05 mesos-01 docker[14008]: INFO: 2015/07/24 12:16:05.536725 [http] Adding basic-3.weave.local -> 10.160.0.1
		Jul 24 12:16:06 mesos-01 docker[14008]: INFO: 2015/07/24 12:16:06.984246 [zonedb] Container 655c979c73a274a5f509538c904376486cb3a0b11a089c7eae67ab6451d84726 down. Removing records
		Jul 24 12:16:07 mesos-01 docker[14008]: INFO: 2015/07/24 12:16:07.174900 [http] Adding basic-3.weave.local -> 10.160.0.5
		Jul 24 12:16:08 mesos-01 docker[14008]: INFO: 2015/07/24 12:16:08.518569 [zonedb] Container 4c34748acebd73a819cd1a69a19134c8c6183a9a9a477b36c2d7dec0305a994b down. Removing records
		Jul 24 12:53:49 mesos-01 docker[14008]: INFO: 2015/07/24 12:53:49.372176 [zonedb] Container 27fca5e90711d94ce38de48a80f4d19c9e8f7813ce04f0e9d3ef3548c6d7e4a5 down. Removing records
		Jul 24 12:53:49 mesos-01 docker[14008]: INFO: 2015/07/24 12:53:49.375405 [zonedb] Container 26e79511ad4c63eb1b7310353cf30c41b6cc3cf189402833784de11feffbfc67 down. Removing records
		Jul 24 12:53:49 mesos-01 docker[14008]: INFO: 2015/07/24 12:53:49.396730 [zonedb] Container b1cf61c7d487bbdb30f9800984e5d360e2e00fbe7cdc5117399627daaac29b92 down. Removing records
		Jul 24 12:54:30 mesos-01 docker[14008]: INFO: 2015/07/24 12:54:30.192701 [http] Adding basic-3.weave.local -> 10.160.0.1
		Jul 24 12:54:35 mesos-01 docker[14008]: INFO: 2015/07/24 12:54:35.313959 [http] Adding basic-3.weave.local -> 10.160.0.2
		Jul 24 12:54:41 mesos-01 docker[14008]: INFO: 2015/07/24 12:54:41.230726 [http] Adding basic-3.weave.local -> 10.160.0.3
		
			weaveproxy.service - Weave Run - DNS
			   Loaded: loaded (/etc/systemd/system/weaveproxy.service; disabled)
			   Active: active (running) since Wed 2015-07-22 21:52:17 UTC; 1 day 20h ago
			     Docs: http://docs.weave.works/
			 Main PID: 13673 (docker)
			   CGroup: /system.slice/weaveproxy.service
			           └─13673 /usr/bin/docker attach weaveproxy
		
		Jul 24 12:54:40 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:40.303734 GET /v1.18/images/python:3/json
		Jul 24 12:54:40 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:40.429436 POST /v1.18/containers/create?name=mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1
		Jul 24 12:54:40 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:40.429768 Creating container with WEAVE_CIDR ""
		Jul 24 12:54:40 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:40.646661 POST /v1.18/containers/c1151278ab82ac79876c07b9c0e9e881e935a161a01bbcef57234ded0fa19616/start
		Jul 24 12:54:40 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:40.835642 Attaching container c1151278ab82ac79876c07b9c0e9e881e935a161a01bbcef57234ded0fa19616 with WEAVE_CIDR "" to weave network
		Jul 24 12:54:41 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:41.355420 POST /v1.18/containers/mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1/wait
		Jul 24 12:54:41 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:41.376063 GET /v1.18/containers/mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1/json
		Jul 24 12:54:41 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:41.383997 GET /v1.18/containers/mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1/logs?follow=1&stderr=1&stdout=1&tail=all
		Jul 24 12:54:41 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:41.400307 POST /v1.18/containers/mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1/wait
		Jul 24 12:54:42 mesos-01 docker[13673]: INFO: 2015/07/24 12:54:42.347627 GET /v1.18/containers/mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1/json
	        


4.  View the Docker containers with Weave: 
      
        [vagrant@mesos-00 ~]$ sudo docker ps
        
        CONTAINER ID        IMAGE                        COMMAND                CREATED             STATUS              PORTS                                            NAMES
		c1151278ab82        python:3                     "/w/w /bin/sh -c 'py   4 hours ago         Up 4 hours          0.0.0.0:31002->8080/tcp                          mesos-d13cce4c-a9c4-4b08-adfd-edd6ce6995c1   
		f7c6f74c5698        python:3                     "/w/w /bin/sh -c 'py   4 hours ago         Up 4 hours          0.0.0.0:31001->8080/tcp                          mesos-3d40b117-2339-4cf7-a6c4-9e4a865acc7f   
		224eb5f51aeb        python:3                     "/w/w /bin/sh -c 'py   4 hours ago         Up 4 hours          0.0.0.0:31000->8080/tcp                          mesos-9a60628e-b35c-4a29-b994-2c0f530a03f4   
		a529d21d2729        weaveworks/weavedns:1.0.1    "/home/weave/weavedn   43 hours ago        Up 43 hours         10.1.42.1:53->53/udp                             weavedns                                     
		23fe7f3e7ac8        weaveworks/weaveexec:1.0.1   "/home/weave/weavepr   43 hours ago        Up 43 hours                                                          weaveproxy                                   
		e4caf3cc6fdc        weaveworks/weave:1.0.1       "/home/weave/weaver    43 hours ago        Up 43 hours         0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weav
 
       
     		
For more information about Weave, type `sudo weave --help` and docker, type `sudo docker --help`		   

### Overriding the Default Configuration Variables

The folllowing are the default variables set up in the `Vagrantfile`:

		$mesos_slaves = 1
		$memory = 1024*2
		$cpus = 2
		$network = [172, 17, 85]

You can override any of these settings by creating a `config.rb` file with your specified variable attributes.  		  	








