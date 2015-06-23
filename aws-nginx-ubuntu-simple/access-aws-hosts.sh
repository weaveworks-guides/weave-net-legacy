#!/bin/bash

DIRNAME=`dirname $0`

if [ $DIRNAME = "." ]; then
    DIRNAME=`pwd`
fi 

MY_KEY=$DIRNAME/$WEAVEDEMO_GROUPNAME-key.pem
WEAVEDEMO_ENVFILE=$DIRNAME/weavedemo.env

if [ ! -f $WEAVEDEMO_ENVFILE ]; then
    echo "Unable to find weavedemo.env, exiting"
    exit 1
fi

. $WEAVEDEMO_ENVFILE

CURL=curl

type -P "$CURL" >/dev/null 2>&1 && echo "Connecting to Nginx in Weave on AWS demo" || { echo "curl not found, exiting"; exit 1; }

for i in `seq 1 6`
do
    curl $WEAVE_AWS_DEMO_HOST1
done
