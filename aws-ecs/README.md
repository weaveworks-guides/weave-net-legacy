
# Weaving together Amazon EC2 Container Service #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will be ...

![Weave and Docker](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/Simple_Weave.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Amazon ECS](http://aws.amazon.com/ecs/)
* [Packer](https://www.packer.io/) and Aminator

## What you will need to complete this guide ##

An AWS account.

## Build the Weave ECS AMI ##

All of the code for this example is available on github, and you first clone the guides repository.

```bash
git clone http://github.com/weaveworks/guides
```

Next, use packer to build the AMI.  This step installs (in the image) the awscli, jq, weave, init scripts for weave and updates the ECS agent to use Weave proxy.

```bash
wget https://dl.bintray.com/mitchellh/packer/packer_0.8.0_linux_amd64.zip
unzip packer_0.8.0_linux_amd64.zip -d ~/bin
packer build -var 'aws_access_key=YOUR ACCESS KEY' -var 'aws_secret_key=YOUR SECRET KEY' template.json
```

### What has happened? ###


## Setup ECS Cluster ##

IAM Role:

```
"ecs:ListClusters",
"ecs:ListContainerInstances",
"ecs:DescribeContainerInstances",
"ec2:DescribeInstances"
````

## Summary ##

