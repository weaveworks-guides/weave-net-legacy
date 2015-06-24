#!/bin/bash
#
# Weave Demo Quick Cleanup Script
#

# 
# This script will cleanup a weavedemo AWS environment, please use with care.
# if you have any doubts at all as to what this script does use the AWS console
# to shutdown and remove these demo instances.
#

WEAVEDEMO_GROUPNAME=${WEAVEDEMO_GROUPNAME:-weavedemo}
WEAVEDEMO_KEY=${MY_KEY:-$WEAVEDEMO_GROUPNAME-key}
MY_SLEEP=0

DIRNAME=`dirname $0`

if [ $DIRNAME = "." ]; then
    DIRNAME=`pwd`
fi 

MY_KEY=$DIRNAME/$WEAVEDEMO_GROUPNAME-key.pem

AWS=aws

type -P "$AWS" >/dev/null 2>&1 && echo "Cleaning up Weave AWS Demo environment" || { echo "aws not found, exiting"; exit 1; }

MY_R_FILTER="Name=instance-state-name,Values=running"
MY_GROUP_FILTER="Name=instance.group-name,Values=$WEAVEDEMO_GROUPNAME"

for i in `aws ec2 describe-instances --filters $MY_R_FILTER $MY_GROUP_FILTER --output text | grep ^INSTANCES | awk '{print $8}'`
do
    echo "Terminating AWS Instance $i"
    aws ec2 terminate-instances  --instance-ids $i
    MY_SLEEP=60
done

# We need to wait a bit for the instances to disapper, so we just sleep"

if [ $MY_SLEEP -gt 0 ]; then
    echo "Sleeping for $MY_SLEEP seconds to allow all instances to terminate"
    sleep $MY_SLEEP
fi

aws ec2 describe-key-pairs --key-names $WEAVEDEMO_KEY >/dev/null 2>&1
if [ $? == 0 ]; then
    echo "Deleting AWS key pair $WEAVEDEMO_KEY"
    aws ec2 delete-key-pair --key-name $WEAVEDEMO_KEY
fi

aws ec2 describe-security-groups --group-names $WEAVEDEMO_GROUPNAME >/dev/null 2>&1
if [ $? == 0 ]; then
    echo "Deleting AWS security group $WEAVEDEMO_GROUPNAME"
    aws ec2 delete-security-group --group-name $WEAVEDEMO_GROUPNAME
fi

rm -f $MY_KEY
