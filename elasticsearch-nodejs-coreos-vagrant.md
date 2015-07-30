---
title: Elasticsearch, Weave and Docker
tags: nodejs, iojs, javascript, docker, coreos, guide, usecase, elasticsearch, vagrant, coreos, bigdata
published: true
layout: guides
---

This guide will demonstrate how to deploy an [Elasticsearch](http://www.elasticsearch.org/) cluster on [Weave](https://github.com/zettio/weave#weave---the-docker-network) as well as a JavaScript microservice application for it.

There are a few major advantages of using Weave for Elasticsearch. Firstly, you will gain [Zen discovery](http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/modules-discovery-zen.html) working out of the box on any infrastructure. Secondly, you can encrypt the communication and avoid having to setup authentication and an HTTPS proxy. Additionally, you can also run a number of clusters across any number of hosts, which can be particularly useful in development, where teams want to have their own cluster instances but the number of physical machines is limited. There are other advantages of using Weave, however the above are the most critical for Elasticsearch.

I will first show step-by-step how to run Elasticsearch on Weave, and then deploy a simple JavaScript app container.

## Setup an Elasticsearch cluster

To run an Elasticsearch cluster, you will need 2 or more hosts. There are different ways to provision these and we are committed to guiding you on [tooling](http://weaveblog.com/tag/provisioning/), but for this post I have prepared something simple that will get you up and running with 3 VMs on Vagrant.

Let's get started!

    $ git clone https://github.com/errordeveloper/weave-demos
    $ cd weave-demos/felix
    $ vagrant up

This should bring up 3 VMs with weave installed out of the box. Now you can login to each of these and start Elasticsearch like so:

    weave run \
        --with-dns 10.10.1.X/24 \
        --hostname=es-X.weave.local \
        errordeveloper/weave-elasticsearch-minimal:latest

> _NOTE: the above command uses a container of my own, however you can use any other, given you have set configuration options correctly. Please refer to my Dockerfile lines [16](https://github.com/errordeveloper/weave-demos/blob/d2c2a00/java-containers/elasticsearch/Dockerfile#L16) and [33-35](https://github.com/errordeveloper/weave-demos/blob/d2c2a00/java-containers/elasticsearch/Dockerfile#L33-L35) and  for details._

You would substitute `X` with 1, 2 and 3 for each of the nodes. To keep it simple for you, I have created a little shell script that starts all 3 of these:

    cd ../hello-apps/elasticsearch-js/
    ./scripts/run_elasticsearch.sh

Once all 3 nodes are set-up, let's verify we have a cluster. The easiest way to do so is by exposing the Docker host to the Weave network with the `weave expose <CIDR>` command, where `<CIDR>` is a free IP address on the same subnet the app is on. We have used `10.10.1.X/24` for the Elasticsearch nodes, so let's pick a free IP in this subnet.

    vagrant ssh core-01
    core@core-01 ~ $ weave expose 10.10.1.100/24
    core@core-01 ~ $ curl 10.10.1.1:9200/_cat/nodes
    es-2.weave.local 10.10.1.2 4 17 0.01 d m Hobgoblin II
    es-3.weave.local 10.10.1.3 4 17 0.00 d m Chtylok
    es-1.weave.local 10.10.1.1 5 17 0.07 d * Madame MacEvil
    core@core-01 ~ $ exit

Ok, this looks pretty good so far. Let's move on to the next step!

## Deploying an app

For the purpose of this post, I have written a little JavaScript demo app that talks to Elasticsearch. [It's rather simple](https://github.com/errordeveloper/weave-demos/blob/master/hello-apps/elasticsearch-js/index.js), yet capable of  creating and retrieving documents in Elasticsearch.

The app refers to ES nodes by their Weave DNS names like so:

    var es = new elasticsearch.Client({
        hosts: [ 'es-1.weave.local:9200'
               , 'es-2.weave.local:9200'
               , 'es-3.weave.local:9200' ],
          log: 'trace'
    });

DNS in Weave is much more dynamic then traditional DNS, any container on the network gets a DNS record automatically, there is no management tools or in-app self-registration required. It will make your app config more human-friendly and the underlying IP addresses can be re-organised transparently when needed.

Let's deploy it on `core-01`:

    git clone https://github.com/errordeveloper/weave-demos
    cd weave-demos/hello-apps/elasticsearch-js/

First, run a build script that will install the dependencies and create a new container that you can run.

    ./scripts/build.sh

> _NOTE: I am using an IO.js container [image of my own](https://registry.hub.docker.com/u/errordeveloper/iojs-minimal-runtime/), but you can use anything else._

Now you have built the app into a local container image, which is ready to be deployed on the weave network.

    weave run --with-dns 10.10.1.11/24 \
        --name hello-es-app-instance \
        -h hello-es-app.weave.local \
        -p 80:80 \
        hello-es-app
    docker logs -f hello-es-app-instance

As you can see, port 80 will be exposed to the world. The IP address of Vagrant VM `core-01` is `172.17.8.101`.

The API defined by our app is pretty simple:

   - `GET /` will give you some basic info about the database cluster
   - `POST /hello/:title` will store body in a document with title `:title`
   - `GET /hello/:title` will retrieve contents of document with title `:title`
   - `GET /search/:title` will search by title

So let's create our first document:

    curl -s \
      --request POST \
      --data '{"a": 1}' \
      --header 'Content-type: application/json' \
      http://172.17.8.101/hello/sample1 | jq
    {
      "msg": {
        "_index": "hello",
        "_type": "json",
        "_id": "AUsB9l_6iEcqWz_eIw5X",
        "_version": 1,
        "created": true
      }
    }

And fetch it:

    curl -s \
      --request GET \
      http://172.17.8.101/hello/sample1 | jq
    {
      "msg": {
        "a": 1
      }
    }

Now, we can also post another document with the same title:

    curl -s \
      --request POST \
      --data '{"a": 2}' \
      --header 'Content-type: application/json' \
      http://172.17.8.101/hello/sample1 | jq
    {
      "msg": {
        "_index": "hello",
        "_type": "json",
        "_id": "AUsB9quZiEcqWz_eIw5Y",
        "_version": 1,
        "created": true
      }
    }

Try to fetch it:

    curl -s \
      --request GET \
      http://172.17.8.101/hello/sample1 | jq
    {
      "msg": "There're too many of those, I'm sorry! But you can try `/hello/_search/:title` ;)"
    }

So we no longer can use `GET /hello/:title`, however search comes to rescue:

    curl -s \
      --request GET \
      http://172.17.8.101/hello/_search/sample1 | jq
    {
      "msg": "Found 2 matching documents...",
      "hits": [
        {
          "title": "sample1",
          "text": {
            "a": 1
          },
          "id": "AUsB9l_6iEcqWz_eIw5X"
        },
        {
          "title": "sample1",
          "text": {
            "a": 2
          },
          "id": "AUsB9quZiEcqWz_eIw5Y"
        }
      ]
    }

All done, have fun weaving Elasticsearch and Node.js (or IO.js) apps!

## Conclusion

In this post, I have demonstrated how Weave helps with deploying a distributed database engine and an example of a microservice to go along with it. Weave makes it very easy to run containerised applications on any network, in particular, for Elasticsearch it enables out-of-the-box discovery mechanism to work and provides DNS for apps to find the database wherever it lives on the network. We would love to hear about your usecases, do get in touch with [team@weave.works](mailto:team@weave.works) and make sure to follow [@weaveworks](https://twitter.com/weaveworks) on twitter.

## Appendix

### Using Kibana or plugins

I have shown how you can access Elasticsearch API on Weave network from the Docker host by running `weave expose 10.10.1.100/24`. If you want to access it from your own machine and hook-up Kibana or use BigDesk or other plugins through your browser, you will need to setup port forwarding.

    vagrant ssh core-01 -- -L localhost:9200:10.10.1.1:9200
    core@core-01 ~ $ weave expose 10.10.1.100/24

The above will forward port 9200 of container `es-1` as `localhost:9200`, which will persist until you exit the ssh session.

In a new terminal window try

    curl localhost:9200/_cat/nodes

and you will see the same list of nodes as show above.

You can now [download and extract the Kibana release](http://www.elasticsearch.org/overview/kibana/installation/) and use it with the default URL. To use a plugin, you would need to install it on the container image, which is outside of the scope here to go into detail, but if you are not sure you can look at [one of my other examples](https://github.com/errordeveloper/weave-demos/blob/d2c2a00/java-containers/elasticsearch-river-twitter/Dockerfile).

### Running multiple clusters

There could be different reasons why you may wish to run multiple clusters of Elasticsearch on the infrastructure. It might happen that someone wants to try something for the project of their own and you'd prefer they don't mess with your data, or you may wish to utilise Weave's isolation for spinning up a new version of Elasticsearch in production, while keeping previous version running. In any case, it's rather simple to do with Weave and you can see how it can be done with a simple shell script ([run_elasticsearch_2_clusters.sh](https://github.com/errordeveloper/weave-demos/blob/d2c2a00/hello-apps/elasticsearch-js/scripts/run_elasticsearch_2_clusters.sh)).
