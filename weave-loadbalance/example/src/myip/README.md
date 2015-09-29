# Very Basic REST Server to Display a Weave IP Address

This is a very simple rest server, written in Go, to
demonstrate IP addresses in containers. We build it as a static
binary and use it in a from scratch docker container.

We only look up the ip address of `ethwe` for the purposes of 
this example.

## Building

1. You will need to build this as a static binary:

```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o myip
```
2. Create your docker image and then run it in a container.