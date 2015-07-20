FROM centos

ENV GOPATH=/

# Build amazon-ecs-init
RUN yum -y install git golang make rpm-build; yum clean all
RUN mkdir -p /src/github.com/aws/
RUN git clone -b dev https://github.com/aws/amazon-ecs-init.git /src/github.com/aws/amazon-ecs-init
RUN make -C /src/github.com/aws/amazon-ecs-init
# for some reason Make rpm doens't put the sources where expected 
RUN make -C /src/github.com/aws/amazon-ecs-init sources
RUN mkdir -p /root/rpmbuild/SOURCES
RUN cp /src/github.com/aws/amazon-ecs-init/{sources.tgz,ecs.conf} /root/rpmbuild/SOURCES/
RUN make -C /src/github.com/aws/amazon-ecs-init rpm
