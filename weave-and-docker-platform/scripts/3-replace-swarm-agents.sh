#!/bin/bash -e

DOCKER_SWARM_CREATE=${DOCKER_SWARM_CREATE:-"curl -s -XPOST https://discovery-stage.hub.docker.com/v1/clusters"}

## This script will replace Swarm agent, aside from that it will have
## point them to Weave proxy port 12375 instead of Docker port 2376,
## it will need a new token as the registration on Docker Hub stores
## an array of `<host>:<port>` pairs and the clean-up method doesn't
## seem to be documented
swarm_dicovery_token="$(${DOCKER_SWARM_CREATE})"

for i in $(seq 3 | sort -r) ; do
  ## We are not really using Weave script anymore, hence
  ## this is only a local variable
  DOCKER_CLIENT_ARGS="$(docker-machine config weave-${i})"

  ## Default Weave proxy port is 12375
  weave_proxy_endpoint="$(docker-machine ip weave-${i}):12375"

  ## Next, we restart the slave agents
  docker ${DOCKER_CLIENT_ARGS} rm -f swarm-agent
  docker ${DOCKER_CLIENT_ARGS} run \
    -d \
    --restart=always \
    --name=swarm-agent \
    swarm join \
    --addr "${weave_proxy_endpoint}" \
    "token://${swarm_dicovery_token}"

  if [ ${i} = 1 ] ; then
    ## On the head node (weave-1) we will also restart the master
    ## with the new token and all the original arguments; the reason
    ## this is a bit complicated is because we need steal all the
    ## `--tls*` arguments as well as the `-v` ones
    swarm_master_args_fmt="\
      -d \
      --restart=always \
      --name={{.Name}} \
      -p 3376:3376 \
      {{range .HostConfig.Binds}}-v {{.}} {{end}} \
      swarm{{range .Args}} {{.}}{{end}} \
    "
    swarm_master_args=$(docker ${DOCKER_CLIENT_ARGS} inspect \
        --format="${swarm_master_args_fmt}" \
        swarm-agent-master \
        | sed "s|\(token://\)[[:alnum:]]*|\1${swarm_dicovery_token}|")

    docker ${DOCKER_CLIENT_ARGS} rm -f swarm-agent-master
    docker ${DOCKER_CLIENT_ARGS} run ${swarm_master_args}
  fi
done
