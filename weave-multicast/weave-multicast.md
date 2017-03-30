---
layout: guides
title: Enabling Weave Net Multicast In AWS 
description: How to use Weave Cloud to visualize multicast.
---


Weave Net is one of the few Docker container networking solutions that supports multicast networking. Since Weave Net fully emulates a layer 2 network, it operates just like a server that is attached to a standard Ethernet network. Running multicast in Weave Net works even if the underlying network doesn’t support it, which is the case with Amazon Web Services (AWS) and Azure.

With multicast, it is possible for a node to transmit its data once and then to have it delivered to multiple receivers in the same multicast group. Multicasting is used by software that generates and distributes data feeds to other applications, such as financial services.

This tutorial runs a multicast demo in an ECS cluster created by an AWS CloudFormation template.  You will then visualize the end result in Weave Cloud. 

The following topics are described: 

* [What You Will Use](#what-use)
* [Launching the AWS CloudFormation Template](#launching-AWS)
* [Creating the Stack](#the-stack)
* [Deploying the Multicast Demo to an EC2 Cluster](#multicast-demo)
   * [Running Multicast Services in an ECS Cluster](#running-multicast)
* [Visualizing Multicast in Weave Cloud](#visualize-multicast)

## <a name="what-use"></a>What You Will Use

* [Weave Net](https://www.weave.works/docs/net/latest/installing-weave/) and [Multicast](https://www.weave.works/docs/net/latest/features/)
* AWS CloudFormation Template
* EC2 Container Console
* The [Weave Cloud](https://cloud.weave.works) token obtained after you've signed up. 

## <a name="launching-AWS"></a>Launching the AWS CloudFomation Templates

This AWS CloudFormation template is the easiest way to get started with Weave Net and Weave Cloud. CloudFormation templates provide a simple way to create a collection or a stack of related AWS resources, and allows you to provision and update them in an orderly and predictable fashion.

Use this specially created Weaveworks CloudFormation template to create an EC2 cluster with all of the resources you need, including Weave Net and Weave Scope pre-installed onto an ECS Cluster.

### Before You Begin

Before launching the CloudFormation template:

* [Set up an Amazon Account](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/get-set-up-for-amazon-ec2.html)
* [Create the Key Pairs](http://docs.aws.amazon.com/gettingstarted/latest/wah/getting-started-prereq.html). You will need to reference the name of the key pairs when you create the stack.
* Set up a [Weave Cloud](https://cloud.weave.works) account and [obtain the cloud token](https://www.weave.works/guides/using-weave-scope-cloud-service-to-visualize-and-monitor-docker-containers/).

**Ready to launch a stack?  Click here to launch a stack to AWS:**

[![](../images/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/new?templateURL=https:%2F%2Fs3.amazonaws.com%2Fweaveworks-cfn-public%2Fintegrations%2Fecs-baseline.json)


## <a name="the-stack"></a>Creating the Stack

1. Enable the ‘Specify an Amazon S3 template URL’ option and then click `Next`.
 ![](https://github.com/weaveworks/guides/blob/master/images/muticast/AWS-1-select-template.png)
2. Enter a name for the stack. 
3. This template also comes with an additional sample app, called 'Hit Counter'. It is not required for the multicast demo, so select `No`.  
4. Select the key pair that you generated for your AWS Region.
![](https://github.com/weaveworks/guides/blob/master/images/muticast/AWS-2-specify-details-parameters.png)
5. Add the Weave Cloud token into the WeaveScopeCloudService token field and click `Next`.
4. The options dialog doesn’t require any input, so just click `Next`.
5. In the Confirmation dialog, enable the capabilities acknowledgement box and then click `Create`.

![](https://github.com/weaveworks/guides/blob/master/images/muticast/AWS-4-create-stack.png)

The CloudFormation stack dashboard appears, where you can monitor the progress of the stack’s creation. It takes about 10-15 minutes to complete. Press the refresh button in the top right corner to monitor its progress.

Once the stack has been created, you can go back to [Weave Cloud](https://cloud.weave.works) where you can visualize the demo app. However, before you can do that, you need to deploy the multicast app as a set of services to the ECS cluster you just created. 

## <a name="multicast-demo"></a>Deploying the Multicast Demo to an EC2 Cluster

To deploy the multicast demo: 

Go to the EC2 Container Service console by clicking `Services -> EC2 Container Service Console` where you will see something similar to the following:

![](https://github.com/weaveworks/guides/blob/master/images/muticast/create-stack.png)

The cluster you just created with the AWS template appears under the Cluster group. Its name is prepended with the name that you gave your stack in step 2 during stack creation.

1. Create a task by clicking on `Task Definition` and then `Create New Task`. 
2. Give the task a name in the Task Definition field.
3. Create the multicast containers from the docker image by clicking the `Create Container` button, where the following appears: 

![](https://github.com/weaveworks/guides/blob/master/images/muticast/add-container.png)

Fill in: 

 * Container Name -- A name for the container
 * Image -- Add the repository and the app `lmarsden/mlist`
 * Maximum Memory -- 500
 * CPU -- 100
 
For this demo, these are the only fields that need to be configured. Once complete, click `Add` 

Return to the top level `Task Definitions`, where you should see your newly created task in the list.

### <a name="running-multicast"></a>Running Multicast Services in an ECS Cluster

Next, run the task you just created as a service in the cluster. For the purposes of this demo, you will run three instances of the service. 

1. Select the cluster that was created with the AWS Cloud Formation template. 
2. Click on `Create` to add a service: 

![](https://github.com/weaveworks/guides/blob/master/images/muticast/create-service.png)

![](https://github.com/weaveworks/guides/blob/master/images/muticast/service-name-definition-instances.png)

Select the Task Definition you just created, then give the service a name and assign the number of tasks to 3. Click `Create Service` and then `View Service`. Wait for the containers to spin up, when they've changed from PENDING to RUNNING, before moving on to the next section. 


## <a name="visualize-multicast"></a>Visualizing Multicast in Weave Cloud

To visualize the demo, log in to Weave Cloud and click View Instance:

![](https://github.com/weaveworks/guides/blob/master/images/muticast/containers-multicast.png)

Click on one of the containers to view its metrics: 

![](https://github.com/weaveworks/guides/blob/master/images/muticast/metrics-multicast.png)

To view multicast in action, select the terminal button from the controls located on the top of the metrics panel: 

![](https://github.com/weaveworks/guides/blob/master/images/muticast/metrics-multicast.png)

Click on some of the other containers and launch their terminals to view how all of the IP addresses are being discovered by each of the nodes as they broadcast data across the Weave network.

## Conclusions

In this tutorial, you deployed Weave Net and Weave Scope onto an ECS cluster using an AWS Cloudformation template. You then deployed three containers as services onto the cluster and visualized the result in Weave Cloud. 

If you have any questions or comments, we would be happy to hear from you, visit [Weave Help & Support](https://www.weave.works/help/) for information on how to contact us. 

**Further Reading:**

 * [Weave Net Features](https://www.weave.works/docs/net/latest/features/)
 * [Microservice Deployment to ECS with Weave Net](https://www.weave.works/guides/service-discovery-and-load-balancing-with-weave-on-amazon-ecs-2/)





