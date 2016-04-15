#!/bin/bash

set -euo pipefail

ssh_to_instance() {
    HOST=$1
    shift
    ssh -o "StrictHostKeyChecking no" -i `dirname $0`/weave-ecs-demo-key.pem ec2-user@$HOST $@
}

SCOPE_IMAGE_FILE=$(mktemp /tmp/scope-update-image-tar-XXXX)
trap 'rm $SCOPE_IMAGE_FILE' EXIT
echo -n 'Saving current Scope image .. '
docker save weaveworks/scope:latest> $SCOPE_IMAGE_FILE
echo done

INSTANCE_HOSTNAMES=$(`dirname "$0"`/echo_instances.sh)
echo Updating Scope in $INSTANCE_HOSTNAMES:
echo

for HOST in $INSTANCE_HOSTNAMES; do
    echo
    echo Updating $HOST;
    echo Current scope image:
    ssh_to_instance $HOST docker images weaveworks/scope
    echo -n 'Stopping Scope and removing images .. '
    ssh_to_instance $HOST -t sudo stop scope > /dev/null || true
    ssh_to_instance $HOST docker rm -f weavescope > /dev/null || true
    ssh_to_instance $HOST docker rmi '$(docker images -q weaveworks/scope)' > /dev/null || true
    echo -n 'Updating Scope image .. '
    ssh_to_instance $HOST docker load < $SCOPE_IMAGE_FILE
    echo done
    echo 'New Scope image:'
    ssh_to_instance $HOST docker images weaveworks/scope
    echo Updating scope script:
    ssh_to_instance $HOST -t sudo curl https://raw.githubusercontent.com/weaveworks/scope/master/scope -o /usr/local/bin/scope \; sudo chmod +x /usr/local/bin/scope
    echo -n 'Restarting Scope .. '
    ssh_to_instance $HOST -t sudo start scope
    echo done
done
