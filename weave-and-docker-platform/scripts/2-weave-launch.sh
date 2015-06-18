#!/bin/bash -e

find_tls_args="cat /proc/\$(pgrep /usr/local/bin/docker)/cmdline | tr '\0' '\n' | grep ^--tls | tr '\n' ' '"

for i in $(seq 3) ; do
  ## This environment variable is respected by Weave script,
  ## hence it needs to be exported
  export DOCKER_CLIENT_ARGS="$(docker-machine config weave-${i})"

  tlsargs=$(docker-machine ssh "weave-${i}" "${find_tls_args}")

  ## We are going to use IPAM, hence estimated cluster size
  ## (`-initpeercount`) needs to be supplied,
  ## as we don't pass any peer addresses yet
  ./weave launch -initpeercount 3
  ## Launch WeaveDNS on 10.53.1.0/24 subnet
  ./weave launch-dns "10.53.1.${i}/24"
  ## Proxy will use TLS arguments we just obtained from Docker
  ## daemon and should have DNS enabled too
  ./weave launch-proxy --with-dns ${tlsargs}

  ## Let's connect-up the Weave cluster by telling
  ## each of the nodes about the head node (weave-1)
  if [ ${i} -gt 1 ] ; then
    ./weave connect $(docker-machine ip 'weave-1')
  fi
done

unset DOCKER_CLIENT_ARGS
