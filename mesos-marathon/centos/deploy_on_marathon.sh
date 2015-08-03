#!/bin/bash
MARATHON=http://172.17.85.100:8080

curl -X POST $MARATHON/v2/apps -d @$1 -H "Content-type: application/json"
