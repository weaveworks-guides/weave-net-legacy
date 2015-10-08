# Weave, Seneca and Docker buildfiles

If you would like to recreate these images, create a sudirectory app inside the dockerfiles directory and then copy the contents of ../example/micro-services into it. 

Build the docker images using the following commands:

```bash
docker build -f ./Dockerfile.seneca_webapp -t yourtag_webapp .
docker build -f ./Dockerfile.seneca_offer -t yourtag_offer .
docker build -f ./Dockerfile.seneca_user -t yourtag_user .
```
