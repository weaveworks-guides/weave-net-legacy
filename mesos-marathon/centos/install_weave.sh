#!/bin/bash -ex

cd $(dirname $0)

install -o root -g root -m 0755 weave /usr/bin/
install -o root -g root -m 0644 weave.target weave.service /etc/systemd/system/
