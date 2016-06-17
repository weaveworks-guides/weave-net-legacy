---
layout: guides

shorttitle: Service Discovery & Load Balancing on Amazon ECS
title: The fastest path to Docker on ECS: microservice deployment on Amazon EC2 Container Service with Weave Net
description: Weave Net & Weave Run provides a simpler way to run applications on the EC2 Container Service
tags: aws, load-balancing, dns, packer, ecs, amazon-linux, microservices, weave scope
permalink: /guides/service-discovery-with-weave-aws-ecs.html
sidebarpath: /start/aws/awssd
sidebarweight: 25
---


[Amazon EC2 container service](http://aws.amazon.com/ecs/) is a scalable container management service that allows you to manage Docker containers on a cluster of Amazon EC2 instances. Weave Net provides a simple and robust software-defined network for apps running as Docker containers that does not require a external database (cluster store). Weave simplifies setting up a container network within the Amazon EC2 Container Service. Because Weave allows each container to use standard port numbers -- for example you can expose MySQL on port 3306 -- managing services is straightforward. Every container can find the IP of any other container using a simple DNS query on the container's name, and communicate directly without NAT or complicated port mapping.

An advantage to using DNS is that when you use a container name within (say) a config file, you are not required to have a script in place to generate the name based on run-time variables. You can also optionally burn the config file with the hostname right into the container image.

There is no need to deploy extra services to achieve DNS lookup and load balancing. Weave Net takes care of both automatic service discovery and load balancing, reducing overhead and complexity. Weave saves you time and money, and lets you focus on app development rather than your infrastructure design.

###About This Example

This guide takes approximately 15 minutes to complete: you will use Weave for service discovery and load balancing
between [containers that have been deployed to Amazon Elastic Cloud (EC2) instances using Amazon Container Service or ECS](http://aws.amazon.com/ecs/). 

This guide also introduces [Weave Scope](http://weave.works/scope/index.html), and [Weave Cloud](https://cloud.weave.works) which enables you to visualize and understand your container-based microservices.

Two types of containerized microservices are demonstrated in this guide: HTTP Servers and "Data Producers".

![overview diagram](/guides/images/aws-ecs/overview-diagram.png)

Data producers generically model containers that produce a data feed of some kind. The HTTP Servers present a web interface to the data from the Data Producers. This is a very common pattern in distributed systems, but its implementation requires answers to the following questions:

1. Service discovery: How does an HTTP Server find a Data Producer to connect to?
2. Load balancing/fault tolerance: How can the HTTP Servers make uniform and efficient use of all the Data Producers available to them?

Weave solves these issues using its built-in DNS server, where it securely and transparently:

* Implements service discovery by adding DNS A-records for your containers based on
their names.
* Manages load balancing by randomizing the order of DNS responses.

For more information about the weavedns service see [Automatic Discovery with weavedns](https://github.com/weaveworks/weave/blob/master/site/weavedns.md)

## What You Will Use

* [Weave](http://weave.works)
* [Weave Scope](http://weave.works/scope/index.html)
* [Docker](http://docker.com)
* [Amazon ECS](http://aws.amazon.com/ecs/)

## Before You Begin

We will make use of the [Amazon Web Services (AWS) CLI tool](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) to manage and access AWS.  You need a valid [Amazon Web Services](http://aws.amazon.com) account, and also have the AWS CLI set up and configured before working through this guide. Please ensure your AWS account has the appropriate administrative privileges. Amazon provides extensive documentation on how to set up the [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-set-up.html).

* [Git](http://git-scm.com/downloads)
* [AWS CLI >= 1.7.35 ](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
* [bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell))
* An [SSH client](https://en.wikipedia.org/wiki/Comparison_of_SSH_clients) (optional)

## Getting the Code

The code for this guide is available on GitHub. Clone the `weaveworks/guides` repository and then change to the `aws-ecs`
directory, from which you will be working throughout most of this guide.

~~~ bash
git clone https://github.com/weaveworks/guides
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

and then modify it by running:

~~~bash
aws configure
~~~


## Obtain a Weave Cloud Service Token (Recommended)

To visualize this example with the Weave Cloud service, you will need to obtain a Weave Cloud service token.
 
To gain access, sign up at [Weave Cloud](http://cloud.weave.works). An email will be sent to you with further login instructions. 

Login into Weave Cloud and click the settings icon in the top right hand corner to obtain the cloud service token:

![Weave Cloud main page](/guides/images/aws-ecs/weave-cloud-main-page.png)

## Automatic Setup and Configuration

To configure this example, run the following command:

~~~bash
./setup.sh $SCOPE_TOKEN
~~~

where, 

* `$SCOPE_TOKEN` is an optional argument corresponding to your Weave Cloud
service token.

You should see something like this:

~~~bash
    Creating ECS cluster (weave-ecs-demo-cluster) .. done
    Creating VPC (weave-ecs-demo-vpc) .. done
    Creating Subnet (weave-ecs-demo-subnet) .. done
    Creating Internet Gateway (weave-ecs-demo) .. done
    Creating Security Group (weave-ecs-demo) .. done
    Creating Key Pair (weave-ecs-demo, file weave-ecs-demo-key.pem) .. done
    Creating IAM role (weave-ecs-role) .. done
    Creating Launch Configuration (weave-ecs-launch-configuration) .. done
    Creating Auto Scaling Group (weave-ecs-demo-group) with 3 instances .. done
    Waiting for instances to join the cluster (this may take a few minutes) .. done
    Registering ECS Task Definition (weave-ecs-demo-task) .. done
    Creating ECS Service with 3 tasks (weave-ecs-demo-service) .. done
    Waiting for tasks to start running .. done
    Setup is ready!
    Open your browser and go to any of these URLs:
      http://foo.region.compute.amazonaws.com
      http://bar.region.compute.amazonaws.com
      http://baz.region.compute.amazonaws.com
~~~

## What Just Happened?

The `setup.sh` script automatically:

* Created an Amazon ECS cluster named `weave-ecs-demo-cluster`
* Spawned three hosts (EC2 instances), which are now part of
  the cluster and are based on Weave's ECS
  [AMI](https://en.wikipedia.org/wiki/Amazon_Machine_Image).
* Created an ECS task family definition that describes the HTTP Server and "Data Producer" containers.
* Spawned three tasks, one per host, resulting in an HTTP Server and a Data Producer container running on each host.

## Testing the Setup

The three URLs shown above communicate via your browser with the HTTP Server containers. Pick one of them (or all three, if you like) and open them in your browser:

      http://foo.region.compute.amazonaws.com
      http://bar.region.compute.amazonaws.com
      http://baz.region.compute.amazonaws.com 

This is what you should see:

![httpserver's output](/guides/images/aws-ecs/httpserver.png)

Reload your browser to force the HTTP Server to refresh its Data Provider address list, balancing the load between the EC2 instances.


## How Do Service Discovery and Load Balancing Work?

Both the HTTP Server and the Data Producer containers are very simple. They were implemented with a few lines of bash, using Netcat.

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

>*Note:* the source code shown above has been simplified and reformatted for clarity.


![ECS and Weave Diagram](/guides/images/aws-ecs/ecs-weave-diagram.png)

When ECS launches a container, the call to Docker is intercepted by Weave's Docker API proxy,
and an address is assigned using Weave's automatic IP allocator. The container is then registered with the Weave DNS service and attached to the Weave network. Weave Net's DNS registers A-records based on the container's name:

* A `dataproducer` A-record for all the Data Producer containers.
* A `httpserver` A-record for all the HTTP Server container.

The Data Producer waits for requests on TCP port 4540 and responds with a string containing its IP address.

The HTTP Server works as follows:

1. Contacts a Data Producer and obtains its message (`nc dataproducer 4540`). This
   implicitly does the load balancing due to weavedns' response randomization
   (more about this in the next section).
2. Composes HTML with the information obtained in (1) and (2).
3. Waits for a browser to connect.


## What's Happening in the Hosts?

[`Weave Scope`](http://weave.works/scope/) provides a real-time visualization of the containers running on the Weave network and also an overview of how they communicate with each other.

* If you provided a `$PROBE_TOKEN` to `setup.sh`, simply login to [https://cloud.weave.works](https://cloud.weave.works)
* As an alternative, if you did not provide a token, all of your ECS instances will still be running equipped with a `Weave Scope`
  web application listening on port `4040` (this solution does have some
  performance and administration issues compared to using the Weave Cloud service, but it
  is more than sufficient for demonstration purposes).

  To access it,  open your browser and paste the `Weave Scope` application URL from any of your instances:

~~~bash
      http://foo.region.compute.amazonaws.com:4040
      http://bar.region.compute.amazonaws.com:4040
      http://baz.region.compute.amazonaws.com:4040
~~~

This is what you should see with `Weave Scope` when accessing one of the HTTP Servers multiple
times (i.e. reloading `http://foo.region.compute.amazonaws.com` in your browser
multiple times).

![Scope visualization](/guides/images/aws-ecs/scope.png)

Click the `httpserver` container to display its details.

Note that the edges between one of the `httpserver` containers (the one
accessed from your browser) and the three `dataproducer` containers, reflect
the load balancing scheme that we built using the `weavedns` service.

More insights into the Weave network can be gleaned by selecting different views: *Applications (by
name)*, *Containers by image* and *Hosts*.

To dig even deeper on what's happening in the ECS instances, access
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

~~~bash
    CONTAINER ID     IMAGE                            COMMAND                CREATED           STATUS           PORTS                          NAMES
    a67655146b5b     2opremio/weaveecsdemo:latest     "\"/w/w bash -c 'set   7 minutes ago     Up 7 minutes     0.0.0.0:80->80/tcp             ecs-weave-ecs-demo-task-1-httpserver-a2bad7f8f792f185f901
    eeb53274c26b     2opremio/weaveecsdemo:latest     "/w/w sh -c 'while t   7 minutes ago     Up 7 minutes                                    ecs-weave-ecs-demo-task-1-dataproducer-dec2b39a92e0edb1aa01
    8af86be1dd18     amazon/amazon-ecs-agent:latest   "/w/w /agent"          8 minutes ago     Up 8 minutes     127.0.0.1:51678->51678/tcp     ecs-agent
    693ef5ae00cb     weaveworks/weaveexec:v1.1.0      "/home/weave/weavepr   8 minutes ago     Up 8 minutes                                    weaveproxy
    86b6019c3995     weaveworks/weave:v1.1.0          "/home/weave/weaver    8 minutes ago     Up 8 minutes                                    weave
    190afc5cd56b     weaveworks/scope:latest          "/home/weave/entrypo   8 minutes ago     Up 8 minutes                                    weavescope
~~~

* Container `ecs-weave-ecs-demo-task-1-httpserver-a2bad7f8f792f185f901` is the
  HTTP Server of this host, producing the output you saw in your browser.  Note
  how container names are mangled by ECS: 
  `ecs-${TASK_FAMILY_NAME}-${TASK_FAMILY_VERSION}-${STRIPPED_CONTAINER_NAME}-${UUID}`.

* Container `ecs-weave-ecs-demo-task-1-dataproducer-dec2b39a92e0edb1aa01` is the
  Data Producer of this host.

* Containers `weaveproxy` and `weave` are responsible for running
  Weave within each ECS instance. For illustration purposes, the proxy was shown out
  of Docker in the previous section's diagram, but in actual fact `weaveproxy` runs
  inside of Docker.

* Container `weavescope` is responsible for running `Weave Scope` and for monitoring each instance.

* Container `ecs-agent` corresponds to
  [Amazon's ECS Agent](https://github.com/aws/amazon-ecs-agent), which runs on
  all of the EC2 instances and is responsible for starting containers on behalf of Amazon ECS.   For simplification, the ECS Agent was represented out of Docker in the previous
  section's diagram.

View the IP addresses of the HTTP Servers and the Data Producers by running:

~~~bash
    [ec2-user@ip-XXX-XXX-XXX-XXX ~]$ eval $(weave env) # Use weave-proxy
    [ec2-user@ip-XXX-XXX-XXX-XXX ~]$ docker run 2opremio/weaveecsdemo dig +short httpserver
    10.36.0.3
    10.32.0.3
    10.40.0.2
    [ec2-user@ip-XXX-XXX-XXX-XXX ~]$ docker run 2opremio/weaveecsdemo dig +short dataproducer
    10.36.0.2
    10.32.0.2
    10.40.0.1
~~~

Re-running these commands vary the IP addresses. This is the `weavedns` service transparently balancing the load by randomizing the IP addresses, as the HTTP servers are connecting to Data Producers.

###Cleanup

To clean up this demonstration run:

~~~bash
./cleanup.sh
~~~

This script will work even if something has gone wrong while configuring the
demonstration (for example, if `setup.sh` didn't finish due to missing AWS
permissions). If this was the case, `cleanup.sh` may output errors while it is
trying to destroy resources, which weren't created. Simply disregard them.

##Manual Setup

To manually reproduce what `./setup.sh` does automatically:

**1. Create the ECS cluster**
  
~~~bash
aws ecs create-cluster --cluster-name weave-ecs-demo-cluster
~~~

**2. Create a Virtual Private Cloud**

Create a VPC, which is necessary for creating `t2.micro` instances.

~~~bash
VPC_ID=$(aws ec2 create-vpc --cidr-block 172.31.0.0/28 --query 'Vpc.VpcId' --output text)
~~~

Enable DNS to get nice FQDNs for your instances.

~~~bash
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
~~~

Tag the VPC to enable automatic deletion with the `cleanup.sh`.

~~~bash
aws ec2 create-tags --resources $VPC_ID --tag Key=Name,Value=weave-ecs-demo-vpc
~~~

**3. Create a subnet**

Create a subnet to enable networking in your instances.

~~~bash
SUBNET_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 172.31.0.0/28 --query 'Subnet.SubnetId' --output text)
~~~

Tag the subnet to enable automatic deletion with the `cleanup.sh`.

~~~bash
aws ec2 create-tags --resources $SUBNET_ID --tag Key=Name,Value=weave-ecs-demo-subnet
~~~

**4. Create an Internet Gateway**

Create an Internet Gateway so that you can access your EC2 instances externally.

~~~bash
GW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
~~~

Attach the gateway to the VPC and ensure that the gateway is used as the destination of the default route.

~~~bash
aws ec2 attach-internet-gateway --internet-gateway-id $GW_ID --vpc-id $VPC_ID
TABLE_ID=$(aws ec2 describe-route-tables --query 'RouteTables[?VpcId==`'$VPC_ID'`].RouteTableId' --output text)
aws ec2 create-route --route-table-id $TABLE_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $GW_ID
~~~

Tag the gateway to enable automatic deletion with the `cleanup.sh` script.

~~~bash
aws ec2 create-tags --resources $GW_ID --tag Key=Name,Value=weave-ecs-demo
~~~

**5. Create the security group and key pair**

Create the security group `weave-ecs-demo` in the VPC as we created a few steps above.

~~~bash
SECURITY_GROUP_ID=$(aws ec2 create-security-group --group-name weave-ecs-demo --vpc-id $VPC_ID --description 'Weave ECS Demo' --query 'GroupId' --output text)
~~~

Add inbound rules to the group to allow:

* Public SSH access (tcp port 22).
* Public HTTP access (tcp port 80).
* Private Weave access between instances:
    * tcp port 6783 for data.
    * udp port 6783 for control in sleeve mode.
    * udp port 6784 for control in [fastdp](/documentation/net-1.5-features#fast-data-path) mode.
* Public and private access to Weave Scope between instances (tcp port 4040) . This is Only needed when not using Scope 'Cloud').

~~~bash
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 4040 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 6783 --source-group $SECURITY_GROUP_ID
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol udp --port 6783 --source-group $SECURITY_GROUP_ID
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol udp --port 6784 --source-group $SECURITY_GROUP_ID
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 4040 --source-group $SECURITY_GROUP_ID
~~~

Next create a key pair which allows us to access any EC2 instances that are associated with this security group.

~~~bash
aws ec2 create-key-pair --key-name weave-ecs-demo-key --query 'KeyMaterial' --output text > weave-ecs-demo-key.pem
~~~

**6. Create the IAM role**

Create an IAM role for the Weave ECS instances.

~~~bash
aws iam create-role --role-name weave-ecs-role --assume-role-policy-document file://data/weave-ecs-role.json
aws iam put-role-policy --role-name weave-ecs-role --policy-name weave-ecs-policy --policy-document file://data/weave-ecs-policy.json
aws iam create-instance-profile --instance-profile-name weave-ecs-instance-profile
aws iam add-role-to-instance-profile --instance-profile-name weave-ecs-instance-profile --role-name weave-ecs-role
~~~

**7. Create a launch configuration**

Check
[Weave's latest ECS AMIs](https://github.com/weaveworks/integrations/tree/master/aws/ecs#weaves-ecs-amis) and choose an AMI depending on your configured region.

Set the AMI variable, replacing `XXXX` with the AMI of your region.

~~~bash
AMI=XXXX
~~~

Initialize the instance User Data script.

~~~bash
cp /data/set-ecs-cluster-name.sh ./user-data.sh
~~~

Optionally (if you would like to use Scope 'Cloud' and you are participating in the Early
Access program), add your Scope 'Cloud' service token to the User Data. Run the following
command, replacing `XXXX` with your Scope 'Cloud' service token.


~~~bash
echo "SCOPE_AAS_PROBE_TOKEN=XXXX" >> ./user-data.sh
~~~

~~~bash
aws autoscaling create-launch-configuration --image-id $AMI --launch-configuration-name weave-ecs-launch-configuration --key-name weave-ecs-demo-key --security-groups $SECURITY_GROUP_ID --instance-type t2.micro --user-data file://user-data.sh  --iam-instance-profile weave-ecs-instance-profile --associate-public-ip-address --instance-monitoring Enabled=false
~~~

**8. Create an Auto Scaling Group**

Create an Auto Scaling Group using 3 instances available in the first subnet of your region.

~~~bash
aws autoscaling create-auto-scaling-group --auto-scaling-group-name weave-ecs-demo-group --launch-configuration-name weave-ecs-launch-configuration --min-size 3 --max-size 3 --desired-capacity 3 --vpc-zone-identifier $SUBNET_ID
~~~

**9. Register the task definition**

~~~bash
aws ecs register-task-definition --family weave-ecs-demo-task --container-definitions "$(cat data/weave-ecs-demo-containers.json)"
~~~

**10. Create the demo service**

Before launching the demo task, confirm that 3 instances from the Auto
Scaling Group have joined the cluster. This should occur shortly after
creating the Auto Scaling Group.

To confirm it, run the following command. Its output should show a `3` once all the instances have joined the cluster.

~~~bash
aws ecs describe-clusters --clusters weave-ecs-demo-cluster --query 'clusters[0].registeredContainerInstancesCount' --output text
~~~

You will create an ECS Service with 3 tasks, one per EC2
instance in the Auto Scaling Group.

~~~bash
aws ecs create-service --cluster weave-ecs-demo-cluster --service-name  weave-ecs-demo-service --task-definition weave-ecs-demo-task --desired-count 3
~~~


##Known Issues and Limitations

* Auto Scaling Groups are required for ECS to work with Weave. If you create individual
  instances, they will not work and won't be able to see each other due to how Weave finds peers in ECS.

## For the Advanced User: Build Your Own Weave ECS AMI

If you need to incorporate changes to the Weave AMI, you can do so by following [these steps](https://github.com/weaveworks/integrations/tree/master/aws/ecs#creating-your-own-customized-weave-ecs-ami).


##Conclusions

You have used Weave out-of-the-box within the Amazon Container Management service or ECS and used Weave for both service discovery and load balancing between containers running in Amazon EC2 instances. In addition to this, you were introduced to Weave Cloud for visualizing and monitoring a Weave container network. 

Weave runs regardless of whether it was executed on the same or on different hosts, and can even run across completely different cloud providers if necessary.

You can easily adapt these examples and use them as a templates in your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).

###Further Reading

* [Automatic Discovery with weavedns](https://github.com/weaveworks/weave/blob/master/site/weavedns.md)
* [Weave - Weaving Containers into Applications](https://github.com/weaveworks/weave)
* [Documentation Home Page](/docs)
