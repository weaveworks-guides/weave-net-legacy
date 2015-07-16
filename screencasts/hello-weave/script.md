Hi, it’s Ilya from Weaveworks team! Today I am going to show you how easy it is to get started with Weave 1.0.

I have two machines here that had just been provisioned with a Linux base image that includes Docker.

Firstly, I am installing Weave using the instructions from the docs — download the script into `/usr/local/bin` using
`curl` and set the executable permission on it, same on both machines. Next I will launch Weave services.

Here I have native host-level DNS provided for me, so I can simply type `weave launch weave-02`, which is the hostname of the second machine. Then I will run, `weave launch weave-01` on the other machine.

Now the Weave cluster is fully connected and I am launching WeaveDNS for simple container discovery and the Docker API proxy, which will allow me to use Docker `run` command directly.

I need to run `weave launch-dns` and `weave launch-proxy` on both of the machines, but no arguments required.

Next, I need to set DOCKER_HOST environment variable, for which there is a command — `weave proxy-env`. So I am going to evaluate this in the current shell.

And same on the second machine - `eval $(weave proxy-env)`.

Done launching, and clear the output.

Now I am all set to run some containers!

Here, on the first host I will run a netcat server named “hello`, using plain ubuntu image, really nothing special. The server will listen on port 1234 and will print message on standard output.

And, on the other host, I want to run an interactive shell to test the server I just deployed — so I will do `docker run -ti` and the same ubuntu image...

First, let me verify that I can reach the `hello` server, so I’ll ping it...

Great, now I will try making a TCP connection now and send it a message across, “Hello, Weave!” — Excellent, this works!

Thank you for watching! Do make sure to subscribe to our YouTube channel and follow us on Twitter @weaveworks ;v)
