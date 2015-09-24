#!/bin/bash

vagrant ssh weave-gs-01 -c "eval \$(weave env); docker run -d -h loadbalance.weave.local weaveworks/myip-scratch"
vagrant ssh weave-gs-01 -c "eval \$(weave env); docker run -d -h loadbalance.weave.local weaveworks/myip-scratch"
vagrant ssh weave-gs-01 -c "eval \$(weave env); docker run -d -h loadbalance.weave.local weaveworks/myip-scratch"
vagrant ssh weave-gs-02 -c "eval \$(weave env); docker run -d -h loadbalance.weave.local weaveworks/myip-scratch"
vagrant ssh weave-gs-02 -c "eval \$(weave env); docker run -d -h loadbalance.weave.local weaveworks/myip-scratch"
vagrant ssh weave-gs-02 -c "eval \$(weave env); docker run -d -h loadbalance.weave.local weaveworks/myip-scratch"
