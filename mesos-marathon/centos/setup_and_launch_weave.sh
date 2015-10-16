#!/bin/bash -ex
printf 'WEAVE_PEERS="%s"\n' "$*" > /etc/weave.env
systemctl -q --no-block start weaveproxy weave.service
