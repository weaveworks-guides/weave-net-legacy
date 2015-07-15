#!/bin/bash -ex

cd $(dirname $0)

## This configures Mesos slave to use Docker containerizer and points it to Weave proxy
install -o root -g root -d /etc/systemd/system/mesos-slave.service.d
install -o root -g root mesos-slave-containerizers.conf /etc/systemd/system/mesos-slave.service.d

printf '%s\n' "$*" > /etc/mesos/zk

systemctl -q daemon-reload
systemctl -q start mesos-slave.service
