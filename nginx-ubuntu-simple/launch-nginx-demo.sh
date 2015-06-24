#!/bin/bash -x

echo "Launching Weave and WeaveDNS on each vagrant host"

vagrant ssh weave-gs-01 -c "sudo weave launch -initpeercount 3" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave launch -initpeercount 3 172.17.8.101" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave launch -initpeercount 3 172.17.8.101" >/dev/null 2>&1
vagrant ssh weave-gs-01 -c "sudo weave launch-dns; sudo weave launch-proxy" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave launch-dns; sudo weave launch-proxy" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave launch-dns; sudo weave launch-proxy" >/dev/null 2>&1

echo "Launching our example application in two containers on each vagrant host"

vagrant ssh weave-gs-01 -c "eval \$(weave proxy-env); docker run -d --name ws1 fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-01 -c "eval \$(weave proxy-env); docker run -d --name ws2 fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "eval \$(weave proxy-env); docker run -d --name ws3 fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "eval \$(weave proxy-env); docker run -d --name ws4 fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "eval \$(weave proxy-env); docker run -d --name ws5 fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "eval \$(weave proxy-env); docker run -d --name ws6 fintanr/weave-gs-nginx-apache" >/dev/null 2>&1

echo "Launching nginx"

vagrant ssh weave-gs-01 -c "eval $(weave proxy-env); docker run -ti --name nginx -d -p 80:80 fintanr/weave-gs-nginx-simple"
