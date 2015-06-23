#!/bin/bash

CURL=curl

type -P "$CURL" >/dev/null 2>&1 && echo "Connecting to Nginx in Weave demo" || { echo "curl not found, exiting"; exit 1; }

for i in `seq 1 6`
do
    curl localhost:8080
done
