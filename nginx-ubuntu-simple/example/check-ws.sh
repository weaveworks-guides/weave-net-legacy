#!/bin/bash

HOST_SUFFIX=0
HOST_BASE=weave-gs-0

CONTAINER=$(sudo weave run --with-dns 10.3.1.100/24 -ti -h pinger.weave.local ubuntu)

for i in `seq 1 6`
do
	if [ `expr $i % 2` == 1 ]; then
		HOST_SUFFIX=`expr $HOST_SUFFIX + 1`
	fi

	echo ""
	echo "Ping ws$i.weave.local which is on host ${HOST_BASE}${HOST_SUFFIX}"		
	echo ""
	sudo docker exec -ti $CONTAINER ping -c 1 -t 1 ws$i.weave.local 
done

sudo docker stop $CONTAINER >/dev/null 2>&1
