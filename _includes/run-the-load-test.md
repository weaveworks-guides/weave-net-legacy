### Run the Load Test

Unless there is load on the app, you cannot see full topology in Weave Cloud. To observe the topology,
you will need to run a load test:
```
docker run -ti --rm --name=LOAD_TEST \
  --net=shop_external \
  weaveworksdemos/load-test -h edge-router -r 100 -c 2
```

While the load test is running, you should see how different services communicate, and the topology
graph in Weave Cloud console will form.
