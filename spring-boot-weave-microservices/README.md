---
layout: guides
title: Networking and Monitoring Containerized Spring Boot Microservices with Weave Net and Weave Scope
shorttitle: Networking and Monitoring Containerized Spring Boot Microservices with Weave Net and Weave Scope
description: Using Weave Net and Weave Scope to network and monitor your microservices.
tags: ubuntu, spring-boot, microservices, weave 
permalink: /guides/language/java/framework/spring/microservices-weave-net-and-scope.html
sidebarpath: /start/microservices/spring-weave-net-scope
sidebarweight: 55
---

This guide demonstrates how you can use Weave Scope to visualize a collection of dockerized microservices running on two Virtual Machines all networked using Weave Net. 

The application built in this microservices architecture example is a user registration management system. Users register through a web front-end by entering an email and an associated password. 

The backend user registration service exposes a single RESTful endpoint for registering users. The registration request contains the user’s email address and password, which is sent to the Mongo database, and if the email address is not already present, then it notifies [RabbitMQ,](https://www.rabbitmq.com/download.html) who then notifies [Eureka](https://github.com/netflix/eureka) (an Open Source Registration service developed by Netflix) to include it in the registry. 

![User Registration Application Flow Across Two VMs](/guides/images/spring-boot-microservices/containerized-microservices-spring-boot.png)

>**Note:** The application code in this example is adapted from Chris Richardson's excellent discussion and tutorial on microservices architecture. For information on how this application is built, see [**Building microservices with Spring Boot – part 1**](http://plainoldobjects.com/2014/04/01/building-microservices-with-spring-boot-part1/) and [**Building Microservices with Spring Boot --part 2**](http://plainoldobjects.com/2014/05/05/building-microservices-with-spring-boot-part-2/)

The code used in this guide has been pre-compiled into docker images and uploaded to the Weaveworks repository on Dockerhub. 

A Vagrant file is provided for convenience. This script provisions two Ubuntu Virtual Machines (VMs) on VirtualBox and it also pulls down all of the necessary container images.

This guide requires no programming, and depending on the speed of your network, will take about 20 minutes to complete. 

##What You Will Use

* [Weave](http://weave.works)
* [Weave Scope](http://weave.works/scope/index.html)
* [Docker](http://docker.com)
* [Spring Boot](http://projects.spring.io/spring-boot/)
* [Netflix/Eureka](https://github.com/netflix/eureka)
* [RabbitMQ](https://www.rabbitmq.com/download.html)
* [Mongo NoSQL Database](https://www.mongodb.org/)


##Before You Begin

Ensure that the following are installed and configured for your operating system before you start:

* [Vagrant]( https://docs.vagrantup.com/v2/installation/)
* [Virtualbox]( https://www.virtualbox.org/)


##Getting The Code

To begin this guide, clone the git directory and cd to the `spring-boot-weave-microservices` directory:

~~~bash
git clone https://github.com/weaveworks/guides

cd spring-boot-weave-microservices
~~~


##Setting Up The Virtual Machines and Pulling the Docker Images

Running the Vagrant script creates two Ubuntu VMs on VirtualBox and then pulls the necessary docker images used in this guide as well as the latest versions of Docker and Weave Net from Dockerhub. 

Once you’ve changed to the `spring-boot-weave-microservices` directory run the vagrant script by typing: 

~~~bash
vagrant up
~~~

When the script is complete, view the status of the VMs: 

~~~bash
vagrant status
~~~

where you should see the following: 

~~~bash
weave-microservice-02     running (virtualbox)
weave-microservice-01     running (virtualbox)
~~~

The IP Addresses used for the VMs are as follows: 

weave-microservice-01: 172.17.8.102

weave-microservice-02: 172.17.8.101


##Launching a Weave Container Network and Peering The Virtual Machines

In this section you will launch Weave Net onto both VMs, and to create a peer connection, the IP address of one VM will be passed to the other VM. 

ssh onto `weave-microservice-01`: 

~~~bash
vagrant ssh weave-microservice-01
~~~

And then launch Weave Net: 

~~~bash
vagrant@weave-microservice-01:~$ weave launch
~~~

Set the environment for Weave: 

~~~bash
vagrant@weave-microservice-01:~$ eval $(weave env)
~~~

Now do the same for the other VM, but this time pass the IP of `weave-microservices-01` to `weave-microservice-02` during `weave launch`. 

In a new terminal window:

~~~bash
vagrant ssh weave-microservice-02
~~~

Launch Weave Net onto the VM: 

~~~bash
vagrant@weave-microservice-02:~$ weave launch 172.17.8.102
~~~

Set the environment for Weave: 

~~~bash
vagrant@weave-microservice-02:~$ eval $(weave env)
~~~

>**Important!** If you exit the VM terminal and then return to it, remember to restore Weave's environment. You can do this by running: `weave env --restore` 

Check that the VMs are peered: 

~~~bash

vagrant@weave-microservice-01:~$ weave status

        Version: 1.4.1

        Service: router
       Protocol: weave 1..2
           Name: 4e:fa:13:6e:48:c7(weave-microservice-01)
     Encryption: disabled
  PeerDiscovery: enabled
        Targets: 0
    Connections: 1 (1 established)
          Peers: 2 (with 2 established connections)
 TrustedSubnets: none

        Service: ipam
         Status: ready
          Range: 10.32.0.0-10.47.255.255
  DefaultSubnet: 10.32.0.0/12

        Service: dns
         Domain: weave.local.
       Upstream: 10.0.2.3
            TTL: 1
        Entries: 3

        Service: proxy
        Address: unix:///var/run/weave/weave.sock

        Service: plugin
     DriverName: weave
~~~


##Launching Weave Scope

Next you will install `Weave Scope` and use it to view your microservices application as it gets deployed onto the Weave Network.  

For `Weave Scope` to function properly, the application must be launched onto both VMs:  

~~~bash
sudo wget -O /usr/local/bin/scope \
  https://github.com/weaveworks/scope/releases/download/latest_release/scope
sudo chmod a+x /usr/local/bin/scope
sudo scope launch
~~~

Display `Weave Scope` in your browser using the URL that was presented to you in the terminal window after the application has finished launching. In this guide, Scope uses the following URLs: `http://172.17.8.101:4040/` or `http://172.17.8.102:4040/`


##Viewing Peered Virtual Machines in Weave Scope

With both `Weave Net` and `Weave Scope` launched, go to `Weave Scope`in your browser to view the peered VMs. A line between the two nodes indicates a connection has been made, and if you mouse over one of the nodes all connections with that node will highlight. You will see a better example of this highlighting once the entire microservices application has been deployed. 

![Two Peered VMs](/guides/images/spring-boot-microservices/two-peered-vms.png)

You can use `Weave Scope` to monitor the communications of the different microservices as they are being deployed throughout this guide. 

##Deploying the Microservices to Docker Containers

The microservices are split up between the two VMs. On `weave-microservice-01`, the docker images for the web front-end service and the registration manager were pulled. 

These include: 

 * Restful Service
 * The Web App
 * Eureka

And on `weave-microservices-02` the back-end services were pulled: 

 * RabbitMQ
 * MongoDB

###Deploying Containers onto weave-microservice-02

You will deploy the backend microservices onto `weave-microservice-02` first. 

An explanation of the docker run commands is beyond the scope of this guide. For more information on their use, refer to [Docker Run Commands documentation](https://docs.docker.com/engine/reference/commandline/run/)

>**Note:** Before running the docker commands, ensure that the weave environment is set. If you have left the terminal, you must enter `weave env --restore` before deploying the containers.

To deploy the containers to the VM run the following docker commands for each service: 

**RabbitMQ Service**

~~~bash
docker run -d --name=rabbitMQ weaveworks/rabbitmq /docker-entrypoint.sh rabbitmq-server
~~~

**mongoDB Service** 

~~~bash
docker run -d --name=mongoDB weaveworks/mongo /entrypoint.sh mongod --smallfiles
~~~

###Viewing the RabbitMQ and MondoDB Containers in Scope

Go back to Weave Scope in your browser to visualize and view metrics on the recently deployed services. As you can see the Mongo database, and RabbitMQ are standing by waiting for instructions. They are not connected yet because we haven't yet deployed Eureka (the User Management Service) or the Restful Services.

Click on the RabbitMQ container to view its metrics:

![RabbitMQ and MongoDB Deployed to Containers](/guides/images/spring-boot-microservices/backend-containers.png)


###Deploying Containers onto weave-microservice-01

Next, deploy the front-end and the Eureka service on `weave-microservices-01` by running the following docker commands for each service:

**Eureka Service**

~~~bash
docker run -d --name=eureka weaveworks/eureka java -jar /app.jar
~~~


**Restful Service**

~~~bash
docker run -d --name=restful-service weaveworks/microservice_apps java -DSPRING_RABBITMQ_HOST=rabbitmq -Dspring.data.mongodb.uri=mongodb://mongodb/userregistration -jar /app/spring-boot-restful-service.jar --spring.profiles.active=enableEureka --eureka.client.serviceUrl.defaultZone=http://eureka:8761/eureka/
~~~

**The Web Appr**

~~~bash
docker run -d -p 8080:8080 --name=webapp-register weaveworks/microservice_apps java -Duser_registration_url=http://REGISTRATION-SERVICE:8081/user -jar /app/spring-boot-webapp.jar --spring.profiles.active=enableEureka --eureka.client.serviceUrl.defaultZone=http://eureka:8761/eureka/
~~~

After launching the Web app, the RESTful service and Eureka service into containers on `weave-microservice-01` return to Weave Scope, where you can visualize and monitor the microservices discovering each other. Once discovery is complete all of the services should be in communication with one another, as observed in `Weave Scope`.

>Note: RabbitMQ may not be connected right away. It connects when the first registration request has been made, which is illustrated in a later section of this guide. 

![All Containers Deployed and Communicating](/guides/images/spring-boot-microservices/all-containers-communicating.png)

###Viewing the DNS Entries with Weave

The containerized microservices were deployed onto Weave Net without making any changes to the code base and without having to link ports between containers. 

Weave Net automatically discovers containers on the network and adds a DNS entry using the name of the container and the `weave.local` domain to give any container on a weave network a fully qualified domain name. For example, mongoDB is referred to as: `mongoDB.weave.local`. 

To view the container DNS entries made by Weave: 

~~~bash
weave status dns
~~~

which if executed on `weave-microservices-01` shows the following: 

~~~bash
eureka       10.32.0.2       52f915802e92 4e:fa:13:6e:48:c7
mongoDB      10.40.0.2       77e4f19a9217 9e:e7:55:5a:ec:70
rabbitMQ     10.40.0.1       cf0e60e68c60 9e:e7:55:5a:ec:70
restful-service 10.32.0.3    21347514dedb 4e:fa:13:6e:48:c7
scope        10.0.2.15       e49020094d92 4e:fa:13:6e:48:c7
scope        10.32.0.1       e49020094d92 4e:fa:13:6e:48:c7
scope        172.17.8.102    e49020094d92 4e:fa:13:6e:48:c7
scope        10.0.2.15       a96b8ea7a154 9e:e7:55:5a:ec:70
scope        10.40.0.0       a96b8ea7a154 9e:e7:55:5a:ec:70
scope        172.17.8.101    a96b8ea7a154 9e:e7:55:5a:ec:70
webapp-register 10.32.0.4    a2c19c69fe45 4e:fa:13:6e:48:c7 
~~~


##Visualizing User Registration with Weave Scope

With the containers deployed, and all in communication with one another, you are ready to test the application.  Open the following URL in your browser: `http://127.0.0.1:8080/register.html` where you should see a registration page.

![Testing the Microservices App](/guides/images/spring-boot-microservices/email-registration.png)

To ensure that your message reached the correct destination, go back to Weave Scope, click on RESTful Service container, and then open the terminal view. The terminal view is launched by clicking the control button furthest left.

Enter an email address and a password in the browser, and wait for the message to appear in the Terminal view of Weave Scope.  Notice that the RESTful service has processed and passed on the message to the system. 

![RESTful, RabbitMQ and Eureka Communicating](/guides/images/spring-boot-microservices/restful-rabbit-eureka.png)

Display the terminal window of other containers, and add a new email to see what messages appear. 

>**Note:** You can also stop, pause and restart containers to troubleshoot communication errors in your app. 

## Cleaning up the VMs

To clean up the VMs from your machine: 

~~~bash
vagrant destroy
~~~


## Conclusions

You have used Weave Net to create a container network out of a set of microservices illustratrating a User Registration service. You also used Weave Scope to visualize and monitor the micoservices as they were being deployed and also used it to monitor and test interactions within your application. 

Thank-you to Chris Richardson, who graciously let us use his code. For more information on this application and on microservices in general, see Chris Richardson's blog, [Plain Old Objects](http://plainoldobjects.com/)

## Further Reading

* [Documentation Home Page](http://docs.weave.works/weave/latest_release/)
* [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
* [Weave encryption](http://docs.weave.works/weave/latest_release/features.html#security)
* [Weave DNS](http://docs.weave.works/weave/latest_release/weavedns.html)