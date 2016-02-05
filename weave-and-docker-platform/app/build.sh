#!/bin/bash -e

echo "Building on 'weave-1':"
docker $(docker-machine config 'weave-1') build -t app_web .
echo "Copying from 'weave-1' to 'weave-2' and 'weave-3'..."
docker $(docker-machine config 'weave-1') save app_web \
  | tee \
    >(docker $(docker-machine config 'weave-2') load) \
    >(docker $(docker-machine config 'weave-3') load) \
  | cat > /dev/null
