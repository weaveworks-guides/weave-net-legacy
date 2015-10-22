#!/bin/bash -e

## find_tls_args="cat /proc/\$(pgrep /usr/local/bin/docker)/cmdline | tr '\0' '\n' | grep ^--tls | tr '\n' ' '"

for i in $(seq 3) ; do
  ## This environment variable is respected by Weave script,
  ## hence it needs to be exported
  ## export DOCKER_CLIENT_ARGS="$(docker-machine config weave-${i})"

  ## tlsargs=$(docker-machine ssh "weave-${i}" "${find_tls_args}")

  ## We are going to use IPAM, hence we supply estimated cluster size
  ./weave launch --init-peer-count 3
  ## set the proxy for weave
  weave $(weave env)

  ## Let's connect-up the Weave cluster by telling
  ## each of the nodes about the head node (weave-1)
  if [ ${i} -gt 1 ] ; then
    ./weave connect $(docker-machine ip 'weave-1')
  fi
done


