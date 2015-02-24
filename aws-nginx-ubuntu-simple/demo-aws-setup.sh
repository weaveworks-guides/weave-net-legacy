#!/bin/bash
#
# Weave Nginx AWS Demo Setup
#
# This demo is self contained, but for real world work you should provision and
# manage your amazon environment with something like chef or puppet.
#
# We also interact with the aws cli output using their --output text interface
# which you really want to avoid
#

AWS=aws
WEAVEDEMO_CIDR=${WEAVEDEMO_CIDR:-0.0.0.0/0}
WEAVEDEMO_GROUPNAME=${WEAVEDEMO_GROUPNAME:-weavedemo}
WEAVEDEMO_HOSTCOUNT=${WEAVEDEMO_HOSTCOUNT:-2}
AWS_AMI=${AWS_AMI:-}
SSH_OPTS=${SSH_OPTS:-"-o StrictHostKeyChecking=no"}
DIRNAME=`dirname $0`

if [ $DIRNAME = "." ]; then
    DIRNAME=`pwd`
fi 

AMI_LIST=$DIRNAME/data/ami-list.csv
MY_KEY=$DIRNAME/$WEAVEDEMO_GROUPNAME-key.pem
WEAVEDEMO_ENVFILE=$DIRNAME/weavedemo.env
KEYPAIR=$WEAVEDEMO_GROUPNAME-key
MY_R_FILTER="Name=instance-state-name,Values=running"
MY_SSH="ssh -i $MY_KEY"
HOSTCOUNT=0

type -P "$AWS" >/dev/null 2>&1 && echo "Setting up Weave, Docker and Nginx on AWS Demo" || { echo "aws not found, exiting"; exit 1; }

# we keep a list of ami's that we use, this is pulled from
# http://cloud-images.ubuntu.com/locator/ec2/
# but you really should check for an update

if [ ! -f $AMI_LIST ]; then
    echo "No AMI List found, exiting"
    exit 1
fi

if [ -f $MY_KEY ]; then
    echo "Found a prexisting weavedemo key, exiting"
    echo "You could try running cleanup-weave-aws-demo.sh in this directory"
    exit 1
fi

REGION=$(aws configure list | grep region | awk '{print $2}')

if [ -z $AWS_AMI ]; then
    echo "Selecting an AMI to use for the $REGION region"
    AWS_AMI=$(grep $REGION $AMI_LIST | cut -d"," -f2)    
else
    echo "Using user provided AMI of ${AWS_AMI}"
fi

#
# this is just a quick check, if we see a weavedemo account assume we have been
# run already, and exit asking the user to clean up things before running
#

THIS_DEMO=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$WEAVEDEMO_GROUPNAME" | grep weavedemo)

if [ ! -z $THIS_DEMO ]; then
    echo "You appear to have a $WEAVEDEMO_GROUPNAME group setup on AWS already"
    echo "Please clean up any pre existing runs of the demo before proceeding"
    exit 1
else
    echo "Creating a weavedemo security group"
    aws ec2 create-security-group --group-name $WEAVEDEMO_GROUPNAME --description "Weave Demo"
fi

aws ec2 authorize-security-group-ingress --group-name $WEAVEDEMO_GROUPNAME --protocol tcp --port 22 --cidr $WEAVEDEMO_CIDR
aws ec2 create-key-pair --key-name $KEYPAIR --query 'KeyMaterial' --output text > $MY_KEY
aws ec2 run-instances --image-id ami-81fa71f6  --count $WEAVEDEMO_HOSTCOUNT --instance-type t1.micro --key-name $KEYPAIR --security-groups $WEAVEDEMO_GROUPNAME 

chmod 400 $MY_KEY 

echo "Waiting for one minute for our instances to initialize"
sleep 60

OUR_IP_ADDRESSES=$(aws ec2 describe-instances --output text --filters $MY_R_FILTER | grep ^ASSOCIATION | awk '{print $4}' | sort -u)

if [ -f $WEAVEDEMO_ENVFILE ]; then
    rm -f $WEAVEDEMO_ENVFILE
fi

for i in $OUR_IP_ADDRESSES
do
    echo "Installing Weave and Docker on host $i"
    $MY_SSH $SSH_OPTS ubuntu@$i "sudo apt-get install -y apt-transport-https"
    $MY_SSH $SSH_OPTS ubuntu@$i "sudo sh -c 'echo deb https://get.docker.com/ubuntu docker main > /etc/apt/sources.list.d/docker.list'"
    $MY_SSH $SSH_OPTS ubuntu@$i "sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9"
    $MY_SSH $SSH_OPTS ubuntu@$i "sudo apt-get update"
    $MY_SSH $SSH_OPTS ubuntu@$i "sudo apt-get install -y lxc-docker"
    $MY_SSH $SSH_OPTS ubuntu@$i "sudo wget -O /usr/local/bin/weave https://github.com/zettio/weave/releases/download/latest_release/weave"
    $MY_SSH $SSH_OPTS ubuntu@$i "sudo chmod a+x /usr/local/bin/weave"
    HOSTCOUNT=`expr $HOSTCOUNT + 1`
    echo "export WEAVE_AWS_DEMO_HOST$HOSTCOUNT=$i" >> $WEAVEDEMO_ENVFILE
    DEMO_ARRAY="$DEMO_ARRAY $i"
done

DEMO_ARRAY=$(echo $DEMO_ARRAY | sed -e "s/^\s+//")
echo "export WEAVE_AWS_DEMO_HOSTCOUNT=$WEAVEDEMO_HOSTCOUNT" >> $WEAVEDEMO_ENVFILE
echo "export WEAVE_AWS_DEMO_HOSTS=($DEMO_ARRAY)" >> $WEAVEDEMO_ENVFILE
