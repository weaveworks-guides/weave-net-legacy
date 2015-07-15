#!/bin/sh -ex
p="--project weave-testing-1"
z="--zone europe-west1-c"

gcloud compute networks create $p \
  'test-net-1'
gcloud compute firewall-rules create $p \
  'test-net-1-fw' \
  --network 'test-net-1' \
  --allow 'icmp,tcp:22,tcp:6783,udp:6783'
gcloud compute instances create $p $z \
  'weave-01' 'weave-02' \
  --image 'container-vm' \
  --preemptible \
  --network 'test-net-1' \
  --metadata-from-file 'startup-script=provision.sh'
