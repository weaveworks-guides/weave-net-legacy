---
layout: guides

shorttitle: Service Discovery & Load Balancing with Weave
title: Service Discovery and Load Balancing with Weave on Amazon ECS
description: Weave Net & Weave Run provides a simpler way to run applications on the EC2 Container Service
tags: aws, load-balancing, dns, packer, ecs, amazon-linux, microservices
permalink: /guides/service-discovery-with-weave-aws-ecs.html
sidebarpath: /start/aws/awssd
sidebarweight: 60
---

## What You Will Build

[Amazon EC2 container service](http://aws.amazon.com/ecs/) or ECS is a scalable container management service that allows you to manage Docker containers on a cluster of Amazon EC2 instances. Weave provides a software network optimized for visualizing and communicating with apps distributed among Docker containers. Using tools and protocols that are familiar to you, Weave's network provides a way for you to communicate between containerized apps distributed across multiple networks or hosts more quickly and efficiently.

Weave simplifies setting up a container network within the Amazon EC2 Container Service. Because Weave uses standard ports, for example, you could expose MySQL port 3306 on the Weave network, managing containers is straight forward. In addition to using default TCP ports, Weave looks up IP addresses in DNS and works across hosts using only hostnames to find other containers without the need for custom code.

An advantage to using DNS is that when you set a hostname within a config file, you are not required to have a script in place to generate the hostname based on input variables. You can also optionally burn the config file with the hostname right into the container image.

With Weave there is no need to deploy extra services to achieve DNS lookup and load balancing. [Weave Run](http://weave.works/run/) takes care of both automatic service discovery and load balancing. Because these web services are already a part of Weave, there is no need to deploy and provision additional services, therefor reducing both overhead costs and resource complexity. Weave in essence saves you time and money, and lets you focus on app development, rather than your infrastructure design.


###About This Example

In this example you will use Weave for service discovery and load balancing
between [containers that have been deployed to Amazon Elastic Cloud (EC2) instances using Amazon Container Service or ECS](http://aws.amazon.com/ecs/).

Two types of containerized microservices are demonstrated in this guide: HTTP Servers and Data Producers.

![overview diagram](/guides/images/aws-ecs/overview-diagram.png)

The HTTP Servers serve data produced from the Data
Producers. This is a very common pattern in practise, but its implementation requires answers to the following questions:

1. Service discovery: How does an HTTP Server find a Data Producer to connect to?
2. Load balancing/fault tolerance: How can the HTTP Servers make uniform and efficient use of all the Data Producers available to them?

Weave solves these issues using the [weavedns service](http://docs.weave.works/weave/latest_release/weavedns.html), where it securely and transparently:

* Implements service discovery by adding DNS A-records for your containers based on
their names 
* Manages load balancing by randomizing the order of DNS responses.
* For more information about the weavedns service see [Automatic Discovery with weavedns](https://github.com/weaveworks/weave/blob/master/site/weavedns.md)

## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Amazon ECS](http://aws.amazon.com/ecs/)

## What You Will Need to Complete This Guide

This getting started guide is self contained. You will use Weave, Docker and Amazon ECS. We also make use of the [Amazon Web Services (AWS) CLI tool](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) to manage and access AWS.  You will need a valid [Amazon Web Services](http://aws.amazon.com) account, and have the AWS CLI setup and configured before working through this guide. Amazon provides extensive documentation on how to setup the [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-set-up.html).

* [Git](http://git-scm.com/downloads)
* [AWS CLI >= 1.7.35 ](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
* [bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell))
* An [SSH client](https://en.wikipedia.org/wiki/Comparison_of_SSH_clients) (optional)

This guide will take approximately 15 minutes to complete.

## Getting the Code

The code for this example is available on GitHub.

Clone the `weaveworks/guides` repository and then move to the `aws-ecs`
directory, from which you will be working throughout most of this guide.

~~~ bash
git clone http://github.com/weaveworks/guides
cd guides/aws-ecs
~~~

## AWS-CLI Configuration

Make sure AWS-CLI is set to use a region where Amazon ECS is available
(`us-east-1`, `us-west1`, `us-west-2`, `eu-west-1`, `ap-northeast-1` or `ap-southeast-2` at
the time of writing this guide). See [Regions & Endpoints documentation at Amazon Web Service](http://docs.aws.amazon.com/general/latest/gr/rande.html) for more information.

View AWS-CLI's configuration with

~~~bash
aws configure list
~~~

and modify it by running:

~~~bash
aws configure
~~~

Also, please make sure your AWS account has administrative privileges to be able
to configure this demonstration.

## Automatic Setup & Configuration

To configure the demonstration, run the following command:

~~~bash
./setup.sh
~~~

You will see output similar to the following:

    Creating ECS cluster (weave-ecs-demo-cluster) .. done
    Creating Security Group (weave-ecs-demo) .. Done
    Creating Key Pair (weave-ecs-demo, file weave-ecs-demo-key.pem) .. done
    Creating IAM role (weave-ecs-role) .. done
    Creating Launch Configuration (weave-ecs-launch-configuration) .. done
    Creating Auto Scaling Group (weave-ecs-demo-group) with 3 instances .. done
    Waiting for instances to join the cluster (this may take a few minutes) .. done
    Registering ECS Task Definition (weave-ecs-demo-task) .. done
    Launching (3) tasks .. done
    Waiting for tasks to start running .. done
    Setup is ready!
    Open your browser and go to any of these URLs:
      http://foo.region.compute.amazonaws.com
      http://bar.region.compute.amazonaws.com
      http://baz.region.compute.amazonaws.com


## What Just Happened?

The `setup.sh` script automatically:

* Created an Amazon ECS cluster named `weave-ecs-demo-cluster`
* Spawned three hosts (EC2 instances in Amazon's jargon), which are now part of
  the cluster and are based on Weave's ECS
  [AMI](https://en.wikipedia.org/wiki/Amazon_Machine_Image).
* Created an ECS task family definition that describes the HTTP Server and Data Producer containers.
* Spawned three tasks, one per host, resulting in an HTTP Server and a Data Producer container running on each host.

## Testing the Setup

The three URLs shown above communicates via your browser with the HTTP Server containers. Pick one of them (or all three of them if you like) and open them in your browser:

      http://foo.region.compute.amazonaws.com
      http://bar.region.compute.amazonaws.com
      http://baz.region.compute.amazonaws.com 

This is what you should see:

![httpserver's output](/guides/images/aws-ecs/httpserver.png)

Reload your browser to force the HTTP Server to refresh its Data Provider address list (generated randomly by `weavedns`), balancing the load between the EC2 instances.


## How Does Service Discovery and Load Balancing Work?

Both the HTTP Server and the Data Producer containers are very simple. They were implemented with a few lines of bash, using mostly Netcat.

Container `dataproducer`:

~~~bash
while true; do
  IP=`hostname -i | awk '{ print $1 }'`
  echo "Hi, this is the data producer in $IP" | nc -q 0 -l -p 4540
done
~~~

Container `httpserver`:

~~~bash
sleep 7 # Wait for data producers to start
  while true; do
  # Get a message from a data producer
  DATA_PRODUCER_MESSAGE=`nc dataproducer 4540`
  HTML="<html> <head> <title>Weaveworks Amazon ECS Sample App<\/title> <style>body {margin-top:   40px; background-color: #333;} <\/style> <\/head><body> <div style=color:white;text-align:center> <h1>Chosen data producer message:<\/h1> <h2>${DATA_PRODUCER_MESSAGE}<\/h2> <\/div>"
  echo "$HTML" | nc -q 0 -l -p 80
done
~~~

Note the source code shown above has been reformatted for clarity.


![ECS and Weave Diagram](/guides/images/aws-ecs/ecs+weave-diagram.png)

When ECS launches a container, the call to Docker is intercepted by weaveproxy,
and an address is assigned using weave's automatic IP allocation, then the container is registered with the weavedns service and it is attached to the weave network. Weavedns registers A-records based on the container's name:

* A `dataproducer` A-record for all the Data Producer containers.
* A `httpserver` A-record for all the HTTP Server container.

The Data Producer waits for requests on TCP port 4540 and it responds with a string containing its IP address.

The HTTP Server works as follows:

1. Contacts a Data Producer and obtains its message (`nc dataproducer 4540`). This
   implicitly does the load balancing due to weavedns' response randomization
   (more about this in the next section).
2. Composes HTML with the information obtained in (1) and (2).
3. Waits for a browser to connect.


## What's Happening in the Hosts?

All host are equipped with Weave Scope, providing an intuitive visualization of
all your containers and how the communicate with each other. Scope has a
webserver listening on port `4040` so, to access it, just open your browser and
paste the URL of any of your instances:

      http://foo.region.compute.amazonaws.com:4040
      http://bar.region.compute.amazonaws.com:4040
      http://baz.region.compute.amazonaws.com:4040

This is what you should see:

![Scope visualization](/guides/images/aws-ecs/scope.png)

You can get more insights by selecting different views: *Applications (by
name)*, *Containers by image* and *Hosts*.

If you want to dive even deeper on what's happening in the ECS instances, you can access
them through ssh:

~~~bash
    ssh -i weave-ecs-demo-key.pem ec2-user@${INSTANCE}
~~~

where `${INSTANCE}` can be any of your 3 instance hostnames
(`foo.region.compute.amazonaws.com`, `bar.region.compute.amazonaws.com` or
`baz.region.compute.amazonaws.com` in the `setup.sh` example listing above).

For example, to list the active running containers in the instance:

~~~bash
[ec2-user@ip-XXX-XXX-XXX-XXX ~]$ docker ps
~~~

Where you will see something similar to this:


    CONTAINER ID        IMAGE                            COMMAND                CREATED             STATUS              PORTS                                                                                            NAMES
    e2fe07ab4768        2opremio/weaveecsdemo:latest     "\"/w/w bash -c 'sle   7 minutes ago       Up 7 minutes        0.0.0.0:80->80/tcp                                                                               ecs-weave-ecs-demo-task-1-httpserver-9682f3b0cd868cd60d00
    42658f9eaef5        2opremio/weaveecsdemo:latest     "/w/w sh -c 'while t   7 minutes ago       Up 7 minutes                                                                                                         ecs-weave-ecs-demo-task-1-dataproducer-b8ecddb78a8fecfc3900
    18db610b28f7        amazon/amazon-ecs-agent:latest   "/w/w /agent"          8 minutes ago       Up 8 minutes        127.0.0.1:51678->51678/tcp                                                                       ecs-agent
    4221747c81e3        weaveworks/weaveexec:latest      "/home/weave/weavepr   8 minutes ago       Up 8 minutes                                                                                                         weaveproxy
    9457fff981b8        weaveworks/weave:latest          "/home/weave/weaver    8 minutes ago       Up 8 minutes        0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp, 172.17.42.1:53->53/tcp, 172.17.42.1:53->53/udp   weave


* Container `ecs-weave-ecs-demo-task-1-httpserver-9682f3b0cd868cd60d00` is the
  HTTP Server of this host, producing the output you saw in your browser.  Note
  how container names are mangled by ECS: 
  `ecs-${TASK_FAMILY_NAME}-${TASK_FAMILY_VERSION}-${STRIPPED_CONTAINER_NAME}-${UUID}`.

* Container `ecs-weave-ecs-demo-task-8-dataproducer-b8ecddb78a8fecfc3900` is the
  Data Producer of this host.

* Containers `weaveproxy` and `weave` are responsible for running
  Weave within each ECS instance. For illustration purposes, the proxy was shown out
  of Docker in the previous section's diagram, but in actual fact weaveproxy runs
  inside of Docker.

* Container `ecs-agent` corresponds to
  [Amazon's ECS Agent](https://github.com/aws/amazon-ecs-agent), which runs on
  all of the EC2 instances and is responsible for starting containers on behalf of Amazon ECS. Again, for
  simplification, the ECS Agent was represented out of Docker in the previous
  section's diagram.

View the IP addresses of the HTTP Servers and the Data Producers by running:

    [ec2-user@ip-XXX-XXX-XXX-XXX ~]$ export DOCKER_HOST=unix:///var/run/weave.sock # Use weave-proxy
    [ec2-user@ip-XXX-XXX-XXX-XXX ~]$ docker run 2opremio/weaveecsdemo dig +short httpserver
    10.36.0.3
    10.32.0.3
    10.40.0.2
    [ec2-user@ip-XXX-XXX-XXX-XXX ~]$ docker run 2opremio/weaveecsdemo dig +short dataproducer
    10.36.0.2
    10.32.0.2
    10.40.0.1

Re-running the commands listed above will vary the IP addresses. This is the weavedns service transparently balancing the load by randomizing the IP addresses, as the HTTP servers are connecting to Data Producers.

###Cleanup

To clean up this demonstration run:

~~~bash
./cleanup.sh
~~~

This script works even if something goes wrong while configuring the
demonstration (e.g. if `setup.sh` didn't finish due to missing AWS
permissions). If that was the case, `cleanup.sh` may output some errors when
trying to destroy resources which weren't created, you can simply disregard
them.

##Manual Setup

To manually reproduce what `./setup.sh` does
automatically:

**1. Create the ECS cluster**
  
~~~bash
aws ecs create-cluster --cluster-name weave-ecs-demo-cluster
~~~

**2. Create the security group and key pair**

Create the security group `weave-ecs-demo`

~~~bash
SECURITY_GROUP=$(aws ec2 create-security-group --group-name weave-ecs-demo --description 'Weave ECS Demo' --query 'GroupId' --output text)
~~~

Add inbound rules to the group to allow:

* Public SSH access.
* Public HTTP access.
* Private Weave access between instances.
* Public and private access to Weave Scope between instances.

~~~bash
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 4040 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 6783 --source-group weave-ecs-demo
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol udp --port 6783 --source-group weave-ecs-demo
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 4040 --source-group weave-ecs-demo
~~~

Next create a key pair which allows us to access any EC2 instances that are associated with this security group.

~~~bash
aws ec2 create-key-pair --key-name weave-ecs-demo-key --query 'KeyMaterial' --output text > weave-ecs-demo-key.pem
~~~

**3. Create the IAM role**

Create an IAM role for the Weave ECS instances 

~~~bash
aws iam create-role --role-name weave-ecs-role --assume-role-policy-document file://data/weave-ecs-role.json
aws iam put-role-policy --role-name weave-ecs-role --policy-name weave-ecs-policy --policy-document file://data/weave-ecs-policy.json
aws iam create-instance-profile --instance-profile-name weave-ecs-instance-profile
aws iam add-role-to-instance-profile --instance-profile-name weave-ecs-instance-profile --role-name weave-ecs-role
~~~

**4. Create a launch configuration**

Choose a Weave ECS AMI depending on your configured region:

* `us-east-1` -> `ami-81bedde4`
* `us-west-1` -> `ami-d54bb091`
* `us-west-2` -> `ami-57475567`
* `eu-west-1` -> `ami-476c4a30`
* `ap-northeast-1` -> `ami-4a7df34a`
* `ap-southeast-2` -> `ami-739dd149`


and then execute the command below by replacing `XXXX` with the AMI of your region.

~~~bash
AMI=XXXX aws autoscaling create-launch-configuration --image-id ${AMI} --launch-configuration-name weave-ecs-launch-configuration --key-name weave-ecs-demo-key --security-groups ${SECURITY_GROUP} --instance-type t2.micro --user-data file://data/set-ecs-cluster-name.sh  --iam-instance-profile weave-ecs-instance-profile --associate-public-ip-address --instance-monitoring Enabled=false
~~~

**5. Create an auto scaling group**

Create an Auto Scaling Group with 3 instances in the first subnet available in your region.

~~~bash
SUBNET=$(aws ec2 describe-subnets --query 'Subnets[0].SubnetId' --output text)
aws autoscaling create-auto-scaling-group --auto-scaling-group-name weave-ecs-demo-group --launch-configuration-name weave-ecs-launch-configuration --min-size 3 --max-size 3 --desired-capacity 3 --vpc-zone-identifier ${SUBNET}
~~~

**6. Register the task definition**

~~~bash
aws ecs register-task-definition --family weave-ecs-demo-task --container-definitions "$(cat data/weave-ecs-demo-containers.json)"
~~~

**7. Launch the demo tasks**

Before launching the demo task, confirm that 3 instances from the Auto
Scaling Group have joined the cluster. This should should occur shortly after
creating the Auto Scaling Group.

To confirm it, run the following command. Its output should show a `3` once all the instances have joined the cluster.

~~~bash
aws ecs describe-clusters --clusters weave-ecs-demo-cluster --query 'clusters[0].registeredContainerInstancesCount' --output text
~~~

You will launch 3 task instances, one per EC2
instance in the Auto Scaling Group.

~~~bash
aws ecs run-task --cluster weave-ecs-demo-cluster --task-definition weave-ecs-demo-task --count 3
~~~


##Known issues & limitations

* Auto Scaling Groups are required for ECS to work with Weave. If you create individual
  instances, they won't work be able to see each other due to how Weave finds peers in ECS.
* Due to the way ECS mangles container names at launch, Weave's service discovery
  only supports container names with alphanumeric characters
  (e.g. `httpserver` would be OK but `http-server` won't work due to the hyphen)


## For the advanced user: Build your own Weave ECS AMI


Clone the guides repository if you haven't done so yet and go to the `packer`
directory.

~~~bash
git clone http://github.com/weaveworks/guides
cd guides/aws-ecs/packer
~~~

Download an SFTP-enabled version of [Packer](https://www.packer.io/) to build
the AMI.

~~~bash
wget https://dl.bintray.com/2opremio/generic/packer-sftp_0.8.1_linux_amd64.zip
unzip packer-sftp_0.8.1_linux_amd64.zip -d ~/bin
~~~

Finally, invoke `./build-all-amis.sh` to build `Weave ECS` images for all
regions. This step installs (in the image) the version of ecs-init we just
built, AWS-CLI, jq, Weave/master, init scripts for Weave and it also updates the ECS
agent to use weaveproxy.

Customize the image by modifying `template.json` to match your
requirements.

~~~bash
AWS_ACCSS_KEY_ID=XXXX AWS_SECRET_ACCESS_KEY=YYYY  ./build-all-amis.sh
~~~

If you only want to build an AMI for a particular region, set `ONLY_REGION` to
that region when invoking the script:

~~~bash
ONLY_REGION=us-east-1 AWS_ACCSS_KEY_ID=XXXX AWS_SECRET_ACCESS_KEY=YYYY  ./build-all-amis.sh
~~~

##Conclusions

You have used Weave out-of-the-box within the Amazon Container Management service or ECS and used Weave for both service discovery and load
balancing between containers running in Amazon EC2 instances. Weave runs regardless of whether it was executed on the same or on different hosts, and can even run across completely different cloud providers if necessary. 

You can easily adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [email](mailto:help@weave.works) or [Twitter](https://twitter.com/weaveworks).

###Find Out More

* [Automatic Discovery with weavedns](https://github.com/weaveworks/weave/blob/master/site/weavedns.md)
* [Weave - Weaving Containers into Applications](https://github.com/weaveworks/weave)
* [Documentation Home Page](http://docs.weave.works/weave/latest_release/)
