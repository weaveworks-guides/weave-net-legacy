You will need to build this as a static binary

```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o myip
```

