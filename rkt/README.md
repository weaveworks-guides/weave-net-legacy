Bring a couple of Vagrant VMs up:
```
git clone \
  https://github.com/weaveworks/guides \
  weave-guides
cd weave-guides/rkt
vagrant up
```

First, login to one of the Vagrant VMs:
```
vagrant ssh core-01
```

Start a console container:
```
core@core-01 ~ $ sudo rkt run \
  --insecure-skip-verify=true \
  --mds-register=false \
  --interactive \
  --private-net \
  docker://ubuntu
```

Set DNS IP address manually (not yet supported in rkt):
```
root@rkt-48e60c5f-c461-4d82-b6a0-22bee4feea36:/# echo 'nameserver 10.22.1.251' > /etc/resolv.conf 
```

On the second machine, wait for Redis container to boot:
```
core@core-02 ~ $ journalctl -f -u redis
```

Hit `^C` once done and run `weave-rkt-dns-add redis`.

Now, try ping it from the interactive container (TODO: automate this):
```
root@rkt-48e60c5f-c461-4d82-b6a0-22bee4feea36:/# ping -c3 redis
PING redis (10.22.2.1) 56(84) bytes of data.
64 bytes from redis.weave.local (10.22.2.1): icmp_seq=1 ttl=64 time=1.03 ms
64 bytes from redis.weave.local (10.22.2.1): icmp_seq=2 ttl=64 time=0.904 ms
64 bytes from redis.weave.local (10.22.2.1): icmp_seq=3 ttl=64 time=1.32 ms

--- redis ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2002ms
rtt min/avg/max/mdev = 0.904/1.086/1.323/0.177 ms
```

Then install Redis client:
```
root@rkt-48e60c5f-c461-4d82-b6a0-22bee4feea36:/# apt-get update
root@rkt-48e60c5f-c461-4d82-b6a0-22bee4feea36:/# apt-get install redis-tools
```

And use it:
```
root@rkt-48e60c5f-c461-4d82-b6a0-22bee4feea36:/# redis-cli -h redis
```

That's it!
