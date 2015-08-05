#!/bin/bash

set -euo pipefail

# Build dev branch of ecs-init
CURRENT_DIR=$(dirname $(realpath $0))
docker run -v $CURRENT_DIR:/packer centos /packer/ecs-init/build.sh

# Build master branch of Weave
docker run -v /var/run/docker.sock:/var/run/docker.sock weaveworks/weave-build https://github.com/weaveworks/weave.git
docker save weaveworks/weave:latest weaveworks/weaveexec:latest > to-upload/weave.tar
