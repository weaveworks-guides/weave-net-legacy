#!/bin/bash

if [ -z "${AWS_ACCESS_KEY_ID+x}" -a -z "${AWS_SECRET_ACCESS_KEY+x}" ]; then
    echo "error: both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY needs to be set"
    echo "usage: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY $0"
    exit 1
fi

# Taken from http://docs.aws.amazon.com/AmazonECS/latest/developerguide/launch_container_instance.html
BASE_AMIS=('us-east-1:ami-b540eade'
	   'us-west-1:ami-5721df13'
	   'us-west-2:ami-cb584dfb'
	   'eu-west-1:ami-2aaef35d'
	   'ap-northeast-1:ami-8aa61c8a'
	   'ap-southeast-2:ami-5ddc9f67'
	  )

# Mimic associative arrays using ":" to compose keys and values,
# to make them work in bash v3
function key(){
    echo  ${1%%:*}
}

function value(){
    echo  ${1#*:}
}

# Access is O(N) but .. we are mimicking maps with arrays
function get(){
    KEY=$1
    shift
    for I in $@; do
	if [ $(key $I) = "$KEY" ]; then
	    echo $(value $I)
	    return
	fi
    done
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
    LOGFILE=$(mktemp /tmp/${1}-packer-log-weave-ecs-XXXX)
    packer build -var "aws_access_key=${AWS_ACCESS_KEY_ID}" -var "aws_secret_key=${AWS_SECRET_ACCESS_KEY}" -var "aws_region=$1" -var "source_ami=$2" template.json > $LOGFILE
    if [ "$?" = 0 ]; then
	echo "Success: $(tail -n 1 $LOGFILE)"
	rm $LOGFILE
    else
	echo "Failure: $1: see $LOGFILE for details"
    fi
}

BUILD_FOR_REGIONS=""
if [ -n "${ONLY_REGION+x}" ]; then
    if [ -z "$(get $ONLY_REGION ${BASE_AMIS[@]})" ]; then
	echo "error: ONLY_REGION set to '$ONLY_REGION', which doesn't offer ECS yet, please set it to one from: ${REGIONS}"
	exit 1
    fi
    BUILD_FOR_REGIONS="$ONLY_REGION"
else
    BUILD_FOR_REGIONS="$REGIONS"
fi

echo
echo "Spawning parallel packer builds"
echo



for REGION in $BUILD_FOR_REGIONS; do
    AMI=$(get $REGION ${BASE_AMIS[@]})
    echo Spawning AMI build for region $REGION based on AMI $AMI
    invoke_packer "${REGION}" "${AMI}" &
done

echo
echo "Waiting for builds to finish, this will take a few minutes, please be patient"
echo

wait

echo
echo "Done"
echo
