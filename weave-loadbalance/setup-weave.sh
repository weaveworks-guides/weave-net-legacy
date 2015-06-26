#!/bin/bash

vagrant ssh weave-gs-01 -c "weave launch -iprange 10.2.0.1/16"
vagrant ssh weave-gs-02 -c "weave launch -iprange 10.2.0.1/16 172.17.8.101"
vagrant ssh weave-gs-01 -c "weave launch-dns; weave launch-proxy"
vagrant ssh weave-gs-02 -c "weave launch-dns; weave launch-proxy"
