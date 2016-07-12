### Install Docker for Mac

If you haven't installed Docker for Mac, please follow the installation instructions on [Docker website][install-d4m].

Once it's runing you should see <img alt="Docker Icon in the Mac OS menu bar" src="docker-for-mac-menu-bar-icon.png"
style="height: 1em;" /> in your menu bar.

[install-d4m]: https://docs.docker.com/docker-for-mac/

### Install the Application

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

### Use Weave Scope

Install and launch Weave Scope:
```
curl -sLO https://raw.github.com/weaveworks/scope/master/scope
bash ./scope launch && open http://localhost:4040
```

Run a load test:
```
docker run -ti --rm --name=LOAD_TEST --net=shop_external weaveworksdemos/load-test -h edge-router -r 1000 -c 20
```
