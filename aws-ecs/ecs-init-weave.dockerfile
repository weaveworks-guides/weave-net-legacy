FROM centos

ENV GOPATH=/

RUN yum -y install git golang make rpm-build
RUN mkdir -p /src/github.com/tomwilkie/
RUN git clone -b 14-docker-endpoint https://github.com/tomwilkie/amazon-ecs-init.git /src/github.com/tomwilkie/amazon-ecs-init
RUN make -C /src/github.com/tomwilkie/amazon-ecs-init
# for some reason Make rpm doens't put the sources where expected 
RUN make -C /src/github.com/tomwilkie/amazon-ecs-init sources
RUN mkdir -p /root/rpmbuild/SOURCES
RUN cp /src/github.com/tomwilkie/amazon-ecs-init/{sources.tgz,ecs.conf} /root/rpmbuild/SOURCES/
RUN make -C /src/github.com/tomwilkie/amazon-ecs-init rpm
