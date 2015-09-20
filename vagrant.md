---
permalink: /guides/vagrant.html
title: How We Use Vagrant In These Guides
layout: guides
shorttitle: Vagrant & These Guides
description: Using Vagrant and Weave.
sidebarpath: /start/vagrant
sidebarweight: 5
---



[Vagrant](https://www.vagrantup.com/) is a great product developed by our friends at [HashiCorp](https://hashicorp.com/). It allows
you to automate provisoning of VirtualBox VMs, and enables rapid prototyping of infrastructure or subsets of it using a very simple Ruby-based DSL. Vagrant works with VMWare, with KVM, and also provides plugins to integrate with a number of public cloud providers. 

For information on how and where you can use Vagrant, see [Why Vagrant?](https://docs.vagrantup.com/v2/why-vagrant/index.html)

## Installation

 * [Vagrant](https://docs.vagrantup.com/v2/installation/index.html)
 * [VirtualBox](https://www.virtualbox.org/wiki/Downloads)

## General Usage Pattern

Most of our Vagrant-based guides begin by cloning the [`weaveworks/guides`](https://github.cim/weaveworks/guides) repository, and then changing to a subdirectory:

    cd guides/<title>

Next, one or more VMs are booted:

    vagrant up

and then, depending on what kind of VMs we are running, you can login:

    vagrant ssh [<vm>]

When a guide says to  _"login to `vm-X`"_, it implies that you should open another terminal, go to the directory of the guide and then run:

    vagrant ssh vm-X.

In the step-by-step instructions of our guides, commands are prefixed with the remote prompt of the shell, as it
appears to you, but we do not show it when you are expected to copy several commands at once or when running a command on your local machine (e.g. `vagrant up` as it appears above).

Once you have completed a guide, you can dispose of the VM(s) using:

    vagrant destroy

If you need to free-up resources on your machine, run `vagrant destroy`. You can then resume the guide at a later time.

##Vagrant In Our Guides

These guides are alway tested using the latest release of Vagrant together with the most recent release of VirtualBox. If something doesn't work, please try upgrading both of those packages first.

To ensure that Vagrant works on all operating systems, Vagrant is always used with the default VirtualBox backend. We never require you to install any 3rd-party plugins and also we will never require you pay for an addional license or for any public cloud compute time. You should be able to run all of these guides on your own computer.

The intention of these guides is to demonstrate a fully-functional system in a box. We expect users to learn Weave
from using a Vagrant-based guide, which can later be adapted as a template to use in a production setting. As previously mentioned, we always assume a VirtualBox-based setup, and we will certainly accept contributions for enabling other environments.

Do note that we currently have no implicit figures of RAM and CPU requirements in any of our guides, and the perfomance may vary depending on your hardware. However, in most cases you should be able to reduce those requirements declared in the Vagrantfile that you are using. As a rule, we refrain from using more then 3 VMs, claiming 6GB+ in total, and we never ask for more than 2 CPU cores per VM. 

A public cloud provider plugin may come in handy when you want to scale out your development cluster.

Vagrant is generally used as a development tool, so we don't recommend transplanting Vagrant workflows directly to
production. If are thinking about this, you may wish to consider [other HashiCorp tools that are better suited to this job.](https://www.terraform.io/intro/hashicorp-ecosystem.html).

