#!/bin/bash

if [ -z "${AWS_ACCESS_KEY_ID}" -a -z "${AWS_SECRET_ACCESS_KEY}" ]; then
    echo "error: both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY need to be set"
    echo "usage: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE AWS_SECRET_ACCES_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY $0"
    exit 1
fi

# Taken from http://docs.aws.amazon.com/AmazonECS/latest/developerguide/launch_container_instance.html
declare -A BASE_AMIS
BASE_AMIS['us-east-1']='ami-8da458e6'
BASE_AMIS['us-west-2']='ami-db0306eb'
BASE_AMIS['eu-west-1']='ami-7948320e'
BASE_AMIS['ap-northeast-1']='ami-fa12b7fa'
BASE_AMIS['ap-southeast-2']='ami-014f353b'

invoke_packer() {
    packer build -var "aws_access_key=${AWS_ACCESS_KEY_ID}" -var "aws_secret_key=${AWS_SECRET_ACCESS_KEY}" -var "aws_region=$1" -var "source_ami=$2" template.json
}

if [ -n "${ONLY_REGION}" ]; then
    invoke_packer "${ONLY_REGION}" "${BASE_AMIS[$ONLY_REGION]}"
else
    for REGION in "${!BASE_AMIS[@]}"; do
	invoke_packer "${REGION}" "${BASE_AMIS[$REGION]}"
    done
fi
