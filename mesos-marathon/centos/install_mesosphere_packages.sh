#!/bin/bash -ex

cd $(dirname $0)

rpm -i http://repos.mesosphere.io/el/7/noarch/RPMS/mesosphere-el-repo-7-3.noarch.rpm
yum -q -y install mesos-0.28.2 marathon-1.1.1 mesosphere-zookeeper-3.4.6
