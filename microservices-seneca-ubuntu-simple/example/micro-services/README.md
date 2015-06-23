# Seneca Microservices Example

This example is derived from the microservices example at 
[https://github.com/rjrodger/seneca-examples/tree/master/micro-services](https://github.com/rjrodger/seneca-examples/tree/master/micro-services). We have stripped the example down further for use with Weave and Docker.

The only significant code changes are 

* the removal of specific port numbers in services/web-app.js
* the addition of dns hostnames in services/web-app.js
* updating seneca.client.listen to use the default port of 10101
* updating app.listen to use port 80

Details on the Dockerfiles we used for generating our containers are in the 
dockerfiles directory for this example. 
