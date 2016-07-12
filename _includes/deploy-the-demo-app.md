### Deploy the Demo App

In this guide you will deploy a miscroservices app that [we have built](demo-app). The app is a full-blown
online store, which sells socks.

Get the code:
```
git clone https://github.com/weaveworks/guides
cd microservices-demo-app
```
Deploy the shop app:
```
docker-compose pull
docker-compose -p shop up -d
open http://localhost
```

Once the app has been loaded in your browser, you can test the functionality. The user interface should be
self-explanatory. Login using `user1`/`password1`, put an item in the basket and proceed to checkout.

[demo-app]: https://github.com/weaveworks/weaveDemo

