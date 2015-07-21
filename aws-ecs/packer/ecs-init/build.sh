#!/bin/bash

set -euo pipefail

export GOPATH=/

# Build amazon-ecs-init
yum -y install git golang make rpm-build || yum clean all
mkdir -p /src/github.com/aws/
git clone -b dev https://github.com/aws/amazon-ecs-init.git /src/github.com/aws/amazon-ecs-init
make -C /src/github.com/aws/amazon-ecs-init
# for some reason Make rpm doens't put the sources where expected 
make -C /src/github.com/aws/amazon-ecs-init sources
mkdir -p /root/rpmbuild/SOURCES
cp /src/github.com/aws/amazon-ecs-init/{sources.tgz,ecs.conf} /root/rpmbuild/SOURCES/
make -C /src/github.com/aws/amazon-ecs-init rpm
cp /root/rpmbuild/RPMS/x86_64/ecs-init-1.3.0-1.el7.centos.x86_64.rpm /packer/to-upload/
