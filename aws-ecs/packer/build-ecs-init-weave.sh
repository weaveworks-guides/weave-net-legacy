#!/bin/bash

docker build -t ecs-init-weave -f ecs-init-weave.dockerfile  .
echo -n 'Saving ecs-init-1.2.1-2.el7.centos.x86_64.rpm .. '
docker run ecs-init-weave:latest cat /root/rpmbuild/RPMS/x86_64/ecs-init-1.3.0-1.el7.centos.x86_64.rpm > ecs-init-1.3.0-1.el7.centos.x86_64.rpm
echo Done
echo -n 'Saving weave.tar .. '
docker run ecs-init-weave:latest cat /src/github.com/weaveworks/weave/weave.tar > weave.tar
echo Done
