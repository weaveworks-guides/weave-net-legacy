#!/bin/bash -x
docker-machine create -d vmwarefusion kubedev
docker-machine ssh kubedev 'img=weaveworks/kubernetes-anywhere ; for i in $img:tools $img:scheduler $img:apiserver $img:controller-manager $img:proxy $img:kubelet $img:etcd weaveworks/weaveexec:1.3.0 weaveworks/weave:1.3.0 weaveworks/scope:0.10.0 ; do docker pull $i ; done'
