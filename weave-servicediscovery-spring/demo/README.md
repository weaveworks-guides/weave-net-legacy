# Spring Example for use with Weave

This is a very basic spring.io example for use in a demo of WeaveRun
functionality. It is derived from the docker example on spring.io.

If you are using the Vagrantfile from this example all of the requirements
are already installed. To build just use 

mvn clean package

To create the docker container use

docker build -t <your tag> .
