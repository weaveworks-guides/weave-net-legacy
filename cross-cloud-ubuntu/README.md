# Running a Cluster between your own machine and Amazon Web Services using Weave and Docker #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example we will demonstrate how Weave allows you deploy a
simple PHP/MySQL application in containers, with the PHP running at
[Amazon Web Services](http://aws.amazon.com) and MySQL running on your
home machine, with no modifications to the application and minimal
docker knowledge.

The scenario is: you want to run a web server in a container, out in
the cloud, talking to a database in another container, back in your
home datacentre. You're going to use weave to network up the two
containers.

![Pithy Caption](https://weaveblogdotcom.files.wordpress.com/2014/10/overview2.png)

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Apache](http://httpd.apache.org/)
* [Ubuntu](http://ubuntu.com)
* [Amazon Web Services](http://aws.amazon.com)
* [PostgreSQL](http://www.postgresql.org)

## What you will need to complete this guide ##

This getting started guide is self-contained. You will use Weave,
Docker, Apache, Ubuntu and Amazon Web Services. We make use of the
[Amazon Web Services (AWS) CLI
tool](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
to manage and access AWS.  You will need to have a valid [Amazon Web
Services](http://aws.amazon.com) account, and the AWS CLI setup and
configured before working through this getting started guide. Amazon
provide an extensive guide on how to setup the [AWS
CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-set-up.html).

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [AWS CLI > 1.7.12 ](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
* [VirtualBox > 4.3.20](https://www.virtualbox.org/wiki/Downloads)
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html)

## Setting up our host and AWS instance ##

All of the code for this example is available on github, and you first clone the getting started repository.

```bash
git clone http://github.com/weave/guides
```

First, you will use Vagrant to setup and configure an Ubuntu host and
install Docker. This host will be assigned an IP address on a [private
network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named
`weave-gs-01`.

```bash
cd guides/cross-cloud-ubuntu
vagrant up
```

Next, you will use the AWS CLI to setup and configure an AWS EC2
instance. For the purposes of this this getting started guide you
will use the smallest available instance, t1.micro. We provide a
script to set up your initial environment with Weave and Docker,
installed on Ubuntu.

If you would like to manually work through these steps, and for further details on the script, please refer to the _**Manual 
install on AWS section**_ at the end of this guide.

If you get errors regarding the AMI, please set your preferred Ubuntu AMI value is the environment variable `AWS_AMI`.

```bash
./demo-aws-setup.sh
```

This script will generate quite a lot of output, but once it is
completed you will have an aws instance, running Ubuntu, with Weave
and Docker installed. You will need the IP addresses of this instance
to complete the rest of this guide. It is stored in a file
`weavedemo.env` which we create during the execution of the
`demo-aws-setup.sh`.

By setting the container name, our postgres instance will be
registered with weaveDNS as dbserver.weave.local. This will be in the
local domain of our webapp. When PHP connects to dbserver, weaveDNS
will take care of resolving that address to our postgres container.

## Starting our example ##

To start the example run the script `launch-cross-cloud-demo.sh`. This will 

* launch Weave and WeaveDNS
* launch one container on AWS running an Apache instance with our simple PHP site
* launch one container on our local Vagrant host running Postgres

```bash
./launch-cross-cloud-demo.sh
```

## Testing the service ##

There is a small file `checkdb.php` inside the Apache container to let
you check that it is working.

Take the IP address of your AWS instance - it's printed out at the end
by the launch script, e.g. 54.154.252.55, and then you can use curl,
or a web browser, to call up the checkdb file:

```bash
curl http://54.154.252.55/checkdb.php
Connected to Postgres version PostgreSQL 9.4.4 on x86_64-unknown-linux-gnu, compiled by gcc (Debian 4.7.2-5) 4.7.2, 64-bit
```

### What has happened?

Weave has launched one container from a pre-built Docker image with an
Apache webserver, and another running a Postgres database.  The Apache
server is running on an AWS VM, and the database is running on a VM on
your own machine.

Using `curl`, you have run some PHP code inside the Apache container
that connects over the weave network to the database running on your
own machine.

## Summary ##

You have now used Weave to deploy an application across two hosts in
widely-separated locations using containers.
