#!/bin/bash -x

echo "Launching Weave"

vagrant ssh weave-gs-01 -c "weave launch 172.17.8.102"
vagrant ssh weave-gs-02 -c "weave launch 172.17.8.101"

echo "Launching our Node.js application"

vagrant ssh weave-gs-01 -c 'docker $(weave config) run -d --name=offer-ms weaveworks/seneca_offer' >/dev/null 2>&1
vagrant ssh weave-gs-02 -c 'docker $(weave config) run -d --name=user-ms weaveworks/seneca_user' >/dev/null 2>&1
vagrant ssh weave-gs-01 -c 'docker $(weave config) run -d --name=web -p 80:80 weaveworks/seneca_webapp' >/dev/null 2>&1
