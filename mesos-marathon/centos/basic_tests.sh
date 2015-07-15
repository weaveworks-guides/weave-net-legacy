#!/bin/sh -x
curl http://172.17.85.100:8080/v2/apps  \
  -X POST \
  -H 'Content-type: application/json' \
  -d '{
    "id": "basic-3",
    "cmd": "python3 -m http.server 8080",
    "cpus": 0.5,
    "mem": 32.0,
    "instances": 3,
    "container": {
      "type": "DOCKER",
      "docker": {
        "image": "python:3",
        "network": "BRIDGE",
        "portMappings": [
          { "containerPort": 8080, "hostPort": 0 }
        ],
        "parameters": [
          { "key": "hostname", "value": "basic-3.weave.local" }
        ]
      }
    }
  }'
