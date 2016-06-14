# Image for use in demos, now that official ubuntu:latest doesn't contain nc or ping
FROM ubuntu:xenial
MAINTAINER Weaveworks Inc <help@weave.works>
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping netcat \
    && rm -rf /var/lib/apt/lists/*
