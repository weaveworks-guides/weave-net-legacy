#!/bin/bash -e

DOCKER_MACHINE_DRIVER=${DOCKER_MACHINE_DRIVER:-"virtualbox"}

driver_flags="--driver ${DOCKER_MACHINE_DRIVER}"

## I am using curl to create tokens as I find it the easiest, otherwise
## one needs to either download or compile a `docker-swarm` binary or
## have a Docker daemon running
DOCKER_SWARM_CREATE=${DOCKER_SWARM_CREATE:-"curl -s -XPOST https://discovery-stage.hub.docker.com/v1/clusters"}

swarm_flags="--swarm --swarm-discovery=token://$(${DOCKER_SWARM_CREATE})"

for i in $(seq 3) ; do
  if [ ${i} = 1 ] ; then
    ## The first machine shall be the Swarm master
    docker-machine create \
      ${driver_flags} \
      ${swarm_flags} \
      --swarm-master \
      "weave-${i}"
  else
    ## The rest of machines are Swarm slaves
    docker-machine create \
      ${driver_flags} \
      ${swarm_flags} \
      "weave-${i}"
  fi
done
