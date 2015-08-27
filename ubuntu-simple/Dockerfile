FROM  ubuntu:trusty
RUN   export DEBIAN_FRONTEND=noninteractive ; \
        apt-get -qqy update && \
        apt-get -qqy install apache2 php5 libapache2-mod-php5 php5-mcrypt
RUN   rm -f /var/www/html/index.html 
ADD   example/index.php /var/www/html/
CMD   apache2ctl -D FOREGROUND
