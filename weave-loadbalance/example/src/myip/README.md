# Very basic rest server to show IP addresses

This is a very simple rest server, written in Go, to show
demonstrate IP addresses in containers. We build it as a static
binary and use it in a from scratch docker container

## Building

You will need to build this as a static binary

```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o myip
```
