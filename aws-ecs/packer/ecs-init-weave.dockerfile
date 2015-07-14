FROM centos

ENV GOPATH=/

# Build amazon-ecs-init
RUN yum -y install git golang make rpm-build
RUN mkdir -p /src/github.com/aws/
RUN git clone -b dev https://github.com/aws/amazon-ecs-init.git /src/github.com/aws/amazon-ecs-init
RUN make -C /src/github.com/aws/amazon-ecs-init
# for some reason Make rpm doens't put the sources where expected 
RUN make -C /src/github.com/aws/amazon-ecs-init sources
RUN mkdir -p /root/rpmbuild/SOURCES
RUN cp /src/github.com/aws/amazon-ecs-init/{sources.tgz,ecs.conf} /root/rpmbuild/SOURCES/
RUN make -C /src/github.com/aws/amazon-ecs-init rpm

# Build special version of weave with proxy chunking fixes
RUN yum -y install docker glibc-static flex bison
RUN curl -L http://www.tcpdump.org/release/libpcap-1.7.4.tar.gz -o libpcap-1.7.4.tar.gz
RUN tar -xzf libpcap-1.7.4.tar.gz
RUN cd libpcap-1.7.4 && ./configure && make && make install
RUN go clean -i net
RUN go install -tags netgo std
RUN mkdir -p /src/github.com/weaveworks
RUN git clone -b donotremove/aws-ecs https://github.com/weaveworks/weave.git /src/github.com/weaveworks/weave
# we are root, so sudo shouldn't do anything
RUN echo -e '#!/bin/bash\nexec $@\n' > /bin/sudo && chmod +x /bin/sudo
# Build weave using the host's docker daemon
RUN DOCKER_HOST=$(/sbin/ip route|awk '/default/ { print $3 }'):2375  make -C /src/github.com/weaveworks/weave