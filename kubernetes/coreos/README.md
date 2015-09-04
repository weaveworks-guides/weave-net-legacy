This is an extract from our [blog post](http://weaveblog.com/2014/11/11/weave-for-kubernetes/), the post itself contains more technical details and the motivation.

## Quick Start

Here is the gist of what you need to do in order to fire-up 3 CoreOS VMs. As result of this you will get a Kubernetes cluster running over Weave network and the `core-01` VM is the master.

```Bash
git clone https://github.com/errordeveloper/weave-demos/
cd weave-demos/poseidon
vagrant up
vagrant ssh core-01
```

Now, on the master machine (`core-01`), let’s try deploying the guestbook example.

As part of the provisioning process we have placed Kubernetes examples in your home directory. You should see a directory called `guestbook-example`, if it’s not there check if a `curl` process is still running.

```
core@core-01 ~ $ ls
guestbook-example
```

Another basic thing to double-check is whether all minions have registered with the master.

```
core@core-01 ~ $ kubectl get minions
NAME
172.17.8.101
172.17.8.102
172.17.8.103
```

If you have any problems, check the additional troubleshooting section at the end of this post.

If all is well, let’s proceed!

```
core@core-01 ~ $ cd guestbook-example
core@core-01 ~/guestbook-example $
```

Firstly we need to deploy Redis database, which consists of a single master and two slave pods.

In Kubernetes terms, this consists of:

  - A single Redis master _Replication Controller_ and _Service_

```
core@core-01 ~/guestbook-example $ kubectl create -f redis-master-controller.json
I1105 17:08:24.679092 06680 restclient.go:133] Waiting for completion of operation 1
redis-master-2
core@core-01 ~/guestbook-example $ kubectl create -f redis-master-service.json
redismaster
```

  - Two Redis slave _Replication Controllers_ and a _Service_

```
core@core-01 ~/guestbook-example $ kubectl create -f redis-slave-controller.json
redisSlaveController
core@core-01 ~/guestbook-example $ kubectl create -f redis-slave-service.json
I1105 17:08:44.219372 06719 restclient.go:133] Waiting for completion of operation 10
redisslave
```

Let’s take a look at the state of our Kubernetes cluster, we should see the three pods that we have just deployed. This number matches how many _Replication Controllers_ we had.

```
core@core-01 ~/guestbook-example $ kubectl get pods
NAME                                   IMAGE(S)                   HOST                LABELS              STATUS
redis-master-2                         dockerfile/redis           172.17.8.102/       name=redis-master  Pending
64749995-650e-11e4-b80b-080027fb95c5   brendanburns/redis-slave   172.17.8.103/       name=redisslave     Pending
6474482b-650e-11e4-b80b-080027fb95c5   brendanburns/redis-slave   172.17.8.101/       name=redisslave     Pending
```

As it takes some time to pull the container images onto each of the machines, you might need to wait for a few minutes for pods to change from “Pending” state to “Running”. However, you don’t need to wait for all of them right now, unless you wish to test Redis manually.

Let’s deploy the PHP app now. It will consists of three _Replication Controllers_ and a _Service_.

```
core@core-01 ~/guestbook-example $ kubectl create -f frontend-controller.json
I1105 17:43:38.936889 10080 restclient.go:133] Waiting for completion of operation 12
frontendController
core@core-01 ~/guestbook-example $ kubectl create -f frontend-service.json
I1105 17:43:46.444804 10132 restclient.go:133] Waiting for completion of operation 19
frontend
```

If your run kubectl get pods now, you will observer that we have the new pods labeled “frontend” in a “Pending” state.

```
core@core-01 ~/guestbook-example $ kubectl get pods
NAME                                   IMAGE(S)                   HOST                LABELS              STATUS
46849afa-6513-11e4-b80b-080027fb95c5   brendanburns/php-redis     172.17.8.103/       name=frontend       Pending
redis-master-2                         dockerfile/redis           172.17.8.102/       name=redis-master   Running
64749995-650e-11e4-b80b-080027fb95c5   brendanburns/redis-slave   172.17.8.103/       name=redisslave     Running
6474482b-650e-11e4-b80b-080027fb95c5   brendanburns/redis-slave   172.17.8.101/       name=redisslave     Running
468432e7-6513-11e4-b80b-080027fb95c5   brendanburns/php-redis     172.17.8.102/       name=frontend       Pending
46844cba-6513-11e4-b80b-080027fb95c5   brendanburns/php-redis     172.17.8.101/       name=frontend       Pending
```

Running `kubectl get pods` after a few minutes shows us that the state has changed to “Running”.

```
core@core-01 ~/guestbook-example $ kubectl get pods
NAME                                   IMAGE(S)                   HOST                LABELS              STATUS
46844cba-6513-11e4-b80b-080027fb95c5   brendanburns/php-redis     172.17.8.101/       name=frontend       Running
46849afa-6513-11e4-b80b-080027fb95c5   brendanburns/php-redis     172.17.8.103/       name=frontend       Running
redis-master-2                         dockerfile/redis           172.17.8.102/       name=redis-master   Running
64749995-650e-11e4-b80b-080027fb95c5   brendanburns/redis-slave   172.17.8.103/       name=redisslave     Running
6474482b-650e-11e4-b80b-080027fb95c5   brendanburns/redis-slave   172.17.8.101/       name=redisslave     Running
468432e7-6513-11e4-b80b-080027fb95c5   brendanburns/php-redis     172.17.8.102/       name=frontend       Running
```

We should now be able to test this. If you look at the output of `kubectl get services`, you will see that there is front-end portal and it can be accessed on `10.0.0.5:9998` locally, and you can probably call `curl 10.0.0.5:9998`, but this doesn’t quite show the app in action. It’s not quite clear why the host ports are not exposed in the console output of `kubectl get pods`, but this is something you can find by either looking at `frontend-controller.json` or calling `kubectl get pod --output=yaml --selector="name=frontend"`. So whichever you did, you will find that it binds to the host’s port _8000_. As we have three machines in the cluster with IP addresses _172.17.8.101_, _172.17.8.102_ and _172.17.8.103_, we can connect to each of them on port _8000_ and see exact same application on each:

  - http://172.17.8.101:8000
  - http://172.17.8.102:8000
  - http://172.17.8.103:8000

