#!/bin/bash -x

echo "Launching Weave on each vagrant host"

vagrant ssh weave-gs-01 -c "weave launch" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "weave launch 172.17.8.101" >/dev/null 2>&1

echo "Launching demo container on weave-gs-02"
vagrant ssh weave-gs-02 -c "weave run 10.3.1.1/24 weaveworks/weave-gs-simple-hw" >/dev/null 2>&1

echo "Launching container with curl on weave-gs-01"
vagrant ssh weave-gs-01 -c "weave run 10.3.1.2/24 weaveworks/weave-gs-ubuntu-curl" >/dev/null 2>&1
