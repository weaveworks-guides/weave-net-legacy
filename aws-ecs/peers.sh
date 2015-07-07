#!/bin/bash
# This script print a list of IPs of the EC2 instances in your current ECS
# cluster.  Its uses the ecsInstanceRole IAM credentials to query the ECS
# EC2 APIs.
set -eu

aws=/usr/local/bin/aws
cluster_name() {
    if [ -e /etc/ecs/ecs.config ]; then
	cat /etc/ecs/ecs.config | grep ECS_CLUSTER | cut -d= -f2
    else
	echo default
    fi
}

ecs_cluster_name=$(cluster_name)
ecs_instance_role=$(curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/ecsInstanceRole)

export AWS_ACCESS_KEY_ID=$(echo "$ecs_instance_role" | grep AccessKeyId | cut -d':' -f2 | sed 's/[^0-9A-Z]*//g')
export AWS_SECRET_ACCESS_KEY=$(echo "$ecs_instance_role" | grep SecretAccessKey | cut -d':' -f2 | sed 's/[^0-9A-Za-z/+=]*//g')
export AWS_SESSION_TOKEN=$(echo "$ecs_instance_role" | grep Token | cut -d':' -f2 | sed 's/[^0-9A-Za-z/+=]*//g')
export AWS_DEFAULT_REGION=$(curl -s http://169.254.169.254/latest/meta-data/public-hostname | cut -d. -f 2)

ecs_container_instances=$($aws ecs list-container-instances --cluster $ecs_cluster_name | \
	jq -r '.containerInstanceArns | join(" ")')
ec2_instances=$($aws ecs describe-container-instances --container-instances $ecs_container_instances | \
	jq -r '.containerInstances | .[] | .ec2InstanceId')
ec2_ips=$($aws ec2 describe-instances --instance-ids $ec2_instances | \
	jq -r '.Reservations | .[] | .Instances | .[] | .NetworkInterfaces | .[] | .PrivateIpAddress')

echo $ec2_ips | tr '\n' ' '
echo
