### Docker for Mac

Get the code:
```
git clone https://github.com/weaveworks/guides
git checkout weave-demo-app
cd scope-on-docker-for-mac
```
Deploy the shop app:
```
docker-compose pull
docker-compose -p shop up -d && open http://localhost:80
```

Install and launch Weave Scope:
```
curl -sLO https://raw.github.com/weaveworks/scope/master/scope
bash ./scope launch && open http://localhost:4040
```

Run a load test:
```
docker run -ti --rm --name=LOAD_TEST --net=shop_external weaveworksdemos/load-test -h edge-router -r 1000 -c 20
```
