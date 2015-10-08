---
layout: guides
title: Running a load balanced Ruby on Rails app with Weave, and Docker
description: How to use a Weave network with Ruby on Rails PostgreSQL database-backed application.
tags: ubuntu, ruby, rails, load-blancing, microservices, dns, postgres
markdown: kramdown
highlighter: pygments

permalink: /guides/language/ruby/ruby-on-rails-index.html

shorttitle: Ruby on Rails app with Weave & Docker
sidebarpath: /start/micro/ruby
sidebarweight: 45
---


## What you will build ##

Weave allows you to focus on developing your application, rather than
your infrastructure.

In this example we will set up a simple, containerized deployment of a
Ruby on Rails application, backed by a standard PostgreSQL database.

We will use
[WeaveDNS](https://github.com/weaveworks/weave/tree/master/weavedns#readme)
for service discovery between the Rails application, and its database,
without changing any code.

## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Rails](http://rubyonrails.org)
* [PostgreSQL](http://www.postgresql.org)
* [Ubuntu](http://ubuntu.com)

## Before You Begin ##

This getting started guide is self contained. You will use Weave, Docker, Rails, and Ubuntu. We make use of VirtualBox and Vagrant to allow you to run this entire getting started guide on your personal system.

* 20 minutes
* [Git](http://git-scm.com/downloads)
* [Vagrant & VirtualBox](/guides/about/vagrant.html)

## Setting Up The Hosts ##

All of the code for this example is available on github, and you first clone the getting started repository.

~~~bash
$ git clone https://github.com/weaveworks/guides
~~~

You will use Vagrant to setup and configure three Ubuntu hosts and
install Docker. We make use of Vagrant's functionality to download the
base docker images we will be using, and we then install Weave. If you
would like to work through the installation steps please review our
[getting started guide](https://github.com/weaveworks/guides/blob/master/ubuntu-simple/README.md)
for a more manual example.

~~~bash
$ cd weave-gs/rails-ubuntu-simple
$ vagrant up
~~~


Vagrant pulls down and configures an Ubuntu image. This may take a
few minutes depending on the speed of your network connection. For
more details on Vagrant please refer to the [Vagrant
documentation](http://vagrantup.com).

You may be prompted for a password when `/etc/hosts` is being updated
during the Vagrant setup, please just hit return at this point.

Once the setup of the host is complete, check its status with:

~~~bash
$ vagrant status
~~~

The IP address we use for this is

~~~bash
172.17.8.101 	weave-rails-01
~~~

Our Vagrantfile also configures weave-rails-01 to pass traffic from
port 3000 to localhost port 3000, which we will use later when we
view the running rails app.

## Preparing our Rails Application ##

We'll be preparing a rails application based on the [official rails
image](https://registry.hub.docker.com/_/rails/) from dockerhub.

For convenience we'll be running our docker commands within the
vagrant machine. If you want to run the commands from your client, you
will need weave installed on your client, and your
DOCKER_HOST environment variable set.

~~~bash
$ vagrant ssh
~~~

First, let's bootstrap our new Rails app. The rails setup process is
taken from the documentation of the [official dockerhub rails
image](https://registry.hub.docker.com/_/rails/).

~~~bash
$ docker run -it --rm \
    --user "$(id -u):$(id -g)" \
    -v "$PWD":/usr/src/app \
    -w /usr/src/app rails \
    rails new webapp --database=postgresql --skip-bundle
$ cd webapp
~~~

Next, we use the docker ruby image to generate the project's Gemfile.lock.

~~~bash
$ docker run --rm -v "$PWD":/usr/src/app -w /usr/src/app ruby:2.2 bundle install
~~~

When we boot it, the database container will be registered with
weaveDNS at db.weave.local. By default, containers launched through
weave will be registered based on either their container name or their
hostname, if this was set. Containers resolve DNS addresses within the
.weave.local domain. This allows the rails webapp container to resolve
db to db.weave.local, finding our postgres container. This works
transparently even when rails and postgres are running on different
hosts.

You will also need to tell rails where to find its database. To do this, edit
the config/database.yml to look like the following.

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

To boot our app as a docker container, a Dockerfile was added into the
project directory. The rails image from dockerhub provides a
convenient base image to build from. The ruby postgres client gem
depends upon libpq-dev being installed, therefore this will also be installed as a
part of our Dockerfile.

~~~
FROM rails:onbuild
RUN apt-get update -qq && apt-get install -y build-essential libpq-dev
~~~

With the Dockerfile configured, you are now ready to build the container
image. As usual with a docker container, if you change your project
you will need to re-build the image before running your container.

~~~bash
$ docker build -t webapp .
~~~

For more information about dockerizing rails applications, see [the
rails docker image
documentation](https://registry.hub.docker.com/_/rails/)

## Launching Weave ##

Launch weave, with weaveDNS. Weave will be responsible for the raw
network connection and routing between our containers.
[WeaveDNS](http://docs.weave.works/weave/latest_release/weavedns.html)
will provide service-discovery between the app, and the database
container.

~~~bash
$ weave launch && weave launch-dns
~~~

In this guide we'll configure our docker client to use the [weave
proxy](http://docs.weave.works/weave/latest_release/proxy.html). This
lets us use the official docker client, and will attach any booted
containers to the weave network. We'll launch the proxy and then use
the proxy-env utility to configure our DOCKER_HOST.

~~~bash
$ weave launch-proxy
$ eval $(weave proxy-env)
~~~

## Launching PostgreSQL ##

Now, launching a PostgreSQL instance with DNS service discovery can be
done with one command. For convenience, we'll use the official
[postgres image from dockerhub](https://registry.hub.docker.com/_/postgres/).

~~~bash
$ docker run --name db -e POSTGRES_PASSWORD=mysecretpassword -d postgres
~~~

By setting the container name, our postgres instance will be
registered with weaveDNS as db.weave.local. This will be in the local
domain of our webapp. When rails connects to db, weaveDNS will take
care of resolving that address to our postgres container.

Keep in mind, that in this example, we're not concerned about
preserving our data with backups. However, the postgres container
we're using will store its data at /var/lib/postgresql/data, which is
good enough to preserve data across container restarts.

## Run Database Migrations ##

With our database running, we can create and migrate our rails
database using rake.

~~~bash
$ docker run -it --rm -w /usr/src/app webapp rake db:create
~~~

## Launching Rails ##

Run the first server container for our webapp:

~~~bash
$ docker run --name webapp-1 -p 3000:3000 -d webapp
~~~

By giving the webapp container a unique name, it will be registered with
weaveDNS at webapp-1.weave.local. If we wished to do advanced
load-balancing with HAProxy or nginx, we could use these dns entries
to route traffic. In the simple case, we could use weaveDNS for
load-balancing between our rails containers. However, both of those
are outside the scope of this guide.

Your app will now be running on port 3000 on your vagrant host. This
will be available at: [http://172.17.8.101:3000](http://172.17.8.101:3000)

## Summary ##

While our example application is very simple, it has many of the same elements as a real rails application.
