#!/bin/bash

vagrant ssh weave-gs-01 -c "weave launch --ipalloc-range 10.2.0.1/16"
vagrant ssh weave-gs-02 -c "weave launch --ipalloc-range 10.2.0.1/16 172.17.8.101"
