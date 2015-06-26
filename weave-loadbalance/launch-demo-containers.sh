#!/bin/bash

vagrant ssh weave-gs-01 -c "eval \$(weave proxy-env); docker run -d -h lb.weave.local fintanr/myip-scratch"
vagrant ssh weave-gs-01 -c "eval \$(weave proxy-env); docker run -d -h lb.weave.local fintanr/myip-scratch"
vagrant ssh weave-gs-01 -c "eval \$(weave proxy-env); docker run -d -h lb.weave.local fintanr/myip-scratch"
vagrant ssh weave-gs-02 -c "eval \$(weave proxy-env); docker run -d -h lb.weave.local fintanr/myip-scratch"
vagrant ssh weave-gs-02 -c "eval \$(weave proxy-env); docker run -d -h lb.weave.local fintanr/myip-scratch"
vagrant ssh weave-gs-02 -c "eval \$(weave proxy-env); docker run -d -h lb.weave.local fintanr/myip-scratch"
