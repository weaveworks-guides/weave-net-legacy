#!/bin/sh -e

for m in $(docker-machine ls -q); do
  echo "Building on '${m}':"
  docker $(docker-machine config ${m}) build -t app_web .
done
