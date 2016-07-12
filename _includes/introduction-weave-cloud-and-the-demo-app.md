### Introduction: Weave Cloud and the Demo App

In this guide you will learn how Weave Cloud can help you to understand a microservices app. You will deploy
an app consisting of several microservices written in different languages (Node.js, Java and Go) as well as
data services (RabbitMQ and MongoDB). You will use Docker for Docker Compose to deploy this app on
your local machine, and then use the Weave Scope Probe to push metrics to Weave Cloud to observe the
topology of the app and explore how it works. Weave Scope Probe monitors the network traffic and builds the
topology graph in real-time, augmented with metadata from Docker API along with various system metrics.
