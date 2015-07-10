#!/bin/bash
# This script print a list of IPs of the EC2 instances in your current ECS
# cluster.
set -eu

# Read agent configuration
if [ -e /etc/ecs/ecs.config ]; then
  . /etc/ecs/ecs.config
else
  ECS_CLUSTER=default
fi

aws=/usr/local/bin/aws

export AWS_DEFAULT_REGION=$(curl -s curl http://169.254.169.254/latest/dynamic/instance-identity/document | \
                            jq -r .region)
current_instance_id=$(curl -s curl http://169.254.169.254/latest/dynamic/instance-identity/document | \
                      jq -r .instanceId)

ecs_container_instances=$($aws ecs list-container-instances --cluster $ECS_CLUSTER | \
	jq -r '.containerInstanceArns | join(" ")')

if [ -z "$ecs_container_instances" ]; then
# no peers found
  exit 0
fi

ec2_instances=$($aws ecs describe-container-instances --cluster $ECS_CLUSTER --container-instances $ecs_container_instances | \
	jq -r '.containerInstances | .[] | .ec2InstanceId')

# Filter out current instance
filtered_instances=""
for instance_id in $ec2_instances; do
  if [ "$instance_id" != "$current_instance_id" ]; then
    filtered_instances="$filtered_instances $instance_id"
  fi
done

if [ -z "$filtered_instances" ]; then
# no peers found
  exit 0
fi

ec2_ips=$($aws ec2 describe-instances --instance-ids $filtered_instances | \
	jq -r '.Reservations | .[] | .Instances | .[] | .NetworkInterfaces | .[] | .PrivateIpAddress')

echo $ec2_ips | tr '\n' ' '
echo
