#!/bin/bash

WEAVE_ECS_AMIS=('us-east-1:ami-97b86afc'
		'us-west-2:ami-69d3de59'
		'eu-west-1:ami-d26d25a5'
		'ap-northeast-1:ami-083b8f08'
		'ap-southeast-2:ami-1d80c627'
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
for I in ${WEAVE_ECS_AMIS[@]}; do
    REGIONS="$REGIONS $(key $I)"
done

# Check that we have everything we need

if [ -z "$(which aws)" ]; then
    echo "error: Cannot find AWS-CLI, please make sure it's installed"
    exit 1
fi

REGION=$(aws configure list 2> /dev/null | grep region | awk '{ print $2 }')
if [ -z "$REGION" ]; then
    echo "error: Region not set, please make sure to run 'aws configure'"
    exit 1
fi

AMI=""
for I in ${WEAVE_ECS_AMIS[@]}; do
    if [ "$(key $I)" = "$REGION" ]; then
	AMI=$(value $I)
    fi
done

if [ -z "$AMI" ]; then
    echo "error: AWS-CLI is using '$REGION', which doesn't offer ECS yet, please set it to one from: ${REGIONS}"
    exit 1
fi

# Check that setup wasn't already run
CLUSTER_STATUS=$(aws ecs describe-clusters --clusters weave-ecs-demo-cluster --query 'clusters[0].status' --output text)
if [ "$CLUSTER_STATUS" != "None" -a "$CLUSTER_STATUS" != "INACTIVE" ]; then
    echo "error: ECS cluster weave-ecs-demo-cluster is active, run cleaup.sh first"
    exit 1
fi    


set -euo pipefail

# Cluster
echo -n "Creating ECS cluster (weave-ecs-demo-cluster) .. "
aws ecs create-cluster --cluster-name weave-ecs-demo-cluster > /dev/null
echo "done"

# Security group
echo -n "Creating Security Group (weave-ecs-demo) .. "
SECURITY_GROUP=$(aws ec2 create-security-group --group-name weave-ecs-demo --description 'Weave ECS Demo' --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 6783 --source-group weave-ecs-demo
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol udp --port 6783 --source-group weave-ecs-demo
echo "Done"

# Key pair
echo -n "Creating Key Pair (weave-ecs-demo, file weave-ecs-demo-key.pem) .. "
aws ec2 create-key-pair --key-name weave-ecs-demo-key --query 'KeyMaterial' --output text > weave-ecs-demo-key.pem
chmod 600 weave-ecs-demo-key.pem
echo "done"

# IAM role
echo -n "Creating IAM role (weave-ecs-role) .. "
aws iam create-role --role-name weave-ecs-role --assume-role-policy-document file://data/weave-ecs-role.json > /dev/null
aws iam put-role-policy --role-name weave-ecs-role --policy-name weave-ecs-policy --policy-document file://data/weave-ecs-policy.json
aws iam create-instance-profile --instance-profile-name weave-ecs-instance-profile > /dev/null
# Wait for the instance to be ready, otherwise we get an error
sleep 5
aws iam add-role-to-instance-profile --instance-profile-name weave-ecs-instance-profile --role-name weave-ecs-role
echo "done"

# Launch configuration
echo -n "Creating Launch Configuration (weave-ecs-launch-configuration) .. "
# Wait for the role to be ready, otherwise we get:
# A client error (ValidationError) occurred when calling the CreateLaunchConfiguration operation: You are not authorized to perform this operation.
sleep 8
aws autoscaling create-launch-configuration --image-id ${AMI} --launch-configuration-name weave-ecs-launch-configuration --key-name weave-ecs-demo-key --security-groups ${SECURITY_GROUP} --instance-type t2.micro --user-data file://data/set-ecs-cluster-name.sh  --iam-instance-profile weave-ecs-instance-profile --associate-public-ip-address --instance-monitoring Enabled=false
echo "done"

# Auto Scaling Group
echo -n "Creating Auto Scaling Group (weave-ecs-demo-group) with 3 instances .. "
SUBNET=$(aws ec2 describe-subnets --query 'Subnets[0].SubnetId' --output text)
aws autoscaling create-auto-scaling-group --auto-scaling-group-name weave-ecs-demo-group --launch-configuration-name weave-ecs-launch-configuration --min-size 3 --max-size 3 --desired-capacity 3 --vpc-zone-identifier ${SUBNET}
echo "done"

# Wait for instances to join the cluster
echo -n "Waiting for instances to join the cluster (this may take a few minutes) .. "
while [ "$(aws ecs describe-clusters --clusters weave-ecs-demo-cluster --query 'clusters[0].registeredContainerInstancesCount' --output text)" != 3 ]; do
    sleep 2
done
echo "done"

# Task definition
echo -n "Registering ECS Task Definition (weave-ecs-demo-task) .. "
aws ecs register-task-definition --family weave-ecs-demo-task --container-definitions "$(cat data/weave-ecs-demo-containers.json)" > /dev/null
echo "done"

# Launch tasks
echo -n "Launching (3) tasks .. "
FAILURES="$(aws ecs run-task --cluster weave-ecs-demo-cluster --task-definition weave-ecs-demo-task --count 3 --query failures)"
if [ -n "$FAILURES" ]; then
    echo "failed:"
    echo "$FAILURES"
    exit 1
fi
echo "done"

# Wait for tasks to start running
echo -n "Waiting for tasks to start running .. "
while [ "$(aws ecs describe-clusters --clusters weave-ecs-demo-cluster --query 'clusters[0].runningTasksCount')" != 3 ]; do
    sleep 2
done
echo "done"


# Print out the public hostnames of the instances we created
INSTANCE_IDS=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names weave-ecs-demo-group --query 'AutoScalingGroups[0].Instances[*].InstanceId' --output text)
DNS_NAMES=$(aws ec2 describe-instances --instance-ids ${INSTANCE_IDS} --query 'Reservations[0].Instances[*].PublicDnsName' --output text)

echo "Setup is ready!"
echo "Open your browser and go to any of these URLs:"
for NAME in $DNS_NAMES; do
    echo "  http://$NAME"
done
