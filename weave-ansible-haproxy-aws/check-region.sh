#!/bin/bash
#
# Weave AWS Region Check
#
# Creates an environment file we can source for use with Ansible
# based on our AWS region
#

AWS=aws
AWS_REGION=${AWS_REGION:-}
AWS_AMI=${AWS_AMI:-}
DIRNAME=`dirname $0`
WEAVEDEMO_ANSIBLE_VARS=$DIRNAME/ansible_aws_variables.yml

function usage {

    OURNAME=$(basename $0)
    echo "Usage: $OURNAME [-r AWS_REGION]"
    exit 1
}

while getopts ":r:" OPTION; do
    case $OPTION in
        r)  AWS_REGION=${OPTARG}
            ;;
        *)  usage
            ;;
    esac
done

shift $((OPTIND - 1))

if [ $DIRNAME = "." ]; then
    DIRNAME=`pwd`
fi

AMI_LIST=$DIRNAME/data/ami-list.csv

if [ ! -f $AMI_LIST ]; then
    echo "No AMI List found, exiting"
    exit 1
fi

if [ -z $AWS_REGION ]; then 
    type -P "$AWS" >/dev/null 2>&1 && echo "Getting AWS Region" || { echo "aws not found, exiting"; exit 1; } 
    AWS_REGION=$(aws configure list | grep region | awk '{print $2}')
fi

AWS_AMI=$(grep $AWS_REGION $AMI_LIST | cut -d"," -f2)

if [ -z $AWS_AMI ]; then
    echo "No AMI found in our list for region $AWS_REGION"
    exit 1
fi

echo "Generating variables file for use with Ansible"

echo "---" > $WEAVEDEMO_ANSIBLE_VARS
echo "aws_region: $AWS_REGION" >> $WEAVEDEMO_ANSIBLE_VARS
echo "template: $AWS_AMI" >> $WEAVEDEMO_ANSIBLE_VARS
