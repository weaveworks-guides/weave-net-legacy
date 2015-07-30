---
title: Networking Spark Cluster on Docker with Weave
tags: docker, spark, vagrant, cloud, coreos, usecase, guide, python
layout: guides
---

In this guide, I will show you how easy it is to deploy a Spark cluster using [Docker](https://www.docker.com/) and [Weave](https://weave.works/), running on [CoreOS](https://coreos.com/).

[Apache Spark](http://spark.apache.org/) is a fast and general-purpose cluster computing system. It provides high-level APIs in Java, Scala and Python, and an optimized engine that supports general execution graphs. It also supports a rich set of higher-level tools, including [stream processing](http://spark.apache.org/docs/1.2.0/streaming-programming-guide.html). For this guide, I am going to demonstrate a basic stream processing example in Python. I will use Weave to connect 3 Spark nodes on a fully isolated and portable network with DNS, no reconfiguration would be required if you wish to run this elsewhere.

To keep things simple for you, I will show how to setup the Spark cluster using Vagrant. If you would like to run a really big workload in the cloud, please refer to [my other blog post](http://weaveblog.com/2014/12/18/automated-provisioning-of-multi-cloud-weave-network-terraform/), but you probably want to try this first and make sure you understand all the relevant steps. For this guide, I made sure it's supper easy to get up and running and you don't have to pay for a cloud services account.

## What you will do?

By following this guide, you will learn how simple and transparent Weave make deployment of Apache Spark on lightweight CoreOS/Docker stack. You will use Vagrant and VirtualBox, but the same setup can be reproduced in any cloud with ease.

  - CoreOS
  - Docker
  - Vagrnat and VirtualBox
  - ...

## Let's go!

Firstly, let's checkout the code and bring up 3 VMs on Vagrant:

    git clone https://github.com/errordeveloper/weave-demos
    cd weave-demos/sparkles
    vagrant up

Vagrant will boot and provision 3 VMs, shortly after there will be a Spark cluster running with master on the head node (`core-01`) and workers on the remaining `core-02` and `core-03`. To keep this guide short, I will not explain how exactly provisioning works, as I have [done so previously](http://weaveblog.com/2014/10/28/running-a-weave-network-on-coreos/).

Now, let's login to `core-01`:

    vagrant ssh core-01

A few container images should be downloading in the background. It takes a few minutes, but you can run `watch docker images` and wait for the following to appear:

    REPOSITORY                                   TAG                 IMAGE ID            CREATED             VIRTUAL SIZE
    errordeveloper/weave-spark-master-minimal    latest              437bd4307e0e        47 hours ago        430.4 MB
    errordeveloper/weave-spark-worker-minimal    latest              bdb33ca885ae        47 hours ago        430.4 MB
    errordeveloper/weave-twitter-river-minimal   latest              af9f7dad1877        47 hours ago        193.8 MB
    errordeveloper/weave-spark-shell-minimal     latest              8d11396e01c2        47 hours ago        574.6 MB
    ...

I have prepared a set of [lean](http://weaveblog.com/2014/12/09/running-java-applications-in-docker-containers/) Spark container images for the purpose of this demo.

> Note: You can use images of your own if you'd like, just make sure to consult my [Dockerfile](https://github.com/errordeveloper/weave-demos/blob/master/java-containers/spark/base/Dockerfile#L33-L34) for the `nsswitch.conf` tweak, you will need it to make sure DNS works correctly.

You may have noticed there is Elasticsearch running,  I will not be using it for the purpose of this guide, but it's there for you to experiment with, if you'd like.

Once all of the images are downloaded,  Spark cluster will get bootstrapped shortly.

You can tail the logs and see 2 workers joining the cluster,  these go by DNS names`spark-worker-1.weave.local` and `spark-worker-2.weave.local`:

    core@core-01 ~ $ journalctl -f -u spark
    ...
    Feb 18 16:09:34 core-01 docker[3658]: 15/02/18 16:09:34 INFO Master: I have been elected leader! New state: ALIVE
    Feb 18 16:10:15 core-01 docker[3658]: 15/02/18 16:10:15 INFO Master: Registering worker spark-worker-1.weave.local:44122 with 1 cores, 982.0 MB RAM
    Feb 18 16:10:17 core-01 docker[3658]: 15/02/18 16:10:17 INFO Master: Registering worker spark-worker-2.weave.local:33557 with 1 cores, 982.0 MB RAM

> Note: these are not very big compute nodes, if your machine has more resource, you can deploy bigger VMs by setting `$vb_memory` and `$vb_cpus` in `config-override.rb`.

## Ready to work!

Now everything is ready to deploy a workload on the cluster. I will submit a simple job written in Python, featuring newly added stream API.

Let's start pyspark container:

    sudo weave run \
      --with-dns \
      10.10.1.88/24 \
      --hostname=spark-shell.weave.local \
      \
      --tty --interactive \
      --name=spark-shell \
      --entrypoint=pyspark \
      errordeveloper/weave-spark-shell-minimal:latest \
      \
      --master spark://spark-master.weave.local:7077

The IP address I have picked for this container is `10.10.1.88`, it's part of the `10.10.1.0/24` subnet, which had been allocated for the cluster, you can use any other IP in that range. This container will get a DNS name `spark-shell.weave.local`, that's simply taken care of by passing `--with-dns`  and `--hostname=...`. Most of remaining arguments are not specific to Weave, these are just usual `docker run` arguments, followed by `pyspark` arguments, where master node is addressed by it's DNS name.

For the demo to work, you will also need a data source of some sort. Naturally, it will run in a container as well, which in turns joins Weave network.

Here is a very simple one for you:

    sudo weave run --with-dns 10.10.1.99/24 \
      --hostname=spark-data-source.weave.local \
      busybox sh -c 'nc -ll -p 9999 -e yes Hello, Weave!'

So we will have a netcat server on 9999, with DNS name `spark-data-source.weave.local` and IP address `10.10.1.99`. Weave will make this server reachable from any node in the cluster, and it can be moved between hosts without need to change any of your code or config.

Next, you want to attach to the Spark shell container:


    core@core-01 ~ $ docker attach spark-shell
    ...
    Welcome to
          ____              __
         / __/__  ___ _____/ /__
        _\ \/ _ \/ _ `/ __/  '_/
       /__ / .__/\_,_/_/ /_/\_\   version 1.2.1
          /_/

    Using Python version 2.7.6 (default, Nov 23 2014 14:48:23)
    SparkContext available as sc.
    >>> 15/02/18 17:10:37 INFO SparkDeploySchedulerBackend: Registered executor: Actor[akka.tcp://sparkExecutor@spark-worker-2.weave.local:34277/user/Executor#-2039127650] with ID 0
    15/02/18 17:10:37 INFO SparkDeploySchedulerBackend: Registered executor: Actor[akka.tcp://sparkExecutor@spark-worker-1.weave.local:44723/user/Executor#-1272098548] with ID 1
    15/02/18 17:10:38 INFO BlockManagerMasterActor: Registering block manager spark-worker-2.weave.local:44675 with 267.3 MB RAM, BlockManagerId(0, spark-worker-2.weave.local, 44675)
    15/02/18 17:10:38 INFO BlockManagerMasterActor: Registering block manager spark-worker-1.weave.local:36614 with 267.3 MB RAM, BlockManagerId(1, spark-worker-1.weave.local, 36614)

The code we are going to run is based on the [`streaming/network_wordcount.py`](https://github.com/apache/spark/blob/a8eb92dcb9ab1e6d8a34eed9a8fddeda645b5094/examples/src/main/python/streaming/network_wordcount.py) example, which counts words in a text stream received from the data source server every second.

    >>>
    >>> from pyspark.streaming import StreamingContext
    >>>
    >>> ssc = StreamingContext(sc, 1)
    >>>
    >>> lines = ssc.socketTextStream('spark-data-source.weave.local', 9999)
    >>>
    >>> counts = lines.flatMap(lambda line: line.split(" ")).map(lambda word: (word, 1)).reduceByKey(lambda a, b: a+b)
    >>>
    >>> counts.pprint()
    >>>
    >>> ssc.start(); ssc.awaitTermination();

Amongst much of log messages, you should see this being printed periodically:

    -------------------------------------------
    Time: 2015-02-18 18:10:56
    -------------------------------------------
    ('Hello,', 130962)
    ('Weave!', 130962)

## Conclusion

In this guide, we have looked at deploying Apache Spark with Docker and Weave.

There are several advantage that Weave brings to a containerised Spark cluster:

 1. Secure and simple to setup virtual network with DNS out-of-the box
 2. No need to care about what container ports are published to host's interface
 3. Worker (and master) containers can be moved between hosts
 4. Scaling Spark cluster and introducing ad-hoc services is very easy
 5. Moving the entire setup to new infrastructure required no code changes

Hope you find information in this guide useful, and do make sure to follow [@weaveworks](https://twitter.com) on Twitter to read more guides like this. You can also contact us via [help@weave.works](mailto:help@weave.works?subject=[sparkles]), and let us know of anything interesting you built using Weave.
