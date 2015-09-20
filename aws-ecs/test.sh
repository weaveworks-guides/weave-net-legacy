#!/bin/bash

COUNTER=0
# 10 minutes
TIMEOUT=600

run_with_timeout() {
    TOUT=$1
    shift
    # Run timeout in the background so that we can kill it from the shell
    timeout $TIMEOUT $@ &
    TIMEOUTPID=$!
    trap 'kill -INT -$TIMEOUTPID; exit 1' INT
    wait $TIMEOUTPID
    RET=$?
    # restore trap
    trap - INT
    return $RET
}


while true; do
    echo
    echo "CLEANING UP at $(date)"
    # Sometimes cleanup.sh gets stuck, run it again
    while true; do
	if ! run_with_timeout $TIMEOUT ./cleanup.sh; then
	    echo
	    echo "CLEAN UP TIMEOUT, CLEANING UP AGAIN at $(date)"
	else
	    break
	fi
    done
    sleep 60
    
    echo
    echo "STARTING UP ($COUNTER times so far) at $(date)"
    if ! run_with_timeout $TIMEOUT ./setup.sh ; then
	echo FAILURE
	exit 1
    fi
    let COUNTER++
    sleep 15
done
    
