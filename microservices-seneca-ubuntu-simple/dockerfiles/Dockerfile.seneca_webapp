FROM    ubuntu
MAINTAINER      fintan@weave.works

RUN     apt-get -y update 
RUN     apt-get -y install nodejs
RUN     apt-get -y install npm 

# add our app
RUN 	mkdir -p /opt/app
COPY	app/. /opt/app
RUN	cd /opt/app && npm install

# and run our offer-service

CMD	["nodejs", "/opt/app/services/web-app.js" ]
