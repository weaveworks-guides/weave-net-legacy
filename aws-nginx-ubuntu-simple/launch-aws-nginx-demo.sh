#!/bin/bash
#
# Weave Nginx AWS Demo - Setup Weave and our containers
#

WEAVEDEMO_GROUPNAME=${WEAVEDEMO_GROUPNAME:-weavedemo}
WEAVEDEMO_HOSTCOUNT=${WEAVEDEMO_HOSTCOUNT:-2}
AWS_AMI=${AWS_AMI:-}
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
DNS_OFFSET=1
CONTAINER_OFFSET=1
DNS_BASE=10.2.1
APP_BASE=10.3.1

function launchWeave() {

    myHostIP=$1
    myWeaveDnsPeer=$2
    myDnsOffSet=$3

    myDnsIp=$(echo "$DNS_BASE.$myDnsOffSet")

    echo "Launching Weave and WeaveDNS on $myHostIP"

    if [ $myHostIP != $myWeaveDnsPeer ]; then
        $MY_SSH $SSH_OPTS ubuntu@$myHostIP "sudo weave launch"
    else 
        $MY_SSH $SSH_OPTS ubuntu@$myHostIP "sudo weave launch $myWeaveDnsPeer"
    fi

    $MY_SSH $SSH_OPTS ubuntu@$myHostIP "sudo weave launch-dns $myDnsIp/24"

}

function launchApacheDemo() {

    myHostIP=$1
    myContainerOffSet=$2

    myContainerIP=$(echo "$APP_BASE.$myContainerOffSet")
    myDnsName=$(echo "ws$myContainerOffSet.weave.local")

    echo "Launching php app container $myDnsName on $myHostIP with $myContainerIP"

    $MY_SSH $SSH_OPTS ubuntu@$myHostIP "sudo weave run --with-dns $myContainerIP/24 -h $myDnsName fintanr/weave-gs-nginx-apache"
}

function launchNginx() {
    
    myHostIP=$1
    myContainerOffSet=$2

    myContainerIP=$(echo "$APP_BASE.$myContainerOffSet")
    myDnsName=nginx.weave.local

    echo "Launching nginx front end app container $myDnsName on $myHostIP with $myContainerIP"
    $MY_SSH $SSH_OPTS ubuntu@$myHostIP "sudo weave run --with-dns $myContainerIP/24 -ti -h $myDnsName -d -p 80:80 fintanr/weave-gs-nginx-simple"

}

echo "Launching Weave and WeaveDNS on each AWS host"

. $WEAVEDEMO_ENVFILE

TMP_HOSTCOUNT=$(expr $WEAVEDEMO_HOSTCOUNT - 1)

while [ $TMP_HOSTCOUNT -ge 0 ]; do
    HOST_IP=${WEAVE_AWS_DEMO_HOSTS[$TMP_HOSTCOUNT]}  
    launchWeave $HOST_IP $WEAVE_AWS_DEMO_HOST1 $DNS_OFFSET
    DNS_OFFSET=$(expr $DNS_OFFSET + 1)
    TMP_HOSTCOUNT=$(expr $TMP_HOSTCOUNT - 1)
done

echo "Launching 3 Simple PHP App Containers on each AWS host"

TMP_HOSTCOUNT=$(expr $WEAVEDEMO_HOSTCOUNT - 1)

while [ $TMP_HOSTCOUNT -ge 0 ]; do
    HOST_IP=${WEAVE_AWS_DEMO_HOSTS[$TMP_HOSTCOUNT]}  

    while [ `expr $CONTAINER_OFFSET % 3` -ne 0 ]; do   
        launchApacheDemo $HOST_IP $CONTAINER_OFFSET
        CONTAINER_OFFSET=$(expr $CONTAINER_OFFSET + 1 )
    done
    TMP_HOSTCOUNT=$(expr $TMP_HOSTCOUNT - 1)
done

echo "Launching our Nginx front end"

launchNginx $WEAVE_AWS_DEMO_HOST1 $CONTAINER_OFFSET
