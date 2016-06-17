# Ubuntu Image #

This Dockerfile builds an image that can be used in interactive demos.

E.g.

    $ docker run -ti --net=weave weaveworks/ubuntu

The reason we need this, rather than just using the official `ubuntu`
image, is that the latter does not have `ping` and `nc` commands.
