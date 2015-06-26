# Very basic rest server to show Weave IP address

This is a very simple rest server, written in Go, to show
demonstrate IP addresses in containers. We build it as a static
binary and use it in a from scratch docker container

We only look up the ip address of `ethwe` for the purposes of 
this example.

## Building

You will need to build this as a static binary

```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o myip
```
