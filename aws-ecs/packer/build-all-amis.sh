#!/bin/bash

set -euo pipefail

if [ -z "${AWS_ACCESS_KEY_ID+x}" -a -z "${AWS_SECRET_ACCESS_KEY+x}" ]; then
    echo "error: both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY need to be set"
    echo "usage: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY $0"
    exit 1
fi

# Taken from http://docs.aws.amazon.com/AmazonECS/latest/developerguide/launch_container_instance.html
BASE_AMIS=('us-east-1:ami-8da458e6'
	   'us-west-2:ami-db0306eb'
	   'eu-west-1:ami-7948320e'
	   'ap-northeast-1:ami-fa12b7fa'
	   'ap-southeast-2:ami-014f353b'
	  )

# Mimic associative arrays using ":" to compose keys and values,
# to make them work in bash v3
function key(){
    echo  ${1%%:*}
}

function value(){
    echo  ${1#*:}
}

REGIONS=""
for I in ${BASE_AMIS[@]}; do
    REGIONS="$REGIONS $(key $I)"
done

if [ -z "$(which packer)" ]; then
    echo "error: Cannot find Packer, please make sure it's installed"
    exit 1
fi

function invoke_packer() {
    packer build -var "aws_access_key=${AWS_ACCESS_KEY_ID}" -var "aws_secret_key=${AWS_SECRET_ACCESS_KEY}" -var "aws_region=$1" -var "source_ami=$2" template.json
}

if [ -n "${ONLY_REGION+x}" ]; then
    AMI=""
    for I in ${BASE_AMIS[@]}; do
	if [ "$(key $I)" = "$ONLY_REGION" ]; then
	    AMI=$(value $I)
	fi
    done
    if [ -z "$AMI" ]; then
	echo "error: ONLY_REGION set to '$ONLY_REGION', which doesn't offer ECS yet, please set it to one from: ${REGIONS}"
	exit 1
    fi
    echo "${ONLY_REGION}" "${AMI}"
    invoke_packer "${ONLY_REGION}" "${AMI}"
else
    for I in ${BASE_AMIS[@]}; do
	REGION=$(key $I)
	AMI=$(value $I)
	invoke_packer "${REGION}" "${AMI}"
    done
fi
