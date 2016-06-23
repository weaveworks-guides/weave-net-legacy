#!/bin/bash -e

for i in $(seq 3) ; do
  ## This environment variable is respected by Weave script,
  ## hence it needs to be exported
  export DOCKER_CLIENT_ARGS="$(docker-machine config weave-${i})"

  ## We are going to use IPAM, hence we supply estimated cluster size
  ./weave launch --ipalloc-init consensus=3

  ## Let's connect-up the Weave cluster by telling
  ## each of the nodes about the head node (weave-1)
  if [ ${i} -gt 1 ] ; then
    ./weave connect $(docker-machine ip 'weave-1')
  fi
done
