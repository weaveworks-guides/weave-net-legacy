Hi, it’s Ilya from Weaveworks team! Today I am going to show you how easy it is to get started with Weave 1.1 and later versions.

I have two machines here that had just been provisioned with a Linux base image that includes Docker.

Firstly, I am installing Weave using the instructions from the docs — download it into `/usr/local/bin` using
`curl` and set the executable permission, same on both machines. Next I will launch all of Weave net & Run services.

Here I have native host-level DNS provided for me, so I can simply type `weave launch weave-02`, which is the hostname of the second machine. Then I will run, `weave launch weave-01` on the other machine.

Now the Weave cluster is fully connected and I have WeaveDNS for simple container discovery as well as the Docker API proxy, which will allow me to use Docker `run` command directly.

Next, I will need to set `DOCKER_HOST` environment variable, for which there is a command — `weave env`. So I am going to evaluate this in the current shell.

Same on the second machine - `eval $(weave env)`.

Done with the setup, clear the output.

Now I am all set to run some containers!

Here, on the first host I will run a netcat server named “hello`, using plain ubuntu image, really nothing special. The server will listen on port 1234 and will print message to the standard output.

And, on the other host, I want to run an interactive container to test the server. For this I want to use the same ubuntu image...

First,  I’ll ping the server... Great, that worked!

Let's just send it a message across, “Hello, Weave!” — Excellent, this works!

Thank you for watching! Do make sure to subscribe to our YouTube channel and follow us on Twitter @weaveworks ;v)
