FROM	ubuntu
MAINTAINER	fintan@weave.works
RUN	apt-get -y update 
RUN	apt-get -y install apache2
RUN     apt-get -y install php5 libapache2-mod-php5 php5-mcrypt
RUN     sed -e "s/DirectoryIndex/DirectoryIndex index.php/" < /etc/apache2/mods-enabled/dir.conf > /tmp/foo.sed
RUN     mv /tmp/foo.sed /etc/apache2/mods-enabled/dir.conf
ADD     example/index.php /var/www/html/
CMD     ["/usr/sbin/apache2ctl", "-D FOREGROUND" ]
