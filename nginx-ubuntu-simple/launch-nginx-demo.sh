#!/bin/bash -x

echo "Launching Weave and WeaveDNS on each vagrant host"

vagrant ssh weave-gs-01 -c "sudo weave launch" >/dev/null 2>&1
vagrant ssh weave-gs-01 -c "sudo weave launch-dns 10.2.1.1/24" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave launch 172.17.8.101" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave launch-dns 10.2.1.2/24">/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave launch 172.17.8.101" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave launch-dns 10.2.1.3/24" >/dev/null 2>&1

echo "Launching our example application in two containers on each vagrant host"

vagrant ssh weave-gs-01 -c "sudo weave run --with-dns 10.3.1.1/24 -h ws1.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-01 -c "sudo weave run --with-dns 10.3.1.2/24 -h ws2.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave run --with-dns 10.3.1.3/24 -h ws3.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave run --with-dns 10.3.1.4/24 -h ws4.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave run --with-dns 10.3.1.5/24 -h ws5.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1
vagrant ssh weave-gs-03 -c "sudo weave run --with-dns 10.3.1.6/24 -h ws6.weave.local fintanr/weave-gs-nginx-apache" >/dev/null 2>&1

echo "Launching nginx"

vagrant ssh weave-gs-01 -c "sudo weave run --with-dns 10.3.1.7/24 -ti -h nginx.weave.local -d -p 80:80 fintanr/weave-gs-nginx-simple"
