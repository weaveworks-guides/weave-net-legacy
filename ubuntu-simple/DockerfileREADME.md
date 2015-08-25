# Getting started with Weave and Docker on Ubuntu - Dockerfile #

For this _Getting Started with Weave and Docker on Ubuntu Guide_ we created a small docker image, `fintanr/weave-gs-simple-hw` and also included the Dockerfile that was used to create this Docker image. 

While this is a very simple example, it demonstrates how easy it is to create Docker images.

```bash
MAINTAINER    help@weave.works
FROM          ubuntu
RUN           apt-get -y update
RUN           apt-get -y install apache2
RUN           apt-get -y install php5 libapache2-mod-php5 php5-mcrypt
RUN           sed -e "s/DirectoryIndex/DirectoryIndex index.php/" < /etc/apache2/mods-enabled/dir.conf > /tmp/foo.sed
RUN           mv /tmp/foo.sed /etc/apache2/mods-enabled/dir.conf
ADD           example/index.php /var/www/html/
CMD           ["/usr/sbin/apache2ctl", "-D FOREGROUND"]
```

A quick explanation of the Dockerfile

- `FROM` - this is the image we have used as the basis for our image
- `MAINTAINER` - the name and/or e-mail address of the maintainer of this image
- `RUN` - a command or commands to run when creating the image
- `ADD` - add a file to the docker image you are creating
- `CMD` - a command or commands to run when the docker image is launched

As you can see, the Ubuntu Docker image is used as our basis, updating this image, installing and configuring `apache2` and `php`. We then copy a new default Apache page into place. Finally when a container is launched with this image we start an Apache webserver.

The Docker documentation provides a lot more detail on [building docker images](https://docs.docker.com/reference/builder/)

If you have worked through the steps in this guide you will find the Dockerfile in the `/home/vagrant` directory on each host you created. 

Try reviewing the docker images documentation and then create your own Ubuntu docker image using curl, similar to the image we installed in the guide.
