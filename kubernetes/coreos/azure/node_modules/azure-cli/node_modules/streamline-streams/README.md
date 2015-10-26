**Warning**: this module is the original stream API for streamline.js. It is now superseeded by the 
[ez-streams](https://github.com/Sage/ez-streams) package which provide a much richer API.

You can nevertheless use this module directly if you are only interested by the low level wrappers
around node streams.

This module provides:

* a generic `ReadableStream` wrapper with an asynchronous `stream.read(_[, len])` method.
* a generic `WritableStream` wrapper with an asynchronous `stream.write(_, buf[, encoding])` method.
* wrappers for HTTP and TCP request and response objects (client and server).

See the [API reference](lib/streams.md) for details.

## More information

The following blog articles give background information on this API design:

* [Asynchronous episode 3 – Adventures in event-land](http://bjouhier.wordpress.com/2011/04/25/asynchronous-episode-3-adventures-in-event-land/)
* [Node.js stream API: events or callbacks?](http://bjouhier.wordpress.com/2012/07/04/node-js-stream-api-events-or-callbacks/)