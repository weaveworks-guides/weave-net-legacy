#!/bin/bash 

echo "Launching Weave and WeaveDNS"

vagrant ssh weave-gs-01 -c "sudo weave launch" 
vagrant ssh weave-gs-01 -c "sudo weave launch-dns 10.2.1.1/24" 
vagrant ssh weave-gs-02 -c "sudo weave launch 172.17.8.101" 
vagrant ssh weave-gs-02 -c "sudo weave launch-dns 10.2.1.2/24"

echo "Launching our node.js application"

vagrant ssh weave-gs-01 -c "sudo weave run --with-dns 10.3.1.1/24 -h offer-ms.weave.local fintanr/seneca_offer" >/dev/null 2>&1
vagrant ssh weave-gs-02 -c "sudo weave run --with-dns 10.3.1.2/24 -h user-ms.weave.local fintanr/seneca_user" >/dev/null 2>&1
vagrant ssh weave-gs-01 -c "sudo weave run --with-dns 10.3.1.3/24 -p 80:80 -h web.weave.local fintanr/seneca_webapp" >/dev/null 2>&1
