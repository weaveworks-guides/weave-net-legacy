---
layout: guides
title: Enabling Weave Net Multicast In AWS 
description: How to use Weave Scope to monitor and visualize docker container clusters and swarms.
---


Weave Net is one of the few Docker container networking solutions that supports multicast networking. Since Weave Net fully emulates a layer 2 network, it operates just like a server that is attached to a standard Ethernet network. Weave Net multicast works even if the underlying network doesn’t support it, which is the case with Amazon Web Services (AWS) and Azure.  

With multicast, it is possible for a node to transmit its data once and then to have it delivered to multiple receivers in the same multicast group. Multicasting is used by software that generates and distributes data feeds to other applications.

This tutorial describes the following: 

1. Configuring an EC2 cluster with Weave Net and Weave Scope pre-installed onto it.
2. How to create a task definition for the EC2 cluster. 
3. Deploying the multicast demo as a service on the cluster.
4. Visualizing the multicast demo in Weave Cloud


##What You Will Use

* Weave Net and Multicast
* Cloud Formation Template
* EC2 Container Console
* Weave Cloud

This AWS CloudFormation template is the easiest way to get started with Weave Net and Weave Scope. CloudFormation templates provide developers and systems administrators a simple way to create a collection or a stack of related AWS resources, and allows you to provision and update them in an orderly and predictable fashion.

Use this specially created Weaveworks CloudFormation template to create an EC2 cluster with all of the resources you need, including Weave Net and Weave Scope.

Before launching the stack:

* Set up an Amazon Account if you don’t already have one.
* Create the Key Pairs. You will need to reference the name of the key pairs when you create the stack.
* Set up a [Weave Cloud](https://cloud.weave.works) account and obtain the cloud token
* Ready to launch Weave?  Click here to launch a stack to AWS:

[launch the weaveworks stack]


##Configuring the Stack

1. Enable ‘Specify an Amazon S3 template URL’ and then click Next.

[screen capture]

2. Enter a name for the stack, and then select the key pair that you generated, from the KeyName dropdown.

[screen capture]

3. The options dialog doesn’t require any input.

4. In the Confirmation dialog, enable the capabilities acknowledgement box and click 'Create'.

[screen capture]

The CloudFormation stack dashboard appears, where you can monitor the progress of the stack’s creation. It takes about 10-15 minutes to complete. Press refresh button in the top right corner to monitor its progress.

[screen capture]

Once the stack has been created, select the Outputs tab and look for the URL to Weave Cloud where you can visualize the demo app. However, before you can do that, you will first deploy the multicast app as a set of services to the ECS cluster you just created. 

Leave the stack creation window open and create a new tab for this next section. 

##Deploying the Multicast Demo to an EC2 Cluster

To deploy the multicast demo: 

1. Go to the EC2 Container Service console by clicking `services -> EC2 Container Service Console` where you will see something similar to the following:

[screen capture]

The cluster you just created with the AWS template appears under the Cluster group. Its name is appended with the name that you give your stack in step 2 during stack creation.

2. Create a task by clicking on `Task Definition` and then `Create New Task`. 

3. Give the task a name in the Task Definition field: 

[task-definition-screen-capture]()

4. Create the multicast containers from the docker image by clicking the `Create Container` button, where the following appears: 

[add-container-screencapture]

Fill in the following fields: 

 * Container Name -- Enter an arbitrary name for the container
 * Image -- Add `lmarsden/mlist`
 * Maximum Memory -- 300
 
For this demo, these are the only fields that need to be configured. Once complete, click `Add` 

Return to the top level `Task Definitions`, where you should see your newly created task in the list.

###Running Multicast Services in an ECS Cluster

Next, run the task you just created as a service in the cluster. For the purposes of this demo, you will run three instances of the service. 

1. Select the cluster that was created with the AWS Cloud Formation template. 
2. Click on Create to add a service: 

In this dialog, select the Task Definition you added, then give the service a name and assign the number of tasks to 3. Click `Create Service` and then `View Service`. Wait for the containers to spin up, when they've changed from PENDING to RUNNING before moving on to the next section. 


##Visualizing Multicast in Weave Cloud

To visualize the demo, launch Weave Cloud by returning to the Cloud Stack tab and copying the URL from the Outputs tab. 

[containers-multicast-screencapture]

Click on one of the containers to view its metrics: 

[metrics-multicast-screencast]

To view multicast in action, select the terminal button from the top of the metrics panel: 

[multicast-scope]

Click on some of the other containers and launch their terminals to view how all of the IP addresses are being discovered by each of the nodes as they broadcast data across the Weave network.

##Conclusions

In this tutorial, you deployed Weave Net and Weave Scope onto an ECS cluster using an AWS Cloudformation template. You then deployed three containers as services onto the cluster and visualized the result in Weave Cloud. 

If you have any questions or comments, we would be happy to hear from you, visit [Weave Help & Support](https://www.weave.works/help/) for information on contacting us. 

Further Reading: 

 * 





