---
layout: guides
shorttitle: Weave & AWS with Ansible
title: Deploying a containerized app with Weave on AWS using Ansible
description: How to deploy a containerized app using Weave on Amazon Web Services using Ansible
tags: ansible, haproxy, aws, ubuntu, php
permalink: /guides/weave-ansible-docker-haproxy-aws.html
sidebarpath: /start/aws/awsans
sidebarweight: 30
---

In this example we will demonstrate how Weave allows you to quickly and easily deploy HAProxy as
a load balancer for a simple PHP application running in containers on multiple nodes in [Amazon
Web Services](http://aws.amazon.com), with no modifications to the application and minimal docker
knowledge.

You will use Weave and Ansible to:

1. Launch two EC2 instances with Weave and Docker installed on Ubuntu
2. Start a number of containers on each EC2 instance and place a HAProxy container in front of them
3. You will then connect to your public facing HAProxy container.

This example requires no programming and takes about 15 minutes to complete. 

![Weave and Docker](/images/2_Node_HAProxy_AWS_Example.png)

## What You Will Use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ansible](http://ansible.com)
* [HAProxy](http://haproxy.org)
* [Apache](http://httpd.apache.org)
* [Ubuntu](http://ubuntu.com)
* [Amazon Web Services](http://aws.amazon.com)

## Before You Begin ##

You will need to have a valid [Amazon Web Services](http://aws.amazon.com) (AWS) account and also know your AWS acess key id and secret. Please refer to [AWS Identity and Access Management documentation](http://docs.aws.amazon.com/IAM/latest/UserGuide/IAM_Introduction.html#IAM-credentials-summary) for details on how to retrive your credentials. If you already installed the [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-set-up.html) these details will be accesible to Ansible.

You will need to have [Ansible installed](http://docs.ansible.com/intro_installation.html). Interacting with AWS via Ansible also requires [boto](http://docs.pythonboto.org/en/latest/), which provides a Python interface to AWS.

* [Git](http://git-scm.com/downloads)
* [Ansible >= 1.8.4](http://docs.ansible.com/intro_installation.html)

It may be helpful to have the [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) installed, but this is optional.

* [AWS CLI > 1.7.12 ](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)

## Configuring and Setting up Your Instances ##

All of the code for this example is available on [github](http://github.com/weaveworks/guides). To begin, clone getting started repository.

    git clone http://github.com/weaveworks/guides
    cd guides/weave-ansible-haproxy-aws

### AWS Regions ###

The ansible playbook associated with this guide use the `eu-west-1` region by default, and an [AMI](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html) from the same region. You can change the region and AMI to your preferred option by calling `./check-region.sh -r <your region>`.

Alternatively if you have the [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) installed you can call `./check-region.sh` which will select an AMI in your region.

In both cases this will create a file `ansible_aws_variables.yml` which our Ansible playbook will use. You can also edit this file directly and put in your choosen region and AMI.

    cat ansible_aws_variables.yml
    ---
    aws_region: eu-west-1
    template: ami-799e100e

## Using Ansible to setup your EC2 instances ##

You will use one of the two Ansible playbooks provided to

* Create a private key
* Create a security group
* Launch two EC2 instances and install Docker and Weave onto each of these instances

You execute this by calling

    ansible-playbook setup-weave-ubunu-aws.yml

This ansible playbook will take four to five minutes to complete. When you execute this playbook you will get output similar to what you can see at this [gist](https://gist.github.com/fintanr/4d6bb5bbc92f4b1197a5).


## What Just Happened ##

You have created a private key for use with AWS and a security group, weavedemo, to run your instances in.
You have then started two EC2 instances with Ubuntu, updated your image and installed Docker and Weave.

## Using Ansible and Weave to Launch The Containerized App ##

You will use the second Ansible playbook provided to

* Launch Weave onto on each EC2 instance
* Launch a set of containers containing a simple webapp
* Launch HAProxy as a load balancer in front of your webapp


    ansible-playbook launch-weave-haproxy-aws-demo.yml

This ansible playbook takes a few minutes to deploy. When you execute this playbook you will get output similar to what you can see at this [gist](https://gist.github.com/fintanr/a53febe129fea9219ef0).

## What has happened ##

`Weave Net` was launched on to each EC2 instance and created a container network between the hosts.
You then used `Weave` to launch three docker containers on to each EC2 instance running our simple PHP application, followed by launching HAProxy.

## Connecting to your application ##

You can connect to the application directly using the curl commands below, or alternatively you can use the
included script `access_aws_hosts.sh`. This script will make six calls to the HAProxy instance to cycle through
all of the web application containers you have started.

    ./access_aws_hosts.sh

Which will give you output similar too

    Connecting to HAProxy with Weave on AWS demo
    {
        "message" : "Hello Weave - HAProxy Example",
        "hostname" : "ws1.weave.local",
        "date" : "2015-03-13 11:23:12"
    }

    {
        "message" : "Hello Weave - HAProxy Example",
        "hostname" : "ws4.weave.local",
        "date" : "2015-03-13 11:23:12"
    }
    
    {
        "message" : "Hello Weave - HAProxy Example",
        "hostname" : "ws5.weave.local",
        "date" : "2015-03-13 11:23:12"
    }
    
    {
        "message" : "Hello Weave - HAProxy Example",
        "hostname" : "ws2.weave.local",
        "date" : "2015-03-13 11:23:12"
    }
    
    {
        "message" : "Hello Weave - HAProxy Example",
        "hostname" : "ws3.weave.local",
        "date" : "2015-03-13 11:23:12"
    }
    
    {
        "message" : "Hello Weave - HAProxy Example",
        "hostname" : "ws6.weave.local",
        "date" : "2015-03-13 11:23:12"
    }

### Connecting Directly With Curl ###

You can also connect to your HAProxy instance directly with Curl.

    AWS_PUBLIC_IP=$(grep public_ip inventory | cut -d"=" -f2)
    curl $AWS_PUBLIC_IP

    {
        "message" : "Hello Weave - HAProxy Example",
        "hostname" : "ws1.weave.local",
        "date" : "2015-03-13 11:25:30"
    }

##Conclusions ##

You have used Weave, Docker and Ansible to deploy a load balanced application with HAProxy on AWS.

## Credits ##

The Ansible playbook used here was based on the work of [Sebastien Goasguen](http://sebgoa.blogspot.com/) in his [ansible-rancher playbook](https://github.com/runseb/ansible-rancher).
