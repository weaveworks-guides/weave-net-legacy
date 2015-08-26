#!/bin/bash -ex
systemctl -q start zookeeper.service                                                                                                                                    
sleep 5
systemctl -q start mesos-master.service marathon.service
