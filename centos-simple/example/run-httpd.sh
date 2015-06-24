#!/bin/bash

# forked from
# https://github.com/CentOS/CentOS-Dockerfiles/blob/master/httpd/centos7/run-httpd.sh
#

# Make sure we're not confused by old, incompletely-shutdown httpd
# context after restarting the container.  httpd won't start correctly
# if it thinks it is already running.
rm -rf /run/httpd/*

exec /usr/sbin/apachectl -D FOREGROUND
