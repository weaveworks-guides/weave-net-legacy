---
layout: guides
title: Launching a Ruby on Rails App with Weave, and Docker
description: How to use a Weave network with Ruby on Rails PostgreSQL database-backed application.
tags: ubuntu, ruby, rails, load-blancing, microservices, dns, PostgreSQL
markdown: kramdown
highlighter: pygments

permalink: /guides/language/ruby/ruby-on-rails-index.html

shorttitle: Ruby on Rails app with Weave & Docker
sidebarpath: /start/micro/ruby
sidebarweight: 45
---


## What You Will Build ##


In this example you will set up a simple, containerized deployment of a Ruby on Rails application, backed by a PostgreSQL database. WeaveDNS will then discover all containers on the network without any code changes. 

Specifically, you will: 

1. Launch the Weave Network. 
2. Build a Docker container image with a Ruby on Rail application.
3. Deploy a PostgreSQL database-backed Ruby on Rails application into three different containers. 
4. Use Weave to discover those containers.

The tutorial will take about 20 minutes to complete, and does not require any programming. 

## What You Will Use

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Rails](http://rubyonrails.org)
* [PostgreSQL](http://www.postgresql.org)
* [Ubuntu](http://ubuntu.com)

## Before You Begin ##

Ensure that you have the following installed before beginning this example:

* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

## Setting Up The Hosts ##

All of the code for this example is available on github. Clone the getting started repository and then change to the `rails-ubuntu-simple` directory:

~~~bash
$ git clone https://github.com/weaveworks/guides

$ cd ./guides/rails-ubuntu-simple
~~~

Vagrant configures the Ubuntu host, installs Docker and also pulls down Weave from Dockerhub. 

If you prefer to work through the installation steps manually then please see,
[Getting Started with Weave and Docker on Ubuntu](http://weave.works/guides/weave-docker-ubuntu-simple.html).

~~~bash
$ cd weave-gs/rails-ubuntu-simple
$ vagrant up
~~~


Setting up Ubuntu may take a few minutes depending on the speed of your network connection. For
more details on Vagrant please refer to the [Vagrant
documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated
during the Vagrant setup, just hit return at this point.

Once the setup of the host is complete, you can check its status with:

~~~bash
$ vagrant status
~~~

The IP address we use for this is:

~~~bash
172.17.8.101 	weave-rails-01
~~~

Vagrant also configures weave-rails-01 to pass traffic from
port 3000 to the localhost port 3000, which is used later for
the running rails app.

## Preparing The Rails Application ##

A rails application will be prepared based on the [official rails
image](https://registry.hub.docker.com/_/rails/) from dockerhub.

SSH onto the host:

~~~bash
$ vagrant ssh
~~~

Then bootstrap the Rails app. 

The set up process for Rails is
taken from the documentation of the [official dockerhub rails
image](https://registry.hub.docker.com/_/rails/):

~~~bash
$ docker run -it --rm \
    --user "$(id -u):$(id -g)" \
    -v "$PWD":/usr/src/app \
    -w /usr/src/app rails \
    rails new webapp --database=postgresql --skip-bundle
~~~


Next, change to the webapp directory and use the docker ruby image to generate the project's Gemfile.lock:

~~~bash
$ cd webapp
~~~

~~~bash
$ docker run --rm -v "$PWD":/usr/src/app -w /usr/src/app ruby:2.2 bundle install
~~~

When the app is booted, the database container will be registered with
`weaveDNS` at `db.weave.local`. 

Containers launched through weave are registered based on either their container name or by their
hostname if this was set. Containers resolve DNS addresses within the
.weave.local domain. This enables the rails webapp container to resolve
db to db.weave.local, thereby discovering the PostgreSQL database container. Discovery is
transparent even when rails and PostgreSQL are running on completely different
hosts.

First tell rails where to find its database by editing
the config/database.yml as follows:

~~~yaml
development: &default
  adapter: postgresql
  encoding: unicode
  database: webapp_development
  pool: 5
  username: postgres
  password: mysecretpassword
  host: db

test:
  <<: *default
  database: webapp_test
~~~

Next create a docker container image of the Rails app. To make this simpler, a Dockerfile has been provided. The rails image from dockerhub provides a convenient base image on which to build. 

The ruby PostgreSQL client gem depends upon `libpq-dev`, which is also installed as a
part of our docker container image.

The contents of the Dockerfile are as follows: 

~~~bash
FROM rails:onbuild
RUN apt-get update -qq && apt-get install -y build-essential libpq-dev
~~~

Copy this Dockerfile to the webapp directory on the host: 

~~~bash
$ cp /vagrant/Dockerfile ./
~~~

With the Dockerfile configured, you are now ready to build the container
image. As usual with a docker container, if you change your project
you will need to re-build the image before running the container.


~~~bash
$ docker build -t webapp .
~~~

For more information about dockerizing rails applications, see [the
rails docker image
documentation](https://registry.hub.docker.com/_/rails/)

##Launching Weave

Weave is responsible for the raw
network connection and also any routing between containers.
[WeaveDNS](http://docs.weave.works/weave/latest_release/weavedns.html)
provides service-discovery between the app, and the database
container.

On the host, launch weave and then set up its environment:

~~~bash
$ weave launch
~~~

~~~bash
$ eval "$(weave env)"
~~~

>Note: In this guide commands were run directly on the host, but you can also run docker commands from your local machine on the remote host by configuring the docker client to use the [Weave Docker API
Proxy](http://docs.weave.works/weave/latest_release/proxy.html). The Weave Docker API Proxy allows you to use the official docker client, and it will also attach any booted containers to the weave network. To enable the proxy, first install Weave on to your local machine, run `weave launch` and then set the environment by running `eval "$(weave env)"`


##Launching PostgreSQL

For convenience, the official [PostgreSQL image from dockerhub](https://registry.hub.docker.com/_/postgres/) is used.

~~~bash
$ docker run --name db -e POSTGRES_PASSWORD=mysecretpassword -d postgres
~~~

By setting the container name, the PostgreSQL instance is
registered with weaveDNS as db.weave.local. This is in the local
domain of our webapp. When rails connects to the database, `weaveDNS` takes
care of resolving that address to our PostgreSQL container.

Keep in mind, that this example is not concerned about
preserving data with backups. However, the PostgreSQL container does store its data at `/var/lib/postgresql/data`, which is enough to preserve data across container restarts.

##Run Database Migrations

With the database running, create and migrate the rails
database using rake.

~~~bash
$ docker run -it --rm -w /usr/src/app webapp rake db:create
~~~

##Launching Rails

Run the server container for the webapp:

~~~bash
$ docker run --name webapp-1 -p 3000:3000 -d webapp
~~~

Check `weave status`, where you can see that there have been 2 containers discovered, as shown by 2 entries logged in `WeaveDNS`: 

~~~bash
Version: 1.1.1

       Service: router
      Protocol: weave 1..2
          Name: 4e:7b:c0:c6:5e:46(weave-rails-01)
    Encryption: disabled
 PeerDiscovery: enabled
       Targets: 0
   Connections: 0
         Peers: 1

       Service: ipam
     Consensus: achieved
         Range: [10.32.0.0-10.48.0.0)
 DefaultSubnet: 10.32.0.0/12

       Service: dns
        Domain: weave.local.
           TTL: 1
       Entries: 2

       Service: proxy
       Address: unix:///var/run/weave/weave.sock
~~~

and then view the running containers: 

~~~bash
$ docker ps

CONTAINER ID        IMAGE                        COMMAND                CREATED             STATUS              PORTS                                                                                        NAMES
bddeda16d611        webapp                       "/w/w rails server -   25 minutes ago      Up 25 minutes       0.0.0.0:3000->3000/tcp                                                                       webapp-1            
c291c3d9dde7        postgres                     "/w/w /docker-entryp   26 minutes ago      Up 26 minutes       5432/tcp                                                                                     db                  
48fb680c8908        weaveworks/weaveexec:1.1.1   "/home/weave/weavepr   34 minutes ago      Up 34 minutes                                                                                                    weaveproxy          
129f749d40d8        weaveworks/weave:1.1.1       "/home/weave/weaver    35 minutes ago      Up 34 minutes       10.1.42.1:53->53/tcp, 10.1.42.1:53->53/udp, 0.0.0.0:6783->6783/tcp, 0.0.0.0:6783->6783/udp   weave               
~~~

By giving the webapp container a unique name, it is registered with `weaveDNS` at `webapp-1.weave.local`. 

Your app will now be running on port 3000 on your vagrant host and is available by pointing your browser at: [http://172.17.8.101:3000](http://172.17.8.101:3000)

If advanced load-balancing with HAProxy or nginx is required, you could use those DNS entries to route the traffic. In the simplest case, weaveDNS can be used for load-balancing between the rails containers. However, both of those scenarios are outside the scope of this guide.

##Cleaning Up the VMs

To clean up the VMs run: 

~~~bash
vagrant destroy
~~~

##Conclusions

While our example application is very simple, it has many of the same elements as a real rails application.

You can adapt this example and use it as a template for your own implementation. We would be very happy to hear any of your thoughts or issues via [Help and Support](http://weave.works/help/index.html).


##Further Reading

 * [How Weave Works](http://docs.weave.works/weave/latest_release/how-it-works.html)
 * [Weave Features](http://docs.weave.works/weave/latest_release/features.html)
 * [Weave Docker API Proxy](http://docs.weave.works/weave/latest_release/proxy.html)
