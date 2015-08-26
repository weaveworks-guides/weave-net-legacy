#!/bin/bash
# This script print a list of IPs of the EC2 instances in your current Autoscaling Group.
set -eu

aws=/usr/local/bin/aws

export AWS_DEFAULT_REGION=$(curl -s curl http://169.254.169.254/latest/dynamic/instance-identity/document | \
                            jq -r .region)
current_instance_id=$(curl -s curl http://169.254.169.254/latest/meta-data/instance-id)
current_autoscaling_group=$(aws autoscaling describe-auto-scaling-instances | \
                            jq -r ".AutoScalingInstances[] | select(.InstanceId == \"$current_instance_id\") | .AutoScalingGroupName")

if [ -z "$current_autoscaling_group" ]; then
  echo "instance doesn't belong to an autoscaling group" | logger -p local0.error  -t weave/peers.sh -s
  exit 1
fi

peer_instances=$($aws autoscaling describe-auto-scaling-instances | \
                jq -r ".AutoScalingInstances[] | select(.AutoScalingGroupName == \"$current_autoscaling_group\" and .InstanceId != \"$current_instance_id\") | .InstanceId")

if [ -z "$peer_instances" ]; then
# no peers found
  exit 0
fi

peer_ips=$($aws ec2 describe-instances --instance-ids $peer_instances | \
	jq -r '.Reservations | .[] | .Instances | .[] | .NetworkInterfaces | .[] | .PrivateIpAddress')

echo $peer_ips | tr '\n' ' '
echo
