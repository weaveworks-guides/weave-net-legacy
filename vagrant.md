---
permalink: /guides/about/vagrant.html
title: Usage of Vagrant in our guides
layout: guides
---

## What is Vagrant

[Vagrant](https://www.vagrantup.com/) is a great product by our friends at [HashiCorp](https://hashicorp.com/), it allows
you to automate provisoning of VirtualBox VMs in a very simple way, and enables rapid prototyping of infrastructure or
subsets of it with a very simple Ruby-based DSL. Additionally it works on VMWare products as well as KVM, and a number of
public cloud plugins exist also.

## Installation

 * [Vagrant](https://docs.vagrantup.com/v2/installation/index.html)
 * [VirtualBox](https://www.virtualbox.org/wiki/Downloads)

## How we use Vagrant in our guides

We always test using the latest release of Vagrant and most recent release of VirtualBox, so if something doesn't work,
please make sure to try upgrading both of the packages first.

We only use Vagrant with the default VirtualBox backend, as it works on all major operationg systems. It also doesn't
requite installation of a 3rd-party plugin and doesn't directly imply that the user has to pay for anything (e.g. a VMWare
license or public cloud compute time), they can just run everything on their own computer.

The intention of our guides is to demonstrate a fully-functional system in a box, and we do expect users to learn it
from using a Vagrant-based guide and later adopt elsewhere. As said, we always assume a VirtualBox-based setup, but will
certainly accept contributions for enabling other environments. However, we do not recommend users to directly deploy the
exact same Vagrant infrastructure in public cloud using any of the 3rd-party plugins, as there exist better tools for this
(e.g. [Terraform](http://terraform.io)), as Vagrant is meant as development-only type of tool by design. A public cloud
provider plugin could come in handy when you want to scale out your development cluster, but you should consider using
a tool that will allow you to manage instances as well as other resources, e.g. storage and access from external
networks. Vagrant won't manage any resources for you and mixing tools makes your work harder if you haven't picked the
right one in the first place.

Do note that we currently have no implicit figures of RAM and CPU requirements in any of our guides, and perfomance may
vary depending on your hardware, however in most cases you should be able to reduce the figures declared in Vagrantfile
that you are using. We do generally refrain from using more then 3 VMs claiming 6GB+ in total and never ask for more then
2 CPU cores per VM.

## General usage pattern

Most of our Vagrant-based guides adopt a usage pattern where one clones the repository first, the goes to a subdirectory with

    cd guides/<title>

then boot one or more VMs with

    vagrant up

and then, depending on what VMs there are, login with

    vagtant ssh [<vm>]


When we just say _"login to `vm-X`"_, it implies _"open another terminal, go to the directory of the guide and run
`vagrant ssh vm-X`"_.

In step-by-step sections of our guides you will see command prefixed with remote prompt of the shell, just as it will
appear to you, but we do not show it when you are expected to copy several commands at once or run something on your
local machine (e.g. `vagrant up` as it appears above).
