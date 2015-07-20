#!/bin/bash

# Build dev branch of ecs-init
docker build -t ecs-init-weave -f ecs-init-weave.dockerfile  .
echo -n 'Saving ecs-init-1.2.1-2.el7.centos.x86_64.rpm .. '
docker run ecs-init-weave:latest cat /root/rpmbuild/RPMS/x86_64/ecs-init-1.3.0-1.el7.centos.x86_64.rpm > ecs-init-1.3.0-1.el7.centos.x86_64.rpm
echo Done

# Build master branch of Weave
docker run -v /var/run/docker.sock:/var/run/docker.sock weaveworks/weave-build https://github.com/weaveworks/weave.git
echo -n 'Saving weave.tar .. '
docker save weaveworks/weave:latest weaveworks/weaveexec:latest > weave.tar
echo Done
