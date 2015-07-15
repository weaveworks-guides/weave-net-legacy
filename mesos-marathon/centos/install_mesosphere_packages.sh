#!/bin/bash -ex

cd $(dirname $0)

rpm -i http://repos.mesosphere.io/el/7/noarch/RPMS/mesosphere-el-repo-7-1.noarch.rpm
yum -q -y install mesos-0.22.1 marathon-0.8.2 mesosphere-zookeeper-3.4.6
