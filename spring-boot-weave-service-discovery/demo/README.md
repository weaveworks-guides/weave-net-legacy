# Spring Example for use with Weave

This is a very basic [Spring](http://spring.io) example for use in a demo of [Weave Run](http://weave.works/run) functionality. It is derived from [_'Spring Boot with Docker'_](http://spring.io/guides/gs/spring-boot-docker/).

If you are using the `Vagrantfile` from this example all of the requirements are already installed.

To build just use 
~~~
mvn clean package
~~~

To create the container image use

~~~
docker build -t <your tag> .
~~~
