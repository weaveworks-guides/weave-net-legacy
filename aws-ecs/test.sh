#!/bin/bash

COUNTER=0
# 10 minutes
TIMEOUT=600

while true; do
    echo
    echo "CLEARING UP at $(date)"
    ./cleanup.sh
    sleep 60
    
    echo
    echo "STARTING UP ($COUNTER times so far) at $(date)"
    # Run timeout in the background so that we can kill it from the shell
    timeout $TIMEOUT ./setup.sh &
    TIMEOUTPID=$!
    trap 'kill -INT -$TIMEOUTPID; exit 1' INT
    if ! wait $TIMEOUTPID ; then
	echo FAILURE
	exit 1
    fi
    let COUNTER++
    # restore trap
    trap - INT
    sleep 15
done
    
