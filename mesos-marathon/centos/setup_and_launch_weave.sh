#!/bin/bash -ex
printf 'WEAVE_PEERS="%s"\n' "$*" > /etc/weave.env
systemctl -q start weave.service weaveproxy.service
