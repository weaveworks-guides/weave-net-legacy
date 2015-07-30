---
title: Automated provisioning of multi-cloud weave network with Terraform
tags: terraform, coreos, cross-cloud, docker, elasticsearch, spark, usecase, aws, gce, tools, provisioning, guide
published: true
layout: guides
---

## Introduction
In this post I am going to describe how I used one of HashiCorp's latest tools — [Terraform](https://terraform.io/) — for deploying a weave network across two different cloud providers.

Terraform helps to answer some of provisioning-related questions our users have been asking: e.g. how weave peer nodes can be supplied with IP addresses of each other when the infrastructure is provisioned dynamically. In this example I am using [CoreOS](https://coreos.com/), but if you would like to see an implementation using some different flavour of Linux, please do let us know via a comment or [email](mailto:team@weave.works).

I will first outline the requirements in the context of [our latest demo](http://weaveblog.com/2014/12/03/using-weave-network-for-bigdata-elasticsearch-apache-spark/), then introduce the code with an overview of critical parts for bootstrapping weave nodes, then show how to plan and execute the infrastructure deployment.

This post documents a [simplified version](https://github.com/errordeveloper/weave-demos/tree/master/terraform-example) of the code I used to deploy [the demo stack](https://github.com/errordeveloper/weave-demos/tree/master/sparkles/cloud), in order to make it easier to reuse in a project of your own and easier to read through.

### Requirements
For our [latest demo](http://weaveblog.com/2014/12/03/using-weave-network-for-bigdata-elasticsearch-apache-spark/), which shows how weave enables a [secure](http://zettio.github.io/weave/how-it-works.html#crypto) cross-cloud deployment of ElasticSearch and Apache Spark, I needed to get up and running in two different clouds quickly and be able to re-provision my infrastructure repeatedly in minutes. I could have written a Ruby or Python script using one of the commonly used libraries (e.g. [fog](http://fog.io/) or [boto](https://boto.readthedocs.org/en/latest/)), however I'm pretty sure I would end-up writing quite a lot more procedural code and it wouldn't appear as descriptive as Terraform configurations; I do believe DSLs are made for a reason.

### What needs to happen?

I need to provision 3 instances in GCE and 3 in AWS. I'm using CoreOS images provided by each of the cloud vendors. I'll set up the GCE instances first, where weave nodes will join each other using native DNS resolution. I then need to make sure the inbound SSH ports (22) are exposed on all of 6 VMs. On each of the GCE instances I also need to have a static IP and expose inbound weave port (6783), to which the weave nodes from AWS are going to connect. The diagram below illustrates the order in which weave peer connections are going to be initialised.

![connections](https://weaveblogdotcom.files.wordpress.com/2014/12/connections1.png?w=440)

So, if I were to provision the VMs manually and then launch the network, the sequence would look like so:

*   On the first VM in GCE:
	`weave launch`
*   On the 2nd and 3rd GCE VMs, use private DNS hostname:
	`weave launch weave-gce-0`
*   And on each of the AWS VMs,  pass external IPs of all of the CGE instances:
	`weave launch $IP_VM1 $IP_VM2 $IP_VM3`

### How to do it with Terraform

With Terraform, I simply declare what types of resources I need and how many of each. From one resource I can refer to another, e.g. in a most typical use-case one would create a few VMs and a load-balancer associated with those, then create or update a DNS record. In my case I'm going to refer IPs of GCE machines to a provisioning script on each of the AWS machines. Additionally, I have to ensure that the firewalls are configured correctly.

#### Code Layout

Terraform input files are called _configurations_. I always make sure there is at least a minimum structure to the code, so I have split my configurations into 4 files:

*   [`infra/main.tf`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/infra/main.tf) — main configuration of cloud resources
*   [`infra/outputs.tf`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/infra/outputs.tf) — utility to print IP addresses of instances being created
*   [`infra/providers.tf`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/infra/providers.tf) — AWS and GCE credentials
*   [`infra/variables.tf`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/infra/variables.tf) — declarations of all variables used in the configurations that use may chose to override

The most interesting part you want to look at is in [`infra/main.tf`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/infra/main.tf); the rest of the configurations serve auxiliary purposes.

There are few more files that are used for provisioning:

*   [`cloud-config.yaml`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/cloud-config.yaml) — Cloud Config data to customised CoreOS
*   [`genenv.sh`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/genenv.sh) — environment file generator for systemd units

The [`infra/main.tf`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/infra/main.tf) configuration contains comments which document each significant step and you should be able to follow it; however I would like to explain the provisioning process in more detail here.

### Provisioning

In a [previous post](http://weaveblog.com/tag/coreos+guide/), I was relying on the fact that the hostnames are easy to control, but while in GCE that's the case, in AWS it turns out to be somewhat non-trivial and for me it was easier to ignore the EC2 VMs' hostnames. Hence the units which require hosts-specific configuration could no longer refer to `EnvironmentFile=/etc/weave.%H.env` (where `%H` expands to full hostname). The simplest solution was to generate environment files with a shell script, and then start the service after that.

So firstly, there is Cloud Config phase which writes systemd unit definitions and only starts two host-independent units — [`pre-fetch-container-images.service`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/cloud-config.yaml#L50-L61) and [`install-weave.service`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/cloud-config.yaml#L29-L48). It's passed in as `metadata['user-data']` for GCE instances and as `user_data` for AWS instances.

Secondly, I need to upload the [`genenv.sh`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/genenv.sh) script. Running this script will generate `/etc/weave.env` file, based on the arguments passed to it.

The output looks similar to this on one of the GCE machines:

    WEAVE_LAUNCH_KNOW_NODES="weave-gce-0"
    WEAVE_LAUNCH_PASSWORD="xxx"
    WEAVE_LAUNCH_DNS_ARGS="10.10.2.12/16"

And like this on one of the AWS machines:

    WEAVE_LAUNCH_KNOW_NODES="146.148.39.91 107.178.208.144 146.148.78.107"
    WEAVE_LAUNCH_PASSWORD="xxx"
    WEAVE_LAUNCH_DNS_ARGS="10.10.2.20/16"

This environment file is consumed by [`weave.service`](https://github.com/errordeveloper/weave-demos/blob/a843a5c/terraform-example/cloud-config.yaml#L14-L27) unit, and once it is generated, it's ready to be launched with `systemctl start weave`. Let's take a look at how this final step is implemented.

For the GCE instances this is how environment generator is called:

    provisioner "remote-exec" {
         inline = [
             "sudo sh /tmp/genenv.sh gce ${count.index} '${var.weave_launch_password}'",
             "sudo systemctl start weave",
         ]
         connection { /* ... */ }
        }
    }

And for the AWS instances, as said above, I'll pass all 3 IPs I have for the GCE nodes:

    provisioner "remote-exec" {
         inline = [
             "sudo sh /tmp/genenv.sh aws ${count.index} '${var.weave_launch_password}' ${join(" ", google_compute_instance.weave.*.network.0.external_address)}",
             "sudo systemctl start weave",
         ]
         connection { /* ... */ }
    }

It's important to note that by referencing `.network.0.external_address` attribute, Terraform sees an implicit dependency and thereby the GCE VMs will be created first.

> **Note:**

> The `genenv.sh` script effectively defines the topology of weave network. Personally, I don't think that this is the best way to describe our network, however it's currently the simplest way with Terraform. If it were able [to render templates](https://github.com/hashicorp/terraform/issues/642), one could implement writing of such file in a nicer way with fewer lines of code, hence potentially less error-prone, but it's not something Terraform implements at the moment. Alternatively, I could render this with a different tool/language, but that would require you to possibly install additional tools, so I chose to use a shell script to avoid that.

### Adapting the example

Please first clone the git repository and change to `terraform-example` sub-directory:

    git clone https://github.com/errordeveloper/weave-demos
    cd weave-demos/terraform-example

Now, download the terraform binaries for your OS from _[terraform.io/downloads.html](https://terraform.io/downloads.html)_, and unzip to `terraform-bin` in your working directory.

> **Note:** For your reference, I was using version _v0.3.5_ at the time of writing.

    mkdir terraform-bin
    cd terraform-bin
    unzip ~/Downloads/terraform_*.zip # you might need to adjust the path
    ./terraform version # should print the version
    cd ..

Now you need to collect the auth credentials from either of cloud providers.

> **Note:**
> 
> * For AWS API access, you will need [to obtain](https://terraform.io/docs/providers/google/index.html) access and secret keys and pass them to the Terraform commands shown below.
> * For GCE, you will need to obtain two JSON files, as described in [Terraform documentation](https://terraform.io/docs/providers/google/index.html) and save those as `account.json` and `client_secrets.json` in your current working directory (i.e. `weave-demos/terraform-example`). You also need to provide your Google Cloud project name.

Once you have collected all of the required credentials, let's create a file called `input.tfvars`. This is how the contents of this file would look like:

    aws_access_key = "AKIAJDG5WH3HBFIEGKWQ"
    aws_secret_key = "9gb0y8Cd3OSS3fTr5sxLK5wD8iHwOCduKAy4q3lW"
    gce_project_name = "foo-bar-123"
    weave_launch_password = "b470f2b1f"

> **Note:** The above creds are dummy and will not work. Please make sure to use your own.

One of truly great features is `terraform plan` command, not only it tells you what you are about to do, but it is also a good test to find out if give auth credentials are correct.


    ./terraform-bin/terraform plan -var-file=tfvars ./infra/

If all is well, this should produce output that describes what resources are going to be created.

Additionally you can generate a graph that would show the the order of resource decencies.

    ./terraform-bin/terraform graph ./infra/ \
       | dot -T png > infra.png

![infra](https://weaveblogdotcom.files.wordpress.com/2014/12/terrainfra-gce-aws2.png)

And now you can realise the plan by running:

    ./terraform-bin/terraform apply -var-file=tfvars ./infra/

Once done, you should see output that looks like this
     
    ...
    Apply complete! Resources: 9 added, 0 changed, 0 destroyed.
    
    The state of your infrastructure has been saved to the path
    below. This state is required to modify and destroy your
    infrastructure, so keep it safe. To inspect the complete state
    use the `terraform show` command.
    
    State path: terraform.tfstate
    
    Outputs:
    
      aws_instances = AWS instances:
     - ec2-54-72-209-171.eu-west-1.compute.amazonaws.com
     - ec2-54-154-92-123.eu-west-1.compute.amazonaws.com
     - ec2-54-154-91-8.eu-west-1.compute.amazonaws.com
      gce_instances = GCE instances:
     - 173.255.119.160
     - 146.148.41.228
     - 130.211.163.159

If you login to any of the machines and run `sudo weave status` you should see 6 peers participating in the network. You can now deploy your application containers to the cross-cloud weave network.

If you would like to see how to extend on top of this and provision some complex applications, take a look at the code that realises [full demo](https://github.com/errordeveloper/weave-demos/tree/master/sparkles/cloud) as seen in [screencast I posted earlier](https://www.youtube.com/watch?v=BSY9rnK9QBs).

You'll need to cleanup first:

    ./terraform-bin/terraform plan \
        -destroy -out=kill.tfstate \
        -var-file=tfvars ./infra/
    ./terraform-bin/terraform apply kill.tfstate

Now deploy the full demo by running:

    cd ../sparkles/cloud/
    ./terraform-bin/terraform apply \
        -var-file=../../terraform-example/tfvars ./infra/

Once done, you can login to any of the machines and run:

    weave expose 10.10.1.101/24
    curl 10.10.1.20:9200/_cat/nodes

This should output a list of six ElasticSearch nodes, which are all part of multicloud cluster you have just setup.

    elasticsearch-gce-1.weave.local 10.10.1.21 4 18 0.00 d m Hank McCoy  
    elasticsearch-aws-1.weave.local 10.10.1.41 6  8 0.00 d m Mister Buda 
    elasticsearch-aws-2.weave.local 10.10.1.42 6  8 0.00 d m Legacy      
    elasticsearch-aws-0.weave.local 10.10.1.40 6  8 0.00 d m Outlaw      
    elasticsearch-gce-2.weave.local 10.10.1.22 3 18 0.04 d m D-Man       
    elasticsearch-gce-0.weave.local 10.10.1.20 5 17 0.03 d * Ramshot

Stay tuned for more details!


## Conclusion

In this post I have shown one of the solution to provisioning weave-enabled infrastructure in two different clouds. I walked through the most critical aspects of the implementation and demonstrated how to adopt the example, indicating the direction for next steps.

I find the declarative paradigm of describing infrastructure truly powerful. Terraform is still in a rather early phase of development, nevertheless it worked brilliantly well for me.

I hope you will find this interesting and use it as a basis for an amazing project. Do make sure to follow [@weavenetwork](https://twitter.com/weavenetwork), and keep an eye on this blog for future posts. If you would like to talk to us about your use case for weave or, simply have any question about it, do drop us a line to [help@weave.works](mailto:help@weave.works), tweet or join the #weavenetwork Freenode IRC channel.

