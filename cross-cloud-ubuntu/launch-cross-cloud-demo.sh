#!/bin/bash
#
# Weave AWS/Vagrant Demo - Setup Weave and our containers
#

WEAVEDEMO_GROUPNAME=${WEAVEDEMO_GROUPNAME:-weavedemo}
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
DIRNAME=`dirname $0`

if [ $DIRNAME = "." ]; then
    DIRNAME=`pwd`
fi 

MY_KEY=$DIRNAME/$WEAVEDEMO_GROUPNAME-key.pem
WEAVEDEMO_ENVFILE=$DIRNAME/weavedemo.env
KEYPAIR=$WEAVEDEMO_GROUPNAME-key

MY_R_FILTER="Name=instance-state-name,Values=running"
MY_SSH="ssh -i $MY_KEY"

. $WEAVEDEMO_ENVFILE

echo "Launching Weave on AWS"

$MY_SSH $SSH_OPTS ubuntu@$WEAVE_AWS_DEMO_HOST1 "sudo weave launch"

echo "Launching Weave on local VM"

vagrant ssh weave-gs-01 -c "sudo weave launch $WEAVE_AWS_DEMO_HOST1"

echo "Launching WeaveDNS on AWS"

$MY_SSH $SSH_OPTS ubuntu@$WEAVE_AWS_DEMO_HOST1 "sudo weave launch-dns"

echo "Launching WeaveDNS on local VM"

vagrant ssh weave-gs-01 -c "sudo weave launch-dns"

echo "Launching Apache on AWS"

$MY_SSH $SSH_OPTS ubuntu@$WEAVE_AWS_DEMO_HOST1 "sudo weave run --name ws1 -p 80:80 weaveworks/weave-gs-nginx-apache"

echo "Launching Postgres on local VM"

vagrant ssh weave-gs-01 -c "sudo weave run --name dbserver -e POSTGRES_PASSWORD=mysecretpassword -d postgres"

echo "Note your AWS address is $WEAVE_AWS_DEMO_HOST1"
