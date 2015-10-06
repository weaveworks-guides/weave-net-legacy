#!/bin/bash

set -euo pipefail

#Hack to overcome bindfs permission problems in my machine
cp `dirname $0`/weave-ecs-demo-key.pem /tmp/
chmod 0600 /tmp/weave-ecs-demo-key.pem
KEY=/tmp/weave-ecs-demo-key.pem

ssh_to_instance() {
    HOST=$1
    shift
    ssh -o "StrictHostKeyChecking no" -i $KEY ec2-user@$HOST $@
}

SCOPE_IMAGE_FILE=$(mktemp /tmp/scope-update-image-tar-XXXX)
trap 'rm $SCOPE_IMAGE_FILE' EXIT
echo -n 'Saving current Scope image .. '
docker save weaveworks/scope > $SCOPE_IMAGE_FILE
echo done

INSTANCE_HOSTNAMES=$(`dirname "$0"`/echo_instances.sh)
echo Updating Scope in $INSTANCE_HOSTNAMES:
echo

for HOST in $INSTANCE_HOSTNAMES; do
    echo
    echo Updating $HOST;
    echo Current scope image:
    ssh_to_instance $HOST docker images weaveworks/scope
    echo -n 'Updating Scope image .. '
    ssh_to_instance $HOST docker load < $SCOPE_IMAGE_FILE
    echo done
    echo New Scope image:
    ssh_to_instance $HOST docker images weaveworks/scope
    echo Updating scope script:
    ssh_to_instance $HOST -t sudo curl https://raw.githubusercontent.com/weaveworks/scope/master/scope -o /usr/local/bin/scope \; sudo chmod +x /usr/local/bin/scope
    echo Restarting Scope:
    ssh_to_instance $HOST -t sudo stop scope \; sudo start scope
done
