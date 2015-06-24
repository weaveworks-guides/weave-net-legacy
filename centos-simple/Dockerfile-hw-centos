FROM    centos
MAINTAINER      fintan@weave.works
RUN     yum install -y httpd
RUN     yum install -y php
ADD     example/index.php /var/www/html/
ADD     example/run-httpd.sh /run-httpd.sh
RUN     chmod -v +x /run-httpd.sh
CMD     ["/run-httpd.sh"]
