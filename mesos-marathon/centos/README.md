---
layout: guides
title: Networking Containers with Weave Net and Apache Mesos & Marathon
description:
  How-to use Weave Net & Weave Run with Apache Mesos & Marathon for DNS service discovery
  and load balancing.
tags: mesos, marathon, load-balancing, dns, centos, weaveworks, weave network
permalink: /guides/platform/mesos-marathon/os/centos/cloud/vagrant/index.html
---

In this tutorial, you will learn how to use the Apache Mesos & Marathon cluster manager together with Weave Net to network Docker containers.  

You will:

1. Provision two virtual machines with [CentOS](http://centos.org/).
2. Install and launch [Docker](http://docker.com) and [Weave Net](http://weave.works)
3. Set up and configure [Apache Mesos & Marathon](https://mesosphere.github.io/marathon/)
4. Deploy and test a simple web app.
5. Use Weave Net for simple load balancing. 

This example requires no programming, but does assume some UNIX skills. It will take about 10 minutes to complete. 

##How Weave Net Interacts with Mesos  

[Weave Net](/net) networks containers on an isolated overlay network, and also provides DNS and IP address allocation.

Mesos Marathon frameworks implements a management API (used by `deploy_on_marathon.sh` script) and the user interface. Mesos schedules any tasks created through Marathon and runs those on the cluster, where with the exception of `mesos-00` there is a `mesos-slave` service on each of the nodes . Docker and the Weave Net containers run on all nodes, it doesn't have to run on `mesos-00`, but from a management perspective, it may be convenient to do so. 

![Architecture Overview](/guides/images/mesos-marathon/centos/diagram-1.png)

To enable Marathon to deploy tasks as Docker containers and to use Weave Net, [a configuration file](https://github.com/weaveworks/guides/blob/master/mesos-marathon/centos/mesos-slave-containerizers.conf) [installed](https://github.com/weaveworks/guides/blob/0b10b27f0559b8852c12b81b94034823c3816777/mesos-marathon/centos/setup_and_launch_mesos_slave.sh#L7) using Vagrant's provisioning logic is provided.  See these files for further information on how this tutorial is configured.  

The following diagram shows how Weave Net interacts with Docker and Mesos.

![Weave Net, Docker and Mesos](/guides/images/mesos-marathon/centos/diagram-2.png)

For more information on the Apache Mesos and its application manager, Marathon, refer to the [Apache Mesos Docs](http://mesos.apache.org/documentation/latest/) and the [Marathon Docs](https://mesosphere.github.io/marathon/).

## How This is Setup?

During the provisioning phase (`vagrant up`), several shell scripts run on Vagrant that install and configure both Weave Net and any necessary RPM packages from the Mesosphere repository. Open the [Vagrantfile](https://github.com/weaveworks/guides/blob/0b10b27f0559b8852c12b81b94034823c3816777/mesos-marathon/centos/Vagrantfile#L59-L82), to see the logic of how, where and when those scripts are executed.

##Before You Begin

Please ensure the following are installed:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

##Setting up the VMs and Configuring Apache Zookeeper

First, clone the repo and then run the vagrant script:

~~~ bash
git clone https://github.com/weaveworks/guides
cd guides/mesos-marathon/centos
vagrant up
~~~

Once Vagrant is finished running, you should have two Virtual Machines called `mesos-00` and `mesos-01` with CentOS. It should also have configured a single Apache Zookeeper instance using `mesos-00` as master, and `mesos-01` as slave within the Marathon framework. In addition to this, Docker and Weave Net is also installed.

Once Vagrant is complete, you can access the Marathon UI through your browser at: `http://172.17.85.100:8080`.

## Viewing the Weave Network on the Virtual Machines

View the Weave network on the virtual machines:

~~~ bash
vagrant ssh mesos-00
~~~

First become root.

~~~ bash
[vagrant@mesos-00 ~]$ sudo -s
[root@mesos-00 vagrant]#
~~~

View Weave status:

~~~ bash
[root@mesos-00 vagrant]# weave status
~~~

or see a more detailed status of Weave Net:

~~~ bash
[root@mesos-00 vagrant]# systemctl status weave
~~~

and then view three Docker containers and Weave Net:

~~~ bash
[root@mesos-00 vagrant]# docker ps
~~~

Where you should see the following:

    CONTAINER ID    IMAGE                        COMMAND                CREATED         STATUS         PORTS                                            NAMES
    b9c179b2303d    weaveworks/weaveexec:1.4.3   "/home/weave/weavepr   4 minutes ago   Up 3 minutes                                                    weaveproxy
    3ca6d9c9dd0d    weaveworks/weave:1.4.3       "/home/weave/weaver    4 minutes ago   Up 3 minutes   0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave


There is not much else to do on `mesos-00`, so you can exit:

~~~ bash
[root@mesos-00 vagrant]# exit
~~~

Back in your local shell, run:

~~~ bash
./deploy_on_marathon.sh outyet.json
~~~

This script deploys a simple "Hello, World" web app, as shown in [Marathon tutorial](http://open.mesosphere.com/intro-course/ex17.html).  And in this tutorial, four instances of the web app are deployed.

###Load Balancing with Weave Net

Weave Net can also be used as a transparent, DNS-based, load-balancer, and it also eliminates the need for port remapping and instead uses a default container port.

<div class="alert alert-warning">
If you are looking to deploy your own app instead of this example, make sure to <a href="https://github.com/weaveworks/guides/blob/0b10b27f0559b8852c12b81b94034823c3816777/mesos-marathon/centos/outyet.json#L12">set the <code>hostname</code> parameter</a>, otherwise your containers will fail to launch.
</div>

The Marathon UI is accessed at `http://172.17.85.100:8080`

![Marathon Apps](/guides/images/mesos-marathon/centos/marathon-1.png)
![Marathon Apps - outyet](/guides/images/mesos-marathon/centos/marathon-2.png)

Log on to `mesos-01`, become root and set the environment for Weave Net, which is necessary for attaching containers to a Weave network:

~~~ bash
vagrant ssh mesos-01

[vagrant@mesos-01 ~]$ sudo -s
[root@mesos-01 vagrant]# eval $(weave env)
~~~

List the container processes and confirm that there four instances of the app:

    [root@mesos-01 vagrant]# docker ps | grep outyet
    
    666a8c7f344e     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   5 minutes ago   Up 5 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.bceb4f07-0ff9-4555-b9f0-99dadc9392fa
    8e708c45d0a9     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   6 minutes ago   Up 6 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.a9db0ff5-f666-40be-bc99-b8ee7dac170d
    819a8c3a4f78     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   6 minutes ago   Up 6 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.05f07ff3-0115-4d4b-b6e7-ce1c9532370e
    d9046f7e63cc     docker.io/goexample/outyet:latest   "/w/w go-wrapper run   6 minutes ago   Up 6 minutes     8080/tcp     mesos-20150803-095152-1683296684-5050-15616-S0.374e679d-edee-47ed-a3e2-69abf017a3f3


Next, test the app's functionality by making the container interactive:

~~~ bash
[root@mesos-01 vagrant]# docker run -ti centos:7
[root@7844aae5d94d /]# curl outyet:8080
~~~

You should see output similar to this:

    <!DOCTYPE html><html><body><center>
            <h2>Is Go 1.4 out yet?</h2>
            <h1>
                    <a href="https://go.googlesource.com/go/&#43;/go1.4">YES!</a>
            </h1>
    </center></body></html>


Run `curl -v outyet:8080` several times to confirm that Weave Net is balancing the load. You will notice that the IP address for `outyet` is not always the same and instead is randomized by weavedns as it balances the load between the hosts. For more information on weavedns see [Discovering Containers with WeaveDNS](/documentation/net-1.5-weavedns).


### Overriding Default Configuration Variables

Default variables for this tutorial are specified in the `Vagrantfile`:

~~~ bash
$mesos_slaves = 1
$memory = 1024*2
$cpus = 2
$network = [172, 17, 85]
~~~


Override any of these by creating a `config.rb` file with the desired variables and then save the file to the same directory.

For example, you can grow the cluster by running:

~~~ bash
echo '$mesos_slaves = 3' > config.rb
vagrant up mesos-02 mesos-03
~~~

##Conclusions

In this guide, how to use Weave Net with Apache Mesos and its Marathon framework was explained. The infrastructure was configured and installed using Vagrant on CentOS.

You can easily adapt this example and use it as a template for your own implementation. For more inforamtion you can contact us via [email](mailto:help@weave.works) or [Twitter](https://twitter.com/weaveworks).

## Further Reading

 * [How Weave Works](/documentation/net-1.5-router-topology)
 * [Weave Features](/documentation/net-1.5-features)
 * [Integrating Docker via the API Proxy](/documentation/net-1.5-weave-docker-api)


