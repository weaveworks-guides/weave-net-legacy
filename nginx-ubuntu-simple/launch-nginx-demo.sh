#!/bin/bash -x

echo "Launching Weave and WeaveDNS on each vagrant host"

vagrant ssh weave-gs-01 -c "sudo weave launch -initpeercount 3" >/dev/null 2>&1
vagrant ssh weave-gs-01 -c "sudo weave launch-dns" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave launch -initpeercount 3 172.17.8.101" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave launch-dns">/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave launch -initpeercount 3 172.17.8.101" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave launch-dns" >/dev/null 2>&1

echo "Launching our example application in two containers on each vagrant host"

vagrant ssh weave-gs-01 -c "sudo weave run -h ws1.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-01 -c "sudo weave run -h ws2.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave run -h ws3.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave run -h ws4.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave run -h ws5.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave run -h ws6.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1

echo "Launching nginx"

vagrant ssh weave-gs-01 -c "sudo weave run -ti -h nginx.weave.local -d -p 80:80 fintanr/weave-gs-nginx-simple"
