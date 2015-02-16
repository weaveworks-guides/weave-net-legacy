# Getting started with Weave and Docker on Ubuntu #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure. 

In this example you will be creating a simple application running in a container on one host. Your service provides a json message containing hello world and a date - we call this your hello world service. In your second container, running on a seperate host, you use curl to query the hello world service.
 
## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Ubuntu](http://ubuntu.com)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker and Ubuntu, and we make use of Virtualbox and Vagrant to allow you to run the entire getting started guide on your personal system. 

* 15 minutes  
* [Git](http://git-scm.com/downloads)    
* [Virtualbox > 1.6](https://www.virtualbox.org/wiki/Downloads) 
* [Vagrant > 1.6](https://docs.vagrantup.com/v2/installation/index.html) 

## Setting up our hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

```
git clone http://github.com/fintanr/weave-gs   
```

You will use vagrant to setup and configure two Ubuntu hosts and install Docker. These hosts will be assigned ip addresses on a [private network](http://en.wikipedia.org/wiki/Private%5Fnetwork), and named weave-gs-01 and weave-gs-02. 

```
cd weave-gs/ubuntu-simple
vagrant up
```

Vagrant will pull down and configure an ubuntu image, this may take a few minutes depending on  the speed of your network connection. For more details on Vagrant please refer to the [Vagrant documentation](http://vagrantup.com). 

You may be prompted for a password when /etc/hosts is being updated during the Vagrant setup, please just hit return at this point. 

Once the setup of the hosts is complete you can check their status with

```
vagrant status
```

The IP addresses we use for this demo are

```
172.17.8.101 	weave-gs-01
172.17.8.102 	weave-gs-02
```

## Installing weave ##

Now you install weave on each host.  

```
vagrant ssh weave-gs-01 
sudo wget -O /usr/local/bin/weave https://github.com/zettio/weave/releases/download/latest_release/weave
sudo chmod a+x /usr/local/bin/weave

vagrant ssh weave-gs-02
sudo wget -O /usr/local/bin/weave https://github.com/zettio/weave/releases/download/latest_release/weave
sudo chmod a+x /usr/local/bin/weave
```

We provide the commands to install Weave as part of this getting started guide, but in practice you would automate 
this step.

## Using Weave ##

Next you start weave on each host in turn. 

On host weave-gs-01

```
sudo weave launch
```

On host weave-gs-02

```
sudo weave launch 172.17.8.101
```

Your two hosts are now connected to each other, and any subsequent containers you launch with weave will be visible to other containers
weave is aware of. 

### What has happened? ###

As this is the first time you have launched weave you

* downloaded a docker image for the weave router container
* launched that container

On your first host, weave-gs-01, you have launched a weave router container. On your second host, weave-gs-02, you launched another weave router container with the ip address of your first host. This command tells the weave on weave-gs-02 to peer with the weave on weave-gs-01.

At this point you have a single container running on each host, which you can see from docker. On either host run  

```
sudo docker ps
```

and you will see something similar to

```
CONTAINER ID        IMAGE                COMMAND                CREATED             STATUS              PORTS                                            NAMES
f975990040f1        zettio/weave:0.9.0   "/home/weave/weaver    7 minutes ago       Up 7 minutes        0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave   
```
You can see your peered network by using weave status

```
sudo weave status
```
```
weave router 0.9.0
Encryption off
Our name is 7a:42:86:2f:2c:c4
Sniffing traffic on &{10 65535 ethwe 66:cb:17:94:af:39 up|broadcast|multicast}
MACs:
Peers:
Peer 7a:42:86:2f:2c:c4 (v2) (UID 13774419172407657760)
   -> 7a:2e:1e:f1:e0:1a [172.17.8.101:6783]
Peer 7a:2e:1e:f1:e0:1a (v2) (UID 10517587287546927665)
   -> 7a:42:86:2f:2c:c4 [172.17.8.102:41754]
Routes:
unicast:
7a:42:86:2f:2c:c4 -> 00:00:00:00:00:00
7a:2e:1e:f1:e0:1a -> 7a:2e:1e:f1:e0:1a
broadcast:
7a:42:86:2f:2c:c4 -> [7a:2e:1e:f1:e0:1a]
7a:2e:1e:f1:e0:1a -> []
Reconnects:
```

## Our Hello World Service ##
 
Next you will use weave to run a docker image containing an apache webserver.  Details on how this container was created using docker are at the end of this getting started guide.

On weave-gs-01 run

```
sudo weave run 10.0.1.1/24 -t -i fintanr/weave-gs-simple-hw
```

At this point you have a running apache server in a docker container. 

### What has happened? 

Weave has launched a pre-built docker container containing an apache webserver, and assigned it an address of 10.0.1.1. The docker image you are using has been downloaded from the [Docker Hub](https://hub.docker.com/). 

The container is registered with weave and is accessible to other containers registered with weave across multiple hosts.  

### Creating our client container 

You now want to create a container on your second host and connect to the webserver in the container on our first host. Containers return a container id which you will capture to use further on in this example. On weave-gs-02 run

```
CONTAINER=`sudo weave run 10.0.1.2/24 -t -i ubuntu`
```

This installs the default ubuntu docker image. This image is sparse, and one of the tools you will be missing is [curl](http://curl.haxx.se/). To install this you will use apt-get in the normal way, as shown below. The ubuntu docker image you are using here is the same image that we based our Apache docker image on.

First attach to your docker container using the CONTAINER value we captured earlier

```
sudo docker attach $CONTAINER
```

```
apt-get install -qq curl
```

```
curl http://10.0.1.1
```

And you will see a json string similar too 

```
{
    "message" : "Hello World",
    "date" : "2015-02-16 15:02:57"
}
```

Now you can exit from the container. As you have finished the command that the container was running (in this case /bin/bash) the container also exits. 
## Summary ##

You have now used Weave to quickly deploy an application across two hosts using containers. 
 
## The Dockerfile ##

We have also included the Dockerfile we used for creating the fintanr/weave-gs-simple-hw docker image in our repo. While this is a very simple example it demonstrates how easy it is to create docker images.

```
FROM	ubuntu
MAINTAINER	fintan@weave.works
RUN	apt-get -y update 
RUN	apt-get -y install apache2
RUN	apt-get -y install php5 libapache2-mod-php5 php5-mcrypt
RUN 	sed -e "s/DirectoryIndex/DirectoryIndex index.php/" < /etc/apache2/mods-enabled/dir.conf > /tmp/foo.sed
RUN	mv /tmp/foo.sed /etc/apache2/mods-enabled/dir.conf
ADD	example/index.php /var/www/html/
CMD     ["/usr/sbin/apache2ctl", "-D FOREGROUND"] 
```

A quick explanation of the docker file

FROM - this is the image we have used as the basis for our image
MAINTAINER - the name and/or e-mail address of the maintainer of this image
RUN - a command or commands to run when creating the image
ADD - add a file to the docker image you are creating
CMD - a command or commands to run when the docker image is launched

As you can see here we are using the Ubuntu docker image as our basis, updating this image, installing and configuring apache2 and php. We then copy a new default apache page into place. Finally when a container is launched with this image we start an Apache webserver.

The Docker documentation provides a lot more detail on [building docker images](https://docs.docker.com/reference/builder/)

This Dockerfile has been placed in the /home/vagrant directory on each host you created earlier. As an experiment you could review the building docker images documentation and create your own Ubuntu docker image with curl already installed to avoid the extra install steps we went through above.
